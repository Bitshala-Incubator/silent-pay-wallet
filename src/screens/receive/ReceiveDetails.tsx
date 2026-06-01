import React, { useCallback, useEffect, useState } from 'react';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BackHandler, InteractionManager, Platform, StyleSheet, Text, View } from 'react-native';
import Share from 'react-native-share';
import * as Electrum from '../../modules/Electrum';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../modules/hapticFeedback';
import { ShroudCard, ShroudText } from '../../components/ShroudComponents';
import DeeplinkSchemaMatch from '../../class/deeplink-schema-match';
import presentAlert from '../../components/Alert';
import Button from '../../components/Button';
import CopyTextToClipboard from '../../components/CopyTextToClipboard';
import QRCodeComponent from '../../components/QRCodeComponent';
import SegmentedControl from '../../components/SegmentControl';
import { useTheme } from '../../components/themes';
import TipBox from '../../components/TipBox';
import { TransactionPendingIconBig } from '../../components/TransactionPendingIconBig';
import { useSettings } from '../../hooks/context/useSettings';
import { useStorage } from '../../hooks/context/useStorage';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import loc, { formatBalance } from '../../loc';
import { BitcoinUnit, Chain } from '../../models/bitcoinUnits';
import { ReceiveDetailsStackParamList } from '../../navigation/ReceiveDetailsStackParamList';
import { SuccessView } from '../send/success';
import { Spacing40 } from '../../components/Spacing';
import { Loading } from '../../components/Loading';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';

const segmentControlValues = [loc.bip352.silent_payments, loc.wallets.details_address];
const HORIZONTAL_PADDING = 20;

type StickyHeaderProps = {
  wallet: any;
  tabValues: string[];
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  backgroundColor: string;
};

const StickyHeader = React.memo(({ wallet, tabValues, currentTab, setCurrentTab, backgroundColor }: StickyHeaderProps) => {
  if (!wallet) return null;

  return (
    <View style={[styles.tabsContainer, { backgroundColor }]}>
      <SegmentedControl
        values={tabValues}
        selectedIndex={tabValues.findIndex(tab => tab === currentTab)}
        onChange={index => {
          setCurrentTab(tabValues[index]);
        }}
      />
    </View>
  );
});

type NavigationProps = NativeStackNavigationProp<ReceiveDetailsStackParamList, 'ReceiveDetails'>;
type RouteProps = RouteProp<ReceiveDetailsStackParamList, 'ReceiveDetails'>;

