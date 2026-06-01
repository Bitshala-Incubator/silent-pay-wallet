import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The 'RustJsiBridge' module is not properly linked. ` +
  `Please ensure you've rebuilt the app after adding the native module.\n\n` +
  Platform.select({
    ios: "- Run 'cd ios && pod install && cd ..'\n",
    android: '- Ensure CMakeLists.txt is properly configured\n',
    default: '',
  }) +
  `- Rebuild the app (npx react-native run-ios or run-android)`;

const RustJsiBridgeModule = NativeModules.RustJsiBridge
  ? NativeModules.RustJsiBridge
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      },
    );

export interface RustMatchedUTXO {
  txid: string;
  vout: number;
  value: number;
  height: number;
  pubKey: string;
  tweakHex: string;
  blockHash: string;
  blockTime: number;
  isSpent: boolean;
}

export interface RustBatchScanResult {
  matchedUtxos: RustMatchedUTXO[];
  transactionsScanned: number;
  outputsScanned: number;
}

interface RustErrorResult {
  error: string;
}

interface RustJsiBridgeGlobal {
  spScanTransactions: (scanPrivkeyHex: string, spendPubkeyHex: string, transactionsJson: string) => string;
  spScanSingleTransaction: (scanPrivkeyHex: string, spendPubkeyHex: string, transactionJson: string) => string;
}

let isInstalled = false;

export function initializeRustJsiBridge(): boolean {
  if (isInstalled) {
    return true;
  }

  try {
    const result = RustJsiBridgeModule.install();
    if (result) {
      isInstalled = true;
      console.log('✅ Rust JSI Bridge installed successfully');
    }
    return result;
  } catch (error) {
    console.error('❌ Failed to install Rust JSI Bridge:', error);
    return false;
  }
}

// Type-safe wrappers for JSI functions
const getGlobal = (): RustJsiBridgeGlobal => {
  return global as any as RustJsiBridgeGlobal;
};

export function spScanTransactions<
  T extends {
    id: string;
    blockHeight: number;
    blockHash: string;
    blockTime: number;
    scanTweak: string;
    outputs: Array<{ transactionId: string; vout: number; pubKey: string; value: number; isSpent: boolean | number }>;
  },
>(scanPrivkeyHex: string, spendPubkeyHex: string, transactions: T[]): RustBatchScanResult {
  if (!isInstalled) {
    throw new Error('RustJsiBridge not installed. Call initializeRustJsiBridge() first.');
  }

  const transactionsJson = JSON.stringify(transactions);
  const resultJson = getGlobal().spScanTransactions(scanPrivkeyHex, spendPubkeyHex, transactionsJson);
  const result: RustBatchScanResult | RustErrorResult = JSON.parse(resultJson);

  if ('error' in result) {
    throw new Error(`Rust scan error: ${result.error}`);
  }

  return result;
}

export function spScanSingleTransaction<
  T extends {
    id: string;
    blockHeight: number;
    blockHash: string;
    blockTime: number;
    scanTweak: string;
    outputs: Array<{ transactionId: string; vout: number; pubKey: string; value: number; isSpent: boolean | number }>;
  },
>(scanPrivkeyHex: string, spendPubkeyHex: string, transaction: T): RustMatchedUTXO[] {
  if (!isInstalled) {
    throw new Error('RustJsiBridge not installed. Call initializeRustJsiBridge() first.');
  }

  const transactionJson = JSON.stringify(transaction);
  const resultJson = getGlobal().spScanSingleTransaction(scanPrivkeyHex, spendPubkeyHex, transactionJson);
  const result: RustMatchedUTXO[] | RustErrorResult = JSON.parse(resultJson);

  if ('error' in result) {
    throw new Error(`Rust scan error: ${(result as RustErrorResult).error}`);
  }

  return result as RustMatchedUTXO[];
}
