//! BIP-352 Silent Payment transaction scanner with JSI bridge
//! Provides high-performance parallel scanning via FFI

use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

use bitcoin_hashes::{sha256t_hash_newtype, Hash, HashEngine};
use rayon::prelude::*;
use secp256k1::{PublicKey, Scalar, Secp256k1, SecretKey};
use serde::{Deserialize, Serialize};

// ============================================================================
// BIP-352 Tagged Hash
// ============================================================================

sha256t_hash_newtype! {
    pub struct SharedSecretTag = hash_str("BIP0352/SharedSecret");
    #[hash_newtype(forward)]
    pub struct SharedSecretHash(_);
}

// ============================================================================
// Data Types
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexerOutput {
    pub transaction_id: String,
    pub vout: u32,
    pub pub_key: String,
    pub value: u64,
    #[serde(default)]
    pub is_spent: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexerTransaction {
    pub id: String,
    pub block_height: u32,
    pub block_hash: String,
    pub block_time: u64,
    pub scan_tweak: String,
    pub outputs: Vec<IndexerOutput>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchedUTXO {
    pub txid: String,
    pub vout: u32,
    pub value: u64,
    pub height: u32,
    pub pub_key: String,
    pub tweak_hex: String,
    pub block_hash: String,
    pub block_time: u64,
    pub is_spent: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchScanResult {
    pub matched_utxos: Vec<MatchedUTXO>,
    pub transactions_scanned: usize,
    pub outputs_scanned: usize,
}

// ============================================================================
// Core Cryptographic Operations
// ============================================================================

fn compute_shared_secret_hash(shared_secret: &[u8; 33], output_index: u32) -> [u8; 32] {
    let mut engine = SharedSecretHash::engine();
    engine.input(shared_secret);
    engine.input(&output_index.to_be_bytes());
    SharedSecretHash::from_engine(engine).to_byte_array()
}

fn ecdh_shared_secret(
    scan_privkey: &SecretKey,
    scan_tweak_pubkey: &PublicKey,
) -> Result<[u8; 33], &'static str> {
    let shared_secret = secp256k1::ecdh::shared_secret_point(scan_tweak_pubkey, scan_privkey);
    let shared_secret_pubkey = PublicKey::from_slice(&[&[0x04], shared_secret.as_slice()].concat())
        .map_err(|_| "Failed to create pubkey from shared secret")?;
    Ok(shared_secret_pubkey.serialize())
}

fn derive_expected_pubkey(
    secp: &Secp256k1<secp256k1::VerifyOnly>,
    spend_pubkey: &PublicKey,
    tweak_hash: &[u8; 32],
) -> Result<String, &'static str> {
    let tweak_scalar = Scalar::from_be_bytes(*tweak_hash)
        .map_err(|_| "Invalid tweak scalar")?;
    let expected_pubkey = spend_pubkey
        .add_exp_tweak(secp, &tweak_scalar)
        .map_err(|_| "Tweak addition failed")?;
    Ok(hex::encode(&expected_pubkey.serialize()[1..33]))
}

// ============================================================================
// Transaction Scanning
// ============================================================================

fn build_output_map(outputs: &[IndexerOutput]) -> HashMap<String, &IndexerOutput> {
    outputs
        .iter()
        .map(|o| (o.pub_key.to_lowercase(), o))
        .collect()
}

fn scan_transaction(
    secp: &Secp256k1<secp256k1::VerifyOnly>,
    scan_privkey: &SecretKey,
    spend_pubkey: &PublicKey,
    tx: &IndexerTransaction,
) -> Vec<MatchedUTXO> {
    let scan_tweak_pubkey = match parse_scan_tweak(&tx.scan_tweak) {
        Ok(pk) => pk,
        Err(_) => return Vec::new(),
    };

    let shared_secret = match ecdh_shared_secret(scan_privkey, &scan_tweak_pubkey) {
        Ok(secret) => secret,
        Err(_) => return Vec::new(),
    };

    let output_map = build_output_map(&tx.outputs);
    scan_outputs(secp, spend_pubkey, &shared_secret, &output_map, tx)
}

fn parse_scan_tweak(scan_tweak_hex: &str) -> Result<PublicKey, &'static str> {
    let bytes = hex::decode(scan_tweak_hex)
        .map_err(|_| "Invalid hex in scan tweak")?;
    if bytes.len() != 33 {
        return Err("Scan tweak must be 33 bytes");
    }
    PublicKey::from_slice(&bytes)
        .map_err(|_| "Invalid public key in scan tweak")
}

fn scan_outputs(
    secp: &Secp256k1<secp256k1::VerifyOnly>,
    spend_pubkey: &PublicKey,
    shared_secret: &[u8; 33],
    output_map: &HashMap<String, &IndexerOutput>,
    tx: &IndexerTransaction,
) -> Vec<MatchedUTXO> {
    let mut matches = Vec::new();

    for k in 0..tx.outputs.len() as u32 {
        let tweak_hash = compute_shared_secret_hash(shared_secret, k);
        
        let expected_xonly = match derive_expected_pubkey(secp, spend_pubkey, &tweak_hash) {
            Ok(xonly) => xonly,
            Err(_) => continue,
        };

        if let Some(output) = output_map.get(&expected_xonly) {
            matches.push(create_matched_utxo(output, tx, tweak_hash));
        }
    }

    matches
}

fn create_matched_utxo(
    output: &IndexerOutput,
    tx: &IndexerTransaction,
    tweak_hash: [u8; 32],
) -> MatchedUTXO {
    MatchedUTXO {
        txid: tx.id.clone(),
        vout: output.vout,
        value: output.value,
        height: tx.block_height,
        pub_key: output.pub_key.clone(),
        tweak_hex: hex::encode(tweak_hash),
        block_hash: tx.block_hash.clone(),
        block_time: tx.block_time,
        is_spent: output.is_spent,
    }
}

// ============================================================================
// Batch Processing
// ============================================================================

