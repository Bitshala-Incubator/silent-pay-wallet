import { ECPairFactory } from 'ecpair';
import { SilentPayment, UTXO as SPUTXO, UTXOType as SPUTXOType } from 'silent-payments';
import ecc from '../../modules/noble_ecc';

const ECPair = ECPairFactory(ecc);

// Real test vectors taken from node_modules/silent-payments/tests/silent-payment.test.ts
const UTXO_1: SPUTXO = {
  txid: 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16',
  vout: 0,
  wif: ECPair.fromPrivateKey(Buffer.from('1cd5e8f6b3f29505ed1da7a5806291ebab6491c6a172467e44debe255428a192', 'hex')).toWIF(),
  utxoType: 'p2wpkh' as SPUTXOType,
};

const UTXO_2: SPUTXO = {
  txid: 'a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d',
  vout: 0,
  wif: ECPair.fromPrivateKey(Buffer.from('7416ef4d92e4dd09d680af6999d1723816e781c030f4b4ecb5bf46939ca30056', 'hex')).toWIF(),
  utxoType: 'p2wpkh' as SPUTXOType,
};

const SP_ADDRESS = 'sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj85c6qdfhjdpdjtdgqjuexzk6murw56suy3e0rd2cgqvycxttddwsvgxe2usfpxumr70xc9pkqwv';

describe('SilentPayment.createTransaction sender derivation', () => {
  it('resolves a single sp1 target to a unique Taproot address', () => {
    const sp = new SilentPayment();
    const result = sp.createTransaction([UTXO_1, UTXO_2], [{ address: SP_ADDRESS, value: 22_222 }]);

    expect(result).toHaveLength(1);
    expect(result[0].address).toBeDefined();
    expect(result[0].address!.startsWith('bc1p')).toBe(true);
    expect(result[0].value).toBe(22_222);
    // Known expected value from the library's own tests
    expect(result[0].address).toBe('bc1pszgngkje7t5j3mvdw8xc5l3q7n28awdwl8pena6hrvxgg83lnpmsme6u6j');
  });

  it('produces two distinct Taproot addresses for two targets with the same sp1 address', () => {
    const sp = new SilentPayment();
    const result = sp.createTransaction(
      [UTXO_1, UTXO_2],
      [
        { address: SP_ADDRESS, value: 10_000 },
        { address: SP_ADDRESS, value: 20_000 },
      ],
    );

    expect(result).toHaveLength(2);
    const addr0 = result[0].address!;
    const addr1 = result[1].address!;

    expect(addr0.startsWith('bc1p')).toBe(true);
    expect(addr1.startsWith('bc1p')).toBe(true);
    // k-counter increments so addresses must differ
    expect(addr0).not.toBe(addr1);
  });
});
