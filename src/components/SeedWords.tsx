import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export enum WordStatus {
  DEFAULT = 'default',
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
}

interface SeedWordsProps {
  word: string;
  index: number;
  status?: WordStatus;
  onPress?: () => void;
  disabled?: boolean;
  selectionOrder?: number | null;
  isVerification?: boolean;
}

const SeedWords: React.FC<SeedWordsProps> = ({
  word,
  index,
  status = 'default',
  onPress,
  disabled = false,
  selectionOrder = null,
  isVerification = false,
}) => {
  const getIndexBackgroundColor = () => {
    switch (status) {
      case WordStatus.CORRECT:
        return '#34C571'; // Green
      case WordStatus.INCORRECT:
        return '#EB5757'; // Red
      default:
        return '#EDEDED'; // Default gray
    }
  };

  const getIndexTextColor = () => {
    return status !== WordStatus.DEFAULT ? 'white' : '#000';
  };

  const indexContainerStyle = {
    ...styles.indexContainer,
    backgroundColor: getIndexBackgroundColor(),
  };

  const indexTextStyle = {
    ...styles.seedIndex,
    color: getIndexTextColor(),
  };

  return (
    <TouchableOpacity style={styles.seedItemContainer} onPress={disabled ? undefined : onPress} disabled={disabled} activeOpacity={0.7}>
      <View style={indexContainerStyle}>
        {/* Show either the selection order (if provided and in verification mode) 
            or the original index (if not in verification mode) */}
        {(!isVerification || (isVerification && selectionOrder !== null)) && (
          <Text style={indexTextStyle}>{isVerification && selectionOrder !== null ? selectionOrder + 1 : index + 1}</Text>
        )}
      </View>
      <View style={styles.wordContainer}>
        <Text style={styles.seedWord}>{word}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  seedItemContainer: {
    width: '45%',
    flexDirection: 'row',
    marginVertical: 8,
    marginHorizontal: 6,
  },
  indexContainer: {
    width: 36,
    height: 42,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    backgroundColor: '#f1f1f1',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  wordContainer: {
    flex: 1,
    height: 42,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: '#f1f1f1',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
  },
  seedIndex: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#000',
  },
  seedWord: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#000',
  },
});

export default SeedWords;
