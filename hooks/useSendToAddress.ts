import { useCallback } from 'react';

import { useExtendedNavigation } from './useExtendedNavigation';
import { useStorage } from './context/useStorage';

/**
 * Opens the send flow on the first wallet, optionally with the recipient prefilled.
 *
 * SendDetails only sees params addressed to it by name; a flat payload reaches the nested
 * navigator and stops there, which silently drops the prefilled address. Every caller getting
 * that wrong the same way is what this hook is for.
 */
export const useSendToAddress = () => {
  const navigation = useExtendedNavigation();
  const { wallets } = useStorage();

  return useCallback(
    (address?: string) => {
      if (wallets.length === 0) return;
      navigation.navigate('SendDetailsRoot', { screen: 'SendDetails', params: { walletID: wallets[0].getID(), address } });
    },
    [navigation, wallets],
  );
};
