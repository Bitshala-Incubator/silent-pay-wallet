import React, { useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, StackActions, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContactError, MAX_CONTACT_NAME_LENGTH, normalizeAddress, randomContactColorIndex } from '../../class/contacts';
import ActionButton from '../../components/ActionButton';
import presentAlert from '../../components/Alert';
import ContactAvatar from '../../components/ContactAvatar';
import FieldTextInput, { FieldAddressInput } from '../../components/FieldTextInput';
import LabeledField from '../../components/LabeledField';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';
import { useTheme } from '../../components/themes';
import CheckmarkIcon from '../../components/icons/CheckmarkIcon';
import CloseIcon from '../../components/icons/CloseIcon';
import SaveIcon from '../../components/icons/SaveIcon';
import ContactIcon from '../../components/icons/ContactIcon';
import { ClashFont } from '../../constants/fonts';
import { useContacts } from '../../hooks/context/useContacts';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import loc from '../../loc';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';

type RouteProps = RouteProp<DetailViewStackParamList, 'ContactEdit'>;

const errorMessage = (errors: ContactError[]): { text: string; ok: boolean } | null => {
  const nameError = errors.find(e => e.field === 'name');
  if (nameError?.code === 'too_long') return { text: loc.contacts.name_too_long, ok: false };

  const error = errors.find(e => e.field === 'address');
  if (error === undefined) return { text: loc.contacts.address_valid, ok: true };
  if (error.code === 'invalid') return { text: loc.contacts.address_invalid, ok: false };
  if (error.code === 'duplicate') {
    return { text: loc.formatString(loc.contacts.address_duplicate, { name: error.conflictName }), ok: false };
  }
  return null; // 'empty' renders nothing — an untouched field should not be scolded
};

const ContactEdit: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useExtendedNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<RouteProps>();
  const { getContact, saveContact, validate } = useContacts();

  const editingAddress = params.mode === 'edit' ? params.address : undefined;
  const existing = editingAddress === undefined ? undefined : getContact(editingAddress);

  const [name, setName] = useState(existing?.name ?? '');
  const [address, setAddress] = useState(params.address ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [colorIndex] = useState(() => existing?.colorIndex ?? randomContactColorIndex());

  useLayoutEffect(() => {
    navigation.setOptions({ title: params.mode === 'edit' ? loc.contacts.edit_header : loc.contacts.add_header });
  }, [navigation, params.mode]);

  const errors = useMemo(() => validate({ name, address, editingAddress }), [validate, name, address, editingAddress]);
  const message = errorMessage(errors);
  const canSave = errors.length === 0 && !isSaving;

  // Where a save lands depends on how the screen was reached. Kept out of onSave so the save
  // itself reads as save-then-navigate rather than three returns inside a try block.
  const navigateAfterSave = () => {
    const normalized = normalizeAddress(address);
    if (editingAddress !== undefined && normalized !== normalizeAddress(editingAddress)) {
      // The old key is gone, so the ContactDetail below this form is holding a stale route param.
      // popTo rewrites it in place and drops this form; navigate() only reuses a route when it is
      // the focused one, so it would push a second detail screen on top of the form instead.
      navigation.dispatch(StackActions.popTo('ContactDetail', { address: normalized }));
      return;
    }

    navigation.goBack();
  };

  const onSave = async () => {
    setIsSaving(true);
    try {
      await saveContact({ name, address, editingAddress, colorIndex });
      navigateAfterSave();
    } catch (error: any) {
      presentAlert({ message: error?.message ?? String(error) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Until there is a name to draw initials from, the tile stands in as a generic contact. */}
      <View style={styles.avatar}>
        {name.trim().length === 0 ? (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.fieldBackground }]} testID="ContactAvatarPlaceholder">
            <ContactIcon size={32} color={colors.brandPrimary} />
          </View>
        ) : (
          <ContactAvatar name={name} colorIndex={colorIndex} size={72} borderRadius={24} />
        )}
      </View>

      <View style={styles.form}>
        <LabeledField label={loc.contacts.label_name}>
          <FieldTextInput
            placeholder={loc.contacts.name_placeholder}
            value={name}
            onChangeText={setName}
            maxLength={MAX_CONTACT_NAME_LENGTH}
            testID="ContactNameInput"
          />
        </LabeledField>

        {/* The verdict tracks the field more closely than the field tracks its label. */}
        <View style={styles.addressBlock}>
          {/* Tinting on entry is how the send screen's address field behaves too. */}
          <LabeledField label={loc.contacts.label_address} tinted={address.length > 0}>
            <FieldAddressInput
              placeholder={loc.contacts.address_placeholder}
              value={address}
              onChangeText={setAddress}
              testID="ContactAddressInput"
            />
          </LabeledField>
          {message !== null && (
            <View style={styles.message} testID="ContactAddressMessage">
              {message.ok ? (
                <CheckmarkIcon size={20} color={colors.statusSuccess} variant="filled" />
              ) : (
                <CloseIcon size={15} color={colors.statusError} />
              )}
              <Text style={[styles.messageText, { color: message.ok ? colors.statusSuccess : colors.statusError }]}>{message.text}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Holds the save button against the bottom of the screen on a short form. */}
      <View style={styles.spacer} />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 32) }]}>
        <ActionButton
          title={loc.contacts.save}
          Icon={SaveIcon}
          onPress={onSave}
          disabled={!canSave}
          backgroundColor={canSave ? colors.brandPrimary : colors.accentSubtle}
          color={canSave ? colors.white : colors.textSecondary}
          testID="ContactSaveButton"
        />
      </View>
    </SafeAreaScrollView>
  );
};

export default ContactEdit;

const styles = StyleSheet.create({
  // paddingBottom is the footer's to own, so it is zeroed out of the scroll inset here.
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 0 },
  avatar: { alignItems: 'center' },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  form: { marginTop: 24, gap: 12 },
  addressBlock: { gap: 4 },
  message: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  messageText: { fontFamily: ClashFont.regular, fontSize: 14, lineHeight: 20 },
  spacer: { flex: 1 },
  footer: { paddingTop: 32 },
});
