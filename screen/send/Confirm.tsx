import React, { useEffect, useMemo, useReducer } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { Text } from '@rneui/themed';
import BigNumber from 'bignumber.js';
import * as bitcoin from 'bitcoinjs-lib';
import Clipboard from '@react-native-clipboard/clipboard';
import { BitcoinUnit } from '../../models/bitcoinUnits';
import loc, { formatBalanceWithoutSuffix } from '../../loc';
import { useRoute, RouteProp } from '@react-navigation/native';
import presentAlert from '../../components/Alert';
import { useTheme } from '../../components/themes';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../modules/hapticFeedback';
import SafeArea from '../../components/SafeArea';
import { satoshiToBTC, satoshiToLocalCurrency } from '../../modules/currency';
import * as Electrum from '../../modules/Electrum';
import { unlockWithBiometrics, useBiometrics } from '../../hooks/useBiometrics';
import { TWallet } from '../../class/wallets/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SendDetailsStackParamList } from '../../navigation/SendDetailsStackParamList';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { useStorage } from '../../hooks/context/useStorage';
import { useSettings } from '../../hooks/context/useSettings';
import AmountHero from '../../components/AmountHero';
import DetailRow from '../../components/DetailRow';
import CopyIcon from '../../components/icons/CopyIcon';
import ShieldCheckIcon from '../../components/icons/ShieldCheckIcon';
import SendIcon from '../../components/icons/SendIcon';
import { ClashFont } from '../../constants/fonts';
import { computeTotalSats } from '../../helpers/send/format';

enum ActionType {
  SET_LOADING = 'SET_LOADING',
  SET_BUTTON_DISABLED = 'SET_BUTTON_DISABLED',
}

type Action = { type: ActionType.SET_LOADING; payload: boolean } | { type: ActionType.SET_BUTTON_DISABLED; payload: boolean };

interface State {
  isLoading: boolean;
  isButtonDisabled: boolean;
}

const initialState: State = {
  isLoading: false,
  isButtonDisabled: false,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case ActionType.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case ActionType.SET_BUTTON_DISABLED:
      return { ...state, isButtonDisabled: action.payload };
    default:
      return state;
  }
};

type ConfirmRouteProp = RouteProp<SendDetailsStackParamList, 'Confirm'>;
type ConfirmNavigationProp = NativeStackNavigationProp<SendDetailsStackParamList, 'Confirm'>;

