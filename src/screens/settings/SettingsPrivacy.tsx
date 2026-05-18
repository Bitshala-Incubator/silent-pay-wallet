import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { Linking } from 'react-native';
import A from '../../modules/analytics';
import { Header } from '../../components/Header';
import ListItem, { PressableWrapper } from '../../components/ListItem';
import { useTheme } from '../../components/themes';
import loc from '../../loc';
import { useStorage } from '../../hooks/context/useStorage';
import { useSettings } from '../../hooks/context/useSettings';
import { isDesktop } from '../../modules/environment';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';

enum SettingsPrivacySection {
  None,
  All,
  ReadClipboard,
  QuickActions,
  Widget,
  TemporaryScreenshots,
  TotalBalance,
}

const SettingsPrivacy: React.FC = () => {
  const { colors } = useTheme();
  const { isStorageEncrypted, wallets } = useStorage();
  const {
    isDoNotTrackEnabled,
    setDoNotTrackStorage,
    isPrivacyBlurEnabled,
    setIsPrivacyBlurEnabled,
    isClipboardGetContentEnabled,
    setIsClipboardGetContentEnabledStorage,
    isQuickActionsEnabled,
    setIsQuickActionsEnabledStorage,
    isTotalBalanceEnabled,
    setIsTotalBalanceEnabledStorage,
  } = useSettings();
  const [isLoading, setIsLoading] = useState<number>(SettingsPrivacySection.All);

  const [storageIsEncrypted, setStorageIsEncrypted] = useState<boolean>(true);
  const styleHooks = StyleSheet.create({
    root: {
      backgroundColor: colors.background,
    },
  });

  useEffect(() => {
    (async () => {
      try {
        setStorageIsEncrypted(await isStorageEncrypted());
      } catch (e) {
        console.log(e);
      }
      setIsLoading(SettingsPrivacySection.None);
    })();
  }, [isStorageEncrypted]);

  const onDoNotTrackValueChange = async (value: boolean) => {
    setIsLoading(SettingsPrivacySection.All);
    try {
      setDoNotTrackStorage(value);
      A.setOptOut(value);
    } catch (e) {
      console.debug('onDoNotTrackValueChange catch', e);
    }
    setIsLoading(SettingsPrivacySection.None);
  };

  const onQuickActionsValueChange = async (value: boolean) => {
    setIsLoading(SettingsPrivacySection.QuickActions);
    try {
      setIsQuickActionsEnabledStorage(value);
    } catch (e) {
      console.debug('onQuickActionsValueChange catch', e);
    }
    setIsLoading(SettingsPrivacySection.None);
  };

  const onTotalBalanceEnabledValueChange = async (value: boolean) => {
    setIsLoading(SettingsPrivacySection.TotalBalance);
    try {
      setIsTotalBalanceEnabledStorage(value);
    } catch (e) {
      console.debug('onTotalBalanceEnabledValueChange catch', e);
    }
    setIsLoading(SettingsPrivacySection.None);
  };

  const onTemporaryScreenshotsValueChange = (value: boolean) => {
    setIsLoading(SettingsPrivacySection.TemporaryScreenshots);
    setIsPrivacyBlurEnabled(!value);
    setIsLoading(SettingsPrivacySection.None);
  };

  const openApplicationSettings = () => {
    Linking.openSettings();
  };

  return (
    <SafeAreaScrollView style={[styles.root, styleHooks.root]} contentInsetAdjustmentBehavior="automatic" automaticallyAdjustContentInsets>
      {Platform.OS === 'android' ? (
        <View style={styles.headerContainer}>
          <Header leftText={loc.settings.general} />
        </View>
      ) : null}

      <ListItem
        title={loc.settings.privacy_read_clipboard}
        Component={TouchableWithoutFeedback}
        switch={{
          onValueChange: setIsClipboardGetContentEnabledStorage,
          value: isClipboardGetContentEnabled,
          disabled: isLoading === SettingsPrivacySection.All,
          testID: 'ClipboardSwitch',
        }}
        subtitle={loc.settings.privacy_clipboard_explanation}
      />

      <ListItem
        title={loc.settings.privacy_quickactions}
        Component={TouchableWithoutFeedback}
        switch={{
          onValueChange: onQuickActionsValueChange,
          value: storageIsEncrypted ? false : isQuickActionsEnabled,
          disabled: isLoading === SettingsPrivacySection.All || storageIsEncrypted,
          testID: 'QuickActionsSwitch',
        }}
        subtitle={
          <>
            <Text style={styles.subtitleText}>{loc.settings.privacy_quickactions_explanation}</Text>
            {storageIsEncrypted && <Text style={styles.subtitleText}>{loc.settings.encrypted_feature_disabled}</Text>}
          </>
        }
      />

      <ListItem
        title={loc.total_balance_view.title}
        Component={PressableWrapper}
        switch={{
          onValueChange: onTotalBalanceEnabledValueChange,
          value: isTotalBalanceEnabled,
          disabled: isLoading === SettingsPrivacySection.All || wallets.length < 2,
          testID: 'TotalBalanceSwitch',
        }}
        subtitle={<Text style={styles.subtitleText}>{loc.total_balance_view.explanation}</Text>}
      />

      {!isDesktop && (
        <ListItem
          title={loc.settings.privacy_temporary_screenshots}
          Component={TouchableWithoutFeedback}
          switch={{
            onValueChange: onTemporaryScreenshotsValueChange,
            value: !isPrivacyBlurEnabled,
            disabled: isLoading === SettingsPrivacySection.All,
          }}
          subtitle={<Text style={styles.subtitleText}>{loc.settings.privacy_temporary_screenshots_instructions}</Text>}
        />
      )}

      <ListItem
        title={loc.settings.privacy_do_not_track}
        Component={TouchableWithoutFeedback}
        switch={{
          onValueChange: onDoNotTrackValueChange,
          value: isDoNotTrackEnabled,
          disabled: isLoading === SettingsPrivacySection.All,
        }}
        subtitle={<Text style={styles.subtitleText}>{loc.settings.privacy_do_not_track_explanation}</Text>}
      />

      <ListItem title={loc.settings.privacy_system_settings} chevron onPress={openApplicationSettings} testID="PrivacySystemSettings" />
    </SafeAreaScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  headerContainer: {
    paddingVertical: 16,
  },
  subtitleText: {
    fontSize: 14,
    marginTop: 5,
  },
});

export default SettingsPrivacy;
