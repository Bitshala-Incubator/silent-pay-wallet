import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import loc from '../loc';
import SeedWords, { WordStatus } from './SeedWords';

interface SeedVerificationProps {
  seed: string[];
  onSuccess: () => void;
  onBack: () => void;
}

const SeedVerification: React.FC<SeedVerificationProps> = ({ seed, onSuccess, onBack }) => {
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
    const expectedWord = seedArray[selectedIndices.length];
    const isCorrect = word === expectedWord;
    const currentSelectionIndex = selectedIndices.length;

    // Update the word status (correct or incorrect)
    setWordStatus(prev => ({
      ...prev,
      [index]: isCorrect ? WordStatus.CORRECT : WordStatus.INCORRECT,
    }));

    // Track the selection order for correct words
    if (isCorrect) {
      setSelectionOrder(prev => ({
        ...prev,
        [index]: currentSelectionIndex,
      }));
      setSelectedIndices(prev => [...prev, index]);
    }

    // If incorrect, show error and reset after a delay
    if (!isCorrect) {
      // Display error message
      setErrorMessage(loc.pleasebackup.error);

      setTimeout(() => {
        setSelectedIndices([]);
        setWordStatus({});
        setSelectionOrder({});
        setErrorMessage(null);
      }, 2500);
      return;
    }

    // check ALL words are selected
    if (selectedIndices.length + 1 === seed.length) {
      setTimeout(() => {
        onSuccess();
      }, 500);
    }
  };

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={[styles.flex]}>
        <View>
          <View>
            <Text style={styles.title}>{loc.pleasebackup.heading}</Text>
            <Text style={styles.subtitle}>{loc.pleasebackup.subheading}</Text>
          </View>

          <View style={styles.wordsGrid}>
            {shuffledWords.map((word, index) => {
              const status = wordStatus[index] || WordStatus.DEFAULT;
              const isDisabled = selectedIndices.includes(index);
              return (
                <SeedWords
                  key={index}
                  word={word}
                  index={index}
                  status={status}
                  onPress={() => !isDisabled && handleWordSelect(word, index)}
                  disabled={isDisabled}
                  selectionOrder={selectionOrder[index] !== undefined ? selectionOrder[index] : null}
                  isVerification={true}
                />
              );
            })}
          </View>
        </View>

        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={onBack}>
            <Text style={styles.buttonText}>{loc.pleasebackup.show}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  root: {
    padding: 10,
  },
  flex: {
    flex: 1,
    justifyContent: 'space-between',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EB5757',
  },
  errorText: {
    color: '#EB5757',
    fontSize: 14,
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#222',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    paddingBottom: 10,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  footer: {
    justifyContent: 'center',
    padding: 10,
  },
  button: {
    backgroundColor: '#754CE8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default SeedVerification;
