import { useTheme } from '../components/themes';
import { HDSilentPaymentsWallet } from './wallets/hd-bip352-wallet';

export default class WalletGradient {
  static defaultGradients: string[] = ['#B770F6', '#9013FE'];
  static silentPaymentsWallet: string[] = ['#FF9E3D', '#FF6A3D'];

  static createWallet = () => {
    const { colors } = useTheme();
    return colors.lightButton;
  };

  static gradientsFor(type: string): string[] {
    let gradient: string[];
    switch (type) {
      case HDSilentPaymentsWallet.type:
        gradient = WalletGradient.silentPaymentsWallet;
        break;
      default:
        gradient = WalletGradient.defaultGradients;
        break;
    }
    return gradient;
  }

  static linearGradientProps(type: string) {
    let props: any;
    switch (type) {
      default:
        break;
    }
    return props;
  }

  static headerColorFor(type: string): string {
    let gradient: string[];
    switch (type) {
      case HDSilentPaymentsWallet.type:
        gradient = WalletGradient.silentPaymentsWallet;
        break;
      default:
        gradient = WalletGradient.defaultGradients;
        break;
    }
    return gradient[0];
  }
}
