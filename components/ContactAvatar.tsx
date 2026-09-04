import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { ClashFont } from '../constants/fonts';

// Fixed tints; deliberately independent of the light/dark theme so a contact keeps one
// recognisable colour. One entry per colour index class/contacts hands out — see
// CONTACT_COLOR_COUNT there.
export const CONTACT_AVATAR_PALETTE: ReadonlyArray<{ background: string; text: string }> = [
  { background: '#EAE4FB', text: '#754CE8' },
  { background: '#E7F0FA', text: '#3B80F9' },
  { background: '#F9EFE6', text: '#C35E19' },
  { background: '#EBF5ED', text: '#65C366' },
  { background: '#F7E9EF', text: '#AA3F7E' },
];

export const contactInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('');

interface ContactAvatarProps {
  name: string;
  colorIndex: number;
  size?: number;
  borderRadius?: number;
  /** Shape overrides for hosts that are not a square tile, e.g. ContactChip's 32x22 pill. */
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const ContactAvatar: React.FC<ContactAvatarProps> = ({ name, colorIndex, size = 40, borderRadius, style, textStyle }) => {
  // A colorIndex out of range only reaches here from a hand-edited bucket; fall back rather than
  // destructure undefined.
  const { background, text } = CONTACT_AVATAR_PALETTE[colorIndex] ?? CONTACT_AVATAR_PALETTE[0];

  return (
    <View style={[styles.root, { width: size, height: size, borderRadius: borderRadius ?? size / 4, backgroundColor: background }, style]}>
      <Text style={[styles.initials, { fontSize: size / 3, color: text }, textStyle]}>{contactInitials(name)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: ClashFont.semibold,
  },
});

export default ContactAvatar;
