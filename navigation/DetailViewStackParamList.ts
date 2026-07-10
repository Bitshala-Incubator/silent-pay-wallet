import { Transaction, TWallet } from '../class/wallets/types';
import { ElectrumServerItem } from '../screen/settings/ElectrumSettings';
import { SendDetailsParams } from './SendDetailsStackParamList';
import { AddWalletStackParamList } from './AddWalletStack';

export type ScanQRCodeParamList = {
  cameraStatusGranted?: boolean;
  backdoorPressed?: boolean;
  launchedBy?: string;
  urTotal?: number;
  urHave?: number;
  backdoorText?: string;
  onBarScanned?: (data: string) => void;
  showFileImportButton?: boolean;
  backdoorVisible?: boolean;
  orientation?: 'portrait';
  animatedQRCodeData?: Record<string, any>;
};

export type DetailViewStackParamList = {
  DrawerRoot: undefined;
  UnlockWithScreen: undefined;
  WalletsList: { onBarScanned?: string };
  TransactionDetails: { tx: Transaction; hash: string; walletID: string };
  TransactionStatus: { hash: string; walletID?: string };
  Broadcast: object;
  Success: undefined;
  AddWalletRoot?: {
    screen?: keyof AddWalletStackParamList;
    params?: AddWalletStackParamList[keyof AddWalletStackParamList];
  };
  SendDetailsRoot: SendDetailsParams;
  WalletExportRoot: undefined;
  Settings: undefined;
  Currency: undefined;
  PlausibleDeniability: undefined;
  Licensing: undefined;
  About: undefined;
  ElectrumSettings: { server?: ElectrumServerItem; onBarScanned?: string };
  EncryptStorage: undefined;
  SelfTest: undefined;
  ReceiveDetails: {
    walletID?: string;
    address: string;
  };
  ScanQRCode: ScanQRCodeParamList;
  Onboarding: undefined;
  DeleteWallet: undefined;
  TrackPayment: undefined;
  PaymentFound: { txid: string; blockHeight: number; tipHeight: number };
  NoPaymentFound: undefined;
  SyncScreen: undefined;
};
