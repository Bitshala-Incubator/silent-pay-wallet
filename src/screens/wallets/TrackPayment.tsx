import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Icon } from '@rneui/themed';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import SafeArea from '../../components/SafeArea';
import { useTheme } from '../../components/themes';
import { useStorage } from '../../hooks/context/useStorage';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import { HDSilentPaymentsWallet } from '../../class/wallets/hd-bip352-wallet';
import loc from '../../loc';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../modules/hapticFeedback';
import { Spacing20 } from '../../components/Spacing';

type TrackPaymentProps = NativeStackScreenProps<DetailViewStackParamList, 'TrackPayment'>;

const TrackPayment: React.FC<TrackPaymentProps> = () => {
  const { wallets } = useStorage();
  const wallet = wallets.length > 0 ? (wallets[0] as HDSilentPaymentsWallet) : null;
  const { navigate } = useExtendedNavigation();
  const { colors } = useTheme();
  const [txid, setTxid] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const stylesHook = StyleSheet.create({
    inputContainer: {
      borderColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
    },
    input: {
      color: colors.foregroundColor,
    },
    label: {
      color: colors.foregroundColor,
    },
    description: {
      color: colors.alternativeTextColor,
    },
    helperText: {
      color: colors.alternativeTextColor,
    },
    infoBox: {
      backgroundColor: colors.ballOutgoingExpired,
    },
    infoText: {
      color: colors.secondButtonTextColor,
    },
    outlineButton: {
      borderColor: colors.formBorder,
    },
    outlineButtonText: {
      color: colors.foregroundColor,
    },
  });

  const handlePasteFromClipboard = useCallback(async () => {
    const clipboard = await Clipboard.getStringAsync();
    if (clipboard) {
      setTxid(clipboard.trim());
    }
  }, []);

  const handleCheckTransaction = useCallback(async () => {
    if (!wallet) return;

    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const result = await wallet.scanByTxid(txid.trim());

      if (result.found) {
        triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
        navigate('PaymentFound', {
          txid: txid.trim(),
          blockHeight: result.blockHeight,
          tipHeight: result.tipHeight,
        });
      } else {
        triggerHapticFeedback(HapticFeedbackTypes.NotificationWarning);
        navigate('NoPaymentFound');
      }
    } catch (error: any) {
      triggerHapticFeedback(HapticFeedbackTypes.NotificationWarning);
      navigate('NoPaymentFound');
    } finally {
      setIsLoading(false);
    }
  }, [txid, wallet, navigate]);

  const isValidTxid = txid.trim().length === 64 && /^[0-9a-fA-F]+$/.test(txid.trim());

  return (
    <SafeArea>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={[styles.description, stylesHook.description]}>{loc.track_payment.description}</Text>

          <Spacing20 />

          <Text style={[styles.label, stylesHook.label]}>{loc.track_payment.txid_label}</Text>
          <View style={[styles.inputContainer, stylesHook.inputContainer]}>
            <TextInput
              style={[styles.input, stylesHook.input]}
              placeholder={loc.track_payment.txid_placeholder}
              placeholderTextColor={colors.alternativeTextColor}
              value={txid}
              onChangeText={setTxid}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={false}
              editable={!isLoading}
              testID="TrackPaymentTxidInput"
            />
            <Pressable onPress={handlePasteFromClipboard} style={styles.pasteButton} testID="PasteButton">
              <Icon name="content-paste" type="material" size={18} color={colors.alternativeTextColor} />
            </Pressable>
          </View>
          <Text style={[styles.helperText, stylesHook.helperText]}>{loc.track_payment.txid_helper}</Text>

          <Spacing20 />

          <View style={[styles.infoBox, stylesHook.infoBox]}>
            <View style={styles.infoHeader}>
              <Icon name="info-outline" type="material" size={18} color={colors.hdborderColor} />
              <Text style={[styles.infoTitle, { color: colors.shadowColor }]}>{loc.track_payment.whats_txid}</Text>
            </View>
            <Text style={[styles.infoText, stylesHook.infoText]}>{loc.track_payment.txid_explanation}</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.mainColor} />
          ) : (
            <Pressable
              style={[styles.outlineButton, stylesHook.outlineButton, (!isValidTxid || !wallet) && styles.disabled]}
              onPress={handleCheckTransaction}
              disabled={!isValidTxid || isLoading || !wallet}
              testID="CheckTransactionButton"
            >
              <Text style={[styles.outlineButtonText, stylesHook.outlineButtonText]}>{loc.track_payment.check_transaction}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeArea>
  );
};

export default TrackPayment;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },
  pasteButton: {
    padding: 8,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  buttonContainer: {
    paddingBottom: 30,
  },
  outlineButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
