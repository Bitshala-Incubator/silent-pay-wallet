import * as bip39 from 'bip39';
import { Buffer } from 'buffer';
import { ECPairFactory } from 'ecpair';
import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet.ts';
import { getDefaultIndexer } from '../../modules/SilentPaymentIndexer';
import ecc from '../../modules/noble_ecc';
import {
  getSilentPaymentAddress,
  getScanPrivateKey,
  getSpendPrivateKey,
  getSpendPublicKey,
  RustTransactionProcessor,
  createTransactionProcessor,
  type IndexerTransaction,
  type SilentPaymentUTXO,
  type SilentPaymentUTXOSerializable,
  type ScanProgressCallback,
  type ScanStateInfo,
  type ScanStatus,
  IDLE_SCAN_STATE,
  type StagedScanData,
} from '../../helpers/silent-payments';
import { BIP352_ACTIVATION_HEIGHT } from '../../modules/constants';
import { CreateTransactionResult, CreateTransactionTarget, CreateTransactionUtxo, Transaction, Utxo } from './types.ts';
import * as bitcoin from 'bitcoinjs-lib';
import { HDTaprootWallet } from './hd-taproot-wallet.ts';

const ECPair = ECPairFactory(ecc);

// Minimum gap between scan-progress state emissions, to avoid flooding React with re-renders.
const SCAN_PROGRESS_THROTTLE_MS = 500;
// Number of recent progress samples kept for the windowed ETA throughput estimate.
const SCAN_ETA_ROLLING_WINDOW = 10;

export class HDSilentPaymentsWallet extends HDTaprootWallet {
  static readonly type = 'HDSilentPaymentsWallet';
  static readonly typeReadable = 'HD Silent Payments';
  // @ts-ignore: override
  public readonly type = HDSilentPaymentsWallet.type;
  // @ts-ignore: override
  public readonly typeReadable = HDSilentPaymentsWallet.typeReadable;

  private readonly POLLING_INTERVAL_MS = 30000;
  private cachedSeed: Buffer | null = null;
  private transactionProcessor: RustTransactionProcessor | null = null;
  private lastScannedBlock: number = 0;
  private _birthHeight: number = BIP352_ACTIVATION_HEIGHT;
  private spUTXOsCache: SilentPaymentUTXO[] | null = null;
  private activeScanPromise: Promise<number> | null = null;
  private cancelScanCallbackScan: boolean = false;
  private pollingIntervalId: NodeJS.Timeout | null = null;
  private isPollingActive: boolean = false;
  private onBalanceChangeCallback: (() => void) | null = null;
  private onPersistCallback: (() => void) | null = null;
  private _sp_spending_txs: Transaction[] = [];
  private _sp_pending_inputs: Set<string> = new Set(); // "txid:vout"

  private _scanState: ScanStateInfo = IDLE_SCAN_STATE;
  private _scanPaused: boolean = false;
  private _scanResumeResolver: (() => void) | null = null;
  private _scanResumePromise: Promise<void> | null = null;
  private _lastProgressEmitTime: number = 0;
  // rolling window of {wall-clock time, cumulative percentComplete} samples, used for ETA
  private _scanSamples: { t: number; percent: number }[] = [];
  private _scanStartTime: number = 0;
  private _onScanStateChangeCallback: ((state: ScanStateInfo) => void) | null = null;

  setOnBalanceChangeCallback(callback: (() => void) | null): void {
    this.onBalanceChangeCallback = callback;
  }

  setOnPersistCallback(callback: (() => void) | null): void {
    this.onPersistCallback = callback;
  }

  setOnScanStateChangeCallback(callback: ((state: ScanStateInfo) => void) | null): void {
    this._onScanStateChangeCallback = callback;
  }

  getScanState(): ScanStateInfo {
    return { ...this._scanState, lastScannedBlock: this.lastScannedBlock };
  }

  pauseScan(): void {
    if (!this._scanPaused && this.activeScanPromise !== null) {
      this._scanPaused = true;
      this._scanResumePromise = new Promise<void>(resolve => {
        this._scanResumeResolver = resolve;
      });
      this._emitScanState('paused');
    }
  }

  resumeScan(): void {
    if (this._scanPaused) {
      this._scanPaused = false;
      this._scanSamples = [];
      this._scanResumeResolver?.();
      this._scanResumeResolver = null;
      this._scanResumePromise = null;
      if (this.activeScanPromise !== null) {
        this._emitScanState('scanning');
      }
    }
  }

  private _emitScanState(status: ScanStatus, overrides?: Partial<ScanStateInfo>): void {
    this._scanState = { ...this._scanState, status, ...overrides, lastScannedBlock: this.lastScannedBlock };
    this._onScanStateChangeCallback?.(this._scanState);
  }

