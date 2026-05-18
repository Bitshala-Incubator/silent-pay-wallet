import * as bitcoin from 'bitcoinjs-lib';
import { HDSilentPaymentsWallet } from '../../class/wallets/hd-bip352-wallet.ts';
import ecc from '../../modules/noble_ecc.ts';
import { type SilentPaymentUTXO } from '../../helpers/silent-payments/types.ts';

describe('BIP-352 Silent Payments', () => {
  it.each([
    {
      seed: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      expectedAddress:
        'sp1qqfqnnv8czppwysafq3uwgwvsc638hc8rx3hscuddh0xa2yd746s7xqh6yy9ncjnqhqxazct0fzh98w7lpkm5fvlepqec2yy0sxlq4j6ccc3h6t0g',
    },
    {
      seed: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo glue',
      expectedAddress:
        'sp1qqvchcnrcqpdutxhpf57ptn3wajj0ymqxwzu9g6vj9uxx3wuvlykhyqh99hyh33y5593802pzw5rtw040zrw9f8re52tgcwngc5974w5evuufdy0m',
    },
  ])('should generate a valid silent payment address', ({ seed, expectedAddress }) => {
    const wallet = new HDSilentPaymentsWallet();
    wallet.setSecret(seed);
    const silentPaymentAddress = wallet.getSilentPaymentAddress();
    expect(silentPaymentAddress).toBe(expectedAddress);
  });

  describe('createSPTransaction handles both spend pubkey parities', () => {
    it.each([
      {
        label: 'even-Y (0x02)',
        seed: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        expectedParity: 0x02,
      },
      { label: 'odd-Y (0x03)', seed: 'all all all all all all all all all all all all', expectedParity: 0x03 },
    ])('signs a key-path Taproot input for $label spend pubkey', ({ seed, expectedParity }) => {
      const wallet = new HDSilentPaymentsWallet();
      wallet.setSecret(seed);

      const spendPubKey = wallet.getSpendPublicKey();
      expect(spendPubKey[0]).toBe(expectedParity);

      const tweak = new Uint8Array(32);
      tweak[31] = 0x07;
      const tweakedPub = ecc.pointAddScalar(spendPubKey, tweak, true);
      if (!tweakedPub) throw new Error('synthetic tweak produced invalid point');
      const expectedOutputKey = Buffer.from(tweakedPub.subarray(1, 33));
      const p2trAddress = bitcoin.payments.p2tr({ pubkey: expectedOutputKey }).address!;

      const utxo: SilentPaymentUTXO = {
        txid: '1111111111111111111111111111111111111111111111111111111111111111',
        vout: 0,
        value: 100_000,
        height: 800_000,
        address: p2trAddress,
        silentPaymentAddress: wallet.getSilentPaymentAddress() || '',
        pubKey: expectedOutputKey.toString('hex'),
        tweak,
        blockHash: '',
        blockTime: 0,
        isSpent: false,
      };

      const targetAddress = 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr';
      const result = wallet.createTransaction(
        [utxo as never],
        [{ address: targetAddress, value: 50_000 }],
        2,
        p2trAddress,
        0xfffffffd,
        false,
        0,
      );

      expect(result.tx).toBeDefined();
      const tx = result.tx!;
      expect(tx.ins).toHaveLength(1);

      const witness = tx.ins[0].witness;
      expect(witness).toHaveLength(1);
      const sig = witness[0];
      expect(sig.length === 64 || sig.length === 65).toBe(true);

      const sighash = tx.hashForWitnessV1(
        0,
        [Buffer.concat([Buffer.from([0x51, 0x20]), expectedOutputKey])],
        [BigInt(utxo.value)],
        bitcoin.Transaction.SIGHASH_DEFAULT,
      );
      const sig64 = sig.length === 65 ? Buffer.from(sig.subarray(0, 64)) : Buffer.from(sig);
      expect(ecc.verifySchnorr!(sighash, expectedOutputKey, sig64)).toBe(true);
    });
  });
});
