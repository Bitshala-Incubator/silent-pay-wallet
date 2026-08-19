import * as bip39 from 'bip39';
import { Buffer } from 'buffer';
import { ECPairFactory } from 'ecpair';
import { SilentPayment, UTXOType as SPUTXOType, UTXO as SPLibUTXO } from 'silent-payments';
import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet.ts';
import { getDefaultIndexer } from '../../modules/SilentPaymentIndexer';
import ecc from '../../modules/noble_ecc';
import { calculateSumOfPrivateKeys, createInputHash, scanOutputs, type PrivateKey } from '@silent-pay/core';
import {
  getSilentPaymentAddress,
  getSilentPaymentChangeAddress,
  getScanPrivateKey,
  getSpendPrivateKey,
  getSpendPublicKey,
  getSilentPaymentChangeSpendPrivateKey,
  getSilentPaymentChangeSpendPublicKey,
  getSilentPaymentChangeLabelMap,
  SP_CHANGE_LABEL,
  RustTransactionProcessor,
  createTransactionProcessor,
  type IndexerTransaction,
  type SilentPaymentUTXO,
  type SilentPaymentUTXOSerializable,
  type ScanProgressCallback,
  type ScanStateInfo,
  type ScanStatus,
  IDLE_SCAN_STATE,
  type IScannableWallet,
} from '../../helpers/silent-payments';
import { BIP352_ACTIVATION_HEIGHT } from '../../modules/constants';
import { planSplitOutputs, SPEND_INPUT_VBYTES, OUTPUT_VBYTES } from '../../helpers/silent-payments';
import { CreateTransactionResult, CreateTransactionTarget, CreateTransactionUtxo, SplitOptions, Transaction, Utxo } from './types.ts';
import { CoinSelectOutput, CoinSelectReturnInput } from 'coinselect';
import * as bitcoin from 'bitcoinjs-lib';
import { HDTaprootWallet } from './hd-taproot-wallet.ts';
import { randomBytes } from '../rng';

const ECPair = ECPairFactory(ecc);

/** A spend keypair a silent payment output can belong to (main, or label-0 change). */
interface SpendKeyPair {
  spendPriv: Uint8Array;
  spendPub: Uint8Array;
}

// Minimum gap between scan-progress state emissions, to avoid flooding React with re-renders.
const SCAN_PROGRESS_THROTTLE_MS = 500;
// Number of recent progress samples kept for the windowed ETA throughput estimate.
const SCAN_ETA_ROLLING_WINDOW = 10;
// Maximum fee rate at which opportunistic input obfuscation is attempted
const MAX_SPLIT_FEE_RATE_SATS_VB = 10;
// fixed cap on the input-obfuscation loop, every added input is a *certain*
// common-input-ownership linkage paid to defeat a *probabilistic* heuristic, so bound how much
// of the wallet the tradeoff can link. This also bounds the fee it can cost: obfuscation only
// runs below MAX_SPLIT_FEE_RATE_SATS_VB, so the worst case is 2 * ceil(58 * 9.99) = 1160 sats.
// Raising this cap re-opens that, so pair any increase with an explicit fee ceiling.
const MAX_OBFUSCATION_INPUTS = 2;

export class HDSilentPaymentsWallet extends HDTaprootWallet implements IScannableWallet {
  static readonly type = 'HDSilentPaymentsWallet';
  static readonly typeReadable = 'HD Silent Payments';
  // @ts-ignore: override
  public readonly type = HDSilentPaymentsWallet.type;
  // @ts-ignore: override
  public readonly typeReadable = HDSilentPaymentsWallet.typeReadable;

  private readonly POLLING_INTERVAL_MS = 30000;
  private cachedSeed: Buffer | null = null;
  private spendKeyCandidates: SpendKeyPair[] | null = null;
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
    this._scanState = {
      ...this._scanState,
      status,
      ...overrides,
      lastScannedBlock: this.lastScannedBlock,
    };
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
    const existing = this._utxo.find(u => `${u.txid}:${u.vout}` === key) as SilentPaymentUTXO | undefined;