const ReceiveDetails = () => {
  const { walletID, address } = useRoute<RouteProps>().params;
  const { wallets, saveToDisk, sleep, fetchAndSaveWalletTransactions } = useStorage();
  const { isElectrumDisabled } = useSettings();
  const { colors } = useTheme();
  const [bip21encoded, setBip21encoded] = useState('');
  const [showPendingBalance, setShowPendingBalance] = useState(false);
  const [showConfirmedBalance, setShowConfirmedBalance] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [currentTab, setCurrentTab] = useState(segmentControlValues[0]);
  const { goBack, setParams } = useExtendedNavigation<NavigationProps>();
  const [intervalMs, setIntervalMs] = useState(5000);
  const [eta, setEta] = useState('');
  const [initialConfirmed, setInitialConfirmed] = useState(0);
  const [initialUnconfirmed, setInitialUnconfirmed] = useState(0);
  const [displayBalance, setDisplayBalance] = useState('');
  const [qrCodeSize, setQRCodeSize] = useState(90);

  const wallet = walletID ? wallets.find(w => w.getID() === walletID) : undefined;

  const stylesHook = StyleSheet.create({
    root: {
      backgroundColor: colors.elevated,
    },
    label: {
      color: colors.foregroundColor,
    },
  });

  const setAddressBIP21Encoded = useCallback(
    (addr: string) => {
      const newBip21encoded = DeeplinkSchemaMatch.bip21encode(addr);
      setParams({ address: addr });
      setBip21encoded(newBip21encoded);
      setShowAddress(true);
    },
    [setParams],
  );

  const obtainWalletAddress = useCallback(async () => {
    console.debug('ReceiveDetails - componentDidMount');
    // this function should only be called when wallet exists
    if (!wallet) {
      console.warn('Wallet not found');
      return;
    }
    if (address) {
      setAddressBIP21Encoded(address);
      return;
    }

    let newAddress;
    if (wallet.chain === Chain.ONCHAIN) {
      try {
        if (!isElectrumDisabled) newAddress = await Promise.race([wallet.getAddressAsync(), sleep(1000)]);
      } catch (error) {
        console.warn('Error fetching wallet address (ONCHAIN):', error);
      }
      if (newAddress === undefined) {
        newAddress = wallet._getExternalAddressByIndex(wallet.getNextFreeAddressIndex());
      } else {
        saveToDisk(); // caching whatever getAddressAsync() generated internally
      }
    } else {
      try {
        await Promise.race([wallet.getAddressAsync(), sleep(1000)]);
        newAddress = wallet.getAddress();
      } catch (error) {
        console.warn('Error fetching wallet address (OFFCHAIN):', error);
      }
      if (newAddress === undefined) {
        console.warn('either sleep expired or getAddressAsync threw an exception');
        newAddress = wallet.getAddress();
      } else {
        saveToDisk(); // caching whatever getAddressAsync() generated internally
      }
    }

    if (!newAddress) {
      presentAlert({ title: loc.errors.error, message: loc.receive.address_not_found });
      return;
    }

    setAddressBIP21Encoded(newAddress);
  }, [wallet, saveToDisk, address, setAddressBIP21Encoded, isElectrumDisabled, sleep]);

  useEffect(() => {
    if (showConfirmedBalance) {
      triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
    }
  }, [showConfirmedBalance]);

  useEffect(() => {
    if (address) {
      setAddressBIP21Encoded(address);
    }
  }, [address, setAddressBIP21Encoded]);

  // re-fetching address balance periodically
  useEffect(() => {
    console.debug('receive/details - useEffect');

    const intervalId = setInterval(async () => {
      try {
        const decoded = DeeplinkSchemaMatch.bip21decode(bip21encoded);
        const addressToUse = address || decoded.address;
        if (!addressToUse) return;

        console.debug('checking address', addressToUse, 'for balance...');
        const balance = await Electrum.getBalanceByAddress(addressToUse);
        console.debug('...got', balance);

        if (balance.unconfirmed > 0) {
          if (initialConfirmed === 0 && initialUnconfirmed === 0) {
            setInitialConfirmed(balance.confirmed);
            setInitialUnconfirmed(balance.unconfirmed);
            setIntervalMs(25000);
            triggerHapticFeedback(HapticFeedbackTypes.ImpactHeavy);
          }

          const txs = await Electrum.getMempoolTransactionsByAddress(addressToUse);
          const tx = txs.pop();
          if (tx) {
            const rez = await Electrum.multiGetTransactionByTxid([tx.tx_hash], true, 10);
            if (rez[tx.tx_hash] && rez[tx.tx_hash].vsize) {
              const satPerVbyte = Math.round(tx.fee / rez[tx.tx_hash].vsize);
              const fees = await Electrum.estimateFees();
              if (satPerVbyte >= fees.fast) {
                setEta(loc.formatString(loc.transactions.eta_10m));
              } else if (satPerVbyte >= fees.medium) {
                setEta(loc.formatString(loc.transactions.eta_3h));
              } else {
                setEta(loc.formatString(loc.transactions.eta_1d));
              }
            }
          }

          setDisplayBalance(
            loc.formatString(loc.transactions.pending_with_amount, {
              amt1: formatBalance(balance.unconfirmed, BitcoinUnit.LOCAL_CURRENCY, true).toString(),
              amt2: formatBalance(balance.unconfirmed, BitcoinUnit.BTC, true).toString(),
            }),
          );
          setShowPendingBalance(true);
          setShowAddress(false);
        } else if (balance.unconfirmed === 0 && initialUnconfirmed !== 0) {
          // now, handling a case when unconfirmed == 0, but in past it wasnt (i.e. it changed while user was
          // staring at the screen)
          const balanceToShow = balance.confirmed - initialConfirmed;

          if (balanceToShow > 0) {
            // address has actually more coins than initially, so we definitely gained something
            setShowConfirmedBalance(true);
            setShowPendingBalance(false);
            setShowAddress(false);
            setDisplayBalance(
              loc.formatString(loc.transactions.received_with_amount, {
                amt1: formatBalance(balanceToShow, BitcoinUnit.LOCAL_CURRENCY, true).toString(),
                amt2: formatBalance(balanceToShow, BitcoinUnit.BTC, true).toString(),
              }),
            );
            if (walletID) {
              fetchAndSaveWalletTransactions(walletID);
            }
          } else {
            // rare case, but probable. transaction evicted from mempool (maybe cancelled by the sender)
            setShowConfirmedBalance(false);
            setShowPendingBalance(false);
            setShowAddress(true);
          }
        }
      } catch (error) {
        console.debug('Error checking balance:', error);
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [bip21encoded, address, initialConfirmed, initialUnconfirmed, intervalMs, fetchAndSaveWalletTransactions, walletID]);

  useEffect(() => {
    const handleBackButton = () => {
      goBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => subscription.remove();
  }, [goBack]);

  const renderConfirmedBalance = () => {
    return (
      <View style={styles.scrollBody}>
        <SuccessView />
        <ShroudText style={[styles.label, stylesHook.label]} numberOfLines={1}>
          {displayBalance}
        </ShroudText>
      </View>
    );
  };

  const renderPendingBalance = () => {
    return (
      <View style={styles.scrollBody}>
        <TransactionPendingIconBig />
        <Spacing40 />
        <ShroudText style={[styles.label, stylesHook.label]} numberOfLines={1}>
          {displayBalance}
        </ShroudText>
        <ShroudText style={[styles.label, stylesHook.label]} numberOfLines={1}>
          {eta}
        </ShroudText>
      </View>
    );
  };

  const onLayout = useCallback((e: { nativeEvent: { layout: { height: number; width: number } } }) => {
    const { height, width } = e.nativeEvent.layout;
    const maxQRSize = 500;
    const heightBasedSize = Math.min(height * 0.6, maxQRSize);
    const widthBasedSize = width * 0.85 - HORIZONTAL_PADDING * 2;
    setQRCodeSize(Math.min(heightBasedSize, widthBasedSize));
  }, []);

  const renderTabContent = () => {
    if (currentTab === segmentControlValues[1]) {
      return (
        <View style={styles.container}>
          {address && (
            <View style={styles.scrollBody}>
              <View style={styles.qrCodeContainer}>
                <QRCodeComponent value={bip21encoded} size={qrCodeSize} />
              </View>
              <CopyTextToClipboard text={address} />
            </View>
          )}
        </View>
      );
    } else if (currentTab === segmentControlValues[0] && wallet) {
      const qrValue =
        'getSilentPaymentAddress' in wallet && typeof wallet.getSilentPaymentAddress === 'function'
          ? wallet.getSilentPaymentAddress()
          : undefined;
      return (
        <View style={styles.container}>
          {qrValue ? (
            <>
              <TipBox description={loc.bip352.explanation} containerStyle={styles.tip} />
              <View style={styles.qrCodeContainer}>
                <QRCodeComponent value={qrValue} size={qrCodeSize} />
              </View>
              <CopyTextToClipboard text={qrValue} truncated={false} />
            </>
          ) : (
            <Text>{loc.bip352.not_supported}</Text>
          )}
        </View>
      );
    } else {
      return null;
    }
  };

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(async () => {
        try {
          if (wallet) {
            await obtainWalletAddress();
          } else if (!wallet && address) {
            setAddressBIP21Encoded(address);
          }
        } catch (error) {
          console.error('Error during focus effect:', error);
        }
      });
      return () => {
        task.cancel();
      };
    }, [wallet, address, obtainWalletAddress, setAddressBIP21Encoded]),
  );

  const handleShareButtonPressed = () => {
    let message: string | false = false;
    if (currentTab === segmentControlValues[1]) {
      message = bip21encoded;
    } else if (currentTab === segmentControlValues[0] && wallet) {
      message =
        (wallet && 'getSilentPaymentAddress' in wallet && typeof wallet.getSilentPaymentAddress === 'function'
          ? wallet.getSilentPaymentAddress()
          : false) ?? false;
    }

    if (!message) {
      presentAlert({ title: loc.errors.error, message: loc.receive.address_not_found });
      return;
    }

    Share.open({ message }).catch(error => console.debug('Error sharing:', error));
  };

  return (
    <View style={[styles.flex, stylesHook.root]}>
      <SafeAreaScrollView
        centerContent
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        automaticallyAdjustKeyboardInsets
        testID="ReceiveDetailsScrollView"
        style={stylesHook.root}
        contentContainerStyle={[styles.root, stylesHook.root]}
        keyboardShouldPersistTaps="always"
        onLayout={onLayout}
        stickyHeaderIndices={wallet ? [0] : []}
      >
        {wallet && (
          <StickyHeader
            wallet={wallet}
            tabValues={segmentControlValues}
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            backgroundColor={colors.elevated}
          />
        )}
        {showAddress && renderTabContent()}
        {showConfirmedBalance && renderConfirmedBalance()}
        {showPendingBalance && renderPendingBalance()}

        {!showAddress && !showPendingBalance && !showConfirmedBalance && (
          <View style={styles.loadingContainer}>
            <Loading />
          </View>
        )}

        <View style={styles.share}>
          <ShroudCard>
            <Button
              onPress={handleShareButtonPressed}
              title={loc.receive.details_share}
              disabled={
                !bip21encoded &&
                !(
                  currentTab === segmentControlValues[0] &&
                  !(
                    wallet &&
                    'getSilentPaymentAddress' in wallet &&
                    typeof wallet.getSilentPaymentAddress === 'function' &&
                    wallet.getSilentPaymentAddress()
                  )
                )
              }
            />
          </ShroudCard>
        </View>
      </SafeAreaScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  flex: {
    flex: 1,
  },
  tabsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : undefined,
  },
  scrollBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  share: {
    width: '100%',
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
    paddingBottom: 12,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tip: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});

export default ReceiveDetails;
