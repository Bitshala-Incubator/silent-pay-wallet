import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@rneui/themed';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import SafeArea from '../../components/SafeArea';
import SyncStatusIcon, { PauseIcon, PlayIcon } from '../../components/SyncStatusIcon';
import RefreshIcon from '../../components/icons/RefreshIcon';
import ClockFilledIcon from '../../components/icons/ClockFilledIcon';
import { useStorage } from '../../hooks/context/useStorage';
import { useScannableWallet } from '../../hooks/useScannableWallet';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import { type ScanProgress, type ScanStatus } from '../../helpers/silent-payments';
import loc from '../../loc';
import { ClashFont } from '../../constants/fonts';
import { useTheme } from '../../components/themes';

type SyncScreenProps = NativeStackScreenProps<DetailViewStackParamList, 'SyncScreen'>;

type EffectiveStatus = Exclude<ScanStatus, 'idle'> | 'done';

function formatEtaAbout(ms: number | null): string | null {
  if (ms === null || ms <= 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return loc.formatString(loc.sync.eta_about, { time: `${totalSeconds}s` });
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours >= 1) {
    const remainingMins = minutes % 60;
    const timeStr = remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
    return loc.formatString(loc.sync.eta_about, { time: timeStr });
  }
  return loc.formatString(loc.sync.eta_about, { time: `${minutes}m` });
}

