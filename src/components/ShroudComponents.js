/* eslint react/prop-types: "off", react-native/no-inline-styles: "off" */
import React, { forwardRef } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Icon, Text } from '@rneui/themed';
import { useTheme } from './themes';
import { useLocale } from '@react-navigation/native';

/**
 * TODO: remove this comment once this file gets properly converted to typescript.
 *
 * @type {React.FC<any>}
 */
export const ShroudButtonLink = forwardRef((props, ref) => {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.shroudButtonLink, pressed && styles.pressed]}
      {...props}
      ref={ref}
    >
      <Text style={{ color: colors.foregroundColor, textAlign: 'center', fontSize: 16 }}>{props.title}</Text>
    </Pressable>
  );
});

export const ShroudCard = props => {
  return <View {...props} style={{ padding: 20 }} />;
};

export const ShroudText = ({ bold = false, ...props }) => {
  const { colors } = useTheme();
  const style = StyleSheet.compose(
    {
      color: colors.foregroundColor,
      fontWeight: bold ? 'bold' : 'normal',
    },
    props.style,
  );
  return <Text {...props} style={style} />;
};

export const ShroudTextCentered = props => {
  const { colors } = useTheme();
  return <Text {...props} style={{ color: colors.foregroundColor, textAlign: 'center' }} />;
};

export const ShroudFormLabel = props => {
  const { colors } = useTheme();

  return (
    <Text
      {...props}
      style={{
        color: colors.foregroundColor,
        fontWeight: '400',
        marginHorizontal: 20,
      }}
    />
  );
};

export const ShroudFormMultiInput = props => {
  const { colors } = useTheme();

  return (
    <TextInput
      multiline
      underlineColorAndroid="transparent"
      numberOfLines={4}
      editable={!props.editable}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 16,
        flex: 1,
        marginTop: 5,
        marginHorizontal: 20,
        borderColor: colors.formBorder,
        borderBottomColor: colors.formBorder,
        borderWidth: 1,
        borderBottomWidth: 0.5,
        borderRadius: 4,
        backgroundColor: colors.inputBackgroundColor,
        color: colors.foregroundColor,
        textAlignVertical: 'top',
      }}
      autoCorrect={false}
      autoCapitalize="none"
      spellCheck={false}
      {...props}
      selectTextOnFocus={false}
      keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
    />
  );
};

const styles = StyleSheet.create({
  shroudButtonLink: {
    minWidth: 100,
    minHeight: 36,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
