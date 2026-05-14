import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { getScanPrivateKey, getSpendPublicKey } from './SilentPaymentKeyDerivation';
import { IndexerTransaction, SilentPaymentUTXO } from './types';
import { spScanTransactions, spScanSingleTransaction, RustMatchedUTXO, RustBatchScanResult } from '../../modules/RustJsiBridge';
import { hexToUint8Array } from '../../modules/uint8array-extras';

export class RustTransactionProcessor {
  private scanPrivkeyHex: string;
  private spendPubkeyHex: string;

  constructor(seed: Buffer) {
    const scanPrivkey = getScanPrivateKey(seed);
    const spendPubkey = getSpendPublicKey(seed);

    this.scanPrivkeyHex = Buffer.from(scanPrivkey).toString('hex');
    this.spendPubkeyHex = Buffer.from(spendPubkey).toString('hex');
  }

  private convertToSilentPaymentUTXO(rustUtxo: RustMatchedUTXO, silentPaymentAddress: string): SilentPaymentUTXO {
    return {
      txid: rustUtxo.txid,
      vout: rustUtxo.vout,
      value: rustUtxo.value,
      height: rustUtxo.height,
      address: bitcoin.payments.p2tr({
        pubkey: hexToUint8Array(rustUtxo.pubKey),
      }).address!,

      // sp specific fields
      silentPaymentAddress,
      pubKey: rustUtxo.pubKey,
      tweak: hexToUint8Array(rustUtxo.tweakHex),
      blockHash: rustUtxo.blockHash,
      isSpent: rustUtxo.isSpent,
      blockTime: rustUtxo.blockTime,
    };
  }

  process(tx: IndexerTransaction, silentPaymentAddress: string): SilentPaymentUTXO[] {
    try {
      const matchedUtxos = spScanSingleTransaction(this.scanPrivkeyHex, this.spendPubkeyHex, tx);

      return matchedUtxos.map(utxo => this.convertToSilentPaymentUTXO(utxo, silentPaymentAddress));
    } catch (error) {
      console.error(`Error processing transaction ${tx.id}:`, error);
      return [];
    }
  }

  async processBatch(
    transactions: IndexerTransaction[],
    silentPaymentAddress: string,
    cancelScanCallback?: () => boolean,
  ): Promise<SilentPaymentUTXO[]> {
    if (transactions.length === 0) {
      return [];
    }

    if (cancelScanCallback?.()) {
      return [];
    }

    try {
      const result: RustBatchScanResult = spScanTransactions(this.scanPrivkeyHex, this.spendPubkeyHex, transactions);

      console.log(
        `[RustTransactionProcessor] Scanned ${result.transactionsScanned} txs, ` +
          `${result.outputsScanned} outputs, found ${result.matchedUtxos.length} matches`,
      );

      return result.matchedUtxos.map(utxo => this.convertToSilentPaymentUTXO(utxo, silentPaymentAddress));
    } catch (error) {
      console.error('[RustTransactionProcessor] Batch processing error:', error);
      throw error;
    }
  }

  clear(): void {
    this.scanPrivkeyHex = '0'.repeat(64);
    this.spendPubkeyHex = '0'.repeat(66);
    this.scanPrivkeyHex = '';
    this.spendPubkeyHex = '';
  }
}

export function createTransactionProcessor(seed: Buffer): RustTransactionProcessor {
  return new RustTransactionProcessor(seed);
}
