import React, { forwardRef } from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  Pressable,
  PressableProps,
  View,
  ViewStyle,
  Platform,
} from 'react-native';
import { Icon } from '@rneui/themed';

import { ClashFont } from '../constants/fonts';
import { useTheme } from './themes';

interface ButtonProps extends PressableProps {
  backgroundColor?: string;
  buttonTextColor?: string;
  disabled?: boolean;
  testID?: string;
  icon?:
    | {
        name: string;
        type: string;
        color: string;
      }
    | React.ReactElement;
  title?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  borderRadius?: number;
  onPress?: () => void;
  showActivityIndicator?: boolean;
  disabledBackgroundColor?: string;
  disabledTextColor?: string;
}

export const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>((props, ref) => {
  const { colors } = useTheme();

  let backgroundColor = props.backgroundColor ?? colors.primary;
  let fontColor = props.buttonTextColor ?? colors.white;
  if (props.disabled) {
    backgroundColor = props.disabledBackgroundColor ?? colors.buttonDisabledBackgroundColor;
    fontColor = props.disabledTextColor ?? colors.alternativeTextColor;
  }

  const borderRadius = props.borderRadius ?? styles.button.borderRadius;

  const buttonStyle = {
    ...styles.button,
    backgroundColor,
    borderColor: props.disabled ? colors.buttonDisabledBackgroundColor : 'transparent',
    borderRadius,
  };

  const textStyle = [styles.text, { color: fontColor }, props.textStyle];
  const icon = props.icon;

  const buttonView = props.showActivityIndicator ? (
    <ActivityIndicator size="small" color={fontColor} />
  ) : (
    <>
      {icon && ('name' in icon ? <Icon name={icon.name} type={icon.type} color={icon.color} /> : icon)}
      {props.title && <Text style={textStyle}>{props.title}</Text>}
    </>
  );

  return props.onPress ? (
    <View style={[styles.pressableWrapper, { borderRadius }]}>
      <Pressable
        {...props}
        ref={ref}
        testID={props.testID}
        android_ripple={{ color: colors.androidRippleColor }}
        style={({ pressed }) => [Platform.OS === 'ios' && pressed ? styles.pressed : null, buttonStyle, props.style, styles.content]}
        accessibilityRole="button"
        onPress={props.onPress}
        disabled={props.disabled}
      >
        {buttonView}
      </Pressable>
    </View>
  ) : (
    <View style={[buttonStyle, props.style, styles.content]}>{buttonView}</View>
  );
});

const styles = StyleSheet.create({
  button: {
    borderWidth: 0.7,
    minHeight: 45,
    height: 48,
    maxHeight: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginHorizontal: 8,
    fontFamily: ClashFont.medium,
    fontSize: 16,
  },
  pressableWrapper: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default Button;