const Confirm: React.FC = () => {
  const { wallets, fetchAndSaveWalletTransactions } = useStorage();
  const { isElectrumDisabled } = useSettings();
  const { isBiometricUseCapableAndEnabled } = useBiometrics();
  const navigation = useExtendedNavigation<ConfirmNavigationProp>();
  const route = useRoute<ConfirmRouteProp>();
  const { recipients, walletID, fee, tx, splitOutputCount, spRecipientAddress } = route.params;

  const [state, dispatch] = useReducer(reducer, initialState);
  const { navigate, goBack } = navigation;
  const wallet = wallets.find((w: TWallet) => w.getID() === walletID) as TWallet;
  const feeSatoshi = new BigNumber(fee).multipliedBy(100000000).toNumber();
  const { colors } = useTheme();
  const [copiedAddr, setCopiedAddr] = React.useState(false);
  const [copiedTxid, setCopiedTxid] = React.useState(false);
  const [copiedSP, setCopiedSP] = React.useState(false);
  const [copiedOutputs, setCopiedOutputs] = React.useState<Record<number, boolean>>({});

  const stylesHook = StyleSheet.create({
    splitSectionTitle: { color: colors.brandPrimary },
    splitOutputsCard: {
      backgroundColor: colors.splitCardEnabledBGColor,
      borderColor: 'transparent',
    },
    outputLabel: { color: colors.textPrimary },
    outputAmount: { color: colors.textPrimary },
    outputAddressCard: { backgroundColor: colors.background },
    outputAddressLabel: { color: colors.amountMeta },
    outputAddressText: { color: colors.textPrimary },
    spAddressRow: {
      borderColor: colors.inputBackgroundColor,
      backgroundColor: colors.background,
    },
    spAddressLabel: { color: colors.amountMeta },
    spAddressText: { color: colors.brandPrimary },

    root: { backgroundColor: colors.background },
    divider: { backgroundColor: colors.divider },
    summaryLabel: { color: colors.amountMeta },
    summaryValue: { color: colors.black },
    summaryFiat: { color: colors.chevron },
    totalRow: { backgroundColor: colors.white },
    totalLabel: { color: colors.textPrimary },
    totalValue: { color: colors.brandPrimary },
    sendNowButton: { backgroundColor: colors.brandPrimary },
    sendNowButtonDisabled: { backgroundColor: colors.ctaDisabled },
    sendNowText: { color: colors.white },
    outputCopyBtn: { backgroundColor: colors.white },
    lightDivider: { backgroundColor: colors.divider },
  });

  useEffect(() => {
    if (!wallet) {
      goBack();
    }
  }, [wallet, goBack]);

  const handleSendTransaction = async () => {
    dispatch({ type: ActionType.SET_BUTTON_DISABLED, payload: true });
    dispatch({ type: ActionType.SET_LOADING, payload: true });
    try {
      if (await isBiometricUseCapableAndEnabled()) {
        if (!(await unlockWithBiometrics())) {
          dispatch({ type: ActionType.SET_LOADING, payload: false });
          dispatch({ type: ActionType.SET_BUTTON_DISABLED, payload: false });
          return;
        }
      }

      const txidsToWatch = [];
      const result = await broadcastTransaction(tx);
      if (!result) {
        dispatch({ type: ActionType.SET_LOADING, payload: false });
        dispatch({ type: ActionType.SET_BUTTON_DISABLED, payload: false });
        return;
      }

      const txid = bitcoin.Transaction.fromHex(tx).getId();
      txidsToWatch.push(txid);
      let amount = 0;
      for (const recipient of recipients) {
        if (recipient.value) {
          amount += recipient.value;
        }
      }

      amount = Number(formatBalanceWithoutSuffix(amount, BitcoinUnit.BTC, false));
      triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
      navigate('Success', {
        fee: Number(fee),
        amount,
        txid,
      });

      dispatch({ type: ActionType.SET_LOADING, payload: false });

      await new Promise(resolve => setTimeout(resolve, 3000)); // sleep to make sure network propagates
      fetchAndSaveWalletTransactions(walletID);
    } catch (error: any) {
      triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
      dispatch({ type: ActionType.SET_LOADING, payload: false });
      dispatch({ type: ActionType.SET_BUTTON_DISABLED, payload: false });
      presentAlert({ message: error.message });
    }
  };

  const broadcastTransaction = async (transaction: string) => {
    await Electrum.ping();
    await Electrum.waitTillConnected();

    const result = await wallet.broadcastTx(transaction);
    if (!result) {
      throw new Error(loc.errors.broadcast);
    }

    return result;
  };

  const recipient = recipients[0];
  const amountSats = spRecipientAddress ? recipients.reduce((acc, curr) => acc + (curr.value ?? 0), 0) : (recipient?.value ?? 0);
  // Display order only. The on-chain order is deliberately shuffled (change must not be
  // positionally identifiable), so sorting by value — the same rule SendDetails previews with —
  // is what keeps "Output 1" the same row on both screens instead of contradicting itself.
  const splitOutputs = useMemo(() => recipients.slice().sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), [recipients]);
  const displayAddress = spRecipientAddress ?? recipient?.address ?? '';
  const txid = useMemo(() => {
    try {
      return tx ? bitcoin.Transaction.fromHex(tx).getId() : '';
    } catch {
      return '';
    }
  }, [tx]);
  const totalSats = computeTotalSats(amountSats, feeSatoshi);
  const copy = (text: string, setFlag: (b: boolean) => void) => {
    Clipboard.setString(text);
    triggerHapticFeedback(HapticFeedbackTypes.Selection);
    setFlag(true);
    setTimeout(() => setFlag(false), 1000);
  };

  const copyOutput = (index: number, text: string) => {
    copy(text, v => setCopiedOutputs(prev => ({ ...prev, [index]: v })));
  };

  return (
    <SafeArea style={[styles.root, stylesHook.root]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <AmountHero amount={satoshiToBTC(amountSats)} fiat={`≈ ${satoshiToLocalCurrency(amountSats)}`} />

          <View style={[styles.divider, stylesHook.divider]} />

          <View style={styles.detailsGroup}>
            <View style={styles.outputsWrapper}>
              {spRecipientAddress ? (
                <>
                  <Text style={[styles.splitSectionTitle, stylesHook.splitSectionTitle]}>
                    {loc.formatString(loc.send.split_into_outputs, {
                      count: splitOutputCount ?? recipients.length,
                    })}
                  </Text>

                  <View style={[styles.splitOutputsCard, stylesHook.splitOutputsCard]}>
                    {splitOutputs.map((r, i) => (
                      <React.Fragment key={`output-${i}`}>
                        <View style={styles.outputGroup}>
                          <View style={styles.outputHeaderRow}>
                            <Text style={[styles.outputLabel, stylesHook.outputLabel]}>
                              {loc.formatString(loc.send.split_output_label, { number: i + 1 })}
                            </Text>
                            <Text style={[styles.outputAmount, stylesHook.outputAmount]}>
                              {`${satoshiToBTC(r.value ?? 0)} ${loc.units[BitcoinUnit.BTC]}`}
                            </Text>
                          </View>
                          <View style={[styles.outputAddressCard, stylesHook.outputAddressCard]}>
                            <View style={styles.outputAddressHeader}>
                              <Text style={[styles.outputAddressLabel, stylesHook.outputAddressLabel]}>
                                {loc.send.onchain_address_derived}
                              </Text>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => copyOutput(i, r.address ?? '')}
                                style={[styles.outputCopyBtn, stylesHook.outputCopyBtn]}
                              >
                                <CopyIcon size={16} color={copiedOutputs[i] ? colors.brandPrimary : colors.chevron} />
                              </Pressable>
                            </View>
                            <Text style={[styles.outputAddressText, stylesHook.outputAddressText]} numberOfLines={2}>
                              {r.address}
                            </Text>
                          </View>
                        </View>
                        {i < splitOutputs.length - 1 && <View style={[styles.lightDivider, stylesHook.lightDivider]} />}
                      </React.Fragment>
                    ))}

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={loc.send.recipients_sp_address}
                      style={[styles.spAddressRow, stylesHook.spAddressRow]}
                      onPress={() => copy(spRecipientAddress, setCopiedSP)}
                    >
                      <ShieldCheckIcon size={20} />
                      <View style={styles.spAddressTextWrap}>
                        <Text style={[styles.spAddressLabel, stylesHook.spAddressLabel]} numberOfLines={1}>
                          {loc.send.recipients_sp_address}
                        </Text>
                        {/* This is the one address the user can actually verify — they typed it,
                            and it never appears on-chain — so it must be shown before signing. */}
                        <Text style={[styles.spAddressText, stylesHook.spAddressText]} numberOfLines={1}>
                          {spRecipientAddress}
                        </Text>
                      </View>
                      <CopyIcon size={18} color={copiedSP ? colors.brandPrimary : colors.settingsBtnIconColor} />
                    </Pressable>
                  </View>

                  <View style={[styles.lightDivider, stylesHook.lightDivider]} />
                </>
              ) : (
                <>
                  <DetailRow
                    label={loc.send.onchain_address_derived}
                    value={displayAddress}
                    mono
                    copied={copiedAddr}
                    onCopy={() => copy(displayAddress, setCopiedAddr)}
                    accessibilityLabel={loc.transactions.details_copy}
                  />
                  <View style={[styles.lightDivider, stylesHook.lightDivider]} />
                </>
              )}

              <DetailRow
                label={loc.send.transaction_id}
                value={txid}
                mono
                copied={copiedTxid}
                onCopy={() => copy(txid, setCopiedTxid)}
                accessibilityLabel={loc.transactions.details_copy_txid}
              />
              <View style={[styles.lightDivider, stylesHook.lightDivider]} />
            </View>

            <View style={styles.summaryBlock}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, stylesHook.summaryLabel]}>{loc.send.network_fee}</Text>
                <Text style={[styles.summaryValue, stylesHook.summaryValue]}>
                  {satoshiToBTC(feeSatoshi)} {loc.units[BitcoinUnit.BTC]}
                  <Text style={[styles.summaryFiat, stylesHook.summaryFiat]}> ({satoshiToLocalCurrency(feeSatoshi)})</Text>
                </Text>
              </View>
              <View style={[styles.lightDivider, stylesHook.lightDivider]} />

              <View style={[styles.totalRow, stylesHook.totalRow]}>
                <Text style={[styles.totalLabel, stylesHook.totalLabel]}>{loc.send.total}</Text>
                <Text style={[styles.totalValue, stylesHook.totalValue]}>
                  {satoshiToBTC(totalSats)} {loc.units[BitcoinUnit.BTC]}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        {state.isLoading ? (
          <ActivityIndicator />
        ) : (
          <Pressable
            accessibilityRole="button"
            testID="sendNowButton"
            disabled={isElectrumDisabled || state.isButtonDisabled}
            onPress={handleSendTransaction}
            style={[
              styles.sendNowButton,
              stylesHook.sendNowButton,
              (isElectrumDisabled || state.isButtonDisabled) && stylesHook.sendNowButtonDisabled,
            ]}
          >
            <SendIcon size={20} color={colors.white} />
            <Text style={[styles.sendNowText, stylesHook.sendNowText]}>{loc.send.confirm_sendNow}</Text>
          </Pressable>
        )}
      </View>
    </SafeArea>
  );
};

