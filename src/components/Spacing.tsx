import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

interface SpacingProps extends ViewProps {
  horizontal?: boolean; // Optional prop to determine if spacing is horizontal
}

export const Spacing10: React.FC<SpacingProps> = props => {
  const { style, ...otherProps } = props;
  return <View {...otherProps} style={[styles.spacing10, style]} />;
};

export const Spacing20: React.FC<SpacingProps> = props => {
  const { horizontal = false, style, ...otherProps } = props;
  return <View {...otherProps} style={[horizontal ? styles.spacing20Horizontal : styles.spacing20Vertical, style]} />;
};

export const Spacing40: React.FC<SpacingProps> = props => {
  const { style, ...otherProps } = props;
  return <View {...otherProps} style={[styles.spacing40, style]} />;
};

export const Spacing: React.FC<SpacingProps> = props => {
  const { style, ...otherProps } = props;
  return <View {...otherProps} style={[styles.spacing60, style]} />;
};

const styles = StyleSheet.create({
  spacing10: {
    height: 10,
  },
  spacing20Vertical: {
    height: 20,
    width: 0,
    opacity: 0,
  },
  spacing20Horizontal: {
    height: 0,
    width: 20,
    opacity: 0,
  },
  spacing40: {
    height: 40,
  },
  spacing60: {
    height: 60,
  },
});
