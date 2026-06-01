import React, { useMemo } from 'react';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import HeaderRightButton from '../components/HeaderRightButton';
import navigationStyle, { CloseButtonPosition } from '../components/navigationStyle';
import { useTheme } from '../components/themes';
import loc from '../loc';
import Broadcast from '../screens/send/Broadcast';
import Success from '../screens/send/success';
import CPFP from '../screens/transactions/CPFP';
import TransactionDetails from '../screens/transactions/TransactionDetails';
import RBFBumpFee from '../screens/transactions/RBFBumpFee';
import RBFCancel from '../screens/transactions/RBFCancel';
import TransactionStatus from '../screens/transactions/TransactionStatus';
import WalletAddresses from '../screens/wallets/WalletAddresses';
import WalletDetails from '../screens/wallets/WalletDetails';
import WalletsList from '../screens/wallets/WalletsList';
import { DetailViewStack } from './index';
import SettingsButton from '../components/icons/SettingsButton';
import { useStorage } from '../hooks/context/useStorage';
import WalletTransactions from '../screens/wallets/WalletTransactions';
import Settings from '../screens/settings/Settings';
import Currency from '../screens/settings/Currency';
import PlausibleDeniability from '../screens/PlausibleDeniability';
import Licensing from '../screens/settings/Licensing';
import About from '../screens/settings/About';
import ElectrumSettings from '../screens/settings/ElectrumSettings';
import EncryptStorage from '../screens/settings/EncryptStorage';
import SelfTest from '../screens/settings/SelfTest';

import getWalletTransactionsOptions from './helpers/getWalletTransactionsOptions';
import { useSizeClass, SizeClass } from '../modules/sizeClass';
import { isDesktop } from '../modules/environment';
import ReceiveDetails from '../screens/receive/ReceiveDetails';
import TrackPayment from '../screens/wallets/TrackPayment';
import PaymentFound from '../screens/wallets/PaymentFound';
import NoPaymentFound from '../screens/wallets/NoPaymentFound';
import OnboardingStack from './OnboardingStack';

