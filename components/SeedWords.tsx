import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from './themes';

interface SeedWordsProps {
  word: string;
  index: number;
}

const SeedWords: React.FC<SeedWordsProps> = ({ word, index }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.seedItemContainer}>
      <View style={[styles.indexContainer, { backgroundColor: colors.settingsCardBackground, borderColor: colors.settingsCardBorder }]}>
        <Text style={[styles.seedIndex, { color: colors.textPrimary }]}>{index + 1}</Text>
      </View>
      <View style={[styles.wordContainer, { backgroundColor: colors.settingsCardBackground, borderColor: colors.settingsCardBorder }]}>
        <Text style={[styles.seedWord, { color: colors.textPrimary }]}>{word}</Text>
      </View>
    </View>
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
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  wordContainer: {
    flex: 1,
    height: 42,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
  },
  seedIndex: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  seedWord: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SeedWords;
