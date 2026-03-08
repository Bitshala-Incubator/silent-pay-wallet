import { IndexerHttpClient } from '../helpers/silent-payments/IndexerHttpClient';
import type {
  HealthResponse,
  LatestBlockHeightResponse,
  BlockHeightByTimestampResponse,
  TransactionResponse,
  IndexerTransaction,
  SilentPaymentIndexerConfig,
  ScanProgressCallback,
} from '../helpers/silent-payments/types';

export class SilentPaymentIndexer {
  private httpClient: IndexerHttpClient;

  constructor(config: SilentPaymentIndexerConfig) {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const onionUrl = config.onionUrl?.replace(/\/$/, '');
    this.httpClient = new IndexerHttpClient(baseUrl, config.timeout, onionUrl);
  }

  getBaseUrl(): string {
    return this.httpClient.getBaseUrl();
  }

  setBaseUrl(url: string): void {
    this.httpClient.setBaseUrl(url);
  }

  async getHealth(): Promise<HealthResponse> {
    return this.httpClient.get<HealthResponse>('/health', 'Error fetching indexer health');
  }

  async getTransactionsByHeight(height: number): Promise<TransactionResponse> {
    return this.httpClient.get<TransactionResponse>(`/transactions/height/${height}`, `Error fetching transactions by height ${height}`);
  }

  async getTransactionsByRange(startHeight: number, endHeight: number): Promise<TransactionResponse> {
    return this.httpClient.get<TransactionResponse>(
      `/transactions/range?startHeight=${startHeight}&endHeight=${endHeight}&filterSpent=true`,
      `Error fetching transactions by range ${startHeight}-${endHeight}`,
    );
  }

  async getLatestBlockHeight(): Promise<LatestBlockHeightResponse> {
    return this.httpClient.get<LatestBlockHeightResponse>('/silent-block/latest-height', 'Error fetching latest block height');
  }

  async getBlockHeightByTimestamp(timestamp: number): Promise<BlockHeightByTimestampResponse> {
    return this.httpClient.get<BlockHeightByTimestampResponse>(
      `/transactions/timestamp-to-height?timestamp=${timestamp}`,
      `Error fetching block height for timestamp ${timestamp}`,
    );
  }

  /**
   * Scan forward using range queries for better performance.
   * Uses the range API to fetch up to 50 blocks at a time.
   *
   * @param {number} startHeight - Starting block height
   * @param {number} endHeight - Ending block height
   * @param {Function} processTransactions - Callback to process transactions from each range
   * @param {ScanProgressCallback} onProgress - Optional progress callback
   */
  async scanForwardWithCallback(
    startHeight: number,
    endHeight: number,
    processTransactions: (transactions: IndexerTransaction[]) => Promise<number>,
    onProgress?: ScanProgressCallback,
    cancelCallback?: () => boolean,
  ): Promise<void> {
    await this.scanBlocks(startHeight, endHeight, processTransactions, onProgress, cancelCallback);
  }

  private async scanBlocks(
    startHeight: number,
    endHeight: number,
    onRangeProcessed?: (transactions: IndexerTransaction[]) => Promise<number>,
    onProgress?: ScanProgressCallback,
    cancelCallback?: () => boolean,
  ): Promise<void> {
    const RANGE_BATCH_SIZE = 50;
    const totalBlocks = endHeight - startHeight + 1;
    let blocksScanned = 0;
    let utxosFound = 0;

    for (let rangeStart = startHeight; rangeStart <= endHeight; rangeStart += RANGE_BATCH_SIZE) {
      if (cancelCallback?.()) {
        throw new Error('SCAN_CANCELLED');
      }

      const rangeEnd = Math.min(rangeStart + RANGE_BATCH_SIZE - 1, endHeight);
      const rangeSize = rangeEnd - rangeStart + 1;

      try {
        const response = await this.getTransactionsByRange(rangeStart, rangeEnd);

        if (response.transactions.length > 0 && onRangeProcessed) {
          const foundInRange = await onRangeProcessed(response.transactions);

          utxosFound += foundInRange;
        }

        blocksScanned += rangeSize;

        if (onProgress) {
          onProgress({
            currentBlock: rangeEnd,
            totalBlocks,
            blocksScanned,
            percentComplete: (blocksScanned / totalBlocks) * 100,
            utxosFound,
          });
        }
      } catch (error: any) {
        if (error?.message === 'SCAN_CANCELLED') {
          throw error;
        }
        console.error(`[Indexer] ✗ Failed to fetch range ${rangeStart}-${rangeEnd}:`, error);
      }
    }
  }
}

let defaultIndexer: SilentPaymentIndexer | null = null;

export function initializeIndexer(config: SilentPaymentIndexerConfig): void {
  defaultIndexer = new SilentPaymentIndexer(config);
}

export function getDefaultIndexer(): SilentPaymentIndexer {
  if (!defaultIndexer) {
    throw new Error('Silent Payment Indexer not initialized. Call initializeIndexer() first.');
  }
  return defaultIndexer;
}

export function disconnectIndexer(): void {
  defaultIndexer = null;
}

export default SilentPaymentIndexer;
