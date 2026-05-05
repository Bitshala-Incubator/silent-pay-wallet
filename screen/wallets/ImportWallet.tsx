import React, { useCallback, useEffect, useState } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { ActivityIndicator, Keyboard, Platform, StyleSheet, TouchableWithoutFeedback, View, TouchableOpacity, Image } from 'react-native';
import { ShroudFormLabel, ShroudFormMultiInput } from '../../ShroudComponents';
import Button from '../../components/Button';
import {
  DoneAndDismissKeyboardInputAccessory,
  DoneAndDismissKeyboardInputAccessoryViewID,
} from '../../components/DoneAndDismissKeyboardInputAccessory';
import { useTheme } from '../../components/themes';
import { useSettings } from '../../hooks/context/useSettings';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { useKeyboard } from '../../hooks/useKeyboard';
import loc from '../../loc';
import { AddWalletStackParamList } from '../../navigation/AddWalletStack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AddressInputScanButton } from '../../components/AddressInputScanButton';
import { useScreenProtect } from '../../hooks/useScreenProtect';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';
import { Spacing20 } from '../../components/Spacing';
import { HDSilentPaymentsWallet } from '../../class/wallets/hd-bip352-wallet.ts';
import { useStorage } from '../../hooks/context/useStorage';
import presentAlert from '../../components/Alert';
import { WalletBirthSection } from '../../components/WalletBirthSection';
import { BIP352_ACTIVATION_HEIGHT } from '../../modules/constants';
import { getDefaultIndexer } from '../../modules/SilentPaymentIndexer';

type RouteProps = RouteProp<AddWalletStackParamList, 'ImportWallet'>;
type NavigationProps = NativeStackNavigationProp<AddWalletStackParamList, 'ImportWallet'>;

type BirthHeightResult = { ok: true; height: number } | { ok: false; error: 'invalid_date' | 'future_date' | 'network' };

