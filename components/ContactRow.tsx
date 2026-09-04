import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { ContactListItem } from '../class/contacts';
import { shortenAddress } from '../utils/transactionHelpers';
import ContactAvatar from './ContactAvatar';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PaperPlaneIcon from './icons/PaperPlaneIcon';
import { useTheme } from './themes';
import { ClashFont } from '../constants/fonts';
import loc from '../loc';

type ContactRowProps = {
  contact: ContactListItem;
  // Handlers take the address rather than close over it, so a list can hold one stable callback
  // per action and let the React.memo below actually skip untouched rows.
  onPress: (address: string) => void;
  testID: string;
  /** Spacing is the list's to set: neither variant carries a margin of its own. */
  style?: StyleProp<ViewStyle>;
} & (
  | // Bare row that opens the contact, for a screen whose whole job is the list.
  { variant?: 'row' }
  // Bordered card carrying its own pay action, for a list sharing a screen with other content.
  | { variant: 'card'; onPay: (address: string) => void }
);

const ContactRow: React.FC<ContactRowProps> = props => {
  const { contact, onPress, testID, style } = props;
  const { colors } = useTheme();
  const isCard = props.variant === 'card';

  const identity = (
    <>
      <ContactAvatar name={contact.name} colorIndex={contact.colorIndex} size={48} borderRadius={16} />
      <View style={[styles.text, isCard ? styles.cardText : styles.rowText]}>
        <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>
          {contact.name}
        </Text>
        <Text style={[styles.rowAddress, { color: colors.textSecondary }]} numberOfLines={1}>
          {shortenAddress(contact.address, 8)}
        </Text>
      </View>
    </>
  );

  if (props.variant !== 'card') {
    return (
      <Pressable accessibilityRole="button" style={[styles.row, style]} onPress={() => onPress(contact.address)} testID={testID}>
        {identity}
        <ChevronRightIcon color={colors.chevron} />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.transactionCardBorder }, style]}
      onPress={() => onPress(contact.address)}
      testID={testID}
    >
      {identity}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${loc.contacts.pay} ${contact.name}`}
        style={[styles.pay, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderDefault }]}
        onPress={() => props.onPay(contact.address)}
        testID={`${testID}-Pay`}
      >
        <PaperPlaneIcon size={16} color={colors.textBrand} />
        <Text style={[styles.payText, { color: colors.textBrand }]}>{loc.contacts.pay}</Text>
      </Pressable>
    </Pressable>
  );
};

// Sits in the same lists as TransactionListItem, which is memoised for the same reason: the
// screens above it re-render on every keystroke and balance poll.
export default React.memo(ContactRow);

const styles = StyleSheet.create({
  // Vertical rhythm comes from the list's gap, not from padding of its own.
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 77,
    borderRadius: 16,
    borderWidth: 0.5,
    paddingHorizontal: 12,
  },
  text: { flex: 1 },
  rowText: { gap: 12 },
  cardText: { gap: 4 },
  rowName: { fontFamily: ClashFont.medium, fontSize: 16, lineHeight: 20 },
  rowAddress: { fontFamily: ClashFont.regular, fontSize: 14, lineHeight: 17 },
  pay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  payText: { fontFamily: ClashFont.medium, fontSize: 16, lineHeight: 24 },
});