export default Confirm;

const styles = StyleSheet.create({
  splitSectionTitle: {
    fontFamily: ClashFont.medium,
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  splitOutputsCard: {
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  outputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outputLabel: {
    fontFamily: ClashFont.medium,
    fontSize: 14,
    lineHeight: 26,
  },
  outputAmount: {
    fontFamily: ClashFont.medium,
    fontSize: 12,
    lineHeight: 26,
  },
  outputAddressCard: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    gap: 10,
  },
  outputAddressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outputAddressLabel: {
    fontFamily: ClashFont.regular,
    fontSize: 12,
    lineHeight: 26,
  },
  outputAddressText: {
    fontFamily: ClashFont.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  outputCopyBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  spAddressTextWrap: {
    flex: 1,
  },
  spAddressLabel: {
    fontFamily: ClashFont.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  spAddressText: {
    fontFamily: ClashFont.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  root: {
    flex: 1,
    paddingTop: 19,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  lightDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  detailsGroup: {
    gap: 8,
  },
  outputsWrapper: {
    gap: 6,
  },
  outputGroup: {
    gap: 8,
  },
  summaryBlock: {
    gap: 4,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: ClashFont.regular,
    fontSize: 14,
    lineHeight: 26,
  },
  summaryValue: {
    fontFamily: ClashFont.medium,
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: -0.104281,
  },
  summaryFiat: {
    fontFamily: ClashFont.regular,
    fontSize: 14,
    lineHeight: 17,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  totalLabel: {
    fontFamily: ClashFont.regular,
    fontSize: 12,
    lineHeight: 20,
  },
  totalValue: {
    fontFamily: ClashFont.semibold,
    fontSize: 14,
    lineHeight: 26,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  sendNowButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  sendNowText: {
    fontFamily: ClashFont.medium,
    fontSize: 16,
    lineHeight: 24,
  },
});
