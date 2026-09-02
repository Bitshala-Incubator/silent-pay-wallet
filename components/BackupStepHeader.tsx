import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import ChevronRightIcon from './icons/ChevronRightIcon';
import { useTheme } from './themes';

interface BackupStepHeaderProps {
  onBack: () => void;
  filledSteps: number;
  totalSteps: number;
  testID?: string;
}

const BackupStepHeader: React.FC<BackupStepHeaderProps> = ({ onBack, filledSteps, totalSteps, testID }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton} testID={testID}>
        <View style={styles.backIconFlip}>
          <ChevronRightIcon color={colors.textPrimary} size={20} />
        </View>
      </TouchableOpacity>
      <View style={styles.progressBar}>
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <View
            key={idx}
            style={[styles.progressSegment, { backgroundColor: idx < filledSteps ? colors.primary : colors.progressTrack }]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backIconFlip: {
    transform: [{ rotate: '180deg' }],
  },
  progressBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 4,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});

export default BackupStepHeader;
