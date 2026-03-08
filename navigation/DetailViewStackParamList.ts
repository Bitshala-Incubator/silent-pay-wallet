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
  WalletTransactions: { isLoading?: boolean; walletID: string; walletType: string; onBarScanned?: string };
  WalletDetails: { walletID: string };
  TransactionDetails: { tx: Transaction; hash: string; walletID: string };
  TransactionStatus: { hash: string; walletID?: string };
  CPFP: {
    wallet: TWallet | null;
    txid: string;
  };
  RBFBumpFee: { txid: string; wallet: TWallet | null };
  RBFCancel: { txid: string; wallet: TWallet | null };
  Broadcast: object;
  IsItMyAddress: object;
  GenerateWord: undefined;
  Success: undefined;
  WalletAddresses: { walletID: string };
  AddWalletRoot?: {
    screen?: keyof AddWalletStackParamList;
    params?: AddWalletStackParamList[keyof AddWalletStackParamList];
  };
  SendDetailsRoot: SendDetailsParams;
  WalletExportRoot: undefined;
  Settings: undefined;
  Currency: undefined;
  GeneralSettings: undefined;
  PlausibleDeniability: undefined;
  Licensing: undefined;
  NetworkSettings: undefined;
  TorSettings: undefined;
  About: undefined;
  DefaultView: undefined;
  ElectrumSettings: { server?: ElectrumServerItem; onBarScanned?: string };
  SettingsBlockExplorer: undefined;
  EncryptStorage: undefined;
  Language: undefined;
  NotificationSettings: undefined;
  SelfTest: undefined;
  ReleaseNotes: undefined;
  ToolsScreen: undefined;
  SettingsPrivacy: undefined;
  WalletXpubRoot: undefined;
  SignVerifyRoot: {
    screen: 'SignVerify';
    params: {
      walletID: string;
      address: string;
    };
  };
  ReceiveDetails: {
    walletID?: string;
    address: string;
  };
  ScanQRCode: ScanQRCodeParamList;
  PaymentCodeList: {
    paymentCode: string;
    walletID: string;
  };
  Onboarding: undefined;
  DeleteWallet: undefined;
};
