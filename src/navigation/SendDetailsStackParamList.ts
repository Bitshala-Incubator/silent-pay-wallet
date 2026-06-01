import { Psbt } from 'bitcoinjs-lib';
import { CreateTransactionTarget, CreateTransactionUtxo } from '../class/wallets/types';
import { BitcoinUnit } from '../models/bitcoinUnits';
import { ScanQRCodeParamList } from './DetailViewStackParamList';
import { IFee } from '../screens/send/SendDetails';
import { NetworkTransactionFeeType } from '../models/networkTransactionFees';

export type SendDetailsParams = {
  transactionMemo?: string;
  isTransactionReplaceable?: boolean;
  feeUnit?: BitcoinUnit;
  frozenBalance?: number;
  amountUnit?: BitcoinUnit;
  address?: string;
  amount?: number;
  amountSats?: number;
  onBarScanned?: string;
  unit?: BitcoinUnit;
  noRbf?: boolean;
  walletID: string;
  launchedBy?: string;
  utxos?: CreateTransactionUtxo[] | null;
  isEditable?: boolean;
  uri?: string;
  selectedFeeRate?: string | undefined;
  selectedFeeType?: NetworkTransactionFeeType;
  addRecipientParams?: {
    address: string;
    amount?: number;
    memo?: string;
  };
};

export type SendDetailsStackParamList = {
  SendDetails: SendDetailsParams;
  SelectFee: {
    networkTransactionFees: {
      fastestFee: number;
      mediumFee: number;
      slowFee: number;
    };
    feePrecalc: IFee;
    feeRate: string;
    feeUnit?: BitcoinUnit;
    walletID: string;
    customFee?: string | null;
  };
  Confirm: {
    fee: number;
    memo?: string;
    walletID: string;
    tx: string;
    recipients: CreateTransactionTarget[];
    satoshiPerByte: number;
  };
  PsbtWithHardwareWallet: {
    memo?: string;
    walletID: string;
    launchedBy?: string;
    psbt?: Psbt;
    txhex?: string;
  };
  CreateTransaction: {
    memo?: string;
    psbt?: Psbt;
    txhex?: string;
    tx: string;
    fee: number;
    showAnimatedQr?: boolean;
    recipients: CreateTransactionTarget[];
    satoshiPerByte: number;
    feeSatoshi?: number;
  };
  Success: {
    fee?: number;
    amount: number;
    amountUnit?: BitcoinUnit;
    txid?: string;
    invoiceDescription?: string;
  };
  CoinControl: {
    walletID: string;
  };
  ScanQRCode: ScanQRCodeParamList;
};
