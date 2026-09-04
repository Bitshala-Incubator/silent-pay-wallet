import { useContext } from 'react';
import { ContactsContext } from '../../components/Context/ContactsProvider';

export const useContacts = () => useContext(ContactsContext);
