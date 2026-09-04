import React from 'react';
import { StyleSheet } from 'react-native';

import ActionButton from './ActionButton';
import EmptyStateCard from './EmptyStateCard';
import AddIcon from './icons/AddIcon';
import ContactsGroupIcon from './icons/ContactsGroupIcon';
import { useTheme } from './themes';
import loc from '../loc';

interface ContactsEmptyStateProps {
  onAdd: () => void;
  bordered?: boolean;
}

// Shown in place of the contact list until the first contact is saved.
const ContactsEmptyState: React.FC<ContactsEmptyStateProps> = ({ onAdd, bordered = true }) => {
  const { colors } = useTheme();

  return (
    <EmptyStateCard
      icon={
        <ContactsGroupIcon
          size={94}
          background={colors.shieldIconBackground}
          borderColor={colors.shieldIconBorder}
          accent={colors.brandPrimary}
        />
      }
      title={loc.contacts.empty_title}
      subtitle={loc.contacts.empty_subtitle}
      testID="NoContactsMessage"
      bordered={bordered}
    >
      <ActionButton
        title={loc.contacts.empty_cta}
        Icon={AddIcon}
        onPress={onAdd}
        backgroundColor={colors.brandPrimary}
        color={colors.white}
        style={styles.cta}
        testID="ContactsEmptyAddButton"
      />
    </EmptyStateCard>
  );
};

export default ContactsEmptyState;

const styles = StyleSheet.create({
  // Narrower than the full-width call to action it otherwise is, to sit inside the card.
  cta: { width: 214 },
});
