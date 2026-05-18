import { Utxo } from '../../class/wallets/types';

export interface IndexerOutput {
  transactionId: string;
  vout: number;
  pubKey: string;
  value: number;
  isSpent: boolean | number; // 0 = false (not spent), 1 = true (spent)
}

export interface IndexerTransaction {
  id: string;
  blockHeight: number;
  blockHash: string;
  blockTime: number;
  scanTweak: string;
  outputs: IndexerOutput[];
}

export interface TransactionResponse {
  transactions: IndexerTransaction[];
}

export interface LatestBlockHeightResponse {
  height: number;
}

export interface BlockHeightByTimestampResponse {
  blockHeight: number;
}

export interface SilentPaymentUTXO extends Utxo {
  silentPaymentAddress: string;
  pubKey: string;
  tweak: Uint8Array;
  blockHash: string;
  blockTime: number;
  isSpent: boolean;
}

export interface SilentPaymentUTXOSerializable extends Omit<SilentPaymentUTXO, 'tweak'> {
  tweakHex: string;
}

export interface SilentPaymentIndexerConfig {
  baseUrl: string;
  timeout?: number;
  retry?: {
    count: number;
    delay: number; // ms
  };
}

export interface HealthResponse {
  status: string;
  message?: string;
}

export interface ScanProgress {
  currentBlock: number;
  totalBlocks: number;
  blocksScanned: number;
  percentComplete: number;
  utxosFound: number;
}

export type ScanProgressCallback = (progress: ScanProgress) => void | Promise<void>;