const DetailViewStackScreensStack = () => {
  const theme = useTheme();
  const { wallets } = useStorage();
  const { sizeClass } = useSizeClass();
  const DetailButton = useMemo(() => <HeaderRightButton testID="DetailButton" disabled={true} title={loc.send.create_details} />, []);
  const RightBarButtons = useMemo(() => <SettingsButton />, []);

  const walletListScreenOptions = useMemo<NativeStackNavigationOptions>(() => {
    return {
      title: '',
      navigationBarColor: theme.colors.navigationBarColor,
      headerLargeTitle: sizeClass === SizeClass.Compact,
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: theme.colors.customHeader,
      },
      headerRight: () => (isDesktop ? undefined : RightBarButtons),
    };
  }, [RightBarButtons, sizeClass, theme.colors.customHeader, theme.colors.navigationBarColor]);

  const initialRoute = wallets.length === 0 ? 'Onboarding' : 'WalletsList';

  return (
    <DetailViewStack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShadowVisible: false, animationTypeForReplace: 'push' }}
    >
      <DetailViewStack.Screen
        name="Onboarding"
        component={OnboardingStack}
        options={{ headerShown: false, gestureEnabled: false, headerBackVisible: false }}
      />
      <DetailViewStack.Screen name="WalletsList" component={WalletsList} options={navigationStyle(walletListScreenOptions)(theme)} />
      <DetailViewStack.Screen name="WalletTransactions" component={WalletTransactions} options={getWalletTransactionsOptions} />
      <DetailViewStack.Screen
        name="WalletDetails"
        component={WalletDetails}
        options={navigationStyle({
          headerTitle: loc.wallets.details_title,
          statusBarStyle: 'auto',
        })(theme)}
      />
      <DetailViewStack.Screen
        name="TransactionDetails"
        component={TransactionDetails}
        options={navigationStyle({
          statusBarStyle: 'auto',
          headerStyle: {
            backgroundColor: theme.colors.customHeader,
          },
          headerTitle: loc.transactions.details_title,
        })(theme)}
      />
      <DetailViewStack.Screen
        name="TransactionStatus"
        component={TransactionStatus}
        initialParams={{
          hash: undefined,
          walletID: undefined,
        }}
        options={navigationStyle({
          statusBarStyle: 'auto',
          headerStyle: {
            backgroundColor: theme.colors.customHeader,
          },
          headerTitle: '',
          headerRight: () => DetailButton,
          headerBackButtonDisplayMode: 'default',
        })(theme)}
      />
      <DetailViewStack.Screen name="CPFP" component={CPFP} options={navigationStyle({ title: loc.transactions.cpfp_title })(theme)} />
      <DetailViewStack.Screen
        name="RBFBumpFee"
        component={RBFBumpFee}
        options={navigationStyle({ title: loc.transactions.rbf_title })(theme)}
      />
      <DetailViewStack.Screen
        name="RBFCancel"
        component={RBFCancel}
        options={navigationStyle({ title: loc.transactions.cancel_title })(theme)}
      />
      <DetailViewStack.Screen
        name="Broadcast"
        component={Broadcast}
        options={navigationStyle({ title: loc.send.create_broadcast })(theme)}
      />
      <DetailViewStack.Screen
        name="Success"
        component={Success}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <DetailViewStack.Screen
        name="WalletAddresses"
        component={WalletAddresses}
        options={navigationStyle({ title: loc.addresses.addresses_title, statusBarStyle: 'auto' })(theme)}
      />

      <DetailViewStack.Screen
        name="Settings"
        component={Settings}
        options={navigationStyle({
          title: loc.settings.header,
          headerBackButtonDisplayMode: 'default',
          headerShadowVisible: false,
          headerLargeTitle: true,
          animationTypeForReplace: 'push',
        })(theme)}
      />
      <DetailViewStack.Screen name="Currency" component={Currency} options={navigationStyle({ title: loc.settings.currency })(theme)} />
      <DetailViewStack.Screen
        name="PlausibleDeniability"
        component={PlausibleDeniability}
        options={navigationStyle({ title: loc.plausibledeniability.title })(theme)}
      />
      <DetailViewStack.Screen name="Licensing" component={Licensing} options={navigationStyle({ title: loc.settings.license })(theme)} />
      <DetailViewStack.Screen name="About" component={About} options={navigationStyle({ title: loc.settings.about })(theme)} />
      <DetailViewStack.Screen
        name="ElectrumSettings"
        component={ElectrumSettings}
        options={navigationStyle({ title: loc.settings.electrum_settings_server })(theme)}
        initialParams={{ server: undefined }}
      />
      <DetailViewStack.Screen
        name="EncryptStorage"
        component={EncryptStorage}
        options={navigationStyle({ title: loc.settings.encrypt_title })(theme)}
      />
      <DetailViewStack.Screen name="SelfTest" component={SelfTest} options={navigationStyle({ title: loc.settings.selfTest })(theme)} />
      <DetailViewStack.Screen
        name="TrackPayment"
        component={TrackPayment}
        options={navigationStyle({
          title: loc.track_payment.title,
          statusBarStyle: 'auto',
        })(theme)}
      />
      <DetailViewStack.Screen
        name="PaymentFound"
        component={PaymentFound}
        options={navigationStyle({
          title: loc.payment_found.title,
          statusBarStyle: 'auto',
        })(theme)}
      />
      <DetailViewStack.Screen
        name="NoPaymentFound"
        component={NoPaymentFound}
        options={navigationStyle({
          title: loc.no_payment_found.title,
          statusBarStyle: 'auto',
        })(theme)}
      />
      <DetailViewStack.Screen
        name="ReceiveDetails"
        component={ReceiveDetails}
        options={navigationStyle({
          title: loc.receive.header,
          closeButtonPosition: CloseButtonPosition.Left,
          statusBarStyle: 'light',
          headerShown: true,
          presentation: 'modal',
        })(theme)}
      />
    </DetailViewStack.Navigator>
  );
};

export default DetailViewStackScreensStack;
