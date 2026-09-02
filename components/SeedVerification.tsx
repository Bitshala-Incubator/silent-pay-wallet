import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Icon } from '@rneui/themed';
import loc from '../loc';
import { useTheme } from './themes';
import { ClashFont } from '../constants/fonts';
import BackupStepHeader from './BackupStepHeader';
import Button from './Button';
import ShowPhraseEyeIcon from './icons/ShowPhraseEyeIcon';

export enum WordStatus {
  DEFAULT = 'default',
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
}

const ORDINAL_WORDS = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
  'Thirteenth',
  'Fourteenth',
  'Fifteenth',
  'Sixteenth',
  'Seventeenth',
  'Eighteenth',
  'Nineteenth',
  'Twentieth',
  'Twenty-first',
  'Twenty-second',
  'Twenty-third',
  'Twenty-fourth',
];

const ordinalWord = (zeroIndexedPosition: number): string => ORDINAL_WORDS[zeroIndexedPosition] ?? `word ${zeroIndexedPosition + 1}`;

interface VerifyWordPillProps {
  word: string;
  status: WordStatus;
  position: number | null;
  onPress: () => void;
}

const VerifyWordPill: React.FC<VerifyWordPillProps> = ({ word, status, position, onPress }) => {
  const { colors } = useTheme();

  if (status === WordStatus.DEFAULT) {
    return (
      <TouchableOpacity
        style={[
          styles.pill,
          styles.pillDefault,
          { backgroundColor: colors.settingsCardBackground, borderColor: colors.settingsCardBorder },
        ]}
        onPress={onPress}
      >
        <Text style={[styles.pillWord, { color: colors.textPrimary }]}>{word}</Text>
      </TouchableOpacity>
    );
  }

  const isCorrect = status === WordStatus.CORRECT;
  const borderColor = isCorrect ? colors.statusSuccess : colors.statusError;
  const badgeColor = isCorrect ? colors.statusSuccess : colors.errorAccent;
  const fillColor = isCorrect ? colors.verifyCorrectFill : colors.verifyIncorrectFill;

  return (
    <View style={[styles.pill, styles.pillSelected, { backgroundColor: fillColor, borderColor }]}>
      <View style={[styles.pillBadge, { backgroundColor: badgeColor }]}>
        <Text style={styles.pillBadgeText}>{position}</Text>
      </View>
      <View style={styles.pillWordWrap}>
        <Text style={[styles.pillWord, { color: colors.textPrimary }]}>{word}</Text>
      </View>
    </View>
  );
};

interface SeedVerificationProps {
  seed: string[];
  onSuccess: () => void;
  onBack: () => void;
}

const SeedVerification: React.FC<SeedVerificationProps> = ({ seed, onSuccess, onBack }) => {
  const { colors } = useTheme();
  const [shuffledWords, setShuffledWords] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [wordStatus, setWordStatus] = useState<{ [key: number]: WordStatus }>({});
  const [selectionOrder, setSelectionOrder] = useState<{ [key: number]: number }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Shuffle the seed words
  useEffect(() => {
    const shuffled = [...seed].sort(() => 0.5 - Math.random());
    setShuffledWords(shuffled);
  }, [seed]);

  // Handle word selection
  const handleWordSelect = (word: string, index: number) => {
    const seedArray = seed;
    const expectedPosition = selectedIndices.length;
    const expectedWord = seedArray[expectedPosition];
    const isCorrect = word === expectedWord;

    // Update the word status (correct or incorrect)
    setWordStatus(prev => ({
      ...prev,
      [index]: isCorrect ? WordStatus.CORRECT : WordStatus.INCORRECT,
    }));

    // Track the selection order for correct words
    if (isCorrect) {
      setSelectionOrder(prev => ({
        ...prev,
        [index]: expectedPosition,
      }));
      setSelectedIndices(prev => [...prev, index]);
    }

    // If incorrect, show error and reset after a delay
    if (!isCorrect) {
      setErrorMessage(loc.formatString(loc.pleasebackup.error, { ordinal: ordinalWord(expectedPosition) }));

      setTimeout(() => {
        setSelectedIndices([]);
        setWordStatus({});
        setSelectionOrder({});
        setErrorMessage(null);
      }, 2500);
      return;
    }

    // check ALL words are selected
    if (expectedPosition + 1 === seed.length) {
      setTimeout(() => {
        onSuccess();
      }, 500);
    }
  };

  const subtitle =
    selectedIndices.length === 0
      ? loc.pleasebackup.subheading
      : selectedIndices.length === seed.length
        ? loc.pleasebackup.verify_complete
        : loc.formatString(loc.pleasebackup.verify_progress, { word: selectedIndices.length + 1 });

  return (
    <View style={styles.root}>
      <BackupStepHeader onBack={onBack} filledSteps={3} totalSteps={3} testID="SeedVerificationBackButton" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{loc.pleasebackup.heading}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

        <View style={styles.wordsGrid}>
          {shuffledWords.map((word, index) => {
            const status = wordStatus[index] || WordStatus.DEFAULT;
            const isDisabled = selectedIndices.includes(index);
            return (
              <VerifyWordPill
                key={index}
                word={word}
                status={status}
                position={selectionOrder[index] !== undefined ? selectionOrder[index] + 1 : null}
                onPress={() => !isDisabled && handleWordSelect(word, index)}
              />
            );
          })}
        </View>

        {errorMessage && (
          <View style={[styles.errorContainer, { backgroundColor: colors.surfaceError, borderColor: colors.statusError }]}>
            <Icon name="info-outline" type="material" size={18} color={colors.statusError} />
            <Text style={[styles.errorText, { color: colors.statusError }]}>{errorMessage}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={loc.pleasebackup.show}
          onPress={onBack}
          testID="ShowPhraseAgain"
          borderRadius={16}
          backgroundColor="transparent"
          buttonTextColor="#444444"
          icon={<ShowPhraseEyeIcon color="#444444" />}
          style={[styles.footerButton, { borderColor: colors.accentSubtle }]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  title: { fontFamily: ClashFont.medium, fontSize: 32, marginBottom: 12 },
  subtitle: { fontFamily: ClashFont.regular, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  pill: {
    width: '48%',
    borderRadius: 16,
    minHeight: 50,
    justifyContent: 'center',
  },
  pillDefault: {
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  pillSelected: {
    flexDirection: 'row',
    borderWidth: 1,
    overflow: 'hidden',
  },
  pillBadge: {
    width: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillBadgeText: { fontFamily: ClashFont.medium, fontSize: 15, color: 'white' },
  pillWordWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 12 },
  pillWord: { fontFamily: ClashFont.medium, fontSize: 15 },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  errorText: {
    flex: 1,
    fontFamily: ClashFont.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  footerButton: { height: 56, maxHeight: 56, borderWidth: 1 },
});

export default SeedVerification;
