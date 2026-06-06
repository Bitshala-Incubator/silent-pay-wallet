export {
  getScanPrivateKey,
  getSpendPrivateKey,
  getScanPublicKey,
  getSpendPublicKey,
  getSilentPaymentAddress,
} from './SilentPaymentKeyDerivation';
export type {
  IndexerTransaction,
  SilentPaymentUTXO,
  SilentPaymentUTXOSerializable,
  ScanProgressCallback,
  ScanProgress,
  ScanStatus,
  ScanStateInfo,
  IScannableWallet,
  ScanCredentials,
  StagedScanData,
} from './types';
export { IDLE_SCAN_STATE, isScannable } from './types';

export { RustTransactionProcessor, createTransactionProcessor } from './RustTransactionProcessor';
// NOTE: the background-scan runtime modules (BackgroundScanTask, ScanStagingStore,
// BackgroundScanCredentials, ScanLock) are deliberately NOT re-exported here — this
// barrel is imported by wallet classes that must stay loadable outside React Native
// (cli/tests), and those modules pull in NativeModules/AsyncStorage/loc. Import them
// from their files directly.
