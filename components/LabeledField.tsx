import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ShroudText } from '../ShroudComponents';
import { ClashFont } from '../constants/fonts';
import { useTheme } from './themes';

interface LabeledFieldProps {
  label: string;
  children: React.ReactNode; // the input element, normally a FieldTextInput
  trailing?: React.ReactNode; // e.g. a scan button
  testID?: string;
  /** Tinted variant for the Address field: light purple background + border. */
  tinted?: boolean;
}

const LabeledField: React.FC<LabeledFieldProps> = ({ label, children, trailing, testID, tinted }) => {
  const { colors } = useTheme();

  const stylesHook = StyleSheet.create({
    label: { color: colors.textSecondary },
    field: tinted
      ? { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.accentSubtle }
      : { backgroundColor: colors.fieldBackground },
  });

  return (
    <View style={styles.container} testID={testID}>
      <ShroudText style={[styles.label, stylesHook.label]}>{label}</ShroudText>
      <View style={[styles.field, stylesHook.field]}>
        <View style={styles.inputWrap}>{children}</View>
        {trailing}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 8,
  },
  label: {
    fontFamily: ClashFont.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    width: '100%',
    // stacks anything rendered above the input (e.g. the send screen's contact chip)
    gap: 10,
  },
});

export default LabeledField;