fn process_transactions_parallel(
    scan_privkey: &SecretKey,
    spend_pubkey: &PublicKey,
    transactions: &[IndexerTransaction],
) -> BatchScanResult {
    let secp = Secp256k1::verification_only();
    let total_outputs: usize = transactions.iter().map(|tx| tx.outputs.len()).sum();

    let matched_utxos: Vec<MatchedUTXO> = transactions
        .par_iter()
        .flat_map(|tx| scan_transaction(&secp, scan_privkey, spend_pubkey, tx))
        .collect();

    BatchScanResult {
        matched_utxos,
        transactions_scanned: transactions.len(),
        outputs_scanned: total_outputs,
    }
}

// ============================================================================
// FFI Interface
// ============================================================================

#[unsafe(no_mangle)]
pub extern "C" fn sp_scan_transactions(
    scan_privkey_hex: *const c_char,
    spend_pubkey_hex: *const c_char,
    transactions_json: *const c_char,
) -> *const c_char {
    let result = scan_transactions_impl(scan_privkey_hex, spend_pubkey_hex, transactions_json);
    serialize_ffi_response(result)
}

#[unsafe(no_mangle)]
pub extern "C" fn sp_scan_single_transaction(
    scan_privkey_hex: *const c_char,
    spend_pubkey_hex: *const c_char,
    transaction_json: *const c_char,
) -> *const c_char {
    let result = scan_single_transaction_impl(scan_privkey_hex, spend_pubkey_hex, transaction_json);
    serialize_ffi_response(result)
}

#[unsafe(no_mangle)]
pub extern "C" fn free_rust_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

// ============================================================================
// FFI Implementation Details
// ============================================================================

fn scan_transactions_impl(
    scan_privkey_hex: *const c_char,
    spend_pubkey_hex: *const c_char,
    transactions_json: *const c_char,
) -> Result<String, String> {
    let scan_privkey = parse_privkey_from_ffi(scan_privkey_hex)?;
    let spend_pubkey = parse_pubkey_from_ffi(spend_pubkey_hex)?;
    let transactions = parse_transactions_from_ffi(transactions_json)?;

    let result = process_transactions_parallel(&scan_privkey, &spend_pubkey, &transactions);
    serde_json::to_string(&result).map_err(|e| format!("Serialization failed: {}", e))
}

fn scan_single_transaction_impl(
    scan_privkey_hex: *const c_char,
    spend_pubkey_hex: *const c_char,
    transaction_json: *const c_char,
) -> Result<String, String> {
    let scan_privkey = parse_privkey_from_ffi(scan_privkey_hex)?;
    let spend_pubkey = parse_pubkey_from_ffi(spend_pubkey_hex)?;
    let transaction = parse_single_transaction_from_ffi(transaction_json)?;

    let secp = Secp256k1::verification_only();
    let matched = scan_transaction(&secp, &scan_privkey, &spend_pubkey, &transaction);
    serde_json::to_string(&matched).map_err(|e| format!("Serialization failed: {}", e))
}

fn parse_privkey_from_ffi(ptr: *const c_char) -> Result<SecretKey, String> {
    if ptr.is_null() {
        return Err("Null pointer for scan_privkey".to_string());
    }
    let hex_str = unsafe {
        CStr::from_ptr(ptr)
            .to_str()
            .map_err(|_| "Invalid UTF-8 in scan_privkey")?
    };
    let bytes = hex::decode(hex_str).map_err(|e| format!("Invalid hex: {}", e))?;
    SecretKey::from_slice(&bytes).map_err(|e| format!("Invalid private key: {}", e))
}

fn parse_pubkey_from_ffi(ptr: *const c_char) -> Result<PublicKey, String> {
    if ptr.is_null() {
        return Err("Null pointer for spend_pubkey".to_string());
    }
    let hex_str = unsafe {
        CStr::from_ptr(ptr)
            .to_str()
            .map_err(|_| "Invalid UTF-8 in spend_pubkey")?
    };
    let bytes = hex::decode(hex_str).map_err(|e| format!("Invalid hex: {}", e))?;
    PublicKey::from_slice(&bytes).map_err(|e| format!("Invalid public key: {}", e))
}

fn parse_transactions_from_ffi(ptr: *const c_char) -> Result<Vec<IndexerTransaction>, String> {
    if ptr.is_null() {
        return Err("Null pointer for transactions_json".to_string());
    }
    let json_str = unsafe {
        CStr::from_ptr(ptr)
            .to_str()
            .map_err(|_| "Invalid UTF-8 in transactions_json")?
    };
    serde_json::from_str(json_str).map_err(|e| format!("Invalid JSON: {}", e))
}

fn parse_single_transaction_from_ffi(ptr: *const c_char) -> Result<IndexerTransaction, String> {
    if ptr.is_null() {
        return Err("Null pointer for transaction_json".to_string());
    }
    let json_str = unsafe {
        CStr::from_ptr(ptr)
            .to_str()
            .map_err(|_| "Invalid UTF-8 in transaction_json")?
    };
    serde_json::from_str(json_str).map_err(|e| format!("Invalid JSON: {}", e))
}

