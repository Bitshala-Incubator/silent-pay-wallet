import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DetailViewStackParamList } from "../../navigation/DetailViewStackParamList";
import { CommonActions } from '@react-navigation/native';

type NavigationProps = NativeStackNavigationProp<DetailViewStackParamList, 'WalletsList'>;

const OnboardingScreen: React.FC = () => {
  const { colors } = useTheme();
  const { dispatch } = useExtendedNavigation<NavigationProps>();

  const handleContinue = () => {

    // Navigate to CreateWallet screen
    dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'Onboarding',
            state: {
              routes: [{ name: 'CreateWalletScreen' }],
            },
          },
        ],
      }),
    );
  };

  const navigateToImportWallet = () => {
    dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'Onboarding',
            state: {
              routes: [{ name: 'ImportWallet' }],
            },
          },
        ],
      }),
    );
  };

  const renderCoverScreen = useCallback(() => {
    return (
      <View style={[styles.welcomeContainer, { backgroundColor: colors.background }]}>
        <View style={styles.welcomeContent}>
          <View style={styles.logoContainer}>
            <Image source={require('../../img/bitcoin.png')} style={styles.bitcoinLogo} />
          </View>

          <Text style={[styles.welcomeTitle, { color: colors.text }]}>
            Bitcoin wallet
          </Text>

          <Text style={[styles.welcomeSubtitle, { color: colors.text }]}>
            A simple bitcoin wallet for{'\n'} all your payments.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: '#ff9500' }]}
              onPress={handleContinue}
            >
              <Text style={[styles.createButtonText, { color: '#fff' }]}>
                Create a new wallet
              </Text>
            </TouchableOpacity>


            <TouchableOpacity
              style={styles.restoreButton}
              onPress={navigateToImportWallet}
              testID="ImportWallet"
            >
              <Text style={[styles.restoreButtonText]}>
                Restore existing wallet
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <Text style={[styles.footerText, { color: colors.text }]}>
              Your wallet, your coins{'\n'}100% open-source & open-design
            </Text>
          </View>
        </View>
      </View>);
  }, [colors]);

  return renderCoverScreen();
}

export default OnboardingScreen;

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32 },
  button: { padding: 16, backgroundColor: '#1c7ed6', borderRadius: 12, marginBottom: 12, width: '100%' },
  buttonText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  welcomeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  welcomeContent: { alignItems: 'center', maxWidth: 320, width: '100%' },
  logoContainer: { marginBottom: 40 },
  bitcoinLogo: { width: 80, height: 80, borderRadius: 40 },
  welcomeTitle: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  welcomeSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 60, lineHeight: 22 },
  buttonContainer: { width: '100%', marginBottom: 40 },
  createButton: { backgroundColor: '#ff9500', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 8, marginBottom: 16 },
  createButtonText: { color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  footerContainer: { marginTop: 20 },
  footerText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  restoreButton: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 8, marginBottom: 16 },
  restoreButtonText: { color: '#ff9500', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});