const SyncScreen: React.FC<SyncScreenProps> = () => {
  const { colors } = useTheme();
  const { scanState } = useStorage();
  const scanWallet = useScannableWallet();

  const [showDone, setShowDone] = useState(false);
  const [liveEta, setLiveEta] = useState<number | null>(scanState.eta);
  const lastProgressRef = useRef<ScanProgress | null>(scanState.progress);
  const prevStatusRef = useRef<ScanStatus>(scanState.status);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (scanState.progress) {
      lastProgressRef.current = scanState.progress;
    }

    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = scanState.status;

    if (scanState.status === 'idle' && (prevStatus === 'scanning' || prevStatus === 'paused')) {
      setShowDone(true);
    } else if (scanState.status !== 'idle') {
      setShowDone(false);
    }
  }, [scanState.status, scanState.progress]);

  useEffect(() => {
    const pct = showDone || scanState.status === 'idle' ? 100 : (scanState.progress?.percentComplete ?? 0);
    Animated.timing(progressAnim, {
      toValue: pct,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [scanState.progress?.percentComplete, showDone, scanState.status, progressAnim]);

  // Sync liveEta whenever a new ETA arrives from the wallet
  useEffect(() => {
    setLiveEta(scanState.eta);
  }, [scanState.eta, scanState.etaComputedAt]);

  // Tick the ETA down every second so it counts live between batch updates (~7s each)
  useEffect(() => {
    if (scanState.status !== 'scanning' || scanState.eta === null || scanState.etaComputedAt === null) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - scanState.etaComputedAt!;
      setLiveEta(Math.max(0, scanState.eta! - elapsed));
    }, 1000);
    return () => clearInterval(id);
  }, [scanState.status, scanState.eta, scanState.etaComputedAt]);

  const effectiveStatus: EffectiveStatus = showDone ? 'done' : scanState.status === 'idle' ? 'done' : scanState.status;
  const effectiveProgress = showDone ? (lastProgressRef.current ?? scanState.progress) : scanState.progress;
  const effectivePct = effectiveStatus === 'done' ? 100 : (effectiveProgress?.percentComplete ?? 0);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const handlePause = useCallback(() => scanWallet?.pauseScan(), [scanWallet]);
  const handleResume = useCallback(() => scanWallet?.resumeScan(), [scanWallet]);
  // On error the scan was never paused (activeScanPromise is already null), so resumeScan() is a
  // no-op. Restart the scan from scratch via fetchTransactions() instead.
  const handleRetry = useCallback(() => {
    scanWallet?.fetchTransactions().catch((e: any) => console.warn('[SyncScreen] retry scan error:', e));
  }, [scanWallet]);
  const handleCheckAgain = useCallback(async () => {
    if (scanWallet) {
      setShowDone(false);
      await scanWallet.fetchTransactions().catch((e: any) => console.warn('[SyncScreen] check again scan error:', e));
    }
  }, [scanWallet]);

  const renderIcon = () => (
    <View style={styles.iconBadge}>
      <SyncStatusIcon status={effectiveStatus} size={66} />
    </View>
  );

  const renderTitle = () => {
    switch (effectiveStatus) {
      case 'scanning':
        return <Text style={[styles.title, { color: colors.textPrimary }]}>{loc.sync.updating}</Text>;
      case 'paused':
        return <Text style={[styles.title, { color: colors.textPrimary }]}>{loc.sync.paused}</Text>;
      case 'done':
        return <Text style={[styles.title, { color: colors.textPrimary }]}>{loc.sync.done}</Text>;
      case 'error':
        return <Text style={[styles.title, { color: colors.statusError }]}>{loc.sync.error_title}</Text>;
    }
  };

  const renderActionButton = () => {
    switch (effectiveStatus) {
      case 'scanning':
        return (
          <Pressable
            onPress={handlePause}
            style={[
              styles.actionButton,
              styles.actionButtonPauseGap,
              { backgroundColor: colors.brandPrimary, borderColor: colors.buttonBorder },
            ]}
          >
            <PauseIcon color={colors.white} size={13} />
            <Text style={[styles.actionButtonText, { color: colors.white }]}>{loc.sync.btn_pause}</Text>
          </Pressable>
        );
      case 'paused':
        return (
          <Pressable
            onPress={handleResume}
            style={[styles.actionButton, { backgroundColor: colors.brandPrimary, borderColor: colors.continueButtonBorder }]}
          >
            <PlayIcon color={colors.white} size={32} />
            <Text style={[styles.actionButtonText, { color: colors.white }]}>{loc.sync.btn_continue}</Text>
          </Pressable>
        );
      case 'done':
        return (
          <Pressable
            onPress={handleCheckAgain}
            style={[
              styles.actionButton,
              styles.actionButtonOutlined,
              { backgroundColor: colors.accentSubtle, borderColor: colors.brandPrimary },
            ]}
          >
            <Icon name="refresh" type="material" size={20} color={colors.brandPrimary} />
            <Text style={[styles.actionButtonText, { color: colors.brandPrimary }]}>{loc.sync.btn_check_again}</Text>
          </Pressable>
        );
      case 'error':
        return (
          <Pressable
            onPress={handleRetry}
            style={[
              styles.actionButton,
              styles.actionButtonRetryGap,
              { backgroundColor: colors.brandPrimary, borderColor: colors.retryButtonBorder },
            ]}
          >
            <RefreshIcon size={24} color={colors.white} />
            <Text style={[styles.actionButtonText, { color: colors.white }]}>{loc.sync.btn_retry}</Text>
          </Pressable>
        );
    }
  };

  const barColor = effectiveStatus === 'done' ? colors.statusSuccess : colors.brandPrimary;

  return (
    <SafeArea>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} alwaysBounceVertical={false}>
        {renderIcon()}

        {renderTitle()}

        {effectiveStatus !== 'error' && (
          <View style={styles.percentRow}>
            <Text style={[styles.percentNum, { color: colors.syncPercentColor }]}>{Math.round(effectivePct)}</Text>
            <Text style={[styles.percentSign, { color: colors.syncPercentSignColor }]}>%</Text>
          </View>
        )}

        {(effectiveStatus === 'scanning' || effectiveStatus === 'paused') && (
          <View style={styles.etaRow}>
            <ClockFilledIcon size={18} color={colors.syncEtaIconColor} />
            <Text style={[styles.etaText, { color: colors.textMeta }]}>{formatEtaAbout(liveEta) ?? '--'}</Text>
          </View>
        )}

        {effectiveStatus !== 'error' && (
          <View style={[styles.barTrack, { backgroundColor: colors.progressTrack }]}>
            <Animated.View style={[styles.barFill, { width: barWidth, backgroundColor: barColor }]} />
          </View>
        )}

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {effectiveStatus === 'scanning' || effectiveStatus === 'paused'
            ? loc.sync.subtitle_recent
            : effectiveStatus === 'done'
              ? loc.sync.subtitle_watching
              : loc.sync.error_description}
        </Text>

        {(effectiveStatus === 'scanning' || effectiveStatus === 'paused') && (
          <View style={[styles.progressCard, { backgroundColor: colors.progressCardBackground, borderColor: colors.progressCardBorder }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{loc.sync.update_progress}</Text>
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{loc.sync.block_label}</Text>
              {effectiveProgress ? (
                <View style={styles.blockHeightRow}>
                  <Text style={[styles.cardValue, styles.cardValueSemibold, { color: colors.textPrimary }]} numberOfLines={1}>
                    {effectiveProgress.currentBlock.toLocaleString()}
                  </Text>
                  <Text style={[styles.cardValue, { color: colors.textMuted }]}>{' / '}</Text>
                  <Text style={[styles.cardValue, { color: colors.textPrimary }]} numberOfLines={1}>
                    {effectiveProgress.tipHeight.toLocaleString()}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.cardValue, { color: colors.textPrimary }]} numberOfLines={1}>
                  --
                </Text>
              )}
            </View>
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{loc.sync.scan_rate_label}</Text>
              <Text style={[styles.cardValue, styles.cardValueSemibold, { color: colors.textPrimary }]} numberOfLines={1}>
                {scanState.scanRate !== null ? loc.formatString(loc.sync.scan_rate_value, { rate: scanState.scanRate }) : '--'}
              </Text>
            </View>
          </View>
        )}

        {renderActionButton()}

        <View style={[styles.privacyCard, { backgroundColor: colors.progressCardBackground }]}>
          <Icon name="info-outline" type="material" size={20} color={colors.brandPrimary} />
          <Text style={[styles.privacyText, { color: colors.textSecondary }]}>{loc.sync.privacy_info}</Text>
        </View>
      </ScrollView>
    </SafeArea>
  );
};

export default SyncScreen;

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconBadge: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: ClashFont.medium,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  percentNum: {
    fontSize: 44,
    lineHeight: 48,
    fontFamily: ClashFont.medium,
    letterSpacing: -2,
  },
  percentSign: {
    fontSize: 44,
    lineHeight: 48,
    marginLeft: 2,
    fontFamily: ClashFont.medium,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  etaText: {
    fontSize: 15,
    fontFamily: ClashFont.regular,
  },
  barTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: ClashFont.regular,
  },
  progressCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
    fontFamily: ClashFont.medium,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 14,
    fontFamily: ClashFont.regular,
  },
  cardValue: {
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: ClashFont.regular,
  },
  cardValueSemibold: {
    fontFamily: ClashFont.medium,
  },
  blockHeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  actionButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  actionButtonOutlined: {
    borderWidth: 1,
  },
  actionButtonPauseGap: {
    gap: 10,
  },
  actionButtonRetryGap: {
    gap: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: ClashFont.medium,
  },
  privacyCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: ClashFont.regular,
  },
});
