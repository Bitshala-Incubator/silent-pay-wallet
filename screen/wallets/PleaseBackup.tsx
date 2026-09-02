import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  InteractionManager,
} from 'react-native';
import { useSettings } from '../../hooks/context/useSettings';
import { useStorage } from '../../hooks/context/useStorage';
import { useScreenProtect } from '../../hooks/useScreenProtect';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation.ts';
import { AddWalletStackParamList } from '../../navigation/AddWalletStack';
import { SafeAreaView } from 'react-native-safe-area-context';
import loc from '../../loc';
import SeedVerification from '../../components/SeedVerification';
import { isE2E } from '../../helpers/e2e';
import { useTheme } from '../../components/themes';
import { ClashFont } from '../../constants/fonts';
import BackupStepHeader from '../../components/BackupStepHeader';
import Button from '../../components/Button';
import KeyIcon from '../../components/icons/KeyIcon';
import WritePaperIcon from '../../components/icons/WritePaperIcon';
import OfflineIcon from '../../components/icons/OfflineIcon';
import NoShareIcon from '../../components/icons/NoShareIcon';
import EyeIcon from '../../components/icons/EyeIcon';
import InfoIcon from '../../components/icons/InfoIcon';
import CheckboxUncheckedIcon from '../../components/icons/CheckboxUncheckedIcon';
import CheckboxCheckedIcon from '../../components/icons/CheckboxCheckedIcon';
import RevealEyeIcon from '../../components/icons/RevealEyeIcon';

type RouteProps = RouteProp<AddWalletStackParamList, 'PleaseBackup'>;

enum BackupStep {
  INTRO = 'intro',
  SHOW_SEED = 'show-seed',
  VERIFY = 'verify',
}

const BACKUP_TIPS = [
  { Icon: WritePaperIcon, bold: loc.pleasebackup.tip_paper_bold, body: loc.pleasebackup.tip_paper_body },
  { Icon: OfflineIcon, bold: loc.pleasebackup.tip_offline_bold, body: loc.pleasebackup.tip_offline_body },
  { Icon: NoShareIcon, bold: loc.pleasebackup.tip_share_bold, body: loc.pleasebackup.tip_share_body },
];

const SKIP_VERIFY_TAP_THRESHOLD = 5;

