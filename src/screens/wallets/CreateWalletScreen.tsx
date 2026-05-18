import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { HDSilentPaymentsWallet } from '../../class/wallets/hd-bip352-wallet';
import loc from '../../loc';
import presentAlert from '../../components/Alert';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../modules/hapticFeedback';
import { useStorage } from '../../hooks/context/useStorage';

type NavigationProps = NativeStackNavigationProp<DetailViewStackParamList, 'WalletTransactions'>;

const CreateWalletScreen = () => {
  const { navigate, dispatch } = useExtendedNavigation<NavigationProps>();
  const { addWallet, saveToDisk, wallets } = useStorage();

  const createWallet = async () => {
    try {
      if (wallets.length > 0) {
        presentAlert({ message: loc.wallets.single_wallet_limit });
        return;
      }

      // Create a new HDSilentPaymentsWallet (native segwit) directly
      const w = new HDSilentPaymentsWallet();
      w.setLabel(loc.wallets.details_title);

      // Generate the wallet (this creates the seed phrase)
      await w.generate();

      // Add to storage immediately so it can be found by ID
      if (!addWallet(w)) {
        presentAlert({ message: loc.wallets.single_wallet_limit });
        return;
      }
      await saveToDisk();

      // haptic feedback
      triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);

      // Go to PleaseBackup screen to show seed phrase
      dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'AddWalletRoot',
              state: {
                routes: [{ name: 'PleaseBackup', params: { walletID: w.getID() } }],
              },
            },
          ],
        }),
      );
    } catch (error) {
      console.error('Error creating wallet:', error);
      // Fallback to normal flow
      navigate('AddWalletRoot');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>First, let's create your recovery phrase</Text>
      <Text style={styles.description}>
        A recovery phrase is a series of 12 words in a specific order. This word combination is unique to your wallet. Make sure to have pen
        and paper ready so you can write it down.
      </Text>
      <TouchableOpacity style={styles.button} onPress={createWallet}>
        <Text style={styles.buttonText}>Create my wallet</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
  },
  button: {
    backgroundColor: '#FFA726',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CreateWalletScreen;