  private async _waitIfPaused(): Promise<void> {
    if (this._scanPaused && this._scanResumePromise) {
      await this._scanResumePromise;
    }
  }

  static fromJson(obj: string): HDSilentPaymentsWallet {
    const data = JSON.parse(obj);
    const wallet = new HDSilentPaymentsWallet();

    for (const key of Object.keys(data)) {
      if (key === '_utxos_serializable') {
        const serializable = data[key] || [];
        wallet._utxo = serializable.map((utxo: SilentPaymentUTXOSerializable) => ({
          ...utxo,
          tweak: new Uint8Array(Buffer.from(utxo.tweakHex, 'hex')),
        }));
      } else if (key === 'lastScannedBlock') {
        wallet.lastScannedBlock = data[key] || 0;
      } else if (key === '_birthHeight') {
        wallet._birthHeight = data[key] || BIP352_ACTIVATION_HEIGHT;
      } else if (key === '_sp_spending_txs') {
        wallet._sp_spending_txs = data[key] || [];
      } else if (key === '_sp_pending_inputs') {
        wallet._sp_pending_inputs = new Set(data[key] || []);
      } else if (
        key !== '_utxo' &&
        key !== 'transactionProcessor' &&
        key !== 'cachedSeed' &&
        key !== 'spUTXOsCache' &&
        key !== 'activeScanPromise' &&
        key !== '_sp_pending_inputs' &&
        key !== '_sp_spending_txs'
      ) {
        (wallet as any)[key] = data[key];
      }
    }

    if (!(wallet._sp_pending_inputs instanceof Set)) {
      wallet._sp_pending_inputs = new Set();
    }

    return wallet;
  }

  prepareForSerialization(): void {
    super.prepareForSerialization();

    // IMPORTANT: serialize ALL SP UTXOs (both spent and unspent)
    // we need spent UTXOs for transaction history and value calculations
    const allSpUtxos = this._utxo.filter((u): u is SilentPaymentUTXO => 'tweak' in u && u.tweak instanceof Uint8Array);

    (this as any)._utxos_serializable = allSpUtxos.map((utxo): SilentPaymentUTXOSerializable => {
      const { tweak, ...rest } = utxo;
      return {
        ...rest,
        tweakHex: Buffer.from(tweak).toString('hex'),
      };
    });

    (this as any).lastScannedBlock = this.lastScannedBlock;
    (this as any)._birthHeight = this._birthHeight;
    (this as any)._sp_spending_txs = this._sp_spending_txs;
    (this as any)._sp_pending_inputs = Array.from(this._sp_pending_inputs);
  }

  private getSilentPaymentUTXOs(): SilentPaymentUTXO[] {
    if (this.spUTXOsCache !== null) {
      return this.spUTXOsCache;
    }

    this.spUTXOsCache = this._utxo.filter((u): u is SilentPaymentUTXO => 'tweak' in u && u.tweak instanceof Uint8Array);

    return this.spUTXOsCache;
  }

  private invalidateUTXOCache(): void {
    this.spUTXOsCache = null;
  }

  private addUTXO(utxo: SilentPaymentUTXO): boolean {
    const key = `${utxo.txid}:${utxo.vout}`;
    const exists = this._utxo.some(u => `${u.txid}:${u.vout}` === key);

    if (exists) {
      return false;
    }

    this._utxo.push(utxo);
    this.invalidateUTXOCache();
    return true;
  }

  private markUTXOAsSpent(txid: string, vout: number): boolean {
    const utxo = this._utxo.find(u => u.txid === txid && u.vout === vout) as SilentPaymentUTXO | undefined;

    if (!utxo) {
      console.warn(`[SP] markUTXOAsSpent: UTXO not found ${txid}:${vout}`);
      return false;
    }

    if (!('tweak' in utxo)) {
      console.warn(`[SP] markUTXOAsSpent: Not an SP UTXO ${txid}:${vout}`);
      return false;
    }

    if (utxo.isSpent) {
      return false;
    }

    utxo.isSpent = true;
    this.invalidateUTXOCache();

    this.onBalanceChangeCallback?.();
    this.onPersistCallback?.();

    return true;
  }

  private ensurePendingInputsInitialized(): void {
    if (!this._sp_pending_inputs || !(this._sp_pending_inputs instanceof Set)) {
      this._sp_pending_inputs = new Set();
    }
  }

  private releaseUTXOsFromTx(hex: string): number {
    this.ensurePendingInputsInitialized();
    try {
      const tx = bitcoin.Transaction.fromHex(hex);
      let releasedCount = 0;

      for (const input of tx.ins) {
        const txid = Buffer.from(input.hash).reverse().toString('hex');
        const vout = input.index;
        const inputKey = `${txid}:${vout}`;

        if (this._sp_pending_inputs.delete(inputKey)) {
          releasedCount++;
        }
      }

      return releasedCount;
    } catch (error) {
      console.error('[SP] Error parsing transaction hex in releaseUTXOsFromTx:', error);
      return 0;
    }
  }

