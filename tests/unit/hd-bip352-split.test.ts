import { HDSilentPaymentsWallet } from '../../class/wallets/hd-bip352-wallet';
import { SilentPayment } from 'silent-payments';
import { ECPairFactory } from 'ecpair';
import ecc from '../../modules/noble_ecc';
import * as bitcoin from 'bitcoinjs-lib';

jest.mock('../../modules/Electrum', () => ({
  broadcastV2: jest.fn(async () => '1'.repeat(64)),
}));

const ECPair = ECPairFactory(ecc);

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function independentTaprootTweakedWif(internalWif: string): string {
  const keyPair = ECPair.fromWIF(internalWif);
  const tapInternalKey = keyPair.publicKey.subarray(1, 33);
  const tweakHash = bitcoin.crypto.taggedHash('TapTweak', tapInternalKey);
  return keyPair.tweak(tweakHash).toWIF();
}

function makeWallet(): HDSilentPaymentsWallet {
  const w = new HDSilentPaymentsWallet();
  w.setSecret(MNEMONIC);
  return w;
}

describe('getChangeAddresses', () => {
  it('returns N distinct sequential addresses without advancing the pointer', () => {
    const w = makeWallet();
    const base = w.next_free_change_address_index;
    const addrs: string[] = (w as any).getChangeAddresses(3);
    expect(addrs).toHaveLength(3);
    expect(new Set(addrs).size).toBe(3);
    expect(addrs[0]).toBe(w._getInternalAddressByIndex(base));
    expect(addrs[2]).toBe(w._getInternalAddressByIndex(base + 2));
    // planning must not consume indices: previews/RBF rebuilds would leak toward the gap limit
    expect(w.next_free_change_address_index).toBe(base);
  });

  it('is idempotent across repeated planning calls', () => {
    const w = makeWallet();
    const a = (w as any).getChangeAddresses(2);
    const b = (w as any).getChangeAddresses(2);
    expect(b).toEqual(a);
  });
});

describe('shuffleOutputs', () => {
  it('preserves the multiset of elements', () => {
    const w = makeWallet();
    const input = [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }];
    const out = (w as any).shuffleOutputs(input);
    expect(out).toHaveLength(5);
    expect(out.map((o: any) => o.v).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('reorders across trials (not always identity)', () => {
    const w = makeWallet();
    let reordered = false;
    for (let trial = 0; trial < 20 && !reordered; trial++) {
      const out = (w as any).shuffleOutputs([1, 2, 3, 4, 5]);
      if (out.join(',') !== '1,2,3,4,5') reordered = true;
    }
    expect(reordered).toBe(true);
  });
});

describe('planSplitTransaction', () => {
  const SP = 'sp1qexamplerecipientaddressxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  it('payment outputs all carry the sp address and sum to the payment value', () => {
    const w = makeWallet();
    const { outputs } = (w as any).planSplitTransaction(SP, 500_000, 120_000, 2);
    const payments = outputs.filter((o: any) => o.address === SP);
    expect(payments.length).toBeGreaterThanOrEqual(2);
    expect(payments.reduce((a: number, o: any) => a + o.value, 0)).toBe(500_000);
  });

  it('change outputs use distinct internal addresses (no reuse)', () => {
    const w = makeWallet();
    const { outputs, changeAddresses } = (w as any).planSplitTransaction(SP, 300_000, 5_000_000, 2);
    const changeOuts = outputs.filter((o: any) => o.address !== SP);
    expect(changeOuts.length).toBe(changeAddresses.length);
    expect(new Set(changeAddresses).size).toBe(changeAddresses.length);
  });

  it('returns a single payment output when not splittable', () => {
    const w = makeWallet();
    const { outputs } = (w as any).planSplitTransaction(SP, 60_000, 0, 500);
    const payments = outputs.filter((o: any) => o.address === SP);
    expect(payments).toEqual([{ address: SP, value: 60_000 }]);
  });

  it('splits at high fee rates if change is sufficient to fund extra output', () => {
    const w = makeWallet();
    const funded = (w as any).planSplitTransaction(SP, 500_000, 200_000, 50, 2);
    const fundedPayments = funded.outputs.filter((o: any) => o.address === SP);
    expect(fundedPayments.length).toBeGreaterThanOrEqual(2);
  });
});

