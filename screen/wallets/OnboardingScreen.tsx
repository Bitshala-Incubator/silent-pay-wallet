import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useTheme } from '../../components/themes';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import { HDSilentPaymentsWallet } from '../../class/wallets/hd-bip352-wallet';
import loc from '../../loc';
import { useStorage } from '../../hooks/context/useStorage';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../blue_modules/hapticFeedback';
import { getDefaultIndexer } from '../../blue_modules/SilentPaymentIndexer';
import { SafeAreaView } from 'react-native-safe-area-context';

type NavigationProps = NativeStackNavigationProp<DetailViewStackParamList, 'WalletsList'>;

const OnboardingScreen: React.FC = () => {
  const { colors } = useTheme();
  const { navigate, navigateToWalletsList } = useExtendedNavigation<NavigationProps>();
  const { addWallet, saveToDisk, wallets } = useStorage();

  const handleContinue = useCallback(async () => {
    if (wallets.length > 0) {
      navigateToWalletsList();
      return;
    }

    const w = new HDSilentPaymentsWallet();
    w.setLabel(loc.wallets.details_title);
    await w.generate();

    try {
      const indexer = getDefaultIndexer();
      const latestHeightResponse = await indexer.getLatestBlockHeight();
      w.setBirthHeight(latestHeightResponse.height);
      console.log(`Wallet birth height set to: ${latestHeightResponse.height}`);
    } catch (error) {
      console.warn('Could not set birth height, will use default:', error);
    }

    addWallet(w);
    await saveToDisk();

    triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);

    navigate('AddWalletRoot', {
      screen: 'PleaseBackup',
      params: {
        walletID: w.getID(),
      },
    });
  }, [wallets, navigateToWalletsList, addWallet, saveToDisk, navigate]);

  const importWallet = useCallback(() => {
    if (wallets.length > 0) {
      navigateToWalletsList();
      return;
    }
    navigate('AddWalletRoot', { screen: 'ImportWallet' });
  }, [wallets, navigateToWalletsList, navigate]);

  const renderCoverScreen = useCallback(() => {
    return (
      <SafeAreaView style={[styles.welcomeContainer, { backgroundColor: colors.background }]}>
        <View style={styles.welcomeContent}>
          <View style={styles.logoContainer}>
            <Image source={require('../../img/icon.png')} style={styles.bitcoinLogo} resizeMode="contain" />
          </View>

          <Text style={[styles.welcomeTitle, { color: colors.primary }]}>{loc.onboarding.shroud}</Text>
          <Text style={[styles.welcomeSubtitle, { color: colors.labelText }]}>{loc.onboarding.subtitle}</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.createButton} onPress={handleContinue} testID="CreateWallet">
              <Text style={styles.createButtonText}>{loc.onboarding.create_wallet}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.restoreButton} onPress={importWallet} testID="ImportWallet">
              <Text style={styles.restoreButtonText}>{loc.onboarding.import_wallet}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <Text style={[styles.footerText, { color: colors.labelText }]}> {loc.onboarding.footer}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }, [colors, handleContinue, importWallet]);

  return renderCoverScreen();
};

export default OnboardingScreen;

const styles = StyleSheet.create({
  welcomeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  welcomeContent: { alignItems: 'center', maxWidth: 320, width: '100%' },
  logoContainer: { marginBottom: 40 },
  bitcoinLogo: { width: 80, height: 80, borderRadius: 40 },
  welcomeTitle: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  welcomeSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 60, lineHeight: 22 },
  buttonContainer: { width: '100%', marginBottom: 40 },
  createButton: { backgroundColor: '#754CE8', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 8, marginBottom: 16 },
  createButtonText: { color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  restoreButton: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 8, marginBottom: 16 },
  restoreButtonText: { color: '#754CE8', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  footerContainer: { marginTop: 20 },
  footerText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