  private ensureTransactionProcessor(): void {
    if (this.transactionProcessor !== null) return;

    const seed = this.getSeed();
    this.transactionProcessor = createTransactionProcessor(seed);
  }

  getSilentPaymentAddress(): string | null {
    const seed = this.getSeed();
    return getSilentPaymentAddress(seed);
  }

  getSpendPrivateKey(): Uint8Array {
    const seed = this.getSeed();
    return getSpendPrivateKey(seed);
  }

  getSpendPublicKey(): Uint8Array {
    const seed = this.getSeed();
    return getSpendPublicKey(seed);
  }

  getScanPrivateKey(): Uint8Array {
    const seed = this.getSeed();
    return getScanPrivateKey(seed);
  }

  getBirthHeight(): number {
    return this._birthHeight;
  }

  getLastScannedBlock(): number {
    return this.lastScannedBlock;
  }

  /**
   * Merge UTXOs found by background scans into the wallet. Idempotent: UTXOs
   * dedup on txid:vout and the cursor never regresses, so re-merging stale
   * staging (e.g. after a race with a finishing background run) is harmless.
   *
   * @returns number of newly added UTXOs
   */
  mergeStagedScanResults(staged: StagedScanData | null): number {
    if (!staged || staged.walletID !== this.getID()) {
      return 0;
    }

    let addedCount = 0;
    for (const serializable of staged.utxos) {
      const { tweakHex, ...rest } = serializable;
      const utxo: SilentPaymentUTXO = {
        ...rest,
        tweak: new Uint8Array(Buffer.from(tweakHex, 'hex')),
      };
      if (this.addUTXO(utxo)) {
        addedCount++;
      }
    }

    // Only adopt the staged cursor when it's past the wallet's effective birth.
    // A background scan run with stale credentials (birth height not yet set)
    // may have scanned from the BIP-352 activation height; adopting such a low
    // cursor into a never-scanned wallet (lastScannedBlock = 0) would drag the
    // next foreground scan years behind its real birth height.
    const effectiveBirthHeight = Math.max(this._birthHeight, BIP352_ACTIVATION_HEIGHT);
    const cursorAdvanced = staged.cursor > this.lastScannedBlock && staged.cursor >= effectiveBirthHeight;
    if (cursorAdvanced) {
      this.lastScannedBlock = staged.cursor;
    }

    if (addedCount > 0) {
      this.onBalanceChangeCallback?.();
    }
    if (addedCount > 0 || cursorAdvanced) {
      this.onPersistCallback?.();
    }

    return addedCount;
  }

  private getSeed(): Buffer {
    if (this.cachedSeed) return this.cachedSeed;

    const mnemonic = this.secret;
    this.cachedSeed = bip39.mnemonicToSeedSync(mnemonic, '');
    return this.cachedSeed;
  }

  private async processTransactions(transactions: IndexerTransaction[]): Promise<{ utxos: SilentPaymentUTXO[]; lastScannedBlock: number }> {
    this.ensureTransactionProcessor();

    const silentPaymentAddress = this.getSilentPaymentAddress()!;
    const validTransactions = transactions.filter(tx => tx.scanTweak && tx.outputs && tx.outputs.length > 0);

    // Derive the highest block height from transactions
    const maxBlockHeight = validTransactions.reduce((max, tx) => Math.max(max, tx.blockHeight), this.lastScannedBlock);

    const newUTXOs = await this.transactionProcessor!.processBatch(
      validTransactions,
      silentPaymentAddress,
      () => this.cancelScanCallbackScan,
    );

    return {
      utxos: newUTXOs,
      lastScannedBlock: maxBlockHeight,
    };
  }

  private commitUTXOs(utxos: SilentPaymentUTXO[], newLastScannedBlock: number): number {
    let addedCount = 0;

    for (const utxo of utxos) {
      if (this.addUTXO(utxo)) {
        addedCount++;
      }
    }

    // Always update lastScannedBlock to track progress, even if no UTXOs found
    if (newLastScannedBlock > this.lastScannedBlock) {
      this.lastScannedBlock = newLastScannedBlock;
    }

    // Trigger callbacks if state changed
    if (addedCount > 0) {
      this.onBalanceChangeCallback?.();
    }

    // Always persist when lastScannedBlock updates to track scan progress
    if (newLastScannedBlock > 0 && this.onPersistCallback) {
      this.onPersistCallback();
    }

    return addedCount;
  }

