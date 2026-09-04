import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';
import SettingsRow from '../../components/SettingsRow';
import GeneralIcon from '../../components/icons/GeneralIcon';
import CurrencyIcon from '../../components/icons/CurrencyIcon';
import ContactIcon from '../../components/icons/ContactIcon';
import SecurityIcon from '../../components/icons/SecurityIcon';
import NetworkIcon from '../../components/icons/NetworkIcon';
import AboutIcon from '../../components/icons/AboutIcon';
import { useTheme } from '../../components/themes';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { useDeleteWallet } from '../../hooks/useDeleteWallet';
import { useStorage } from '../../hooks/context/useStorage';
import loc from '../../loc';
import { ClashFont } from '../../constants/fonts';
import { IconProps } from '../../components/icons/types';

const APP_VERSION = DeviceInfo.getVersion();
const BUILD_NUMBER = DeviceInfo.getBuildNumber();

type SettingsRoute = 'General' | 'Currency' | 'Contacts' | 'EncryptStorage' | 'NetworkSettings' | 'Tools' | 'About';

type SettingsIconColorToken =
  | 'settingsGeneralIconColor'
  | 'settingsCurrencyIconColor'
  | 'settingsContactIconColor'
  | 'settingsSecurityIconColor'
  | 'settingsNetworkIconColor'
  | 'settingsToolsIconColor'
  | 'settingsAboutIconColor';

interface RowConfig {
  Icon: React.FC<IconProps>;
  colorToken: SettingsIconColorToken;
  title: string;
  subtitle: string;
  route: SettingsRoute;
  testID: string;
}

const MAIN_ROWS: RowConfig[] = [
  {
    Icon: GeneralIcon,
    colorToken: 'settingsGeneralIconColor',
    title: loc.settings.general,
    subtitle: loc.settings.general_subtitle,
    route: 'General',
    testID: 'GeneralButton',
  },
  {
    Icon: CurrencyIcon,
    colorToken: 'settingsCurrencyIconColor',
    title: loc.settings.currency,
    subtitle: loc.settings.currency_subtitle,
    route: 'Currency',
    testID: 'CurrencyButton',
  },
  {
    Icon: ContactIcon,
    colorToken: 'settingsContactIconColor',
    title: loc.contacts.header,
    subtitle: loc.contacts.settings_subtitle,
    route: 'Contacts',
    testID: 'ContactsButton',
  },
  {
    Icon: SecurityIcon,
    colorToken: 'settingsSecurityIconColor',
    title: loc.settings.encrypt_title,
    subtitle: loc.settings.security_subtitle,
    route: 'EncryptStorage',
    testID: 'SecurityButton',
  },
  {
    Icon: NetworkIcon,
    colorToken: 'settingsNetworkIconColor',
    title: loc.settings.network,
    subtitle: loc.settings.network_subtitle,
    route: 'NetworkSettings',
    testID: 'NetworkButton',
  },
];

const SECONDARY_ROWS: RowConfig[] = [
  {
    Icon: AboutIcon,
    colorToken: 'settingsAboutIconColor',
    title: loc.settings.about,
    subtitle: `v${APP_VERSION} (build ${BUILD_NUMBER})`,
    route: 'About',
    testID: 'AboutButton',
  },
];

const Settings: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useExtendedNavigation();
  const { wallets } = useStorage();
  const handleDeleteWallet = useDeleteWallet();

  const cardStyle = [styles.card, { borderColor: colors.settingsCardBorder, backgroundColor: colors.settingsCardBackground }];

  const mainRowIcons = useMemo(() => MAIN_ROWS.map(row => <row.Icon key={row.route} color={colors[row.colorToken]} />), [colors]);
  const secondaryRowIcons = useMemo(() => SECONDARY_ROWS.map(row => <row.Icon key={row.route} color={colors[row.colorToken]} />), [colors]);

  return (
    <SafeAreaScrollView
      contentContainerStyle={styles.content}
      floatingButtonHeight={24}
      showsVerticalScrollIndicator={false}
      testID="SettingsScrollView"
    >
      <View style={cardStyle}>
        {MAIN_ROWS.map((row, index) => (
          <SettingsRow
            key={row.route}
            icon={mainRowIcons[index]}
            title={row.title}
            subtitle={row.subtitle}
            onPress={() => navigation.navigate(row.route)}
            testID={row.testID}
            showSeparator={index < MAIN_ROWS.length - 1}
          />
        ))}
      </View>

      <View style={[cardStyle, styles.cardGap]}>
        {SECONDARY_ROWS.map((row, index) => (
          <SettingsRow
            key={row.route}
            icon={secondaryRowIcons[index]}
            title={row.title}
            subtitle={row.subtitle}
            onPress={() => navigation.navigate(row.route)}
            testID={row.testID}
            showSeparator={index < SECONDARY_ROWS.length - 1}
          />
        ))}
      </View>

      {wallets.length > 0 && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={loc.settings.delete_wallet}
          style={[styles.deleteWalletButton, styles.cardGap, { borderColor: colors.settingsDeleteWallet }]}
          onPress={handleDeleteWallet}
          testID="DeleteWalletButton"
          activeOpacity={0.7}
        >
          <Text style={[styles.deleteWalletText, { color: colors.settingsDeleteWallet }]}>{loc.settings.delete_wallet}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaScrollView>
  );
};

export default Settings;

const styles = StyleSheet.create({
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardGap: {
    marginTop: 16,
  },
  deleteWalletButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 20,
    alignItems: 'center',
  },
  deleteWalletText: {
    fontSize: 16,
    fontFamily: ClashFont.semibold,
  },
});
