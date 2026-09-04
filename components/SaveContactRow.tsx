import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';

import { isValidContactAddress, MAX_CONTACT_NAME_LENGTH } from '../class/contacts';
import { ClashFont } from '../constants/fonts';
import { useContacts } from '../hooks/context/useContacts';
import loc from '../loc';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../modules/hapticFeedback';
import ActionButton from './ActionButton';
import presentAlert from './Alert';
import FieldTextInput from './FieldTextInput';
import CheckmarkIcon from './icons/CheckmarkIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import SaveIcon from './icons/SaveIcon';
import { useTheme } from './themes';

interface SaveContactRowProps {
  address?: string;
  /** 'row' is the dashed full-width row; 'pill' the tinted button. Matches ContactRow's naming. */
  variant?: 'row' | 'pill';
}

// The three things this row can be, named. `null` used to mean both "not editing" and "just
// committed", which is how blur ended up committing and cancelling at the same time.
type State = { k: 'offer' } | { k: 'editing'; name: string } | { k: 'saved' };

const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

/**
 * Offers to save a payee the user has just addressed or paid. Renders nothing once the address is
 * a known contact — naming that contact is the calling screen's job, so both screens read on their
 * own instead of handing their chip in here.
 */
const SaveContactRow: React.FC<SaveContactRowProps> = ({ address, variant = 'row' }) => {
  const { colors } = useTheme();
  const { getContact, saveContact, validate } = useContacts();
  const [state, setState] = useState<State>({ k: 'offer' });

  // A full bech32m decode, and the address changes on every keystroke of the field above.
  const isPayable = useMemo(() => address !== undefined && isValidContactAddress(address), [address]);

  useEffect(() => {
    setState({ k: 'offer' });
  }, [address]);

  useEffect(() => {
    if (state.k !== 'saved') return;
    const timer = setTimeout(() => {
      animate();
      setState({ k: 'offer' });
    }, 2000);
    return () => clearTimeout(timer);
  }, [state.k]);

  const onSave = useCallback(async () => {
    if (state.k !== 'editing' || address === undefined) return;

    const errors = validate({ name: state.name, address });
    if (errors.length > 0) {
      presentAlert({ title: loc.errors.error, message: loc.contacts.invalid_contact });
      return;
    }

    try {
      await saveContact({ name: state.name, address });
      animate();
      setState({ k: 'saved' });
      triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
    } catch (error: any) {
      presentAlert({ title: loc.errors.error, message: error?.message ?? String(error) });
    }
  }, [address, state, saveContact, validate]);

  const onOpen = useCallback(() => {
    animate();
    setState({ k: 'editing', name: '' });
  }, []);

  // Blur is a dismissal, not a commit: tapping the address field above to fix a typo must not
  // save a contact for the payee the user is in the middle of correcting.
  const onCancel = useCallback(() => {
    animate();
    setState({ k: 'offer' });
  }, []);

  if (state.k === 'saved') {
    return (
      <View
        style={[styles.row, styles.rowSolid, { backgroundColor: colors.contactSavedSurface, borderColor: colors.contactSavedAccent }]}
        testID="SaveContactReceipt"
      >
        <View style={[styles.savedCheck, { borderColor: colors.contactSavedAccent }]}>
          <CheckmarkIcon size={12} color={colors.contactSavedAccent} />
        </View>
        <Text style={[styles.text, { color: colors.contactSavedAccent }]}>{loc.contacts.saved_to_contacts}</Text>
      </View>
    );
  }

  if (address === undefined || !isPayable || getContact(address) !== undefined) return null;

  if (state.k === 'offer') {
    return variant === 'pill' ? (
      <ActionButton
        title={loc.contacts.save_as_contact}
        onPress={onOpen}
        Icon={SaveIcon}
        iconSize={20}
        backgroundColor={colors.surfaceSubtle}
        color={colors.brandPrimary}
        style={styles.pill}
        testID="SaveContactButton"
      />
    ) : (
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={[styles.row, { backgroundColor: colors.cardBackground, borderColor: colors.dashedBorder }]}
        testID="SaveContactButton"
      >
        <SaveIcon size={20} color={colors.brandPrimary} />
        <Text style={[styles.text, { color: colors.brandPrimary }]}>{loc.contacts.save_as_contact}</Text>
        <ChevronRightIcon color={colors.chevron} />
      </Pressable>
    );
  }

  const canSave = state.name.trim().length > 0;

  return (
    <View style={[styles.row, styles.rowSolid, styles.card, { backgroundColor: colors.surfaceSubtle, borderColor: colors.accentSubtle }]}>
      <View style={styles.cardLabel}>
        <SaveIcon size={20} color={colors.brandPrimary} />
        <Text style={[styles.labelText, { color: colors.brandPrimary }]}>{loc.contacts.save_as_contact}</Text>
      </View>
      <View style={styles.cardRow}>
        <FieldTextInput
          autoFocus
          style={styles.nameInput}
          accessibilityLabel={loc.contacts.label_name}
          placeholder={loc.contacts.name_placeholder}
          value={state.name}
          onChangeText={name => setState({ k: 'editing', name })}
          maxLength={MAX_CONTACT_NAME_LENGTH}
          onBlur={onCancel}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          // Return submits without blurring, so it can't race the blur that cancels.
          blurOnSubmit={false}
          onSubmitEditing={onSave}
          testID="SaveContactNameInput"
        />
        <Pressable
          accessibilityRole="button"
          disabled={!canSave}
          // onPressIn: the input's blur cancels, and on Android it lands before onPress would.
          onPressIn={onSave}
          style={[styles.saveButton, { backgroundColor: canSave ? colors.brandPrimary : colors.accentSubtle }]}
          testID="SaveContactConfirmButton"
        >
          <Text style={[styles.saveLabel, { color: canSave ? colors.white : colors.textSecondary }]}>{loc.contacts.save_short}</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default SaveContactRow;

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 15,
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  pill: {
    alignSelf: 'stretch',
  },
  rowSolid: {
    borderStyle: 'solid',
  },
  card: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 2,
    paddingVertical: 10,
  },
  cardLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10, // matches the collapsed row, so the label does not shift sideways as it shrinks
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    flex: 1,
    fontFamily: ClashFont.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  labelText: {
    fontFamily: ClashFont.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  nameInput: {
    flex: 1,
    fontFamily: ClashFont.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  saveButton: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    fontFamily: ClashFont.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  savedCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