  cancelScan(): void {
    this.cancelScanCallbackScan = true;
    // unblock any pending pause so the scan loop can exit cleanly
    if (this._scanPaused) {
      this._scanPaused = false;
      this._scanResumeResolver?.();
      this._scanResumeResolver = null;
      this._scanResumePromise = null;
    }
    // NOTE: intentionally do NOT call disconnectIndexer() here. The indexer is an app-wide
    // singleton initialised once in App.tsx; nulling it on a per-wallet cancel/delete leaves
    // the whole app without an indexer until restart (e.g. a subsequent wallet import throws
    // "Silent Payment Indexer not initialized"). cancelScan stops the scan loop via the cancel
    // flag below; it must not tear down the shared indexer.
    this.stopPolling();
    this._emitScanState('idle', IDLE_SCAN_STATE);
  }

  private startPolling(): void {
    if (this.isPollingActive) {
      return;
    }

    this.isPollingActive = true;

    this.pollingIntervalId = setInterval(async () => {
      try {
        await this.scanForPayments();
      } catch (error) {
        console.error('[SP] Error during polling:', error);
      }
    }, this.POLLING_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollingIntervalId !== null) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
      this.isPollingActive = false;
    }
  }

  /**
   * Scan forward for silent payments (from wallet birth/last scan to latest block).
   * This is called when the user refreshes or opens the wallet.
   * Uses incremental scanning - only scans blocks since last scan.
   * Respects wallet birth height - will not scan blocks before the wallet was created.
   *
   * Thread-safe: If a scan is already in progress, returns the existing promise to avoid redundant work.
   * Can be cancelled using cancelScan() method.
   *
   * @param {ScanProgressCallback} onProgress - Optional callback for progress updates
   * @param {boolean} forceFullScan - Force a full scan ignoring lastScannedBlock (default: false)
   * @returns {Promise<number>} - Number of new UTXOs found
   */
  async scanForPayments(onProgress?: ScanProgressCallback, forceFullScan: boolean = false): Promise<number> {
    if (this.cancelScanCallbackScan) {
      return 0;
    }

    if (this.activeScanPromise !== null) {
      return this.activeScanPromise;
    }

    this.cancelScanCallbackScan = false;
    this.activeScanPromise = this.performScan(onProgress, forceFullScan);

    try {
      const result = await this.activeScanPromise;
      return result;
    } finally {
      this.activeScanPromise = null;
      // don't cancelScanCallbackScan here — if cancelScan() was called during this scan,
      // the flag must stay true so subsequent calls to scanForPayments() exit early.
    }
  }

  private async performScan(onProgress?: ScanProgressCallback, forceFullScan: boolean = false): Promise<number> {
    this._scanStartTime = Date.now();
    this._scanSamples = [];
    this._lastProgressEmitTime = 0;

    try {
      const indexer = getDefaultIndexer();
      const latestHeightResponse = await indexer.getLatestBlockHeight();
      const latestHeight = latestHeightResponse.height;
      const effectiveBirthHeight = Math.max(this._birthHeight, BIP352_ACTIVATION_HEIGHT);

      if (latestHeight <= 0) {
        throw new Error(`Invalid latest block height: ${latestHeight}`);
      }

      let startHeight: number;
      const endHeight: number = latestHeight;

      if (!forceFullScan && this.lastScannedBlock > 0) {
        startHeight = this.lastScannedBlock + 1;

        if (startHeight > latestHeight) {
          return 0;
        }
      } else {
        startHeight = effectiveBirthHeight;
      }

      if (startHeight > endHeight) {
        return 0;
      }

      this._emitScanState('scanning', { startedAt: this._scanStartTime, progress: null, eta: null, etaComputedAt: null, error: null });

      let totalUTXOsAdded = 0;

      const wrappedProgress: ScanProgressCallback = async progress => {
        await this._waitIfPaused();
        if (this.activeScanPromise === null || this.cancelScanCallbackScan) return;

        this._scanSamples.push({ t: Date.now(), percent: progress.percentComplete });
        if (this._scanSamples.length > SCAN_ETA_ROLLING_WINDOW) {
          this._scanSamples.shift();
        }

        // Estimate ETA from the recent throughput (percent/ms) over the rolling window,
        // not a raw batch count: time spanned vs. percent gained between the oldest and
        // newest samples gives the current scan rate, which we extrapolate to 100%.
        let eta: number | null = null;
        let etaComputedAt: number | null = null;
        if (this._scanSamples.length >= 2) {
          const oldest = this._scanSamples[0];
          const newest = this._scanSamples[this._scanSamples.length - 1];
          const elapsedMs = newest.t - oldest.t;
          const percentGained = newest.percent - oldest.percent;
          if (elapsedMs > 0 && percentGained > 0) {
            const msPerPercent = elapsedMs / percentGained;
            const remainingPercent = 100 - progress.percentComplete;
            eta = Math.round(msPerPercent * remainingPercent);
            etaComputedAt = newest.t;
          }
        }

        const now = Date.now();
        const isComplete = progress.percentComplete >= 100;
        const statusChanged = this._scanState.status !== 'scanning';
        const throttleElapsed = now - this._lastProgressEmitTime >= SCAN_PROGRESS_THROTTLE_MS;

        if (isComplete || statusChanged || throttleElapsed) {
          this._lastProgressEmitTime = now;
          this._emitScanState('scanning', { progress, eta, etaComputedAt });
        }

        if (onProgress) {
          await onProgress(progress);
        }
      };

      await indexer.scanForwardWithCallback(
        startHeight,
        endHeight,
        async transactions => {
          if (this.cancelScanCallbackScan) {
            throw new Error('SCAN_CANCELLED');
          }

          await this._waitIfPaused();
          if (this.cancelScanCallbackScan) throw new Error('SCAN_CANCELLED');

          const result = await this.processTransactions(transactions);
          const addedCount = this.commitUTXOs(result.utxos, result.lastScannedBlock);
          totalUTXOsAdded += addedCount;

          return addedCount;
        },
        wrappedProgress,
        () => this.cancelScanCallbackScan,
      );

      this._emitScanState('idle', IDLE_SCAN_STATE);

      if (this.lastScannedBlock >= latestHeight && !this.isPollingActive && !this.cancelScanCallbackScan) {
        this.startPolling();
      }

      return totalUTXOsAdded;
    } catch (error: any) {
      if (error.message === 'SCAN_CANCELLED') {
        this._emitScanState('idle', IDLE_SCAN_STATE);
        return 0;
      }

      if (error.message?.includes('not initialized')) {
        this._emitScanState('error', { error: 'Silent Payment Indexer not initialized.' });
        throw new Error('Silent Payment Indexer not initialized. Please configure the indexer first.');
      }

      console.error('[SP] Scan error:', error);
      this._emitScanState('error', { error: error.message ?? 'Unknown scan error' });
      throw error;
    }
  }

  async scanByTxid(txid: string): Promise<{ found: boolean; utxosFound: number; blockHeight: number; tipHeight: number }> {
    const indexer = getDefaultIndexer();
    const [response, tipResponse] = await Promise.all([indexer.getTransactionByTxid(txid), indexer.getLatestBlockHeight()]);
    const tx = response.transaction;

    const result = await this.processTransactions([tx]);

    let newlyAdded = false;
    for (const utxo of result.utxos) {
      if (this.addUTXO(utxo)) {
        newlyAdded = true;
      }
    }

    if (newlyAdded) {
      this.onBalanceChangeCallback?.();
      this.onPersistCallback?.();
    }

    return {
      found: result.utxos.length > 0,
      utxosFound: result.utxos.length,
      blockHeight: tx.blockHeight,
      tipHeight: tipResponse.height,
    };
  }

  async fetchUtxo(): Promise<void> {
    const spUtxos = this.getSilentPaymentUTXOs();

    try {
      await super.fetchUtxo();
    } catch (error) {
      console.warn('[SP] super.fetchUtxo failed:', error);
    } finally {
      // Restore SP UTXOs
      const existingKeys = new Set(this._utxo.map(u => `${u.txid}:${u.vout}`));
      let restoredCount = 0;

      for (const utxo of spUtxos) {
        const key = `${utxo.txid}:${utxo.vout}`;
        if (!existingKeys.has(key)) {
          this._utxo.push(utxo);
          restoredCount++;
        }
      }

      if (restoredCount > 0) {
        this.invalidateUTXOCache();
      }
    }
  }

  async fetchBalance(): Promise<void> {
    await super.fetchBalance();
  }

  async fetchTransactions(): Promise<void> {
    try {
      await super.fetchTransactions();
    } catch (regularError) {
      console.error('[SP] Error fetching regular transactions:', regularError);
    }

    this.scanForSilentPayments();
  }

  private async scanForSilentPayments(): Promise<void> {
    if (this.cancelScanCallbackScan) {
      return;
    }

    try {
      await this.scanForPayments();
    } catch (spError: any) {
      if (spError?.message !== 'SCAN_CANCELLED') {
        console.warn('[SP] Scan failed:', spError?.message || spError);
      }
    }
  }

  getUTXOs(): SilentPaymentUTXO[] {
    const allSpUtxos = this.getSilentPaymentUTXOs();
    const unspentUtxos = allSpUtxos.filter(u => !u.isSpent);
    return unspentUtxos;
  }

  /**
   * Get only regular (non-SP) UTXOs from the wallet.
   * Filters out Silent Payment UTXOs to avoid duplicates.
   */
  private getRegularUtxos(): Utxo[] {
    if (this._utxo.length === 0) {
      return this.getDerivedUtxoFromOurTransaction();
    }
    // Filter out SP UTXOs - they have a 'tweak' property
    return this._utxo.filter(u => !('tweak' in u));
  }

  /**
   * override parent's getUtxo() to include both regular UTXOs and SP UTXOs.
   * ensures coin control and transaction creation have access to all available UTXOs.
   * IMPORTANT: We separate regular and SP UTXOs to avoid duplicates.
   */
  getUtxo(respectFrozen = false): Utxo[] {
    const spUtxos = this.getUTXOs(); // unspent SP UTXOs only
    let regularUtxos = this.getRegularUtxos();

    if (!respectFrozen) {
      regularUtxos = regularUtxos.filter(({ txid, vout }) => !this.getUTXOMetadata(txid, vout).frozen);
    }

    // Combine regular UTXOs with SP UTXOs (no duplicates since they're from different sources)
    return [...regularUtxos, ...spUtxos];
  }

  getBalance(): number {
    const regularBalance = super.getBalance();
    // Only add SP balance - regular balance is already computed by parent
    const unspentSpUtxos = this.getUTXOs();
    const silentPaymentBalance = unspentSpUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

    return regularBalance + silentPaymentBalance;
  }

  setBirthHeight(height: number): void {
    if (height < 0) {
      throw new Error('Birth height cannot be negative');
    }

    this._birthHeight = height;
  }

  updateBirthHeight(height: number, resetScan: boolean = false): void {
    if (height < 0) {
      throw new Error('Birth height cannot be negative');
    }

    this._birthHeight = height;

    if (resetScan) {
      this.lastScannedBlock = 0;
    }
  }

  getTransactions(): Transaction[] {
    const regularTransactions = super.getTransactions();

    // Include ALL UTXOs (both spent and unspent) so incoming SP transactions appear in the list
    const utxos = this.getSilentPaymentUTXOs();

    const txMap = new Map<string, SilentPaymentUTXO[]>();

    for (const utxo of utxos) {
      if (!txMap.has(utxo.txid)) {
        txMap.set(utxo.txid, []);
      }
      txMap.get(utxo.txid)!.push(utxo);
    }

    // Create incoming SP transactions (receiving payments)
    const spIncomingTransactions: Transaction[] = [];

    for (const [txid, utxoGroup] of txMap) {
      const totalValue = utxoGroup.reduce((sum, utxo) => sum + utxo.value, 0);
      const firstUtxo = utxoGroup[0];

      spIncomingTransactions.push({
        txid,
        hash: txid,
        version: 2,
        size: 0,
        vsize: 0,
        weight: 0,
        locktime: 0,
        value: totalValue,
        confirmations: 7, // FIXME: dont assume stuff
        blockhash: firstUtxo.blockHash,
        time: firstUtxo.blockTime,
        blocktime: firstUtxo.blockTime,
        timestamp: firstUtxo.blockTime,
        inputs: [], // inputs are not tracked by the indexer
        outputs: utxoGroup.map((utxo, index) => ({
          value: utxo.value,
          n: utxo.vout,
          scriptPubKey: {
            asm: '',
            hex: utxo.pubKey,
            reqSigs: 1,
            type: 'witness_v1_taproot',
            addresses: [this.getSilentPaymentAddress() || ''],
          },
        })),
      });
    }

    // Include spending transactions (when we spend SP UTXOs)
    // These have negative value since money is leaving our wallet
    const allTransactions = [...regularTransactions, ...spIncomingTransactions, ...this._sp_spending_txs];

    allTransactions.sort((a, b) => {
      const timeA = a.timestamp || a.blocktime || 0;
      const timeB = b.timestamp || b.blocktime || 0;
      return timeB - timeA;
    });

    return allTransactions;
  }

  allowSend(): boolean {
    return true;
  }

  createTransaction(
    utxos: CreateTransactionUtxo[],
    targets: CreateTransactionTarget[],
    feeRate: number,
    changeAddress: string,
    sequence: number = AbstractHDElectrumWallet.finalRBFSequence,
    skipSigning = false,
    masterFingerprint: number = 0,
  ): CreateTransactionResult {
    if (targets.length === 0) throw new Error('No destination provided');
    if (utxos.length === 0) throw new Error('No UTXOs provided');

    const spUtxos: SilentPaymentUTXO[] = [];
    const regularUtxos: CreateTransactionUtxo[] = [];

    for (const utxo of utxos) {
      if ('tweak' in utxo && utxo.tweak instanceof Uint8Array) {
        spUtxos.push(utxo as SilentPaymentUTXO);
      } else {
        regularUtxos.push(utxo);
      }
    }

    // Case 1: Only SP UTXOs - use SP builder exclusively
    if (spUtxos.length > 0 && regularUtxos.length === 0) {
      return this.createSPTransaction(spUtxos, targets, feeRate, changeAddress, sequence, skipSigning);
    }

    // Case 2: Only regular UTXOs - delegate to parent
    if (spUtxos.length === 0 && regularUtxos.length > 0) {
      return super.createTransaction(regularUtxos, targets, feeRate, changeAddress, sequence, skipSigning, masterFingerprint);
    }

    // Case 3: Mixed UTXOs - not yet implemented
    throw new Error('Mixed UTXO spending (SP + regular) is not yet implemented. Please select only SP UTXOs or only regular UTXOs.');
  }

  private createSPTransaction(
    spUtxos: SilentPaymentUTXO[],
    targets: CreateTransactionTarget[],
    feeRate: number,
    changeAddress: string,
    sequence: number,
    skipSigning: boolean,
  ): CreateTransactionResult {
    if (targets.length === 0) throw new Error('No destination provided');

    const { inputs, outputs, fee } = this.coinselect(spUtxos as CreateTransactionUtxo[], targets, feeRate);
    const utxoMap = new Map(spUtxos.map(u => [`${u.txid}:${u.vout}`, u]));

    this.ensurePendingInputsInitialized();

    // Reserve UTXOs to prevent double-spend attempts
    const inputKeys = inputs.map(input => `${input.txid}:${input.vout}`);
    inputKeys.forEach(key => this._sp_pending_inputs.add(key));

    try {
      const spendPrivKey = this.getSpendPrivateKey();
      const spendPubKey = this.getSpendPublicKey();

      const psbt = new bitcoin.Psbt();
      const xOnlySpendPub = spendPubKey.subarray(1, 33);

      // add taproot inputs with tweaked public keys
      inputs.forEach(input => {
        const spUtxo = utxoMap.get(`${input.txid}:${input.vout}`);
        if (!spUtxo) {
          throw new Error(`UTXO not found: ${input.txid}:${input.vout}`);
        }

        const outputKey = Buffer.from(spUtxo.pubKey, 'hex');
        if (outputKey.length !== 32) {
          throw new Error(`UTXO ${input.txid}:${input.vout}: pubKey must be 32-byte x-only, got ${outputKey.length}`);
        }

        const tweakedPub = ecc.pointAddScalar(spendPubKey, spUtxo.tweak, true);
        if (!tweakedPub) {
          throw new Error('Failed to compute tweaked public key');
        }
        if (!outputKey.equals(Buffer.from(tweakedPub.subarray(1, 33)))) {
          throw new Error(`UTXO ${input.txid}:${input.vout}: derived output key does not match indexer pubKey`);
        }

        const witnessScript = Buffer.concat([
          Buffer.from([0x51, 0x20]), // OP_1 + PUSH32 (Taproot script)
          outputKey,
        ]);

        psbt.addInput({
          hash: input.txid,
          index: input.vout,
          sequence,
          witnessUtxo: {
            script: witnessScript,
            value: BigInt(input.value),
          },
          tapInternalKey: Buffer.from(xOnlySpendPub),
        });
      });

      outputs.forEach(output => {
        psbt.addOutput({
          address: output.address || changeAddress,
          value: BigInt(output.value),
        });
      });

      let tx: bitcoin.Transaction | undefined;

      if (!skipSigning) {
        // sign each input with its tweaked key pair
        inputs.forEach((input, idx) => {
          const spUtxo = utxoMap.get(`${input.txid}:${input.vout}`);
          if (!spUtxo) {
            throw new Error(`UTXO not found: ${input.txid}:${input.vout}`);
          }

          const tweakedPrivKey = ecc.privateAdd(spendPrivKey, spUtxo.tweak);
          if (!tweakedPrivKey) {
            throw new Error('Failed to compute tweaked private key');
          }

          const tweakedKeyPair = ECPair.fromPrivateKey(Buffer.from(tweakedPrivKey), { compressed: true });
          psbt.signTaprootInput(idx, tweakedKeyPair);
        });

        psbt.finalizeAllInputs();
        tx = psbt.extractTransaction();
      }

      return {
        tx,
        psbt,
        inputs: inputs.map(i => ({
          txid: i.txid,
          vout: i.vout,
          address: i.address,
          value: i.value,
        })),
        outputs: outputs.map(o => ({
          address: o.address || changeAddress,
          value: o.value,
        })),
        fee,
      };
    } catch (error) {
      // If transaction creation fails, release the reserved UTXOs
      inputKeys.forEach(key => this._sp_pending_inputs.delete(key));
      throw error;
    }
  }

  /**
   * Override broadcastTx to mark SP UTXOs as spent only after successful broadcast
   */
  async broadcastTx(hex: string): Promise<boolean> {
    try {
      this.ensurePendingInputsInitialized();

      const tx = bitcoin.Transaction.fromHex(hex);
      const spInputs: Array<{ txid: string; vout: number }> = [];

      // check each input against both pending inputs AND our SP UTXOs
      for (const input of tx.ins) {
        const txid = Buffer.from(input.hash).reverse().toString('hex');
        const vout = input.index;
        const inputKey = `${txid}:${vout}`;

        // check if it's in pending inputs OR if it's one of our SP UTXOs
        const isSpUtxo = this._utxo.some(u => u.txid === txid && u.vout === vout && 'tweak' in u);

        if (this._sp_pending_inputs.has(inputKey) || isSpUtxo) {
          spInputs.push({ txid, vout });
        }
      }

      // broadcast using parent implementation
      const txid = await super.broadcastTx(hex);

      // only after successful broadcast, mark SP UTXOs as spent
      if (txid && spInputs.length > 0) {
        const broadcastedTxid = tx.getId();

        // start with 0, subtract our inputs, add our outputs (change)
        let value = 0;

        // subtract all SP inputs (money leaving our wallet)
        for (const { txid: inputTxid, vout } of spInputs) {
          const utxo = this._utxo.find(u => u.txid === inputTxid && u.vout === vout);
          if (utxo) {
            value -= utxo.value;
          } else {
            console.warn(`[SP] UTXO not found for input ${inputTxid}:${vout}, value calculation may be incorrect`);
          }
        }

        // add back any outputs going to our addresses (change)
        for (const output of tx.outs) {
          try {
            const address = bitcoin.address.fromOutputScript(output.script, bitcoin.networks.bitcoin);
            if (this.weOwnAddress(address)) {
              value += Number(output.value);
            }
          } catch (e) {
            // If we can't decode the address, assume it's not ours
            console.warn('[SP] Failed to decode output address for value calculation:', e);
          }
        }

        const spendingTx: Transaction = {
          txid: broadcastedTxid,
          hash: broadcastedTxid,
          version: tx.version,
          size: tx.byteLength(),
          vsize: tx.virtualSize(),
          weight: tx.weight(),
          locktime: tx.locktime,
          value,
          confirmations: 0,
          blockhash: '',
          time: Math.floor(Date.now() / 1000),
          blocktime: Math.floor(Date.now() / 1000),
          timestamp: Math.floor(Date.now() / 1000),
          inputs: spInputs.map((input, idx) => ({
            txid: input.txid,
            vout: input.vout,
            scriptSig: { asm: '', hex: '' },
            txinwitness: [],
            sequence: tx.ins[idx]?.sequence || 0xfffffffd,
            addresses: [this.getSilentPaymentAddress() || ''],
            value: this._utxo.find(u => u.txid === input.txid && u.vout === input.vout)?.value || 0,
          })),
          outputs: tx.outs.map((output, n) => {
            // Decode the address from the output script
            let addresses: string[] = [];
            try {
              const address = bitcoin.address.fromOutputScript(output.script, bitcoin.networks.bitcoin);
              addresses = [address];
            } catch (e) {
              // If address decoding fails, leave empty
              console.warn('[SP] Failed to decode output address:', e);
            }

            return {
              value: Number(output.value),
              n,
              scriptPubKey: {
                asm: '',
                hex: Buffer.from(output.script).toString('hex'),
                reqSigs: 1,
                type:
                  output.script[0] === 0x00 && output.script[1] === 0x14
                    ? 'witness_v0_keyhash'
                    : output.script[0] === 0x51 && output.script[1] === 0x20
                      ? 'witness_v1_taproot'
                      : 'unknown',
                addresses,
              },
            };
          }),
        };

        this._sp_spending_txs.push(spendingTx);

        for (const { txid: inputTxid, vout } of spInputs) {
          const inputKey = `${inputTxid}:${vout}`;
          this._sp_pending_inputs.delete(inputKey);
          this.markUTXOAsSpent(inputTxid, vout);
        }
        this.fetchUtxo().catch(error => console.warn('[SP] Post-broadcast fetchUtxo failed:', error));

        this.onPersistCallback?.();
        this.onBalanceChangeCallback?.();
      }

      return txid;
    } catch (error) {
      this.releaseUTXOsFromTx(hex);
      throw error;
    }
  }

  clearCache(): void {
    if (this.transactionProcessor) {
      this.transactionProcessor.clear();
      this.transactionProcessor = null;
    }

    if (this.cachedSeed) {
      this.cachedSeed.fill(0);
      this.cachedSeed = null;
    }

    this.stopPolling();
    this.invalidateUTXOCache();
    this._sp_pending_inputs = new Set();
    this.onBalanceChangeCallback = null;
    this.onPersistCallback = null;
    this._onScanStateChangeCallback = null;
    this._scanState = IDLE_SCAN_STATE;
    this._scanPaused = false;
    this._scanResumeResolver = null;
    this._scanResumePromise = null;
    this._scanSamples = [];
  }
}
