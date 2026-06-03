import React, { useCallback, useEffect, useState } from 'react';
import { TouchableWithoutFeedback } from 'react-native';
import ListItem from '../../components/ListItem';
import { isBackgroundScanningEnabledByUser, setBackgroundScanningUserPref } from '../../helpers/silent-payments/BackgroundScanSetup';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import loc from '../../loc';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';
import DeleteWallet from './DeleteWallet';

const Settings = () => {
  const { navigate } = useExtendedNavigation();
  const [backgroundScanEnabled, setBackgroundScanEnabled] = useState<boolean>(true);

  useEffect(() => {
    isBackgroundScanningEnabledByUser().then(setBackgroundScanEnabled);
  }, []);

  const onBackgroundScanSwitch = useCallback(async (value: boolean) => {
    setBackgroundScanEnabled(value);
    try {
      await setBackgroundScanningUserPref(value);
    } catch (error) {
      console.warn('[Settings] Failed to toggle background scanning:', error);
      setBackgroundScanEnabled(!value);
    }
  }, []);

  return (
    <SafeAreaScrollView>
      <ListItem title={loc.settings.currency} onPress={() => navigate('Currency')} testID="Currency" chevron />
      <ListItem title={loc.settings.encrypt_title} onPress={() => navigate('EncryptStorage')} testID="SecurityButton" chevron />
      <ListItem
        title={loc.settings.background_scan}
        subtitle={loc.settings.background_scan_explain}
        Component={TouchableWithoutFeedback}
        testID="BackgroundScanSwitch"
        switch={{
          value: backgroundScanEnabled,
          onValueChange: onBackgroundScanSwitch,
        }}
      />
      {/* TODO: Eventually make this a separate screen with proper description */}
      <DeleteWallet />
      <ListItem title={loc.settings.about} onPress={() => navigate('About')} testID="AboutButton" chevron />
    </SafeAreaScrollView>
  );
};

export default Settings;