describe('createTransaction (Case 2: plain, non-SP-tagged UTXOs) with splitPayment', () => {
  // Same fixture as hd-taproot-wallet.test.ts, so ext_0 is a known-good, signable P2TR address.
  const TAPROOT_MNEMONIC = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo glue';
  // Real BIP-352 test vector (see spSenderDerivation.test.ts) so bech32m decoding succeeds end-to-end.
  const SP_ADDRESS = 'sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj85c6qdfhjdpdjtdgqjuexzk6murw56suy3e0rd2cgqvycxttddwsvgxe2usfpxumr70xc9pkqwv';
  const regularUtxoBase = {
    height: 0,
    value: 500_000,
    address: 'bc1p4mc3hspc535vj2d9qcjmtynllv38u0lvfp8gs8npt64ejgtxszuq6t4ckj', // ext_0 of TAPROOT_MNEMONIC
    txid: 'e97f982766537c5330b50ef521bbcd8811971eb7cc9fd64bda45266136f27b82',
    vout: 0,
  };

  function makeRegularWallet(): HDSilentPaymentsWallet {
    const w = new HDSilentPaymentsWallet();
    w.setSecret(TAPROOT_MNEMONIC);
    return w;
  }

  // real fetched UTXOs carry .wif (populated at fetch time, see _fetchUtxo); the
  // parent's sp1-resolution path requires it, so replicate that here.
  function withWif(w: HDSilentPaymentsWallet) {
    return {
      ...regularUtxoBase,
      wif: w._getWifForAddress(regularUtxoBase.address),
    };
  }

  it('splits and signs a payment to an sp1 recipient funded by plain P2TR UTXOs', () => {
    const w = makeRegularWallet();
    const result: any = w.createTransaction(
      [withWif(w) as any],
      [{ address: SP_ADDRESS, value: 150_000 }],
      1,
      w._getInternalAddressByIndex(0),
      undefined,
      false,
      0,
      { enabled: true },
    );

    expect(result.tx).toBeDefined(); // standard BIP-86 tweak + signTaprootInput succeeded
    const changeSet = new Set(result.changeAddresses);
    const paymentOutputs = result.outputs.filter((o: any) => !changeSet.has(o.address));
    expect(paymentOutputs.length).toBeGreaterThanOrEqual(2); // actually split, not a silent no-op
    expect(paymentOutputs.reduce((a: number, o: any) => a + o.value, 0)).toBe(150_000);
    expect(new Set(paymentOutputs.map((o: any) => o.address)).size).toBe(paymentOutputs.length); // BIP-352 k-increment gives distinct addresses

    // Pin against an independently computed tweaked-key derivation: the address must come
    // from the TapTweak'd output key, not the untweaked internal key (the fund-loss bug).
    const expectedFirst = new SilentPayment().createTransaction(
      [{ txid: regularUtxoBase.txid, vout: regularUtxoBase.vout, wif: independentTaprootTweakedWif(withWif(w).wif), utxoType: 'p2tr' }],
      [{ address: SP_ADDRESS, value: 150_000 }],
    );
    expect(paymentOutputs.map((o: any) => o.address)).toContain(expectedFirst[0].address);

    // Change outputs must carry PSBT derivation metadata so an external signer (routeParams
    // .launchedBy) can recognize them as the wallet's own change rather than presenting them
    // as payments to unknown third parties.
    const psbtOutputs = result.psbt.data.outputs;
    const txOutputs = result.psbt.txOutputs;
    for (let i = 0; i < txOutputs.length; i++) {
      if (!changeSet.has(txOutputs[i].address)) continue;
      expect(psbtOutputs[i].tapInternalKey).toBeDefined();
      expect(psbtOutputs[i].tapBip32Derivation?.length).toBeGreaterThan(0);
    }
  });

  it('falls back to a plain single-output send when the payment is too small to split', () => {
    const w = makeRegularWallet();
    const result: any = w.createTransaction(
      [withWif(w) as any],
      [{ address: SP_ADDRESS, value: 10_000 }], // below the economic floor
      1,
      w._getInternalAddressByIndex(0),
      undefined,
      false,
      0,
      { enabled: true }, // splitPayment requested, but planner should decline
    );

    expect(result.tx).toBeDefined();
    expect(result.outputs).toHaveLength(2); // 1 payment + 1 change, same as a non-split send

    // Fallback path routes through the parent's createTransaction (abstract-hd-electrum-wallet.ts),
    // which must tweak the key exactly as the split path does — same input, same derived address.
    const changeAddress = w._getInternalAddressByIndex(0);
    const spOutput = result.outputs.find((o: any) => o.address !== changeAddress);
    const expected = new SilentPayment().createTransaction(
      [{ txid: regularUtxoBase.txid, vout: regularUtxoBase.vout, wif: independentTaprootTweakedWif(withWif(w).wif), utxoType: 'p2tr' }],
      [{ address: SP_ADDRESS, value: 10_000 }],
    );
    expect(spOutput.address).toBe(expected[0].address);
  });
});