async function resolveBirthHeight(dateStr: string, currentHeight: number): Promise<BirthHeightResult> {
  const trimmed = dateStr.trim();
  if (trimmed.length === 0) {
    return { ok: true, height: BIP352_ACTIVATION_HEIGHT };
  }

  // Append T00:00:00 to treat YYYY-MM-DD as local time, not UTC
  const normalised = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00` : trimmed;
  const parsedTimestamp = Date.parse(normalised);

  if (Number.isNaN(parsedTimestamp)) {
    return { ok: false, error: 'invalid_date' };
  }

  const inputDate = new Date(parsedTimestamp);
  if (inputDate > new Date()) {
    return { ok: false, error: 'future_date' };
  }

  try {
    const indexer = getDefaultIndexer();
    const timestampSeconds = Math.floor(inputDate.getTime() / 1000);
    const response = await indexer.getBlockHeightByTimestamp(timestampSeconds);
    const height = Math.min(Math.max(response.blockHeight, BIP352_ACTIVATION_HEIGHT), currentHeight);
    return { ok: true, height };
  } catch (error) {
    console.warn('Failed to lookup block height by timestamp, using BIP352 activation height:', error);
    return { ok: true, height: BIP352_ACTIVATION_HEIGHT };
  }
}

const ImportWallet = () => {
  const navigation = useExtendedNavigation<NavigationProps>();
  const { colors, closeImage } = useTheme();
  const route = useRoute<RouteProps>();
  const label = route?.params?.label ?? '';
  const triggerImport = route?.params?.triggerImport ?? false;
  const [importText, setImportText] = useState<string>(label);
  const [birthDate, setBirthDate] = useState<string>('');
  const [isToolbarVisibleForAndroid, setIsToolbarVisibleForAndroid] = useState<boolean>(false);
  const [, setSpeedBackdoor] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { isPrivacyBlurEnabled } = useSettings();
  const { enableScreenProtect, disableScreenProtect } = useScreenProtect();
  const { addAndSaveWallet, wallets } = useStorage();
  const stylesHook = StyleSheet.create({
    root: {
      backgroundColor: colors.elevated,
    },
    center: {
      backgroundColor: colors.elevated,
    },
  });

  const onBlur = useCallback(() => {
    const valueWithSingleWhitespace = importText.replace(/^\s+|\s+$|\s+(?=\s)/g, '');
    setImportText(valueWithSingleWhitespace);
    return valueWithSingleWhitespace;
  }, [importText]);

  useKeyboard({
    onKeyboardDidShow: () => {
      setIsToolbarVisibleForAndroid(true);
    },
    onKeyboardDidHide: () => {
      setIsToolbarVisibleForAndroid(false);
    },
  });

  const importMnemonic = useCallback(
    async (text: string) => {
      if (wallets.length > 0) {
        presentAlert({ title: loc.errors.error, message: loc.wallets.single_wallet_limit });
        return;
      }

      try {
        if (await Clipboard.hasStringAsync()) {
          Clipboard.setStringAsync('');
        }
      } catch (error) {
        console.error('Failed to clear clipboard:', error);
      }

      Keyboard.dismiss();
      setIsLoading(true);

      try {
        if (!text.trim()) {
          presentAlert({ title: loc.errors.error, message: loc.wallet_birth.error_empty_mnemonic });
          setIsLoading(false);
          return;
        }

        // create HDSilentPaymentsWallet with hardcoded m/84'/0'/0' derivation path
        const wallet = new HDSilentPaymentsWallet();
        wallet.setSecret(text.trim());

        wallet.setDerivationPath("m/84'/0'/0'");

        if (!wallet.validateMnemonic() && !wallet.getSecret()) {
          presentAlert({ title: loc.errors.error, message: loc.wallet_birth.error_invalid_mnemonic });
          setIsLoading(false);
          return;
        }

        const indexer = getDefaultIndexer();
        let currentHeight: number;
        try {
          currentHeight = (await indexer.getLatestBlockHeight()).height;
        } catch (error) {
          console.error('Failed to fetch latest block height:', error);
          presentAlert({ title: loc.errors.error, message: loc.wallet_birth.error_network });
          setIsLoading(false);
          return;
        }

        const birthHeightResult = await resolveBirthHeight(birthDate, currentHeight);
        if (!birthHeightResult.ok) {
          const messages: Record<string, string> = {
            invalid_date: loc.wallet_birth.error_invalid_date,
            future_date: loc.wallet_birth.error_future_date,
            network: loc.wallet_birth.error_network,
          };
          presentAlert({ title: loc.errors.error, message: messages[birthHeightResult.error] });
          setIsLoading(false);
          return;
        }

        wallet.updateBirthHeight(birthHeightResult.height, true);

        await addAndSaveWallet(wallet);
        navigation.navigateToWalletsList();
      } catch (error: any) {
        console.error('Import error:', error);
        presentAlert({
          title: loc.wallets.import_error,
          message: error.message || loc.wallet_birth.error_import_failed,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [birthDate, addAndSaveWallet, navigation, wallets],
  );

  const handleImport = useCallback(() => {
    const textToImport = onBlur();
    if (textToImport.trim().length === 0) {
      return;
    }
    importMnemonic(textToImport);
  }, [importMnemonic, onBlur]);

  const onBarScanned = useCallback(
    (value: string | { data: any }) => {
      // no objects here, only strings
      const newValue: string = typeof value !== 'string' ? value.data + '' : value;
      setImportText(newValue);
      setTimeout(() => importMnemonic(newValue), 500);
    },
    [importMnemonic],
  );

  useEffect(() => {
    const data = route.params?.onBarScanned;
    if (data) {
      onBarScanned(data);
      navigation.setParams({ onBarScanned: undefined });
    }
  }, [route.name, onBarScanned, route.params?.onBarScanned, navigation]);

  const speedBackdoorTap = () => {
    setSpeedBackdoor(v => {
      v += 1;
      if (v < 5) return v;
      navigation.navigate('ImportSpeed');
      return 0;
    });
  };

  useEffect(() => {
    if (isPrivacyBlurEnabled) {
      enableScreenProtect();
    }
    return () => {
      disableScreenProtect();
    };
  }, [isPrivacyBlurEnabled, enableScreenProtect, disableScreenProtect]);

  useEffect(() => {
    if (triggerImport) handleImport();
  }, [triggerImport, handleImport]);

  // Adding the ToolTipMenu to the header
  useEffect(() => {
    navigation.setOptions({
      headerLeft:
        navigation.getState().index === 0
          ? () => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={loc._.close}
                style={styles.button}
                onPress={() => navigation.goBack()}
                testID="NavigationCloseButton"
              >
                <Image source={closeImage} />
              </TouchableOpacity>
            )
          : undefined,
    });
  }, [colors, navigation, closeImage]);

  const renderOptionsAndImportButton = (
    <>
      <Spacing20 />
      <View style={[styles.center, stylesHook.center]}>
        <>
          <Button
            disabled={importText.trim().length === 0 || isLoading}
            title={loc.wallets.import_do_import}
            testID="DoImport"
            onPress={handleImport}
            backgroundColor="#754CE8"
          />
          <Spacing20 />
          <AddressInputScanButton type="link" onChangeText={setImportText} testID="ScanImport" />
        </>
      </View>
    </>
  );

  return (
    <SafeAreaScrollView
      contentContainerStyle={[styles.root, stylesHook.root]}
      keyboardShouldPersistTaps="always"
      automaticallyAdjustKeyboardInsets
    >
      <Spacing20 />
      <TouchableWithoutFeedback accessibilityRole="button" onPress={speedBackdoorTap} testID="SpeedBackdoor">
        <ShroudFormLabel>{loc.wallets.import_explanation}</ShroudFormLabel>
      </TouchableWithoutFeedback>
      <Spacing20 />
      <View style={styles.mnemonicInputContainer}>
        <ShroudFormMultiInput
          value={importText}
          onBlur={onBlur}
          onChangeText={setImportText}
          testID="MnemonicInput"
          inputAccessoryViewID={DoneAndDismissKeyboardInputAccessoryViewID}
          numberOfLines={3}
        />
      </View>

      <Spacing20 />
      <WalletBirthSection birthDate={birthDate} setBirthDate={setBirthDate} />

      {isLoading && <ActivityIndicator size="large" color={colors.mainColor} style={styles.activityIndicator} />}

      {Platform.select({ android: !isToolbarVisibleForAndroid && renderOptionsAndImportButton, default: renderOptionsAndImportButton })}
      {Platform.select({
        ios: (
          <DoneAndDismissKeyboardInputAccessory
            onClearTapped={() => {
              setImportText('');
            }}
            onPasteTapped={text => {
              setImportText(text);
              Keyboard.dismiss();
            }}
          />
        ),
        default: null,
      })}
    </SafeAreaScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    paddingTop: 10,
  },
  center: {
    flex: 1,
    marginHorizontal: 16,
  },
  button: {
    padding: 10,
  },
  mnemonicInputContainer: {
    minHeight: 120,
  },
  activityIndicator: {
    marginVertical: 16,
  },
});

export default ImportWallet;
