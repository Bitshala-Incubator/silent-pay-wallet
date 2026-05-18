import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Icon } from '@rneui/themed';
import SafeArea from '../../components/SafeArea';
import { useTheme } from '../../components/themes';
import { useStorage } from '../../hooks/context/useStorage';
import { HDSilentPaymentsWallet } from '../../class/wallets/hd-bip352-wallet';
import loc from '../../loc';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../modules/hapticFeedback';
import { Spacing20 } from '../../components/Spacing';
import Button from '../../components/Button';

const NoPaymentFound: React.FC = () => {
  const { wallets } = useStorage();
  const wallet = wallets.length > 0 ? (wallets[0] as HDSilentPaymentsWallet) : null;
  const { colors } = useTheme();

  const reasons = useMemo(
    () => [
      loc.no_payment_found.reason_not_broadcast,
      loc.no_payment_found.reason_different_address,
      loc.no_payment_found.reason_incorrect_txid,
      loc.no_payment_found.reason_not_silent_payment,
    ],
    [],
  );

  const spAddress = useMemo(() => wallet?.getSilentPaymentAddress() ?? '', [wallet]);
  const warningColor = colors.warningColor;

  const handleCopyAddress = useCallback(() => {
    if (!spAddress) return;
    Clipboard.setString(spAddress);
    triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
  }, [spAddress]);

  const stylesHook = StyleSheet.create({
    heading: { color: colors.foregroundColor },
    subheading: { color: colors.alternativeTextColor },
    reasonsBox: { backgroundColor: warningColor + '15' },
    reasonsTitle: { color: colors.foregroundColor },
    reasonText: { color: colors.alternativeTextColor },
    tipBox: { backgroundColor: colors.ballOutgoingExpired },
    tipText: { color: colors.shadowColor },
  });

  return (
    <SafeArea>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: colors.inputBackgroundColor }]}>
            <Icon name="search" type="material" size={40} color={colors.alternativeTextColor} />
          </View>

          <Text style={[styles.heading, stylesHook.heading]}>{loc.no_payment_found.heading}</Text>
          <Text style={[styles.subheading, stylesHook.subheading]}>{loc.no_payment_found.subheading}</Text>

          <Spacing20 />

          <View style={[styles.reasonsBox, stylesHook.reasonsBox]}>
            <View style={styles.reasonsHeader}>
              <Icon name="help-outline" type="material" size={20} color={warningColor} />
              <Text style={[styles.reasonsTitle, stylesHook.reasonsTitle]}>{loc.no_payment_found.could_mean}</Text>
            </View>
            {reasons.map(reason => (
              <View key={reason} style={styles.reasonRow}>
                <View style={[styles.bullet, { backgroundColor: warningColor }]} />
                <Text style={[styles.reasonText, stylesHook.reasonText]}>{reason}</Text>
              </View>
            ))}
          </View>

          <Spacing20 />

          <View style={[styles.tipBox, stylesHook.tipBox]}>
            <Text style={[styles.tipText, stylesHook.tipText]}>
              <Text style={[styles.tipLabel, { color: colors.buttonBackgroundColor }]}>{loc.no_payment_found.tip_label} </Text>
              {loc.no_payment_found.tip}
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title={loc.no_payment_found.copy_my_address}
            onPress={handleCopyAddress}
            icon={{ name: 'content-copy', type: 'material', color: colors.buttonTextColor }}
            testID="CopyMyAddressButton"
          />
        </View>
      </ScrollView>
    </SafeArea>
  );
};

export default NoPaymentFound;

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    justifyContent: 'space-between',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
  },
  subheading: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  reasonsBox: {
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  reasonsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reasonsTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingLeft: 4,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 10,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  tipBox: {
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  tipLabel: {
    fontWeight: '700',
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
  },
  buttonContainer: {
    paddingBottom: 30,
    paddingTop: 20,
  },
});