    if (existing) {
      // The post-broadcast scan stores a placeholder with height 0 and no block hash.
      // Reconcile it when the indexer later returns the confirmed record, otherwise the
      // placeholder metadata sticks forever.
      if (existing.height === 0 && utxo.height > 0) {
        existing.height = utxo.height;
        existing.blockHash = utxo.blockHash;
        existing.blockTime = utxo.blockTime;
        this.invalidateUTXOCache();
      }
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

  getSilentPaymentChangeAddress(): string {
    const seed = this.getSeed();
    return getSilentPaymentChangeAddress(seed);
  }

  /**
   * The change address that `createTransaction` will actually use for these UTXOs.
   *
   * Only `createSPTransaction` can consume a silent payment change address — the parent
   * builder feeds change straight to `psbt.addOutput`, which cannot encode an `sp1` address.
   * So the label-0 address is only valid when every selected UTXO is SP, which is exactly
   * the condition that routes to the SP builder.
   *
   * Callers that need the change address up front (e.g. to filter it out of a recipient
   * list) must use this rather than deciding for themselves.
   */
  getChangeAddressForUtxos(utxos: CreateTransactionUtxo[], fallbackChangeAddress: string): string {
    const allSp = utxos.length > 0 && utxos.every(u => 'tweak' in u && u.tweak instanceof Uint8Array);
    return allSp ? this.getSilentPaymentChangeAddress() : fallbackChangeAddress;
  }

  getSpendPrivateKey(): Uint8Array {
    const seed = this.getSeed();
    return getSpendPrivateKey(seed);
  }

  getSpendPublicKey(): Uint8Array {
    const seed = this.getSeed();
    return getSpendPublicKey(seed);
  }

  /** Every spend key this wallet can own an output under: the main one and label-0 change. */
  private getSpendKeyCandidates(): SpendKeyPair[] {
    if (!this.spendKeyCandidates) {
      const seed = this.getSeed();
      this.spendKeyCandidates = [
        { spendPriv: getSpendPrivateKey(seed), spendPub: getSpendPublicKey(seed) },
        { spendPriv: getSilentPaymentChangeSpendPrivateKey(seed), spendPub: getSilentPaymentChangeSpendPublicKey(seed) },
      ];
    }
    return this.spendKeyCandidates;
  }

  /**
   * Pick the spend key that actually owns this UTXO.
   *
   * A UTXO is either a normal SP receive (main spend key) or our own label-0 change
   * (labeled spend key). This is derived rather than remembered: exactly one of
   * `B_main + tweak` and `B_change + tweak` reproduces the output key, so the answer
   * verifies itself and cannot drift with stale persisted metadata.
   */
  private resolveSpendKeys(spUtxo: SilentPaymentUTXO): SpendKeyPair {
    const outputKey = Buffer.from(spUtxo.pubKey, 'hex');
    if (outputKey.length !== 32) {
      throw new Error(`UTXO ${spUtxo.txid}:${spUtxo.vout}: pubKey must be 32-byte x-only, got ${outputKey.length}`);
    }

    for (const candidate of this.getSpendKeyCandidates()) {
      const tweakedPub = ecc.pointAddScalar(candidate.spendPub, spUtxo.tweak, true);
      if (tweakedPub && outputKey.equals(Buffer.from(tweakedPub.subarray(1, 33)))) {
        return candidate;
      }
    }

    throw new Error(
      `UTXO ${spUtxo.txid}:${spUtxo.vout}: no spend key reproduces the stored output key ` +
        `(tried the main key and label-${SP_CHANGE_LABEL} change) — its tweak or pubKey is wrong`,
    );
  }

  private getSeed(): Buffer {
    if (this.cachedSeed) return this.cachedSeed;

    const mnemonic = this.secret;
    this.cachedSeed = bip39.mnemonicToSeedSync(mnemonic, '');
    return this.cachedSeed;
  }

  private async processTransactions(transactions: IndexerTransaction[]): Promise<{ utxos: SilentPaymentUTXO[]; lastScannedBlock: number }> {
    this.ensureTransactionProcessor();

    const validTransactions = transactions.filter(tx => tx.scanTweak && tx.outputs && tx.outputs.length > 0);

    // Derive the highest block height from transactions
    const maxBlockHeight = validTransactions.reduce((max, tx) => Math.max(max, tx.blockHeight), this.lastScannedBlock);

    const newUTXOs = await this.transactionProcessor!.processBatch(validTransactions, () => this.cancelScanCallbackScan);

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

  isScanActive(): boolean {
    return this.activeScanPromise !== null;
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

      this._emitScanState('scanning', {
        startedAt: this._scanStartTime,
        progress: null,
        eta: null,
        etaComputedAt: null,
        error: null,
      });

      let totalUTXOsAdded = 0;

      const wrappedProgress: ScanProgressCallback = async progress => {
        await this._waitIfPaused();
        if (this.activeScanPromise === null || this.cancelScanCallbackScan) return;

        this._scanSamples.push({
          t: Date.now(),
          percent: progress.percentComplete,
        });
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
        this._emitScanState('error', {
          error: 'Silent Payment Indexer not initialized.',
        });
        throw new Error('Silent Payment Indexer not initialized. Please configure the indexer first.');
      }

      console.error('[SP] Scan error:', error);
      this._emitScanState('error', {
        error: error.message ?? 'Unknown scan error',
      });
      throw error;
    }
  }

  async scanByTxid(txid: string): Promise<{
    found: boolean;
    utxosFound: number;
    blockHeight: number;
    tipHeight: number;
  }> {
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
      if (this._sp_spending_txs.some(tx => tx.txid === txid)) {
        continue;
      }
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
            addresses: [utxo.silentPaymentAddress || ''],
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

  // Derive `count` distinct sequential internal (change) addresses starting at
  // the current free change index. Deliberately does NOT advance the pointer:
  // planning runs many times per send (fee previews, RBF rebuilds) and would
  // leak indices toward the gap limit. Index `n` (the first one) is validated by
  // getChangeAddressAsync() before planning runs, same as the single-change case;
  // indices n+1..n+3 are only ever checked here, so broadcastTx() advances the
  // pointer past whichever of these a given tx actually used.
  private getChangeAddresses(count: number): string[] {
    const base = this.next_free_change_address_index;
    return Array.from({ length: count }, (_, i) => this._getInternalAddressByIndex(base + i));
  }

  // Advance next_free_change_address_index past any of this wallet's change indices that the
  // just-broadcast tx actually paid to, so a second send before the first confirms can't reuse
  // them (see getChangeAddresses above). Scans the same range gap-limit scanning already uses.
  private advanceChangeIndexPastUsedOutputs(tx: bitcoin.Transaction): void {
    let maxUsedIndex = -1;
    const searchLimit = this.next_free_change_address_index + this.gap_limit;

    for (const output of tx.outs) {
      let address: string;
      try {
        address = bitcoin.address.fromOutputScript(output.script, bitcoin.networks.bitcoin);
      } catch (e) {
        continue;
      }
      for (let c = this.next_free_change_address_index; c < searchLimit; c++) {
        if (this._getInternalAddressByIndex(c) === address) {
          maxUsedIndex = Math.max(maxUsedIndex, c);
          break;
        }
      }
    }

    if (maxUsedIndex >= this.next_free_change_address_index) {
      this.next_free_change_address_index = maxUsedIndex + 1;
    }
  }

  // Cryptographic Fisher–Yates shuffle so the change output is not positionally
  // identifiable among the transaction outputs.
  private shuffleOutputs<T>(arr: T[]): T[] {
    const out = arr.slice();
    if (out.length < 2) return out;
    const buf = randomBytes(out.length * 4);
    for (let i = out.length - 1; i > 0; i--) {
      const j = buf.readUInt32BE(i * 4) % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Build the blended output set for a split silent payment: payment outputs to
  // the recipient's sp address plus adaptive, distinct-addressed change outputs,
  // all shuffled.
  private planSplitTransaction(
    spAddress: string,
    paymentValue: number,
    changeValue: number,
    feeRate: number,
    coinSelectOutputCount: number,
    precalculatedPaymentAmounts?: number[],
    splitChange?: boolean,
  ): { outputs: CoinSelectOutput[]; changeAddresses: string[] } {
    const { paymentAmounts, changeAmounts } = planSplitOutputs({
      paymentValue,
      changeValue,
      feeRate,
      coinSelectOutputCount,
      precalculatedPaymentAmounts,
      splitChange,
    });
    const paymentOutputs: CoinSelectOutput[] = paymentAmounts.map(value => ({
      address: spAddress,
      value,
    }));
    const changeAddresses = this.getChangeAddresses(changeAmounts.length);
    const changeOutputs: CoinSelectOutput[] = changeAmounts.map((value, i) => ({
      address: changeAddresses[i],
      value,
    }));
    const outputs = this.shuffleOutputs([...paymentOutputs, ...changeOutputs]);
    return { outputs, changeAddresses };
  }

  // Obfuscates the "unnecessary input heuristic" by opportunistically selecting more
  // inputs until the change value is strictly greater than any individual input in the tx.
  // This causes the heuristic to fail, as both the real payment and the change output
  // interpretations will have apparent "unnecessary" inputs.
  // We only run this when fees are low (<MAX_SPLIT_FEE_RATE_SATS_VB sats/vB) and when performing a split payment.
  private obfuscateUnnecessaryInputHeuristic(
    inputs: CoinSelectReturnInput[],
    rawOutputs: CoinSelectOutput[],
    availableUtxos: CreateTransactionUtxo[],
    feeRate: number,
  ): { inputs: CoinSelectReturnInput[]; rawOutputs: CoinSelectOutput[] } {
    if (feeRate >= MAX_SPLIT_FEE_RATE_SATS_VB) return { inputs, rawOutputs };
    if (inputs.length <= 1) return { inputs, rawOutputs };

    const selectedKeys = new Set(inputs.map(i => `${i.txid}:${i.vout}`));
    const unselectedUtxos = availableUtxos.filter(u => !selectedKeys.has(`${u.txid}:${u.vout}`));

    const changeValue = rawOutputs.find(o => !o.address)?.value ?? 0;
    const inputCost = Math.ceil(SPEND_INPUT_VBYTES * feeRate);
    // Frozen once, from the originally selected inputs only: an added input raising its own
    // bar (by being counted into a rolling max) is what makes the loop self-defeating.
    const maxInputValue = Math.max(...inputs.map(i => i.value));

    const reachableSlack = unselectedUtxos.reduce((sum, u) => sum + Math.max(0, u.value - inputCost), 0);
    if (changeValue + reachableSlack <= maxInputValue) return { inputs, rawOutputs };

    // Sort unselected descending by value to minimize the number of inputs added to cross the threshold
    unselectedUtxos.sort((a, b) => b.value - a.value);

    const currentInputs = [...inputs];
    let currentChangeValue = changeValue;

    for (const utxo of unselectedUtxos) {
      if (currentChangeValue > maxInputValue) break;
      if (currentInputs.length - inputs.length >= MAX_OBFUSCATION_INPUTS) break;

      const netValue = utxo.value - inputCost;
      if (netValue <= 0) continue;

      currentInputs.push(utxo as CoinSelectReturnInput);
      currentChangeValue += netValue;
    }

    if (currentInputs.length === inputs.length) return { inputs, rawOutputs }; // capped out before adding anything

    const newRawOutputs = rawOutputs.map(o => {
      if (!o.address) {
        return { ...o, value: currentChangeValue };
      }
      return o;
    });

    if (!newRawOutputs.some(o => !o.address) && currentChangeValue > 0) {
      const outputFee = Math.ceil(OUTPUT_VBYTES * feeRate);
      currentChangeValue = Math.max(0, currentChangeValue - outputFee);
      // Bail to the ORIGINAL, unexpanded inputs/outputs — pairing the expanded `currentInputs`
      // with stale `rawOutputs` here would silently under-account for the added inputs' value.
      if (currentChangeValue <= 0) return { inputs, rawOutputs };
      newRawOutputs.push({ value: currentChangeValue });
    }

    return { inputs: currentInputs, rawOutputs: newRawOutputs };
  }

  // Resolve sp1 targets to real Taproot addresses via sender-side BIP-352
  // derivation. Shared by both SP-UTXO and regular-UTXO senders — only the
  // source of each input's WIF differs between them.
  private resolveSPOutputs(
    inputWifs: Array<{ txid: string; vout: number; wif: string }>,
    plannedOutputs: CoinSelectOutput[],
  ): CoinSelectOutput[] {
    const libUtxos: SPLibUTXO[] = inputWifs.map(u => ({
      txid: u.txid,
      vout: u.vout,
      wif: u.wif,
      utxoType: 'p2tr' as SPUTXOType,
    }));
    const sp = new SilentPayment();
    const resolved = sp.createTransaction(libUtxos, plannedOutputs);
    return resolved.map((t, i) => ({
      ...plannedOutputs[i],
      address: t.address ?? plannedOutputs[i].address,
    }));
  }

  createTransaction(
    utxos: CreateTransactionUtxo[],
    targets: CreateTransactionTarget[],
    feeRate: number,
    changeAddress: string,
    sequence: number = AbstractHDElectrumWallet.finalRBFSequence,
    skipSigning = false,
    masterFingerprint: number = 0,
    splitOptions?: SplitOptions,
  ): CreateTransactionResult {
    if (targets.length === 0) throw new Error('No destination provided');
    if (utxos.length === 0) throw new Error('No UTXOs provided');

    const splitPayment = splitOptions?.enabled ?? false;
    const splitChange = splitOptions?.splitChange;
    const precalculatedPaymentAmounts = splitOptions?.precalculatedPaymentAmounts;
    const dryRun = splitOptions?.dryRun ?? false;

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
      return this.createSPTransaction(
        spUtxos,
        targets,
        feeRate,
        changeAddress,
        sequence,
        skipSigning,
        splitPayment,
        precalculatedPaymentAmounts,
        dryRun,
        splitChange,
      );
    }

    // Case 2: Only regular UTXOs - delegate to parent, unless a split to an SP
    // recipient was requested and is actually feasible for this payment.
    if (spUtxos.length === 0 && regularUtxos.length > 0) {
      const canSplit = splitPayment && targets.length === 1 && !!targets[0].address?.startsWith('sp1') && !!targets[0].value;
      if (canSplit) {
        const split = this.createSplitRegularToSPTransaction(
          regularUtxos,
          targets,
          feeRate,
          changeAddress,
          sequence,
          skipSigning,
          masterFingerprint,
          precalculatedPaymentAmounts,
          splitChange,
        );
        if (split) return split;
      }
      return super.createTransaction(regularUtxos, targets, feeRate, changeAddress, sequence, skipSigning, masterFingerprint);
    }

    // Case 3: Mixed UTXOs - not yet implemented
    throw new Error('Mixed UTXO spending (SP + regular) is not yet implemented. Please select only SP UTXOs or only regular UTXOs.');
  }

  // Split-payment builder for senders whose coinselected inputs are plain
  // (non-SP-tagged) Taproot UTXOs — e.g. a wallet that has never received via
  // silent payments but wants to split a payment to an SP recipient. Signing
  // uses the standard BIP-86 taproot tweak per input (_getWifForAddress +
  // TapTweak), unlike createSPTransaction which signs with an already-tweaked
  // BIP-352 receive key. Returns null when the planner declines to split
  // (below the economic floor, fee cap, or no change budget), so the caller
  // can fall back to the plain (proven, non-split) parent implementation.
  private createSplitRegularToSPTransaction(
    regularUtxos: CreateTransactionUtxo[],
    targets: CreateTransactionTarget[],
    feeRate: number,
    changeAddress: string,
    sequence: number,
    skipSigning: boolean,
    masterFingerprint: number,
    precalculatedPaymentAmounts?: number[],
    splitChange?: boolean,
  ): CreateTransactionResult | null {
    const spAddress = targets[0].address!;
    let { inputs, outputs: rawOutputs } = this.coinselect(regularUtxos, targets, feeRate);

    const obf = this.obfuscateUnnecessaryInputHeuristic(inputs, rawOutputs, regularUtxos, feeRate);
    inputs = obf.inputs;
    rawOutputs = obf.rawOutputs;

    const changeValue = rawOutputs.find(o => !o.address)?.value ?? 0;
    if (changeValue <= 0) return null;

    const split = this.planSplitTransaction(
      spAddress,
      targets[0].value!,
      changeValue,
      feeRate,
      rawOutputs.length,
      precalculatedPaymentAmounts,
      splitChange,
    );
    const paymentCount = split.outputs.filter(o => o.address === spAddress).length;
    if (paymentCount < 2) return null; // planner declined to split; let the caller fall back
    // A plan with no change output would pay `changeValue` to miners. planSplitOutputs already
    // declines to split in that case, but paymentCount alone can't see it — so never build a
    // tx that drops the change on the floor, whatever the planner returns.
    if (split.changeAddresses.length === 0) return null;

    const inputWifs = inputs.map(input => ({
      txid: input.txid,
      vout: input.vout,
      wif: this._getTaprootTweakedWifForAddress(String(input.address)),
    }));
    const outputs = this.resolveSPOutputs(inputWifs, split.outputs);

    // Shared with the parent's plain createTransaction: same signing path (standard per-address
    // WIF + BIP-86 tweak), same output-metadata rules — so change here carries bip32Derivation /
    // tapBip32Derivation / tapInternalKey for external signers, same as a non-split send.
    const { psbt, tx } = this._buildAndSignPsbt(inputs, outputs, split.changeAddresses, sequence, skipSigning, masterFingerprint);

    const totalIn = inputs.reduce((sum, i) => sum + i.value, 0);
    const totalOut = outputs.reduce((sum, o) => sum + o.value, 0);

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
      fee: totalIn - totalOut,
      changeAddresses: split.changeAddresses,
    };
  }

  private createSPTransaction(
    spUtxos: SilentPaymentUTXO[],
    targets: CreateTransactionTarget[],
    feeRate: number,
    changeAddress: string,
    sequence: number,
    skipSigning: boolean,
    splitPayment = false,
    precalculatedPaymentAmounts?: number[],
    dryRun = false,
    splitChange?: boolean,
  ): CreateTransactionResult {
    if (targets.length === 0) throw new Error('No destination provided');

    let { inputs, outputs: rawOutputs } = this.coinselect(spUtxos as CreateTransactionUtxo[], targets, feeRate);
    const utxoMap = new Map(spUtxos.map(u => [`${u.txid}:${u.vout}`, u]));

    let plannedOutputs = rawOutputs;
    let changeAddresses: string[] = [changeAddress];
    const changeValue = rawOutputs.find(o => !o.address)?.value ?? 0;
    const canSplit =
      splitPayment && targets.length === 1 && !!targets[0].address?.startsWith('sp1') && !!targets[0].value && changeValue > 0;
    if (canSplit) {
      const originalInputs = inputs;
      const originalRawOutputs = rawOutputs;
      const obf = this.obfuscateUnnecessaryInputHeuristic(inputs, rawOutputs, spUtxos as CreateTransactionUtxo[], feeRate);
      inputs = obf.inputs;
      rawOutputs = obf.rawOutputs;

      const coinSelectOutputCount = rawOutputs.length;
      const planned = this.planSplitTransaction(
        targets[0].address!,
        targets[0].value!,
        obf.rawOutputs.find(o => !o.address)?.value ?? 0,
        feeRate,
        coinSelectOutputCount,
        precalculatedPaymentAmounts,
        splitChange,
      );

      const paymentCount = planned.outputs.filter(o => o.address === targets[0].address).length;
      // changeAddresses.length === 0 means the plan has no change output, which would pay the
      // whole change to miners — revert rather than build it (see createSplitRegularToSPTransaction).
      if (paymentCount >= 2 && planned.changeAddresses.length > 0) {
        plannedOutputs = planned.outputs;
        changeAddresses = planned.changeAddresses;
      } else {
        inputs = originalInputs;
        rawOutputs = originalRawOutputs;
      }
    }
    // Fill the change address in before BIP-352 resolution: our own change address is itself an
    // sp1 address whenever every input is an SP UTXO, so it has to be derived like any other
    // sp1 output rather than handed to psbt.addOutput raw.
    let outputs: CoinSelectOutput[] = plannedOutputs.map(o => ({ ...o, address: o.address || changeAddress }));
    const hasSPOutput = outputs.some(o => o.address?.startsWith('sp1'));

    this.ensurePendingInputsInitialized();

    // Reserve UTXOs to prevent double-spend attempts. Skipped for dry runs (preview-only calls
    // from SendDetails) — this set is persisted and only released on error/broadcast, so a
    // repeated preview would otherwise grow it without bound.
    const inputKeys = inputs.map(input => `${input.txid}:${input.vout}`);
    if (!dryRun) inputKeys.forEach(key => this._sp_pending_inputs.add(key));

    try {
      // Resolve each input's spend key once. `resolveSpendKeys` derives which key owns the
      // UTXO from its own tweak/pubKey, so it doubles as the check that the stored UTXO is
      // internally consistent before we build anything.
      const resolvedInputs = inputs.map(input => {
        const spUtxo = utxoMap.get(`${input.txid}:${input.vout}`);
        if (!spUtxo) {
          throw new Error(`UTXO not found: ${input.txid}:${input.vout}`);
        }

        const { spendPriv, spendPub } = this.resolveSpendKeys(spUtxo);
        const tweakedPriv = ecc.privateAdd(spendPriv, spUtxo.tweak);
        if (!tweakedPriv) {
          throw new Error(`UTXO ${input.txid}:${input.vout}: failed to compute tweaked private key`);
        }

        return { input, spendPub, tweakedPriv, outputKey: Buffer.from(spUtxo.pubKey, 'hex') };
      });

      // Resolve sp1 targets to real Taproot addresses via sender-side BIP-352 derivation.
      // The library groups targets by recipient and increments k for each output in the group.
      if (hasSPOutput) {
        const inputWifs = resolvedInputs.map(({ input, tweakedPriv }) => ({
          txid: input.txid,
          vout: input.vout,
          wif: ECPair.fromPrivateKey(Buffer.from(tweakedPriv), { compressed: true }).toWIF(),
        }));
        outputs = this.resolveSPOutputs(inputWifs, outputs);
      }

      const psbt = new bitcoin.Psbt();

      // add taproot inputs with tweaked public keys
      resolvedInputs.forEach(({ input, spendPub, outputKey }) => {
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
          tapInternalKey: Buffer.from(spendPub.subarray(1, 33)),
        });
      });

      outputs.forEach(output => {
        const address = output.address || changeAddress;
        if (!address) {
          throw new Error('Transaction output is missing an address');
        }
        if (output.value === undefined || output.value === null) {
          throw new Error(`Transaction output to ${address} is missing a value`);
        }
        psbt.addOutput({
          address,
          value: BigInt(output.value),
        });
      });

      let tx: bitcoin.Transaction | undefined;

      if (!skipSigning) {
        // sign each input with its tweaked key pair
        resolvedInputs.forEach(({ tweakedPriv }, idx) => {
          const tweakedKeyPair = ECPair.fromPrivateKey(Buffer.from(tweakedPriv), { compressed: true });
          psbt.signTaprootInput(idx, tweakedKeyPair);
        });

        psbt.finalizeAllInputs();
        tx = psbt.extractTransaction();
      }

      const totalIn = inputs.reduce((sum, i) => sum + i.value, 0);
      const totalOut = outputs.reduce((sum, o) => sum + o.value, 0);
      const recomputedFee = totalIn - totalOut;

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
        fee: recomputedFee,
        changeAddresses,
      };
    } catch (error) {
      // If transaction creation fails, release the reserved UTXOs
      inputKeys.forEach(key => this._sp_pending_inputs.delete(key));
      throw error;
    }
  }

  /**
   * Scan a transaction we just built for silent payment outputs belonging to us — in
   * practice our label-0 change, but a self-payment to the main address is found too.
   *
   * Every input must be ours: the BIP-352 input hash is computed over *all* of them, so a
   * foreign or regular input would silently produce a wrong tweak that matches nothing.
   *
   * Note the tweak stored here already carries the label offset for a change match (that is
   * what the label map buys us), so change found this way is spendable with the *main*
   * spend key, whereas the Rust scanner reports the raw tweak against the labeled key.
   * Both are handled because `resolveSpendKeys` derives the owning key per UTXO.
   */
  private scanBroadcastedTxForOurOutputs(tx: bitcoin.Transaction, broadcastedTxid: string): void {
    const ourInputs = tx.ins.map(input => ({
      txid: Buffer.from(input.hash).reverse().toString('hex'),
      vout: input.index,
    }));

    const inputPrivKeys: PrivateKey[] = [];
    for (const { txid, vout } of ourInputs) {
      const spUtxo = this._utxo.find(u => u.txid === txid && u.vout === vout) as SilentPaymentUTXO | undefined;
      if (!spUtxo || !('tweak' in spUtxo)) {
        console.warn(`[SP] Skipping instant change scan: input ${txid}:${vout} is not one of our SP UTXOs`);
        return;
      }
      const { spendPriv } = this.resolveSpendKeys(spUtxo);
      const tweakedPriv = ecc.privateAdd(spendPriv, spUtxo.tweak);
      if (!tweakedPriv) {
        console.warn(`[SP] Skipping instant change scan: could not tweak the key for input ${txid}:${vout}`);
        return;
      }
      inputPrivKeys.push({ key: Buffer.from(tweakedPriv).toString('hex'), isXOnly: true });
    }

    const sumOfInputPrivKeys = calculateSumOfPrivateKeys(inputPrivKeys);
    const sumOfInputPubKeys = ecc.pointFromScalar(sumOfInputPrivKeys, true);
    if (!sumOfInputPubKeys) {
      console.warn('[SP] Skipping instant change scan: summed input keys are not a valid point');
      return;
    }

    // BIP-352 keys the input hash on the lexicographically smallest outpoint,
    // serialised as reverse(txid) || vout (little endian).
    const smallestOutpoint = [...ourInputs].sort((a, b) => {
      const serialise = (o: { txid: string; vout: number }) => {
        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(o.vout);
        return Buffer.concat([Buffer.from(o.txid, 'hex').reverse(), buf]);
      };
      return Buffer.compare(serialise(a), serialise(b));
    })[0];

    // Taproot outputs as the 33-byte even-Y pubkeys the scanner compares against.
    const outputsByHex = new Map<string, number>();
    tx.outs.forEach((out, idx) => {
      if (out.script.length === 34 && out.script[0] === 0x51 && out.script[1] === 0x20) {
        const compressed = Buffer.concat([Buffer.from([0x02]), Buffer.from(out.script.subarray(2))]);
        outputsByHex.set(compressed.toString('hex'), idx);
      }
    });
    if (outputsByHex.size === 0) return;

    const seed = this.getSeed();
    const matches = scanOutputs(
      getScanPrivateKey(seed),
      getSpendPublicKey(seed),
      sumOfInputPubKeys,
      createInputHash(sumOfInputPubKeys, smallestOutpoint),
      [...outputsByHex.keys()].map(hex => Buffer.from(hex, 'hex')),
      getSilentPaymentChangeLabelMap(seed),
    );

    const blockTime = Math.floor(Date.now() / 1000);
    for (const [outputHex, tweak] of matches) {
      const vout = outputsByHex.get(outputHex);
      if (vout === undefined) continue;

      const pubKey = outputHex.slice(2); // drop the 0x02 prefix back to x-only
      this.addUTXO({
        txid: broadcastedTxid,
        vout,
        value: Number(tx.outs[vout].value),
        height: 0,
        address: bitcoin.payments.p2tr({ pubkey: Buffer.from(pubKey, 'hex') }).address!,
        silentPaymentAddress: this.getSilentPaymentAddress()!,
        pubKey,
        tweak,
        blockHash: '',
        isSpent: false,
        blockTime,
      });
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

      if (txid) {
        // getChangeAddresses() deliberately doesn't probe Electrum or advance the pointer while
        // planning (previews/RBF rebuilds shouldn't burn indices toward the gap limit) — so a
        // split tx's non-primary change indices (n+1..n+3) are never validated or advanced.
        // A second send before the first confirms would then reuse all of them. Advance past
        // whatever this broadcast actually used; over-advancing on an RBF-replaced tx is
        // harmless (the gap limit absorbs it, and unused indices are re-derived by discovery).
        // Persisted here rather than relying on the SP-input block below: a split funded by
        // plain (non-SP) UTXOs has no spInputs, so that block never runs and the advanced
        // pointer would be lost on reload — reusing the same change indices on the next send.
        this.advanceChangeIndexPastUsedOutputs(tx);
        this.onPersistCallback?.();
      }

      // only after successful broadcast, mark SP UTXOs as spent
      if (txid && spInputs.length > 0) {
        const broadcastedTxid = tx.getId();

        // -------------------------
        // INSTANT SP CHANGE SCAN
        // -------------------------
        // Our own change is a silent payment output, so `weOwnAddress` can't see it and it
        // would stay invisible until the next indexer scan. Rebuild the scan data from the
        // inputs we just signed and scan this transaction locally.
        try {
          this.scanBroadcastedTxForOurOutputs(tx, broadcastedTxid);
        } catch (scanError) {
          console.warn('[SP] Post-broadcast instant scan failed:', scanError);
        }

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
        for (let idx = 0; idx < tx.outs.length; idx++) {
          const output = tx.outs[idx];

          // Any SP output of this tx that our scan claimed is ours — change *or* a
          // self-payment to the main address, both of which `weOwnAddress` cannot see.
          const isSpOutputOfOurs = this._utxo.some(u => u.txid === broadcastedTxid && u.vout === idx && 'tweak' in u);
          if (isSpOutputOfOurs) {
            value += Number(output.value);
            continue;
          }

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

    if (this.spendKeyCandidates) {
      this.spendKeyCandidates.forEach(({ spendPriv }) => spendPriv.fill(0));
      this.spendKeyCandidates = null;
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
