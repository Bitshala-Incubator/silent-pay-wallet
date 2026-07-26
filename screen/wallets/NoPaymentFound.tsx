import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import SafeArea from '../../components/SafeArea';
import { useTheme } from '../../components/themes';
import { useStorage } from '../../hooks/context/useStorage';
import { HDSilentPaymentsWallet } from '../../class/wallets/hd-bip352-wallet';
import loc from '../../loc';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../modules/hapticFeedback';
import { Spacing20 } from '../../components/Spacing';
import Button from '../../components/Button';
import CopyIcon from '../../components/icons/CopyIcon';
import SearchBadgeIcon from '../../components/icons/SearchBadgeIcon';
import HelpCircleIcon from '../../components/icons/HelpCircleIcon';
import { ClashFont } from '../../constants/fonts';

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

  const handleCopyAddress = useCallback(() => {
    if (!spAddress) return;
    Clipboard.setString(spAddress);
    triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
  }, [spAddress]);

  const stylesHook = StyleSheet.create({
    heading: { color: colors.foregroundColor },
    subheading: { color: colors.alternativeTextColor },
    reasonsBox: { backgroundColor: colors.reasonsBoxBackground, borderColor: colors.reasonsBoxBorder },
    reasonsTitle: { color: colors.reasonsTitleColor },
    reasonText: { color: colors.reasonsBodyText },
    tipBox: { backgroundColor: colors.tipBoxBackground, borderColor: colors.infoBoxBorder },
    tipText: { color: colors.tipBodyText },
  });

  return (
    <SafeArea>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <SearchBadgeIcon
              size={96}
              gradientStart={colors.searchBadgeGradientStart}
              gradientEnd={colors.searchBadgeGradientEnd}
              iconColor={colors.searchBadgeIconColor}
            />
          </View>

          <Text style={[styles.heading, stylesHook.heading]}>{loc.no_payment_found.heading}</Text>
          <Text style={[styles.subheading, stylesHook.subheading]}>{loc.no_payment_found.subheading}</Text>

          <Spacing20 />

          <View style={[styles.reasonsBox, stylesHook.reasonsBox]}>
            <View style={styles.reasonsHeader}>
              <HelpCircleIcon size={20} color={colors.reasonsAccentColor} />
              <Text style={[styles.reasonsTitle, stylesHook.reasonsTitle]}>{loc.no_payment_found.could_mean}</Text>
            </View>
            {reasons.map(reason => (
              <View key={reason} style={styles.reasonRow}>
                <View style={[styles.bullet, { backgroundColor: colors.reasonsAccentColor }]} />
                <Text style={[styles.reasonText, stylesHook.reasonText]}>{reason}</Text>
              </View>
            ))}
          </View>

          <Spacing20 />

          <View style={[styles.tipBox, stylesHook.tipBox]}>
            <Text style={[styles.tipText, stylesHook.tipText]}>
              <Text style={[styles.tipLabel, { color: colors.attentionHighlightColor }]}>{loc.no_payment_found.tip_label} </Text>
              {loc.no_payment_found.tip}
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title={loc.no_payment_found.copy_my_address}
            onPress={handleCopyAddress}
            iconElement={<CopyIcon size={20} color={colors.white} />}
            testID="CopyMyAddressButton"
            backgroundColor={colors.brandPrimary}
            buttonTextColor={colors.white}
            borderRadius={16}
            style={styles.copyButton}
            textStyle={styles.copyButtonText}
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
    marginTop: 16,
  },
  heading: {
    fontSize: 20,
    fontFamily: ClashFont.semibold,
    textAlign: 'center',
    marginTop: 20,
  },
  subheading: {
    fontSize: 14,
    fontFamily: ClashFont.regular,
    textAlign: 'center',
    marginTop: 12,
  },
  reasonsBox: {
    borderRadius: 12,
    borderWidth: 1,
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
    fontFamily: ClashFont.semibold,
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
    fontFamily: ClashFont.regular,
    lineHeight: 20,
    flex: 1,
  },
  tipBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    width: '100%',
  },
  tipLabel: {
    fontFamily: ClashFont.semibold,
  },
  tipText: {
    fontSize: 13,
    fontFamily: ClashFont.regular,
    lineHeight: 20,
  },
  buttonContainer: {
    paddingBottom: 30,
    paddingTop: 20,
  },
  copyButton: {
    height: 56,
    minHeight: 56,
    maxHeight: 56,
  },
  copyButtonText: {
    fontFamily: ClashFont.medium,
  },
});
