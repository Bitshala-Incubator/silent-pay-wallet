import { CommonActions } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import RNQRGenerator from 'rn-qr-generator';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import A from '../modules/analytics';
import { getClipboardContent } from '../modules/clipboard';
import { updateExchangeRate } from '../modules/currency';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../modules/hapticFeedback';
import {
  clearStoredNotifications,
  getDeliveredNotifications,
  getStoredNotifications,
  initializeNotifications,
  removeAllDeliveredNotifications,
  setApplicationIconBadgeNumber,
} from '../modules/notifications';
import DeeplinkSchemaMatch from '../class/deeplink-schema-match';
import presentAlert from '../components/Alert';
import loc from '../loc';
import { navigationRef } from '../NavigationService';
import ActionSheet from '../screen/ActionSheet';
import { useStorage } from './context/useStorage';
import useDeviceQuickActions from './useDeviceQuickActions';
import { useExtendedNavigation } from './useExtendedNavigation';

/**
 * Cross-platform listeners: deeplinks, clipboard prompts, push notifications, quick actions.
 * Apple-only companions (Watch/Widget/Handoff/MenuElements) live in their own hooks and
 * are intentionally not initialized here.
 */
const useCompanionListeners = (skipIfNotInitialized = true) => {
  const { wallets, addWallet, saveToDisk, fetchAndSaveWalletTransactions, refreshAllWalletTransactions, walletsInitialized } = useStorage();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const clipboardContent = useRef<string | undefined>(undefined);
  const navigation = useExtendedNavigation();

  const shouldActivateListeners = !skipIfNotInitialized || walletsInitialized;

  useDeviceQuickActions();

  const processPushNotifications = useCallback(async () => {
    if (!shouldActivateListeners) return false;

    await new Promise(resolve => setTimeout(resolve, 200));
    try {
      const notifications2process = await getStoredNotifications();
      await clearStoredNotifications();
      setApplicationIconBadgeNumber(0);

      const deliveredNotifications = await getDeliveredNotifications();
      setTimeout(async () => {
        try {
          removeAllDeliveredNotifications();
        } catch (error) {
          console.error('Failed to remove delivered notifications:', error);
        }
      }, 5000);

      for (const payload of notifications2process) {
        const wasTapped = payload.foreground === false || (payload.foreground === true && payload.userInteraction);

        console.log('processing push notification:', payload);
        let wallet;
        switch (+(payload.type ?? 0)) {
          case 2:
          case 3:
            wallet = wallets.find(w => w.weOwnAddress(payload.address ?? ''));
            break;
          case 1:
          case 4:
            wallet = wallets.find(w => w.weOwnTransaction((payload.txid || payload.hash) ?? ''));
            break;
        }

        if (wallet) {
          const walletID = wallet.getID();
          fetchAndSaveWalletTransactions(walletID);
          if (wasTapped) {
            if (payload.type !== 3) {
              navigation.navigate('WalletTransactions', {
                walletID,
                walletType: wallet.type,
              });
            } else {
              navigation.navigate('ReceiveDetails', {
                walletID,
                address: payload.address,
              });
            }

            return true;
          }
        } else {
          console.log('could not find wallet while processing push notification, NOP');
        }
      }

      if (deliveredNotifications.length > 0) {
        for (const notification of deliveredNotifications) {
          // expo-notifications returns Notification objects; custom data is in request.content.data
          const data = notification.request.content.data as Record<string, any>;
          const payload = {
            foreground: false,
            userInteraction: true,
            type: data?.type as number | undefined,
            address: data?.address as string | undefined,
            txid: data?.txid as string | undefined,
            hash: data?.hash as string | undefined,
          };
          const wasTapped = true; // delivered notifications were interacted with

          console.log('processing push notification:', payload);
          let wallet;
          switch (+(payload.type ?? 0)) {
            case 2:
            case 3:
              wallet = wallets.find(w => w.weOwnAddress(payload.address ?? ''));
              break;
            case 1:
            case 4:
              wallet = wallets.find(w => w.weOwnTransaction((payload.txid || payload.hash) ?? ''));
              break;
          }

          if (wallet) {
            const walletID = wallet.getID();
            fetchAndSaveWalletTransactions(walletID);
            if (wasTapped) {
              if (payload.type !== 3) {
                navigationRef.dispatch(
                  CommonActions.navigate({
                    name: 'WalletTransactions',
                    params: {
                      walletID,
                      walletType: wallet.type,
                    },
                  }),
                );
              } else {
                navigationRef.dispatch(
                  CommonActions.navigate({
                    name: 'ReceiveDetails',
                    params: {
                      walletID,
                      address: payload.address,
                    },
                  }),
                );
              }

              return true;
            }
          } else {
            console.log('could not find wallet while processing push notification, NOP');
          }
        }
      }

      if (deliveredNotifications.length > 0) {
        refreshAllWalletTransactions();
      }
    } catch (error) {
      console.error('Failed to process push notifications:', error);
    }
    return false;
  }, [shouldActivateListeners, wallets, fetchAndSaveWalletTransactions, navigation, refreshAllWalletTransactions]);

  useEffect(() => {
    if (!shouldActivateListeners) return;

    initializeNotifications(processPushNotifications);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldActivateListeners]);

  const handleOpenURL = useCallback(
    async (event: { url: string }): Promise<void> => {
      if (!shouldActivateListeners) return;

      try {
        if (!event.url) return;
        let decodedUrl: string;
        try {
          decodedUrl = decodeURIComponent(event.url);
        } catch (e) {
          console.error('Failed to decode URL, using original', e);
          decodedUrl = event.url;
        }
        const fileName = decodedUrl.split('/').pop()?.toLowerCase() || '';
        if (/\.(jpe?g|png)$/i.test(fileName)) {
          let base64: string;
          try {
            base64 = await readAsStringAsync(decodedUrl, { encoding: EncodingType.Base64 });
          } catch {
            base64 = await readAsStringAsync(decodedUrl.replace(/^file:\/\//, ''), { encoding: EncodingType.Base64 });
          }
          const qrResult = await RNQRGenerator.detect({ base64 });
          const qrValue = qrResult?.values?.[0];
          if (!qrValue) {
            throw new Error(loc.send.qr_error_no_qrcode);
          }
          triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
          DeeplinkSchemaMatch.navigationRouteFor({ url: qrValue }, (value: [string, any]) => navigationRef.navigate(...value), {
            wallets,
            addWallet,
            saveToDisk,
          });
        } else {
          DeeplinkSchemaMatch.navigationRouteFor(event, (value: [string, any]) => navigationRef.navigate(...value), {
            wallets,
            addWallet,
            saveToDisk,
          });
        }
      } catch (err: any) {
        console.error('Error in handleOpenURL:', err);
        triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
        presentAlert({ message: err.message || loc.send.qr_error_no_qrcode });
      }
    },
    [wallets, addWallet, saveToDisk, shouldActivateListeners],
  );

  const showClipboardAlert = useCallback(() => {
    if (!shouldActivateListeners) return;

    triggerHapticFeedback(HapticFeedbackTypes.ImpactLight);
    getClipboardContent().then(clipboard => {
      if (!clipboard) return;
      ActionSheet.showActionSheetWithOptions(
        {
          title: loc._.clipboard,
          message: loc.wallets.clipboard_bitcoin,
          options: [loc._.cancel, loc._.continue],
          cancelButtonIndex: 0,
        },
        buttonIndex => {
          switch (buttonIndex) {
            case 0:
              break;
            case 1:
              handleOpenURL({ url: clipboard });
              break;
          }
        },
      );
    });
  }, [handleOpenURL, shouldActivateListeners]);

  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus | undefined) => {
      if (!shouldActivateListeners || wallets.length === 0) return;

      if ((appState.current.match(/background/) && nextAppState === 'active') || nextAppState === undefined) {
        setTimeout(() => A(A.ENUM.APP_UNSUSPENDED), 2000);
        updateExchangeRate();
        const processed = await processPushNotifications();
        if (processed) return;
        const clipboard = await getClipboardContent();
        if (!clipboard) return;
        const isAddressFromStoredWallet = wallets.some(
          wallet => wallet.isAddressValid && wallet.isAddressValid(clipboard) && wallet.weOwnAddress(clipboard),
        );
        const isBitcoinAddress = DeeplinkSchemaMatch.isBitcoinAddress(clipboard);
        if (!isAddressFromStoredWallet && clipboardContent.current !== clipboard && isBitcoinAddress) {
          showClipboardAlert();
        }
        clipboardContent.current = clipboard;
      }
      if (nextAppState) {
        appState.current = nextAppState;
      }
    },
    [processPushNotifications, showClipboardAlert, wallets, shouldActivateListeners],
  );

  const addListeners = useCallback(() => {
    if (!shouldActivateListeners) return { urlSubscription: null, appStateSubscription: null };

    const urlSubscription = Linking.addEventListener('url', handleOpenURL);
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return {
      urlSubscription,
      appStateSubscription,
    };
  }, [handleOpenURL, handleAppStateChange, shouldActivateListeners]);

  useEffect(() => {
    const subscriptions = addListeners();

    return () => {
      subscriptions.urlSubscription?.remove?.();
      subscriptions.appStateSubscription?.remove?.();
    };
  }, [addListeners]);
};

export default useCompanionListeners;