fn serialize_ffi_response(result: Result<String, String>) -> *const c_char {
    let response = match result {
        Ok(json) => json,
        Err(error) => serde_json::json!({ "error": error }).to_string(),
    };
    match CString::new(response) {
        Ok(cstring) => cstring.into_raw(),
        Err(_) => {
            // Response contained a NUL byte; return a safe fallback error
            CString::new(r#"{"error":"Response serialization failed"}"#)
                .expect("Fallback error string is valid")
                .into_raw()
        }
    }
}

// ============================================================================
// Tests
// ============================================================================
//
// Design note: the expected values in these tests are computed from the
// *sender's* side of BIP-352, using different secp256k1 APIs than the scanner
// uses. A test that built a fixture with `derive_expected_pubkey` and then
// asserted `scan_transaction` finds it would be circular — it would pass even
// if the crypto were completely wrong. Instead:
//
//   * ECDH is cross-checked as `B_scan * a` (mul_tweak) against the scanner's
//     `A * b_scan` (shared_secret_point).
//   * `P_k = B_spend + t_k*G` is built with `from_secret_key` + `combine`,
//     against the scanner's `add_exp_tweak`.
//   * The BIP-340 tagged hash is reimplemented by hand from raw sha256,
//     bypassing the `sha256t_hash_newtype!` macro.
//
// NOTE: BIP-352 labels are not supported by this scanner. It only ever checks
// `P_k = B_spend + t_k*G`, never `B_spend + t_k*G + label*G`. That is correct
// for the label-less silent payment addresses this wallet derives.

#[cfg(test)]
mod tests {
    use super::*;
    use bitcoin_hashes::sha256;

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /// Deterministic, valid, non-zero secret key. Avoids the `rand`
    /// dev-dependency so every run is reproducible.
    fn sk(tag: u8) -> SecretKey {
        let mut bytes = [0u8; 32];
        bytes[0] = 0x01; // comfortably below the curve order
        bytes[31] = tag;
        SecretKey::from_slice(&bytes).expect("test secret key is valid")
    }

    /// Signing-capable context. `PublicKey::from_secret_key` requires
    /// `C: Signing`, which `Secp256k1<VerifyOnly>` does not satisfy.
    fn full_ctx() -> Secp256k1<secp256k1::All> {
        Secp256k1::new()
    }

    /// The concrete context type every scanning function under test demands.
    fn verify_ctx() -> Secp256k1<secp256k1::VerifyOnly> {
        Secp256k1::verification_only()
    }

    /// Independent BIP-340 tagged hash: `sha256(sha256(tag) || sha256(tag) || msg)`.
    ///
    /// Deliberately does not use `SharedSecretHash`, so comparing against it
    /// proves the production tag string rather than restating it.
    fn tagged_hash_manual(tag: &str, msg: &[u8]) -> [u8; 32] {
        let tag_hash = sha256::Hash::hash(tag.as_bytes()).to_byte_array();
        let mut engine = sha256::Hash::engine();
        engine.input(&tag_hash);
        engine.input(&tag_hash);
        engine.input(msg);
        sha256::Hash::from_engine(engine).to_byte_array()
    }

    fn xonly_hex(pubkey: &PublicKey) -> String {
        hex::encode(&pubkey.serialize()[1..33])
    }

    struct Fixture {
        b_scan: SecretKey,
        b_spend: SecretKey,
        spend_pubkey: PublicKey,
        tx: IndexerTransaction,
        /// `t_k` for the planted output, computed sender-side.
        expected_tweak: [u8; 32],
        /// x-only hex of the planted output's public key.
        expected_xonly: String,
    }

    /// Build a transaction whose output at index `k` is a genuine silent
    /// payment to `(b_scan, b_spend)`, with unrelated decoys elsewhere.
    ///
    /// Everything is derived from the SENDER's perspective via `mul_tweak` +
    /// `combine`, never touching `ecdh_shared_secret`,
    /// `compute_shared_secret_hash`, or `derive_expected_pubkey`.
    fn build_matching_tx(
        b_scan: &SecretKey,
        b_spend: &SecretKey,
        a_ephemeral: &SecretKey,
        k: u32,
        n_outputs: u32,
    ) -> Fixture {
        assert!(k < n_outputs, "k must index a real output");
        let s = full_ctx();

        let scan_pubkey = PublicKey::from_secret_key(&s, b_scan);
        let spend_pubkey = PublicKey::from_secret_key(&s, b_spend);
        // The indexer hands us the ephemeral pubkey A as `scanTweak`.
        let scan_tweak_pub = PublicKey::from_secret_key(&s, a_ephemeral);

        // Sender ECDH: B_scan * a. The scanner computes A * b_scan.
        let a_scalar =
            Scalar::from_be_bytes(a_ephemeral.secret_bytes()).expect("ephemeral key in range");
        let ecdh_sender = scan_pubkey
            .mul_tweak(&s, &a_scalar)
            .expect("sender-side ecdh")
            .serialize();

        // t_k = tagged_hash("BIP0352/SharedSecret", ecdh || be32(k))
        let mut msg = Vec::with_capacity(37);
        msg.extend_from_slice(&ecdh_sender);
        msg.extend_from_slice(&k.to_be_bytes());
        let t_k = tagged_hash_manual("BIP0352/SharedSecret", &msg);

        // P_k = B_spend + t_k*G, via from_secret_key + combine.
        let t_k_sk = SecretKey::from_slice(&t_k).expect("t_k is a valid scalar");
        let t_k_point = PublicKey::from_secret_key(&s, &t_k_sk);
        let p_k = spend_pubkey.combine(&t_k_point).expect("point addition");
        let expected_xonly = xonly_hex(&p_k);

        let outputs = (0..n_outputs)
            .map(|i| {
                let pub_key = if i == k {
                    expected_xonly.clone()
                } else {
                    let decoy = PublicKey::from_secret_key(&s, &sk(200u8.wrapping_add(i as u8)));
                    xonly_hex(&decoy)
                };
                IndexerOutput {
                    transaction_id: "output-level-id".to_string(),
                    vout: i,
                    pub_key,
                    value: 1000 + i as u64,
                    is_spent: false,
                }
            })
            .collect();

        let tx = IndexerTransaction {
            id: "aa".repeat(32),
            block_height: 840_000,
            block_hash: "bb".repeat(32),
            block_time: 1_700_000_000,
            scan_tweak: hex::encode(scan_tweak_pub.serialize()),
            outputs,
        };

        Fixture {
            b_scan: *b_scan,
            b_spend: *b_spend,
            spend_pubkey,
            tx,
            expected_tweak: t_k,
            expected_xonly,
        }
    }

    /// A transaction with no outputs for us, using a valid but unrelated tweak.
    fn build_non_matching_tx(n_outputs: u32) -> IndexerTransaction {
        let s = full_ctx();
        let scan_tweak_pub = PublicKey::from_secret_key(&s, &sk(99));
        let outputs = (0..n_outputs)
            .map(|i| IndexerOutput {
                transaction_id: "output-level-id".to_string(),
                vout: i,
                pub_key: xonly_hex(&PublicKey::from_secret_key(&s, &sk(150u8.wrapping_add(i as u8)))),
                value: 500,
                is_spent: false,
            })
            .collect();
        IndexerTransaction {
            id: "cc".repeat(32),
            block_height: 800_000,
            block_hash: "dd".repeat(32),
            block_time: 1_600_000_000,
            scan_tweak: hex::encode(scan_tweak_pub.serialize()),
            outputs,
        }
    }

    /// `IndexerTransaction` only derives `Deserialize`, so tests build the wire
    /// JSON explicitly. Keeps struct-level and FFI-level tests on one fixture.
    fn tx_to_json(tx: &IndexerTransaction) -> serde_json::Value {
        serde_json::json!({
            "id": tx.id,
            "blockHeight": tx.block_height,
            "blockHash": tx.block_hash,
            "blockTime": tx.block_time,
            "scanTweak": tx.scan_tweak,
            "outputs": tx.outputs.iter().map(|o| serde_json::json!({
                "transactionId": o.transaction_id,
                "vout": o.vout,
                "pubKey": o.pub_key,
                "value": o.value,
                "isSpent": o.is_spent,
            })).collect::<Vec<_>>(),
        })
    }

    /// Read a string returned by the FFI layer, freeing it through the
    /// library's own deallocator so the tests do not leak.
    fn take_ffi_string(ptr: *const c_char) -> String {
        assert!(!ptr.is_null(), "FFI returned a null pointer");
        let owned = unsafe { CStr::from_ptr(ptr) }
            .to_str()
            .expect("FFI response is valid UTF-8")
            .to_owned();
        free_rust_string(ptr as *mut c_char);
        owned
    }

    // ------------------------------------------------------------------
    // compute_shared_secret_hash
    // ------------------------------------------------------------------

    #[test]
    fn shared_secret_hash_equals_hand_built_bip340_tagged_hash() {
        let shared_secret = [0x02u8; 33];
        let k: u32 = 7;

        let mut msg = shared_secret.to_vec();
        msg.extend_from_slice(&k.to_be_bytes());

        assert_eq!(
            compute_shared_secret_hash(&shared_secret, k),
            tagged_hash_manual("BIP0352/SharedSecret", &msg),
            "tag string or tagged-hash construction changed"
        );
    }

    #[test]
    fn shared_secret_hash_encodes_output_index_big_endian() {
        let ss = [0x03u8; 33];

        let mut be = ss.to_vec();
        be.extend_from_slice(&[0x00, 0x00, 0x00, 0x01]);
        assert_eq!(
            compute_shared_secret_hash(&ss, 1),
            tagged_hash_manual("BIP0352/SharedSecret", &be)
        );

        let mut le = ss.to_vec();
        le.extend_from_slice(&[0x01, 0x00, 0x00, 0x00]);
        assert_ne!(
            compute_shared_secret_hash(&ss, 1),
            tagged_hash_manual("BIP0352/SharedSecret", &le),
            "output index must be big-endian"
        );
    }

    #[test]
    fn shared_secret_hash_is_deterministic() {
        let ss = [0x02u8; 33];
        assert_eq!(
            compute_shared_secret_hash(&ss, 3),
            compute_shared_secret_hash(&ss, 3)
        );
    }

    #[test]
    fn shared_secret_hash_varies_with_output_index() {
        let ss = [0x02u8; 33];
        let hashes: Vec<[u8; 32]> = (0..5).map(|k| compute_shared_secret_hash(&ss, k)).collect();
        for i in 0..hashes.len() {
            for j in (i + 1)..hashes.len() {
                assert_ne!(hashes[i], hashes[j], "k={i} and k={j} collided");
            }
        }
    }

    #[test]
    fn shared_secret_hash_varies_with_shared_secret() {
        assert_ne!(
            compute_shared_secret_hash(&[0x02u8; 33], 0),
            compute_shared_secret_hash(&[0x03u8; 33], 0)
        );
    }

    // ------------------------------------------------------------------
    // ecdh_shared_secret
    // ------------------------------------------------------------------

    #[test]
    fn ecdh_matches_independently_computed_sender_side_secret() {
        let s = full_ctx();
        let b_scan = sk(11);
        let a_ephemeral = sk(22);

        let scan_pubkey = PublicKey::from_secret_key(&s, &b_scan);
        let scan_tweak_pub = PublicKey::from_secret_key(&s, &a_ephemeral);

        // Receiver path (code under test).
        let receiver = ecdh_shared_secret(&b_scan, &scan_tweak_pub).expect("receiver ecdh");

        // Sender path, via a different API.
        let a_scalar = Scalar::from_be_bytes(a_ephemeral.secret_bytes()).unwrap();
        let sender = scan_pubkey.mul_tweak(&s, &a_scalar).unwrap().serialize();

        assert_eq!(receiver, sender, "ECDH duality a*B_scan == b_scan*A violated");
    }

    #[test]
    fn ecdh_returns_a_compressed_point() {
        let s = full_ctx();
        let secret = ecdh_shared_secret(&sk(11), &PublicKey::from_secret_key(&s, &sk(22))).unwrap();
        assert_eq!(secret.len(), 33);
        assert!(
            matches!(secret[0], 0x02 | 0x03),
            "expected a compressed pubkey prefix, got {:#04x}",
            secret[0]
        );
    }

    #[test]
    fn ecdh_varies_with_scan_key() {
        let s = full_ctx();
        let tweak = PublicKey::from_secret_key(&s, &sk(22));
        assert_ne!(
            ecdh_shared_secret(&sk(11), &tweak).unwrap(),
            ecdh_shared_secret(&sk(12), &tweak).unwrap()
        );
    }

    #[test]
    fn ecdh_varies_with_scan_tweak() {
        let s = full_ctx();
        let b_scan = sk(11);
        assert_ne!(
            ecdh_shared_secret(&b_scan, &PublicKey::from_secret_key(&s, &sk(22))).unwrap(),
            ecdh_shared_secret(&b_scan, &PublicKey::from_secret_key(&s, &sk(23))).unwrap()
        );
    }

    // ------------------------------------------------------------------
    // derive_expected_pubkey
    // ------------------------------------------------------------------

    #[test]
    fn derive_expected_pubkey_matches_independent_point_addition() {
        let s = full_ctx();
        let spend_pubkey = PublicKey::from_secret_key(&s, &sk(42));
        let tweak = compute_shared_secret_hash(&[0x02u8; 33], 0);

        // Code under test uses add_exp_tweak; this uses from_secret_key + combine.
        let expected = spend_pubkey
            .combine(&PublicKey::from_secret_key(
                &s,
                &SecretKey::from_slice(&tweak).unwrap(),
            ))
            .unwrap();

        assert_eq!(
            derive_expected_pubkey(&verify_ctx(), &spend_pubkey, &tweak).unwrap(),
            xonly_hex(&expected)
        );
    }

    #[test]
    fn derive_expected_pubkey_returns_lowercase_xonly_hex() {
        let s = full_ctx();
        let spend_pubkey = PublicKey::from_secret_key(&s, &sk(42));
        let tweak = compute_shared_secret_hash(&[0x02u8; 33], 0);

        let hex_out = derive_expected_pubkey(&verify_ctx(), &spend_pubkey, &tweak).unwrap();

        assert_eq!(hex_out.len(), 64, "x-only key must be 32 bytes of hex");
        assert_eq!(hex_out, hex_out.to_lowercase());
        assert!(hex_out.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn derive_expected_pubkey_varies_with_tweak() {
        let s = full_ctx();
        let secp = verify_ctx();
        let spend_pubkey = PublicKey::from_secret_key(&s, &sk(42));
        assert_ne!(
            derive_expected_pubkey(&secp, &spend_pubkey, &compute_shared_secret_hash(&[2u8; 33], 0))
                .unwrap(),
            derive_expected_pubkey(&secp, &spend_pubkey, &compute_shared_secret_hash(&[2u8; 33], 1))
                .unwrap()
        );
    }

    #[test]
    fn derive_expected_pubkey_varies_with_spend_key() {
        let s = full_ctx();
        let secp = verify_ctx();
        let tweak = compute_shared_secret_hash(&[0x02u8; 33], 0);
        assert_ne!(
            derive_expected_pubkey(&secp, &PublicKey::from_secret_key(&s, &sk(42)), &tweak).unwrap(),
            derive_expected_pubkey(&secp, &PublicKey::from_secret_key(&s, &sk(43)), &tweak).unwrap()
        );
    }

    // ------------------------------------------------------------------
    // parse_scan_tweak
    // ------------------------------------------------------------------

    #[test]
    fn parse_scan_tweak_accepts_a_compressed_pubkey() {
        let s = full_ctx();
        let pubkey = PublicKey::from_secret_key(&s, &sk(7));
        assert_eq!(
            parse_scan_tweak(&hex::encode(pubkey.serialize())).unwrap(),
            pubkey
        );
    }

    #[test]
    fn parse_scan_tweak_is_case_insensitive() {
        let s = full_ctx();
        let pubkey = PublicKey::from_secret_key(&s, &sk(7));
        assert_eq!(
            parse_scan_tweak(&hex::encode(pubkey.serialize()).to_uppercase()).unwrap(),
            pubkey
        );
    }

    #[test]
    fn parse_scan_tweak_rejects_non_hex() {
        assert_eq!(
            parse_scan_tweak("zz".repeat(33).as_str()),
            Err("Invalid hex in scan tweak")
        );
    }

    #[test]
    fn parse_scan_tweak_rejects_odd_length_hex() {
        assert_eq!(parse_scan_tweak("abc"), Err("Invalid hex in scan tweak"));
    }

    #[test]
    fn parse_scan_tweak_rejects_uncompressed_pubkey_on_length() {
        // A valid 65-byte uncompressed key still fails: the length check runs
        // before parsing.
        let s = full_ctx();
        let uncompressed = PublicKey::from_secret_key(&s, &sk(7)).serialize_uncompressed();
        assert_eq!(uncompressed.len(), 65);
        assert_eq!(
            parse_scan_tweak(&hex::encode(uncompressed)),
            Err("Scan tweak must be 33 bytes")
        );
    }

    #[test]
    fn parse_scan_tweak_rejects_a_point_not_on_the_curve() {
        // Right length, valid prefix, but not a curve point.
        let mut bytes = [0xffu8; 33];
        bytes[0] = 0x02;
        assert_eq!(
            parse_scan_tweak(&hex::encode(bytes)),
            Err("Invalid public key in scan tweak")
        );
    }

    // ------------------------------------------------------------------
    // build_output_map
    // ------------------------------------------------------------------

    fn output(pub_key: &str, vout: u32) -> IndexerOutput {
        IndexerOutput {
            transaction_id: "t".to_string(),
            vout,
            pub_key: pub_key.to_string(),
            value: 1,
            is_spent: false,
        }
    }

    #[test]
    fn output_map_normalizes_keys_to_lowercase() {
        let outputs = vec![output("ABCDEF", 0)];
        let map = build_output_map(&outputs);
        assert!(map.contains_key("abcdef"));
        assert!(!map.contains_key("ABCDEF"));
    }

    #[test]
    fn output_map_is_empty_for_no_outputs() {
        assert!(build_output_map(&[]).is_empty());
    }

    #[test]
    fn output_map_collapses_duplicate_pubkeys() {
        // KNOWN LIMITATION: two outputs sharing a scriptPubKey is legal in
        // Bitcoin, but the map keeps only the last one, so the earlier UTXO
        // becomes unrecoverable. Real silent payments assign each output a
        // distinct k, so exploitability is near zero. Characterized, not fixed.
        let outputs = vec![output("aa", 0), output("aa", 1)];
        let map = build_output_map(&outputs);
        assert_eq!(map.len(), 1);
        assert_eq!(map.get("aa").unwrap().vout, 1, "last write wins");
    }

    // ------------------------------------------------------------------
    // scan_outputs / scan_transaction
    // ------------------------------------------------------------------

    #[test]
    fn scan_finds_a_payment_at_index_zero() {
        let f = build_matching_tx(&sk(11), &sk(12), &sk(13), 0, 1);
        let matched = scan_transaction(&verify_ctx(), &f.b_scan, &f.spend_pubkey, &f.tx);

        assert_eq!(matched.len(), 1);
        assert_eq!(matched[0].pub_key, f.expected_xonly);
        assert_eq!(matched[0].tweak_hex, hex::encode(f.expected_tweak));
    }

    #[test]
    fn scan_finds_a_payment_hidden_among_decoys() {
        let f = build_matching_tx(&sk(21), &sk(22), &sk(23), 2, 5);
        let matched = scan_transaction(&verify_ctx(), &f.b_scan, &f.spend_pubkey, &f.tx);

        assert_eq!(matched.len(), 1, "exactly one of five outputs is ours");
        assert_eq!(matched[0].vout, 2);
        assert_eq!(matched[0].pub_key, f.expected_xonly);
    }

    #[test]
    fn scan_finds_a_payment_at_the_last_index() {
        // Boundary: the k loop runs 0..outputs.len(), so the final index must
        // still be reachable.
        let f = build_matching_tx(&sk(24), &sk(25), &sk(26), 3, 4);
        let matched = scan_transaction(&verify_ctx(), &f.b_scan, &f.spend_pubkey, &f.tx);

        assert_eq!(matched.len(), 1);
        assert_eq!(matched[0].vout, 3);
    }

    #[test]
    fn scan_returns_nothing_for_an_unrelated_transaction() {
        let s = full_ctx();
        let tx = build_non_matching_tx(4);
        let matched = scan_transaction(
            &verify_ctx(),
            &sk(31),
            &PublicKey::from_secret_key(&s, &sk(32)),
            &tx,
        );
        assert!(matched.is_empty());
    }

    #[test]
    fn scan_returns_nothing_for_the_wrong_scan_key() {
        let f = build_matching_tx(&sk(41), &sk(42), &sk(43), 1, 3);
        // Same transaction, different wallet.
        let matched = scan_transaction(&verify_ctx(), &sk(44), &f.spend_pubkey, &f.tx);
        assert!(matched.is_empty());
    }

    #[test]
    fn scan_matches_an_uppercase_output_pubkey() {
        let mut f = build_matching_tx(&sk(51), &sk(52), &sk(53), 0, 2);
        f.tx.outputs[0].pub_key = f.tx.outputs[0].pub_key.to_uppercase();

        let matched = scan_transaction(&verify_ctx(), &f.b_scan, &f.spend_pubkey, &f.tx);
        assert_eq!(matched.len(), 1, "output map lowercases before lookup");
    }

    #[test]
    fn scan_returns_empty_for_a_malformed_scan_tweak() {
        let mut f = build_matching_tx(&sk(61), &sk(62), &sk(63), 0, 2);
        for bad in ["", "not-hex", "00", &"ab".repeat(33)] {
            f.tx.scan_tweak = bad.to_string();
            let matched = scan_transaction(&verify_ctx(), &f.b_scan, &f.spend_pubkey, &f.tx);
            assert!(matched.is_empty(), "expected no matches for tweak {bad:?}");
        }
    }

    #[test]
    fn matched_utxo_carries_transaction_level_metadata() {
        let f = build_matching_tx(&sk(71), &sk(72), &sk(73), 1, 3);
        let matched = scan_transaction(&verify_ctx(), &f.b_scan, &f.spend_pubkey, &f.tx);
        let m = &matched[0];

        // txid comes from the transaction, NOT from output.transaction_id.
        assert_eq!(m.txid, f.tx.id);
        assert_ne!(m.txid, f.tx.outputs[1].transaction_id);

        assert_eq!(m.height, f.tx.block_height);
        assert_eq!(m.block_hash, f.tx.block_hash);
        assert_eq!(m.block_time, f.tx.block_time);
        assert_eq!(m.vout, f.tx.outputs[1].vout);
        assert_eq!(m.value, f.tx.outputs[1].value);
        assert!(!m.is_spent);
    }

    #[test]
    fn matched_tweak_derives_a_private_key_that_controls_the_output() {
        // The contract with the TypeScript side: `tweakHex` must let the wallet
        // reconstruct the spending key. This cannot pass if the crypto is wrong.
        let s = full_ctx();
        let f = build_matching_tx(&sk(81), &sk(82), &sk(83), 2, 5);

        let matched = scan_transaction(&verify_ctx(), &f.b_scan, &f.spend_pubkey, &f.tx);
        assert_eq!(matched.len(), 1);

        // d = b_spend + t_k (mod n)
        let tweak: [u8; 32] = hex::decode(&matched[0].tweak_hex)
            .expect("tweak_hex is hex")
            .try_into()
            .expect("tweak is 32 bytes");
        let spend_key = f
            .b_spend
            .add_tweak(&Scalar::from_be_bytes(tweak).expect("tweak in range"))
            .expect("d = b_spend + t_k");

        assert_eq!(
            xonly_hex(&PublicKey::from_secret_key(&s, &spend_key)),
            matched[0].pub_key.to_lowercase(),
            "returned tweak does not yield a spending key for the matched output"
        );
    }

    // ------------------------------------------------------------------
    // process_transactions_parallel
    // ------------------------------------------------------------------

    #[test]
    fn batch_scan_counts_transactions_and_outputs() {
        let f = build_matching_tx(&sk(91), &sk(92), &sk(93), 0, 3);
        let txs = vec![f.tx.clone(), build_non_matching_tx(4), build_non_matching_tx(2)];

        let result = process_transactions_parallel(&f.b_scan, &f.spend_pubkey, &txs);

        assert_eq!(result.transactions_scanned, 3);
        assert_eq!(result.outputs_scanned, 9);
        assert_eq!(result.matched_utxos.len(), 1);
    }

    #[test]
    fn batch_scan_handles_an_empty_batch() {
        let s = full_ctx();
        let result =
            process_transactions_parallel(&sk(1), &PublicKey::from_secret_key(&s, &sk(2)), &[]);

        assert_eq!(result.transactions_scanned, 0);
        assert_eq!(result.outputs_scanned, 0);
        assert!(result.matched_utxos.is_empty());
    }

    #[test]
    fn batch_scan_finds_payments_across_several_transactions() {
        let (b_scan, b_spend) = (sk(101), sk(102));
        let mut txs = Vec::new();
        for (i, k) in [(0u8, 0u32), (1, 1), (2, 2)] {
            let mut f = build_matching_tx(&b_scan, &b_spend, &sk(110 + i), k, 3);
            f.tx.id = format!("{:02x}", i).repeat(32);
            txs.push(f.tx);
        }
        let spend_pubkey = PublicKey::from_secret_key(&full_ctx(), &b_spend);

        let result = process_transactions_parallel(&b_scan, &spend_pubkey, &txs);
        assert_eq!(result.matched_utxos.len(), 3);
    }

    #[test]
    fn batch_scan_preserves_input_order_deterministically() {
        // rayon's flat_map + collect must keep results in input order, or the
        // TypeScript side sees UTXOs shuffle between runs.
        let (b_scan, b_spend) = (sk(121), sk(122));
        let spend_pubkey = PublicKey::from_secret_key(&full_ctx(), &b_spend);

        let mut txs = Vec::new();
        for i in 0..60u32 {
            if i % 3 == 0 {
                let mut f = build_matching_tx(&b_scan, &b_spend, &sk(130), 0, 2);
                f.tx.id = format!("{:064x}", i);
                txs.push(f.tx);
            } else {
                let mut tx = build_non_matching_tx(2);
                tx.id = format!("{:064x}", i);
                txs.push(tx);
            }
        }

        let first = process_transactions_parallel(&b_scan, &spend_pubkey, &txs);
        assert_eq!(first.matched_utxos.len(), 20);

        let ids: Vec<&str> = first.matched_utxos.iter().map(|m| m.txid.as_str()).collect();
        let mut sorted = ids.clone();
        sorted.sort_unstable();
        assert_eq!(ids, sorted, "results must follow input order");

        for _ in 0..3 {
            let again = process_transactions_parallel(&b_scan, &spend_pubkey, &txs);
            let again_ids: Vec<&str> = again.matched_utxos.iter().map(|m| m.txid.as_str()).collect();
            assert_eq!(ids, again_ids, "batch scan is not deterministic");
        }
    }

    #[test]
    fn batch_scan_skips_transactions_with_bad_tweaks_without_failing_the_batch() {
        let f = build_matching_tx(&sk(141), &sk(142), &sk(143), 0, 2);
        let mut broken = build_non_matching_tx(2);
        broken.scan_tweak = "not-a-pubkey".to_string();

        let txs = vec![broken, f.tx.clone()];
        let result = process_transactions_parallel(&f.b_scan, &f.spend_pubkey, &txs);

        assert_eq!(result.matched_utxos.len(), 1, "good tx still scanned");
        assert_eq!(result.transactions_scanned, 2);
    }

    // ------------------------------------------------------------------
    // Wire contract (serde)
    // ------------------------------------------------------------------

    #[test]
    fn transaction_deserializes_from_camel_case_json() {
        let json = r#"{
            "id": "abc",
            "blockHeight": 840000,
            "blockHash": "def",
            "blockTime": 1700000000,
            "scanTweak": "02aa",
            "outputs": [
                {"transactionId": "abc", "vout": 1, "pubKey": "ff", "value": 5000, "isSpent": true}
            ]
        }"#;

        let tx: IndexerTransaction = serde_json::from_str(json).unwrap();
        assert_eq!(tx.id, "abc");
        assert_eq!(tx.block_height, 840_000);
        assert_eq!(tx.block_time, 1_700_000_000);
        assert_eq!(tx.scan_tweak, "02aa");
        assert_eq!(tx.outputs[0].vout, 1);
        assert_eq!(tx.outputs[0].value, 5000);
        assert!(tx.outputs[0].is_spent);
    }

    #[test]
    fn output_is_spent_defaults_to_false_when_absent() {
        let json = r#"{"transactionId": "abc", "vout": 0, "pubKey": "ff", "value": 1}"#;
        let output: IndexerOutput = serde_json::from_str(json).unwrap();
        assert!(!output.is_spent);
    }

    #[test]
    fn output_rejects_a_numeric_is_spent() {
        // KNOWN LIMITATION: helpers/silent-payments/types.ts declares
        // `isSpent: boolean | number` ("0 = false, 1 = true") and
        // modules/RustJsiBridge.ts propagates that union, but Rust demands a
        // real bool. Because parse_transactions_from_ffi deserializes the whole
        // array at once, a single numeric isSpent fails the ENTIRE batch.
        // Characterized here; the fix (a bool-or-int serde shim) is production
        // code and belongs in its own PR.
        let json = r#"{"transactionId": "abc", "vout": 0, "pubKey": "ff", "value": 1, "isSpent": 0}"#;
        let err = serde_json::from_str::<IndexerOutput>(json).unwrap_err().to_string();
        assert!(
            err.contains("invalid type: integer"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn output_requires_transaction_id_even_though_it_is_never_read() {
        // KNOWN LIMITATION: `transaction_id` has no #[serde(default)], yet
        // create_matched_utxo always uses tx.id instead. Gratuitous strictness
        // on the wire contract; a follow-up could relax it.
        let json = r#"{"vout": 0, "pubKey": "ff", "value": 1}"#;
        let err = serde_json::from_str::<IndexerOutput>(json).unwrap_err().to_string();
        assert!(err.contains("transactionId"), "unexpected error: {err}");
    }

    #[test]
    fn batch_result_serializes_with_the_camel_case_keys_typescript_expects() {
        let f = build_matching_tx(&sk(151), &sk(152), &sk(153), 0, 1);
        let result = process_transactions_parallel(&f.b_scan, &f.spend_pubkey, &[f.tx]);

        let value: serde_json::Value =
            serde_json::from_str(&serde_json::to_string(&result).unwrap()).unwrap();

        assert!(value.get("matchedUtxos").is_some());
        assert!(value.get("transactionsScanned").is_some());
        assert!(value.get("outputsScanned").is_some());

        let utxo = &value["matchedUtxos"][0];
        for key in [
            "txid",
            "vout",
            "value",
            "height",
            "pubKey",
            "tweakHex",
            "blockHash",
            "blockTime",
            "isSpent",
        ] {
            assert!(utxo.get(key).is_some(), "missing key {key} in MatchedUTXO");
        }
    }

    // ------------------------------------------------------------------
    // FFI boundary
    // ------------------------------------------------------------------

    #[test]
    fn scan_transactions_impl_returns_a_batch_result() {
        let f = build_matching_tx(&sk(161), &sk(162), &sk(163), 1, 3);

        let priv_hex = CString::new(hex::encode(f.b_scan.secret_bytes())).unwrap();
        let pub_hex = CString::new(hex::encode(f.spend_pubkey.serialize())).unwrap();
        let txs_json = CString::new(serde_json::json!([tx_to_json(&f.tx)]).to_string()).unwrap();

        let json = scan_transactions_impl(priv_hex.as_ptr(), pub_hex.as_ptr(), txs_json.as_ptr())
            .expect("scan succeeds");
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();

        assert_eq!(value["transactionsScanned"], 1);
        assert_eq!(value["outputsScanned"], 3);
        assert_eq!(value["matchedUtxos"].as_array().unwrap().len(), 1);
        assert_eq!(value["matchedUtxos"][0]["pubKey"], f.expected_xonly);
    }

    #[test]
    fn scan_single_transaction_impl_returns_a_bare_array() {
        // Note the asymmetry with sp_scan_transactions: this one returns a bare
        // JSON array of MatchedUTXO, not a BatchScanResult.
        let f = build_matching_tx(&sk(171), &sk(172), &sk(173), 0, 2);

        let priv_hex = CString::new(hex::encode(f.b_scan.secret_bytes())).unwrap();
        let pub_hex = CString::new(hex::encode(f.spend_pubkey.serialize())).unwrap();
        let tx_json = CString::new(tx_to_json(&f.tx).to_string()).unwrap();

        let json =
            scan_single_transaction_impl(priv_hex.as_ptr(), pub_hex.as_ptr(), tx_json.as_ptr())
                .expect("scan succeeds");

        assert!(json.starts_with('['), "expected a bare array, got: {json}");
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(value.is_array());
        assert!(value.get("matchedUtxos").is_none());
        assert_eq!(value.as_array().unwrap().len(), 1);
    }

    #[test]
    fn ffi_parsers_reject_null_pointers() {
        assert_eq!(
            parse_privkey_from_ffi(std::ptr::null()),
            Err("Null pointer for scan_privkey".to_string())
        );
        assert_eq!(
            parse_pubkey_from_ffi(std::ptr::null()),
            Err("Null pointer for spend_pubkey".to_string())
        );
        assert!(parse_transactions_from_ffi(std::ptr::null())
            .unwrap_err()
            .contains("Null pointer for transactions_json"));
        assert!(parse_single_transaction_from_ffi(std::ptr::null())
            .unwrap_err()
            .contains("Null pointer for transaction_json"));
    }

    #[test]
    fn ffi_parsers_reject_malformed_input() {
        let bad_hex = CString::new("nothex").unwrap();
        assert!(parse_privkey_from_ffi(bad_hex.as_ptr())
            .unwrap_err()
            .contains("Invalid hex"));

        let short_key = CString::new("00ff").unwrap();
        assert!(parse_privkey_from_ffi(short_key.as_ptr())
            .unwrap_err()
            .contains("Invalid private key"));

        let not_a_point = CString::new("02".to_string() + &"ff".repeat(32)).unwrap();
        assert!(parse_pubkey_from_ffi(not_a_point.as_ptr())
            .unwrap_err()
            .contains("Invalid public key"));

        let bad_json = CString::new("{not json}").unwrap();
        assert!(parse_transactions_from_ffi(bad_json.as_ptr())
            .unwrap_err()
            .contains("Invalid JSON"));
    }

    #[test]
    fn scan_impl_propagates_parse_errors() {
        let bad = CString::new("zz").unwrap();
        let good_json = CString::new("[]").unwrap();
        assert!(
            scan_transactions_impl(bad.as_ptr(), bad.as_ptr(), good_json.as_ptr()).is_err()
        );
    }

    #[test]
    fn serialize_ffi_response_wraps_errors_as_json() {
        assert_eq!(
            take_ffi_string(serialize_ffi_response(Err("boom".to_string()))),
            r#"{"error":"boom"}"#
        );
    }

    #[test]
    fn serialize_ffi_response_passes_success_through_unchanged() {
        assert_eq!(
            take_ffi_string(serialize_ffi_response(Ok(r#"{"ok":true}"#.to_string()))),
            r#"{"ok":true}"#
        );
    }

    #[test]
    fn serialize_ffi_response_falls_back_on_an_embedded_nul() {
        assert_eq!(
            take_ffi_string(serialize_ffi_response(Ok("a\0b".to_string()))),
            r#"{"error":"Response serialization failed"}"#
        );
    }

    #[test]
    fn exported_scan_entry_point_round_trips_through_c_strings() {
        let f = build_matching_tx(&sk(181), &sk(182), &sk(183), 0, 2);

        let priv_hex = CString::new(hex::encode(f.b_scan.secret_bytes())).unwrap();
        let pub_hex = CString::new(hex::encode(f.spend_pubkey.serialize())).unwrap();
        let txs_json = CString::new(serde_json::json!([tx_to_json(&f.tx)]).to_string()).unwrap();

        let out = take_ffi_string(sp_scan_transactions(
            priv_hex.as_ptr(),
            pub_hex.as_ptr(),
            txs_json.as_ptr(),
        ));

        let value: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(value["matchedUtxos"][0]["pubKey"], f.expected_xonly);
    }

    #[test]
    fn exported_scan_entry_point_reports_errors_as_json() {
        let bad = CString::new("zz").unwrap();
        let empty = CString::new("[]").unwrap();

        let out = take_ffi_string(sp_scan_transactions(
            bad.as_ptr(),
            bad.as_ptr(),
            empty.as_ptr(),
        ));

        let value: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert!(value.get("error").is_some(), "expected an error object: {out}");
    }

    #[test]
    fn free_rust_string_tolerates_null() {
        free_rust_string(std::ptr::null_mut());
    }
}
