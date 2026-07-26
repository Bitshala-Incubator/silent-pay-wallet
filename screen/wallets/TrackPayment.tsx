import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import ClipboardIcon from '../../components/icons/ClipboardIcon';
import InfoBadgeIcon from '../../components/icons/InfoBadgeIcon';
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
import { ClashFont } from '../../constants/fonts';

type TrackPaymentProps = NativeStackScreenProps<DetailViewStackParamList, 'TrackPayment'>;

const TrackPayment: React.FC<TrackPaymentProps> = () => {
  const { wallets } = useStorage();
  const wallet = wallets.length > 0 ? (wallets[0] as HDSilentPaymentsWallet) : null;
  const { navigate } = useExtendedNavigation();
  const { colors } = useTheme();
  const [txid, setTxid] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isValidTxid = txid.trim().length === 64 && /^[0-9a-fA-F]+$/.test(txid.trim());
  const isCheckEnabled = isValidTxid && !!wallet;

  const stylesHook = StyleSheet.create({
    inputContainer: {
      borderColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
    },
    input: {
      color: colors.foregroundColor,
    },
    label: {
      color: colors.inputlabel,
    },
    description: {
      color: colors.trackpaymentdescription,
    },
    helperText: {
      color: colors.helpertext,
    },
    infoBox: {
      backgroundColor: colors.infoboxbackground,
      borderColor: colors.infoBoxBorder,
    },
    infoText: {
      color: colors.infotext,
    },
    checkButton: {
      backgroundColor: isCheckEnabled ? colors.brandPrimary : colors.checkButtonDisabledBackground,
    },
    checkButtonText: {
      color: isCheckEnabled ? colors.white : colors.buttonDisabledTextColor,
    },
    pasteButton: {
      backgroundColor: colors.pasteButtonBackground,
      borderColor: colors.pasteButtonBorder,
    },
  });

  const handlePasteFromClipboard = useCallback(async () => {
    const clipboard = await Clipboard.getString();
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
              placeholderTextColor={colors.placeholdertext}
              value={txid}
              onChangeText={setTxid}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={true}
              editable={!isLoading}
              testID="TrackPaymentTxidInput"
            />
            <Pressable onPress={handlePasteFromClipboard} style={[styles.pasteButton, stylesHook.pasteButton]} testID="PasteButton">
              <ClipboardIcon size={14} color={colors.pasteButtonIcon} />
            </Pressable>
          </View>
          <Text style={[styles.helperText, stylesHook.helperText]}>{loc.track_payment.txid_helper}</Text>

          <Spacing20 />

          <View style={[styles.infoBox, stylesHook.infoBox]}>
            <View style={styles.infoHeader}>
              <InfoBadgeIcon size={28} background={colors.infoBadgeBackground} glyphColor={colors.infoBadgeIcon} />
              <Text style={[styles.infoTitle, { color: colors.infotitle }]}>{loc.track_payment.whats_txid}</Text>
            </View>
            <Text style={[styles.infoText, stylesHook.infoText]}>{loc.track_payment.txid_explanation}</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.mainColor} />
          ) : (
            <Pressable
              style={[styles.checkButton, stylesHook.checkButton]}
              onPress={handleCheckTransaction}
              disabled={!isCheckEnabled || isLoading}
              testID="CheckTransactionButton"
            >
              <Text style={[styles.checkButtonText, stylesHook.checkButtonText]}>{loc.track_payment.check_transaction}</Text>
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
    fontSize: 16,
    lineHeight: 20,
    fontFamily: ClashFont.regular,
  },
  label: {
    fontSize: 17,
    fontFamily: ClashFont.medium,
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
    fontFamily: ClashFont.regular,
  },
  pasteButton: {
    width: 37,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    fontSize: 14,
    marginTop: 6,
    marginLeft: 4,
    fontFamily: ClashFont.regular,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
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
    fontFamily: ClashFont.medium,
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: ClashFont.regular,
  },
  buttonContainer: {
    paddingBottom: 30,
  },
  checkButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonText: {
    fontSize: 16,
    fontFamily: ClashFont.medium,
  },
});