const PleaseBackup: React.FC = () => {
  const { wallets } = useStorage();
  const { walletID } = useRoute<RouteProps>().params;
  const wallet = wallets.find(w => w.getID() === walletID)!;
  const seedPhrase = wallet.getSecret();
  const seedWords = seedPhrase.split(' ');
  const navigation = useExtendedNavigation();
  const { colors } = useTheme();
  const { isScreenCaptureAllowed } = useSettings();
  const { enableScreenProtect, disableScreenProtect } = useScreenProtect();
  const [currentStep, setCurrentStep] = useState<BackupStep>(isE2E() ? BackupStep.SHOW_SEED : BackupStep.INTRO);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasConfirmedWritten, setHasConfirmedWritten] = useState(false);
  const [skipVerifyTaps, setSkipVerifyTaps] = useState(0);
  const handleVerifyComplete = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      navigation.navigateToWalletsList();
    });
    return true;
  }, [navigation]);

  useEffect(() => {
    if (skipVerifyTaps >= SKIP_VERIFY_TAP_THRESHOLD) handleVerifyComplete();
  }, [skipVerifyTaps, handleVerifyComplete]);

  const handleProceedToVerification = () => {
    setCurrentStep(BackupStep.VERIFY);
  };

  const handleBackToSeed = () => {
    setCurrentStep(BackupStep.SHOW_SEED);
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);

    return () => {
      subscription.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isScreenCaptureAllowed) enableScreenProtect();
      return () => {
        disableScreenProtect();
      };
    }, [disableScreenProtect, enableScreenProtect, isScreenCaptureAllowed]),
  );

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        {currentStep === BackupStep.INTRO && (
          <View style={styles.stepRoot}>
            <BackupStepHeader onBack={() => navigation.goBack()} filledSteps={2} totalSteps={3} testID="BackupIntroBackButton" />

            <ScrollView contentContainerStyle={styles.introScrollContent}>
              <View style={[styles.iconBadge, { backgroundColor: colors.surfaceSubtle, borderColor: colors.accentSubtle }]}>
                <KeyIcon size={64} color={colors.primary} />
              </View>
              <Text style={[styles.introTitle, { color: colors.textPrimary }]}>{loc.pleasebackup.intro_title}</Text>
              <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>{loc.pleasebackup.intro_subtitle}</Text>

              {BACKUP_TIPS.map(tip => (
                <View key={tip.bold} style={[styles.tipCard, { borderColor: colors.accentSubtle }]}>
                  <View style={styles.tipIconBadge}>
                    <tip.Icon size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.tipText}>
                    <Text style={[styles.tipBold, { color: colors.textPrimary }]}>{tip.bold}</Text>
                    <Text style={[styles.tipBody, { color: colors.textPrimary }]}>{tip.body}</Text>
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title={loc.pleasebackup.view_recovery_phrase}
                onPress={() => setCurrentStep(BackupStep.SHOW_SEED)}
                testID="ViewRecoveryPhrase"
                borderRadius={16}
                icon={<EyeIcon color={colors.white} />}
                style={styles.footerButton}
              />
            </View>
          </View>
        )}

        {currentStep === BackupStep.SHOW_SEED && (
          <View style={styles.stepRoot}>
            <BackupStepHeader onBack={() => setCurrentStep(BackupStep.INTRO)} filledSteps={2} totalSteps={3} testID="RevealBackButton" />

            <ScrollView contentContainerStyle={styles.revealScrollContent} testID="PleaseBackupScrollView">
              <Text style={[styles.title, { color: colors.textPrimary }]}>{loc.pleasebackup.title}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{loc.pleasebackup.text}</Text>

              <View style={[styles.warningBanner, { backgroundColor: colors.surfaceSubtle, borderColor: colors.accentSubtle }]}>
                <InfoIcon size={20} color={colors.primary} />
                <Text style={styles.warningText}>
                  <Text style={{ color: colors.textPrimary }}>{loc.pleasebackup.screenshot_warning_prefix}</Text>
                  <Text style={[styles.warningEmphasis, { color: colors.primary }]}>{loc.pleasebackup.screenshot_warning_emphasis}</Text>
                </Text>
              </View>

              <View style={styles.wordGridWrapper}>
                <View style={styles.wordsGrid}>
                  {isRevealed
                    ? seedWords.map((word, idx) => (
                        <View
                          key={idx}
                          style={[styles.seedRow, { backgroundColor: colors.cardBackground, borderColor: colors.transactionCardBorder }]}
                        >
                          <View
                            style={[
                              styles.seedIndexBox,
                              { backgroundColor: colors.fieldBackground, borderColor: colors.transactionCardBorder },
                            ]}
                          >
                            <Text style={[styles.seedIndexText, { color: colors.textSecondary }]}>{idx + 1}</Text>
                          </View>
                          <View style={styles.seedWordBox}>
                            <Text style={[styles.seedWordText, { color: colors.textPrimary }]}>{word}</Text>
                          </View>
                        </View>
                      ))
                    : seedWords.map((_, idx) => (
                        <View key={idx} style={[styles.placeholderCell, { backgroundColor: colors.settingsCardBackground }]} />
                      ))}
                </View>

                {!isRevealed && (
                  <TouchableOpacity style={styles.revealOverlay} onPress={() => setIsRevealed(true)} testID="RevealSeedPhrase">
                    <View style={[styles.revealCircle, { backgroundColor: colors.primary }]}>
                      <RevealEyeIcon size={64} color={colors.white} />
                    </View>
                    <Text style={[styles.revealTitle, { color: colors.textPrimary }]}>{loc.pleasebackup.tap_to_reveal}</Text>
                    <Text style={[styles.revealCaption, { color: colors.textSecondary }]}>{loc.pleasebackup.tap_to_reveal_caption}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setHasConfirmedWritten(c => !c)}
                testID="ConfirmWrittenDown"
                activeOpacity={0.7}
              >
                {hasConfirmedWritten ? (
                  <CheckboxCheckedIcon size={20} color={colors.primary} />
                ) : (
                  <CheckboxUncheckedIcon size={20} color={colors.accentSubtle} />
                )}
                <Text style={[styles.checkboxText, { color: colors.textPrimary }]}>{loc.pleasebackup.confirm_written_down}</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title={loc.pleasebackup.continue}
                onPress={handleProceedToVerification}
                testID="ContinueToVerify"
                borderRadius={16}
                disabled={!hasConfirmedWritten}
                disabledBackgroundColor={colors.darkGray}
                disabledTextColor={colors.white}
                style={styles.footerButton}
              />
            </View>

            {isE2E() && (
              <TouchableWithoutFeedback
                onPress={() => setSkipVerifyTaps(c => c + 1)}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                testID="SkipVerifyBackdoor"
              >
                <View style={styles.skipVerifyBackdoor} />
              </TouchableWithoutFeedback>
            )}
          </View>
        )}

        {currentStep === BackupStep.VERIFY && (
          <SeedVerification seed={seedWords} onSuccess={handleVerifyComplete} onBack={handleBackToSeed} />
        )}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  stepRoot: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  footerButton: { height: 56, maxHeight: 56 },
  introScrollContent: {
    paddingHorizontal: 24,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  introTitle: { fontFamily: ClashFont.medium, fontSize: 32, marginBottom: 12 },
  introSubtitle: { fontFamily: ClashFont.regular, fontSize: 15, lineHeight: 22.5, marginBottom: 24 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  tipIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipText: { flex: 1, fontSize: 14, lineHeight: 20 },
  tipBold: { fontFamily: ClashFont.medium },
  tipBody: { fontFamily: ClashFont.regular },
  revealScrollContent: {
    paddingHorizontal: 24,
  },
  title: { fontFamily: ClashFont.medium, fontSize: 32, lineHeight: 40, letterSpacing: -1.2, marginBottom: 12 },
  subtitle: { fontFamily: ClashFont.regular, fontSize: 15, lineHeight: 22.5, marginBottom: 20 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  warningText: { flex: 1, fontFamily: ClashFont.regular, fontSize: 14, lineHeight: 20 },
  warningEmphasis: { fontFamily: ClashFont.regular },
  wordGridWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  seedRow: {
    flexDirection: 'row',
    width: '48%',
    height: 43,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  seedIndexBox: {
    width: 47,
    borderRightWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seedIndexText: { fontFamily: ClashFont.medium, fontSize: 13 },
  seedWordBox: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  seedWordText: { fontFamily: ClashFont.medium, fontSize: 15 },
  placeholderCell: { width: '48%', height: 43, borderRadius: 16 },
  revealOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revealCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  revealTitle: { fontFamily: ClashFont.semibold, fontSize: 16, marginBottom: 6 },
  revealCaption: { fontFamily: ClashFont.regular, fontSize: 13 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  checkboxText: { flex: 1, fontFamily: ClashFont.regular, fontSize: 15, lineHeight: 22.5 },
  skipVerifyBackdoor: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});

export default PleaseBackup;