describe('createTransaction (Case 1: SP-tagged UTXOs) with splitPayment', () => {
  const SP_ADDRESS = 'sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj85c6qdfhjdpdjtdgqjuexzk6murw56suy3e0rd2cgqvycxttddwsvgxe2usfpxumr70xc9pkqwv';

  it('splits and signs a payment to an sp1 recipient funded by SP UTXOs', () => {
    const w = makeWallet();

    const spendPubKey = w.getSpendPublicKey();
    const tweak = new Uint8Array(32);
    tweak[31] = 0x07;
    const tweakedPub = ecc.pointAddScalar(spendPubKey, tweak, true)!;
    const expectedOutputKey = Buffer.from(tweakedPub.subarray(1, 33));
    const p2trAddress = bitcoin.payments.p2tr({
      pubkey: expectedOutputKey,
    }).address!;

    const spUtxo = {
      txid: '1111111111111111111111111111111111111111111111111111111111111111',
      vout: 0,
      value: 500_000,
      tweak,
      address: p2trAddress,
      pubKey: expectedOutputKey.toString('hex'),
    };

    const result: any = w.createTransaction(
      [spUtxo as any],
      [{ address: SP_ADDRESS, value: 150_000 }],
      1,
      w._getInternalAddressByIndex(0),
      undefined,
      false,
      0,
      { enabled: true },
    );

    expect(result.tx).toBeDefined();
    const changeSet = new Set(result.changeAddresses);
    const paymentOutputs = result.outputs.filter((o: any) => !changeSet.has(o.address));
    expect(paymentOutputs.length).toBeGreaterThanOrEqual(2);
    expect(paymentOutputs.reduce((a: number, o: any) => a + o.value, 0)).toBe(150_000);
    expect(new Set(paymentOutputs.map((o: any) => o.address)).size).toBe(paymentOutputs.length);
  });
});

