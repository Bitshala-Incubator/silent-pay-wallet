import React from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { ShroudFormLabel } from '../components/ShroudComponents';
import { useTheme } from './themes';
import loc from '../loc';

interface WalletBirthSectionProps {
  birthDate: string;
  setBirthDate: (value: string) => void;
}

export const WalletBirthSection: React.FC<WalletBirthSectionProps> = ({ birthDate, setBirthDate }) => {
  const { colors } = useTheme();

  const stylesHook = StyleSheet.create({
    input: {
      borderColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
      color: colors.foregroundColor,
    },
  });

  return (
    <View style={styles.container}>
      <ShroudFormLabel>{loc.wallet_birth.birth_date_label}</ShroudFormLabel>
      <TextInput
        style={[styles.input, stylesHook.input]}
        value={birthDate}
        onChangeText={setBirthDate}
        placeholder={loc.wallet_birth.birth_date_placeholder}
        placeholderTextColor={colors.alternativeTextColor}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        returnKeyType="done"
        testID="BirthDateInput"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 14, default: 10 }),
    marginHorizontal: 0,
    marginTop: 6,
    minHeight: 44,
  },
});
