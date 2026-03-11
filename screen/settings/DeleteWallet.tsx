import React, { useCallback } from 'react';
import ListItem from '../../components/ListItem';
import { useStorage } from '../../hooks/context/useStorage';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../blue_modules/hapticFeedback';
import loc from '../../loc';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import presentAlert from '../../components/Alert';

type NavigationProps = NativeStackNavigationProp<DetailViewStackParamList, 'DeleteWallet'>;

const DeleteWallet: React.FC = () => {
  const { wallets, handleWalletDeletion } = useStorage();
  const { dispatch } = useExtendedNavigation<NavigationProps>();

  const handleDeleteWallet = useCallback(async () => {
    const wallet = wallets.length > 0 ? wallets[0] : null;
    if (!wallet) {
      presentAlert({ title: loc.wallets.list_empty_txs1, message: 'No wallet available to delete' });
      return;
    }

    presentAlert({
      title: loc.wallets.details_delete_wallet,
      message: loc.wallets.details_are_you_sure,
      buttons: [
        {
          text: loc._.cancel,
          style: 'cancel',
        },
        {
          text: loc.wallets.details_yes_delete,
          style: 'destructive',
          onPress: async () => {
            const deletionSucceeded = await handleWalletDeletion(wallet.getID());
            if (deletionSucceeded) {
              triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
              dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Onboarding' }],
                }),
              );
            }
          },
        },
      ],
      options: { cancelable: false },
    });
  }, [wallets, handleWalletDeletion, dispatch]);

  if (wallets.length === 0) {
    return null;
  }

  return <ListItem title="Delete Wallet" onPress={handleDeleteWallet} testID="DeleteWalletButton" chevron={false} />;
};

export default DeleteWallet;
