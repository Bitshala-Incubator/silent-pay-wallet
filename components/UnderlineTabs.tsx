import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from './themes';
import { ClashFont } from '../constants/fonts';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../modules/hapticFeedback';

interface UnderlineTabsProps {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  testIDPrefix: string;
}

// Tab strip that sits on a hairline rule, the selected tab painting a thicker brand-colored
// segment over it. Sizes itself to its labels so a trailing action can share the row.
const UnderlineTabs: React.FC<UnderlineTabsProps> = ({ values, selectedIndex, onChange, testIDPrefix }) => {
  const { colors } = useTheme();

  const handlePress = (index: number) => {
    if (index === selectedIndex) return;
    triggerHapticFeedback(HapticFeedbackTypes.Selection);
    onChange(index);
  };

  return (
    <View style={[styles.strip, { borderBottomColor: colors.tabDivider }]}>
      {values.map((value, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => handlePress(index)}
            testID={`${testIDPrefix}-${index}`}
            style={[styles.tab, selected && { borderBottomColor: colors.brandPrimary }]}
          >
            <Text style={[styles.label, { color: selected ? colors.textPrimary : colors.tabInactiveText }]}>{value}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default UnderlineTabs;

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, borderBottomWidth: 1 },
  tab: {
    paddingTop: 1,
    paddingHorizontal: 4,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1, // overlap the strip's rule so the selected underline replaces it
  },
  label: { fontFamily: ClashFont.medium, fontSize: 14, lineHeight: 20 },
});
