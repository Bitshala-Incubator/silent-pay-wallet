import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import ListItem from '../../components/ListItem';
import { useStorage } from '../../hooks/context/useStorage';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../modules/hapticFeedback';
import loc from '../../loc';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';

type NavigationProps = NativeStackNavigationProp<DetailViewStackParamList, 'DeleteWallet'>;

const DeleteWallet: React.FC = () => {
  const { wallets, handleWalletDeletion } = useStorage();
  const { dispatch } = useExtendedNavigation<NavigationProps>();

  const handleDeleteWallet = useCallback(async () => {
    const wallet = wallets.length > 0 ? wallets[0] : null;
    if (!wallet) {
      Alert.alert(loc.wallets.list_empty_txs1, 'No wallet available to delete');
      return;
    }

    Alert.alert(
      loc.wallets.details_delete_wallet,
      loc.wallets.details_are_you_sure,
      [
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
      { cancelable: false },
    );
  }, [wallets, handleWalletDeletion, dispatch]);

  if (wallets.length === 0) {
    return null;
  }

  return <ListItem title="Delete Wallet" onPress={handleDeleteWallet} testID="DeleteWalletButton" chevron={false} />;
};

export default DeleteWallet;
