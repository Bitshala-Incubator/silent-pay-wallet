import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@rneui/themed';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PauseIcon from './icons/PauseIcon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import loc from '../loc';
import type { ScanStateInfo } from '../helpers/silent-payments';
import { DetailViewStackParamList } from '../navigation/DetailViewStackParamList';
import { useTheme } from './themes';
import { ClashFont } from '../constants/fonts';

interface Props {
  scanState: ScanStateInfo;
  onResume?: () => void;
}

type NavigationProps = NativeStackNavigationProp<DetailViewStackParamList>;

const ScanProgressBar: React.FC<Props> = ({ scanState, onResume }) => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProps>();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const { status, progress, lastScannedBlock } = scanState;

  useEffect(() => {
    if (status === 'scanning') {
      pulseAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.35, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ]),
      );
      pulseAnimRef.current.start();
    } else {
      pulseAnimRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseAnimRef.current?.stop();
  }, [status, pulseAnim]);

  const isDone = status === 'idle' && lastScannedBlock > 0;
  if (status === 'idle' && !isDone) return null;

  if (isDone) {
    const blockText = loc.formatString(loc.sync.banner_synced, { blockHeight: lastScannedBlock.toLocaleString() });
    return (
      <TouchableOpacity
        style={[styles.container, { borderColor: colors.accentSubtle, backgroundColor: colors.surfaceSubtle }]}
        onPress={() => navigation.navigate('SyncScreen')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={blockText as string}
      >
        <View style={styles.leftRow}>
          <View style={styles.iconWrap}>
            <Icon name="check-circle" type="material" size={20} color={colors.statusSuccess} />
          </View>
          <Text style={[styles.bannerText, { color: colors.textPrimary }]} numberOfLines={1}>
            {blockText}
          </Text>
        </View>
        <ChevronRightIcon color={colors.chevron} />
      </TouchableOpacity>
    );
  }

  if (status === 'paused') {
    const pausedBlock = progress?.currentBlock ?? lastScannedBlock;
    const blockText = loc.formatString(loc.sync.banner_paused_at, { blockHeight: pausedBlock.toLocaleString() });
    return (
      <View style={[styles.container, { borderColor: colors.accentSubtle, backgroundColor: colors.surfaceSubtle }]}>
        <TouchableOpacity
          style={styles.leftRow}
          onPress={() => navigation.navigate('SyncScreen')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={blockText as string}
        >
          <View style={styles.iconWrap}>
            <PauseIcon size={20} color={colors.pausedIconColor} />
          </View>
          <Text style={[styles.bannerText, { color: colors.textPrimary }]} numberOfLines={1}>
            {blockText}
          </Text>
        </TouchableOpacity>
        <Pressable onPress={onResume} hitSlop={8} accessibilityRole="button" accessibilityLabel={loc.sync.banner_resume}>
          <Text style={[styles.resumeText, { color: colors.brandPrimary }]}>{loc.sync.banner_resume}</Text>
        </Pressable>
      </View>
    );
  }

  const dotColor = status === 'error' ? colors.statusError : colors.brandPrimary;
  const bannerText = status === 'error' ? loc.sync.banner_error : loc.sync.banner_scanning;

  return (
    <TouchableOpacity
      style={[styles.container, { borderColor: colors.accentSubtle, backgroundColor: colors.surfaceSubtle }]}
      onPress={() => navigation.navigate('SyncScreen')}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={bannerText}
    >
      <View style={styles.leftRow}>
        <View style={styles.iconWrap}>
          <View style={[styles.halo, { backgroundColor: dotColor }]} />
          <Animated.View style={[styles.dot, { backgroundColor: dotColor, opacity: pulseAnim }]} />
        </View>
        <Text style={[styles.bannerText, { color: colors.textPrimary }]} numberOfLines={1}>
          {bannerText}
        </Text>
      </View>
      <Icon name="chevron-right" type="material" size={20} color={colors.chevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
    height: 50,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    opacity: 0.2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bannerText: {
    fontSize: 14,
    fontFamily: ClashFont.regular,
    flex: 1,
  },
  resumeText: {
    fontSize: 14,
    fontFamily: ClashFont.medium,
  },
});

export default ScanProgressBar;
