import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import ChevronRightIcon from './icons/ChevronRightIcon';
import loc from '../loc';

interface HeaderBackButtonProps {
  onPress: () => void;
  color: string;
  /** Override where the chevron dismisses rather than navigates back, e.g. a bottom sheet. */
  accessibilityLabel?: string;
  testID?: string;
}

const HeaderBackButton: React.FC<HeaderBackButtonProps> = ({
  onPress,
  color,
  accessibilityLabel = loc._.back,
  testID = 'NavigationBackButton',
}) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    style={styles.button}
    onPress={onPress}
    testID={testID}
  >
    <View style={styles.flip}>
      <ChevronRightIcon color={color} size={20} />
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    minWidth: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flip: {
    transform: [{ rotate: '180deg' }],
  },
});

export default HeaderBackButton;
