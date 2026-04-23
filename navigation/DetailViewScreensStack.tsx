import React, { useMemo } from 'react';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import HeaderRightButton from '../components/HeaderRightButton';
import navigationStyle, { CloseButtonPosition } from '../components/navigationStyle';
import { useTheme } from '../components/themes';
import loc from '../loc';
import Broadcast from '../screen/send/Broadcast';
import IsItMyAddress from '../screen/settings/IsItMyAddress';
import Success from '../screen/send/success';
import CPFP from '../screen/transactions/CPFP';
import TransactionDetails from '../screen/transactions/TransactionDetails';
import RBFBumpFee from '../screen/transactions/RBFBumpFee';
import RBFCancel from '../screen/transactions/RBFCancel';
import TransactionStatus from '../screen/transactions/TransactionStatus';
import WalletAddresses from '../screen/wallets/WalletAddresses';
import WalletDetails from '../screen/wallets/WalletDetails';
import GenerateWord from '../screen/wallets/generateWord';
import WalletsList from '../screen/wallets/WalletsList';
import { DetailViewStack } from './index';
import PaymentCodesListComponent from './LazyLoadPaymentCodeStack';
import SettingsButton from '../components/icons/SettingsButton';
import { useStorage } from '../hooks/context/useStorage';
import WalletTransactions from '../screen/wallets/WalletTransactions';
import Settings from '../screen/settings/Settings';
import Currency from '../screen/settings/Currency';
import GeneralSettings from '../screen/settings/GeneralSettings';
import PlausibleDeniability from '../screen/PlausibleDeniability';
import Licensing from '../screen/settings/Licensing';
import NetworkSettings from '../screen/settings/NetworkSettings';
import SettingsBlockExplorer from '../screen/settings/SettingsBlockExplorer';
import About from '../screen/settings/About';
import DefaultView from '../screen/settings/DefaultView';
import ElectrumSettings from '../screen/settings/ElectrumSettings';
import EncryptStorage from '../screen/settings/EncryptStorage';
import Language from '../screen/settings/Language';
import NotificationSettings from '../screen/settings/NotificationSettings';
import TorSettings from '../screen/settings/TorSettings';
import SelfTest from '../screen/settings/SelfTest';
import ReleaseNotes from '../screen/settings/ReleaseNotes';
import ToolsScreen from '../screen/settings/tools';
import SettingsPrivacy from '../screen/settings/SettingsPrivacy';

import getWalletTransactionsOptions from './helpers/getWalletTransactionsOptions';
import { useSizeClass, SizeClass } from '../blue_modules/sizeClass';
import { isDesktop } from '../blue_modules/environment';
import ReceiveDetails from '../screen/receive/ReceiveDetails';
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
        name="IsItMyAddress"
        component={IsItMyAddress}
        initialParams={{ address: undefined }}
        options={navigationStyle({ title: loc.is_it_my_address.title })(theme)}
      />
      <DetailViewStack.Screen
        name="GenerateWord"
        component={GenerateWord}
        options={navigationStyle({ title: loc.autofill_word.title })(theme)}
      />
      <DetailViewStack.Screen
        name="PaymentCodeList"
        component={PaymentCodesListComponent}
        options={navigationStyle({ title: loc.bip47.contacts })(theme)}
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
        name="GeneralSettings"
        component={GeneralSettings}
        options={navigationStyle({ title: loc.settings.general })(theme)}
      />
      <DetailViewStack.Screen
        name="PlausibleDeniability"
        component={PlausibleDeniability}
        options={navigationStyle({ title: loc.plausibledeniability.title })(theme)}
      />
      <DetailViewStack.Screen name="Licensing" component={Licensing} options={navigationStyle({ title: loc.settings.license })(theme)} />
      <DetailViewStack.Screen
        name="NetworkSettings"
        component={NetworkSettings}
        options={navigationStyle({ title: loc.settings.network })(theme)}
      />
      <DetailViewStack.Screen
        name="TorSettings"
        component={TorSettings}
        options={navigationStyle({ title: loc.settings.tor_title })(theme)}
      />
      <DetailViewStack.Screen
        name="SettingsBlockExplorer"
        component={SettingsBlockExplorer}
        options={navigationStyle({ title: loc.settings.block_explorer })(theme)}
      />

      <DetailViewStack.Screen name="About" component={About} options={navigationStyle({ title: loc.settings.about })(theme)} />
      <DetailViewStack.Screen
        name="DefaultView"
        component={DefaultView}
        options={navigationStyle({ title: loc.settings.default_title })(theme)}
      />
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
      <DetailViewStack.Screen name="Language" component={Language} options={navigationStyle({ title: loc.settings.language })(theme)} />
      <DetailViewStack.Screen
        name="NotificationSettings"
        component={NotificationSettings}
        options={navigationStyle({ title: loc.settings.notifications })(theme)}
      />
      <DetailViewStack.Screen name="SelfTest" component={SelfTest} options={navigationStyle({ title: loc.settings.selfTest })(theme)} />
      <DetailViewStack.Screen
        name="ReleaseNotes"
        component={ReleaseNotes}
        options={navigationStyle({ title: loc.settings.about_release_notes })(theme)}
      />
      <DetailViewStack.Screen name="ToolsScreen" component={ToolsScreen} options={navigationStyle({ title: loc.settings.tools })(theme)} />
      <DetailViewStack.Screen
        name="SettingsPrivacy"
        component={SettingsPrivacy}
        options={navigationStyle({ title: loc.settings.privacy })(theme)}
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