describe('obfuscateUnnecessaryInputHeuristic', () => {
  it('does not obfuscate if feeRate >= 10', () => {
    const w = makeWallet();
    const inputs = [
      { txid: '1', vout: 0, value: 1000 },
      { txid: '2', vout: 0, value: 1000 },
    ] as any;
    const rawOutputs = [{ address: 'sp1', value: 1500 }, { value: 500 }] as any;
    const available = [{ txid: '3', vout: 0, value: 5000, height: 1, address: 'a' }];

    const res = (w as any).obfuscateUnnecessaryInputHeuristic(inputs, rawOutputs, available, 10);
    expect(res.inputs).toHaveLength(2);
    expect(res.rawOutputs).toEqual(rawOutputs);
  });

  it('does not obfuscate if inputs <= 1', () => {
    const w = makeWallet();
    const inputs = [{ txid: '1', vout: 0, value: 1000 }] as any;
    const rawOutputs = [{ address: 'sp1', value: 500 }, { value: 500 }] as any;
    const available = [{ txid: '2', vout: 0, value: 5000, height: 1, address: 'a' }];

    const res = (w as any).obfuscateUnnecessaryInputHeuristic(inputs, rawOutputs, available, 5);
    expect(res.inputs).toHaveLength(1);
    expect(res.rawOutputs).toEqual(rawOutputs);
  });

  it('pulls in more inputs to make changeValue > maxInputValue', () => {
    const w = makeWallet();
    const inputs = [
      { txid: '1', vout: 0, value: 5000 },
      { txid: '2', vout: 0, value: 3000 },
    ] as any;
    // max input value is 5000, current change is 4000
    const rawOutputs = [{ address: 'sp1', value: 4000 }, { value: 4000 }] as any;
    const available = [{ txid: '3', vout: 0, value: 2000, height: 1, address: 'a' }];

    const res = (w as any).obfuscateUnnecessaryInputHeuristic(inputs, rawOutputs, available, 5);

    expect(res.inputs).toHaveLength(3);
    expect(res.inputs[2].txid).toBe('3');

    const newChange = res.rawOutputs.find((o: any) => !o.address)?.value;
    expect(newChange).toBeGreaterThan(5000); // Exceeds the max input value to break heuristic
  });

  // NOTE: every fixture below needs >= 2 selected inputs. obfuscateUnnecessaryInputHeuristic
  // returns early on `inputs.length <= 1`, so a single-input fixture passes these assertions
  // without ever reaching the precheck, the caps, or the bail-out being tested.

  it('stops at MAX_OBFUSCATION_INPUTS even when more inputs would reach the threshold', () => {
    const w = makeWallet();
    // max(selected) = 100,000 and change = 1,000, so crossing the threshold needs 6 additions
    // (1,000 + 6 x 19,710 = 119,260). The cap must stop at 2 and leave the threshold uncrossed
    // rather than linking four more coins chasing it.
    const inputs = [
      { txid: 'big', vout: 0, value: 100_000 },
      { txid: 'small', vout: 0, value: 20_000 },
    ] as any;
    const rawOutputs = [{ address: 'sp1', value: 118_000 }, { value: 1_000 }] as any;
    const available = Array.from({ length: 10 }, (_, i) => ({
      txid: `u${i}`,
      vout: 0,
      value: 20_000,
      height: 1,
      address: 'a',
    }));

    const res = (w as any).obfuscateUnnecessaryInputHeuristic(inputs, rawOutputs, available, 5);

    expect(res.inputs.length - inputs.length).toBe(2); // exactly the cap, not the 6 it would take
    const newChange = res.rawOutputs.find((o: any) => !o.address)?.value;
    expect(newChange).toBe(1_000 + 2 * (20_000 - Math.ceil(58 * 5))); // change credited for both
  });

  it('bails without adding anything when the target is provably unreachable', () => {
    const w = makeWallet();
    const inputs = [
      { txid: '1', vout: 0, value: 1_000_000 },
      { txid: '1b', vout: 0, value: 10_000 },
    ] as any;
    const rawOutputs = [{ address: 'sp1', value: 1_005_000 }, { value: 5_000 }] as any;
    // Every unselected UTXO combined nets 1,420 — nowhere near the 1,000,000 bar — so the loop
    // would burn fees on both without ever crossing it. The precheck must skip them outright.
    const available = [
      { txid: '2', vout: 0, value: 1_000, height: 1, address: 'a' },
      { txid: '3', vout: 0, value: 1_000, height: 1, address: 'a' },
    ];

    const res = (w as any).obfuscateUnnecessaryInputHeuristic(inputs, rawOutputs, available, 5);
    expect(res.inputs).toBe(inputs);
    expect(res.rawOutputs).toBe(rawOutputs);
  });

  it('bails to the original inputs/outputs rather than pairing expanded inputs with stale outputs', () => {
    const w = makeWallet();
    // No existing change output (fully-spent coinselect result): after adding obfuscation
    // inputs there IS leftover value, but it's too small to survive a new output's own fee.
    const inputs = [
      { txid: '1', vout: 0, value: 100 },
      { txid: '1b', vout: 0, value: 100 },
    ] as any;
    const rawOutputs = [{ address: 'sp1', value: 200 }] as any; // no change entry
    // 100 small UTXOs so the reachability precheck (which sums ALL of them, uncapped) passes,
    // but the per-run cap limits what's actually added to 2 x net 2 = 4 sats — less than the
    // 44-sat fee a new change output would cost, so there's nothing to return.
    const available = Array.from({ length: 100 }, (_, i) => ({ txid: `u${i}`, vout: 0, value: 60, height: 1, address: 'a' }));

    const res = (w as any).obfuscateUnnecessaryInputHeuristic(inputs, rawOutputs, available, 1);
    // Returning `currentInputs` here (the pre-fix behaviour) would pay the added inputs' value
    // straight to miners, since `rawOutputs` has no change output to credit it to.
    expect(res.inputs).toBe(inputs);
    expect(res.rawOutputs).toBe(rawOutputs);
  });
});

describe('broadcastTx advances the change index past used outputs', () => {
  function buildTxHex(outputs: Array<{ address: string; value: number }>): string {
    const tx = new bitcoin.Transaction();
    tx.addInput(Buffer.alloc(32, 1), 0);
    for (const o of outputs) {
      tx.addOutput(bitcoin.address.toOutputScript(o.address, bitcoin.networks.bitcoin), BigInt(o.value));
    }
    return tx.toHex();
  }

  it('advances past the highest change index actually paid to, including skipped n+1..n+3', () => {
    const w = makeWallet();
    const base = w.next_free_change_address_index;
    // Simulate a split send that used index base and base+2, but not base+1 — exactly the
    // gap getChangeAddresses() leaves unvalidated/unadvanced.
    const changeAddr0 = w._getInternalAddressByIndex(base);
    const changeAddr2 = w._getInternalAddressByIndex(base + 2);

    const hex = buildTxHex([
      { address: changeAddr0, value: 10_000 },
      { address: changeAddr2, value: 20_000 },
    ]);

    return w.broadcastTx(hex).then(() => {
      expect(w.next_free_change_address_index).toBe(base + 3);
    });
  });

  it('does not advance the index when the tx pays no change addresses of ours', () => {
    const w = makeWallet();
    const base = w.next_free_change_address_index;
    const foreignAddress = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'; // well-known unrelated address
    const hex = buildTxHex([{ address: foreignAddress, value: 10_000 }]);

    return w.broadcastTx(hex).then(() => {
      expect(w.next_free_change_address_index).toBe(base);
    });
  });
});
