import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@rneui/themed';
import * as Electrum from '../../modules/Electrum';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../modules/hapticFeedback';
import { ShroudCard, ShroudText } from '../../ShroudComponents';
import { Transaction, TWallet } from '../../class/wallets/types';
import TransactionDirectionIcon from '../../components/icons/TransactionDirectionIcon';
import TransactionPendingIcon from '../../components/icons/TransactionPendingIcon';
import { getTransactionIconColors } from '../../components/icons/getTransactionIconColors';
import SafeArea from '../../components/SafeArea';
import { useTheme } from '../../components/themes';
import loc, { formatBalanceWithoutSuffix } from '../../loc';
import { BitcoinUnit } from '../../models/bitcoinUnits';
import { useStorage } from '../../hooks/context/useStorage';
import HeaderRightButton from '../../components/HeaderRightButton';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { Spacing10 } from '../../components/Spacing';
import { Loading } from '../../components/Loading';

type RouteProps = RouteProp<DetailViewStackParamList, 'TransactionStatus'>;
type NavigationProps = NativeStackNavigationProp<DetailViewStackParamList, 'TransactionStatus'>;

enum ActionType {
  SetTransaction,
  SetLoading,
  SetEta,
  SetIntervalMs,
  SetWallet,
  SetLoadingError,
}

interface State {
  tx: any;
  isLoading: boolean;
  eta: string;
  intervalMs: number;
  wallet: TWallet | null;
  loadingError: boolean;
}

const initialState: State = {
  tx: undefined,
  isLoading: true,
  eta: '',
  intervalMs: 1000,
  wallet: null,
  loadingError: false,
};

const reducer = (state: State, action: { type: ActionType; payload?: any }): State => {
  switch (action.type) {
    case ActionType.SetTransaction:
      return { ...state, tx: action.payload };
    case ActionType.SetLoading:
      return { ...state, isLoading: action.payload };
    case ActionType.SetEta:
      return { ...state, eta: action.payload };
    case ActionType.SetIntervalMs:
      return { ...state, intervalMs: action.payload };
    case ActionType.SetWallet:
      return { ...state, wallet: action.payload };
    case ActionType.SetLoadingError:
      return { ...state, loadingError: action.payload };
    default:
      return state;
  }
};

type TransactionStatusProps = {
  transaction?: {
    amount?: number;
    value?: number;
    confirmations?: number;
  };
  txid?: string;
};

const TransactionStatus: React.FC<TransactionStatusProps> = ({ transaction, txid }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { tx, isLoading, eta, intervalMs, wallet, loadingError } = state;
  const { wallets, txMetadata, fetchAndSaveWalletTransactions } = useStorage();
  const { hash, walletID } = useRoute<RouteProps>().params;
  const { navigate, setOptions, goBack } = useExtendedNavigation<NavigationProps>();
  const { colors } = useTheme();
  const fetchTxInterval = useRef<NodeJS.Timeout>();
  const stylesHook = StyleSheet.create({
    value: {
      color: colors.alternativeTextColor2,
    },
    valueUnit: {
      color: colors.alternativeTextColor2,
    },
    iconRoot: {
      backgroundColor: colors.success,
    },
  });

  const setTX = (value: any) => {
    dispatch({ type: ActionType.SetTransaction, payload: value });
  };

  const setIntervalMs = (ms: number) => {
    dispatch({ type: ActionType.SetIntervalMs, payload: ms });
  };

  const setEta = (value: string) => {
    dispatch({ type: ActionType.SetEta, payload: value });
  };

  const setIsLoading = (value: boolean) => {
    dispatch({ type: ActionType.SetLoading, payload: value });
  };

  const navigateToTransactionDetails = useCallback(() => {
    if (walletID && tx && tx.hash) {
      navigate('TransactionDetails', { tx, hash, walletID });
    } else {
      console.error('Cannot navigate to TransactionDetails: Missing tx or hash.');
    }
  }, [hash, navigate, tx, walletID]);

  const DetailsButton = useMemo(
    () => (
      <HeaderRightButton
        testID="TransactionDetailsButton"
        disabled={loadingError || isLoading || !tx || !wallet}
        title={loc.send.create_details}
        onPress={navigateToTransactionDetails}
      />
    ),
    [navigateToTransactionDetails, loadingError, isLoading, tx, wallet],
  );

  useEffect(() => {
    setOptions({
      headerRight: () => DetailsButton,
    });
  }, [DetailsButton, colors, hash, setOptions]);

  useEffect(() => {
    if (wallet) {
      const transactions = wallet.getTransactions();
      const newTx = transactions.find((t: Transaction) => t.hash === hash);
      if (newTx) {
        setTX(newTx);
      }
    }
  }, [hash, wallet]);

  useEffect(() => {
    const foundWallet = wallets.find(w => w.getID() === walletID) || null;
    dispatch({ type: ActionType.SetWallet, payload: foundWallet });
  }, [walletID, wallets]);

  // re-fetching tx status periodically
  useEffect(() => {
    console.debug('transactionStatus - useEffect');

    if (!tx || tx?.confirmations) return;
    if (!hash) return;

    if (fetchTxInterval.current) {
      // interval already exists, lets cleanup it and recreate, so theres no duplicate intervals
      clearInterval(fetchTxInterval.current);
      fetchTxInterval.current = undefined;
    }

    console.debug('setting up interval to check tx...');
    fetchTxInterval.current = setInterval(async () => {
      try {
        setIntervalMs(31000); // upon first execution we increase poll interval;

        console.debug('checking tx', hash, 'for confirmations...');
        const transactions = await Electrum.multiGetTransactionByTxid([hash], true, 10);
        const txFromElectrum = transactions[hash];
        if (!txFromElectrum) {
          console.error(`Transaction from Electrum with hash ${hash} not found.`);
          return;
        }

        console.debug('got txFromElectrum=', txFromElectrum);

        const address = txFromElectrum.vout?.[0]?.scriptPubKey?.addresses?.pop();
        if (!address) {
          console.error('Address not found in txFromElectrum.');
          return;
        }

        if (!txFromElectrum.confirmations && txFromElectrum.vsize) {
          const txsM = await Electrum.getMempoolTransactionsByAddress(address);
          let txFromMempool;
          // searching for a correct tx in case this address has several pending txs:
          for (const tempTxM of txsM) {
            if (tempTxM?.tx_hash === hash) {
              txFromMempool = tempTxM;
              break;
            }
          }
          if (!txFromMempool) {
            console.error(`Transaction from mempool with hash ${hash} not found.`);
            return;
          }

          console.debug('txFromMempool=', txFromMempool);

          const satPerVbyte = txFromMempool.fee && txFromElectrum.vsize ? Math.round(txFromMempool.fee / txFromElectrum.vsize) : 0;
          const fees = await Electrum.estimateFees();
          console.debug('fees=', fees, 'satPerVbyte=', satPerVbyte);
          if (satPerVbyte >= fees.fast) {
            setEta(loc.formatString(loc.transactions.eta_10m));
          }
          if (satPerVbyte >= fees.medium && satPerVbyte < fees.fast) {
            setEta(loc.formatString(loc.transactions.eta_3h));
          }
          if (satPerVbyte < fees.medium) {
            setEta(loc.formatString(loc.transactions.eta_1d));
          }
        } else if (txFromElectrum.confirmations && txFromElectrum.confirmations > 0) {
          // now, handling a case when tx became confirmed!
          triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
          setEta('');
          if (tx) {
            setTX((prevState: any) => {
              return Object.assign({}, prevState, { confirmations: txFromElectrum.confirmations });
            });
          } else {
            console.error('Cannot set confirmations: tx is undefined.');
          }
          clearInterval(fetchTxInterval.current);
          fetchTxInterval.current = undefined;
          if (wallet?.getID()) {
            fetchAndSaveWalletTransactions(wallet.getID());
          } else {
            console.error('Cannot fetch and save wallet transactions: wallet ID is undefined.');
          }
        }
      } catch (error) {
        console.error('Error in fetchTxInterval:', error);
      }
    }, intervalMs);

    return () => {
      clearInterval(fetchTxInterval.current);
      fetchTxInterval.current = undefined;
    };
  }, [hash, intervalMs, tx, fetchAndSaveWalletTransactions, wallet]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });

    return () => {
      subscription.remove();
      clearInterval(fetchTxInterval.current);
      fetchTxInterval.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tx) {
      setIsLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    console.debug('transactionStatus - useEffect');
  }, []);

  const renderTXMetadata = () => {
    if (txMetadata[tx.hash]) {
      if (txMetadata[tx.hash].memo) {
        return (
          <View style={styles.memo}>
            <Text selectable style={styles.memoText}>
              {txMetadata[tx.hash].memo}
            </Text>
          </View>
        );
      }
    }
  };

  useEffect(() => {
    if (!tx && txid) {
      // Fetch transaction details using txid
      const fetchTransaction = async () => {
        try {
          const transactions = await Electrum.multiGetTransactionByTxid([txid], true, 10);
          const fetchedTx = transactions[txid];
          if (fetchedTx) {
            setTX(fetchedTx);
          } else {
            console.error(`Transaction with txid ${txid} not found.`);
            dispatch({ type: ActionType.SetLoadingError, payload: true });
            dispatch({ type: ActionType.SetLoading, payload: false });
          }
        } catch (error) {
          console.error('Error fetching transaction:', error);
          dispatch({ type: ActionType.SetLoadingError, payload: true });
          dispatch({ type: ActionType.SetLoading, payload: false });
        }
      };
      fetchTransaction().catch(error => console.error('Unhandled error in fetchTransaction:', error));
    }
  }, [tx, txid]);

  useEffect(() => {
    if (isLoading) {
      let isComponentMounted = true;
      const loadingTimeout = setTimeout(() => {
        if (isComponentMounted && isLoading) {
          dispatch({ type: ActionType.SetLoadingError, payload: true });
          dispatch({ type: ActionType.SetLoading, payload: false });
          console.error('Loading timed out. There was an issue fetching the transaction.');
        }
      }, 10000);

      return () => {
        isComponentMounted = false;
        clearTimeout(loadingTimeout);
      };
    }
  }, [isLoading]);

  return (
    <SafeArea>
      {loadingError ? (
        <ShroudCard>
          <ShroudText>{loc.transactions.transaction_loading_error}</ShroudText>
        </ShroudCard>
      ) : isLoading || !tx || wallet === undefined ? (
        <Loading />
      ) : !transaction && !tx ? (
        <ShroudText>{loc.transactions.transaction_not_available}</ShroudText>
      ) : (
        <>
          <View style={styles.container}>
            <ShroudCard>
              <View style={styles.center}>
                <Text style={[styles.value, stylesHook.value]} selectable>
                  {wallet && formatBalanceWithoutSuffix(tx.value, wallet.preferredBalanceUnit, true)}
                  {` `}
                  {wallet?.preferredBalanceUnit !== BitcoinUnit.LOCAL_CURRENCY && wallet && (
                    <Text style={[styles.valueUnit, stylesHook.valueUnit]}>{wallet.preferredBalanceUnit}</Text>
                  )}
                </Text>
              </View>

              {renderTXMetadata()}

              <View style={[styles.iconRoot, stylesHook.iconRoot]}>
                <View>
                  <Icon name="check" size={50} type="font-awesome" color={colors.successCheck} />
                </View>
                <View style={[styles.iconWrap, styles.margin]}>
                  {(() => {
                    if (!tx.confirmations) {
                      return (
                        <View style={styles.icon}>
                          <TransactionPendingIcon />
                        </View>
                      );
                    } else {
                      return (
                        <View style={styles.icon}>
                          <TransactionDirectionIcon size={30} {...getTransactionIconColors(colors, tx.value)} />
                        </View>
                      );
                    }
                  })()}
                </View>
              </View>

              {tx.fee && (
                <View style={styles.fee}>
                  <ShroudText style={styles.feeText}>
                    {`${loc.send.create_fee.toLowerCase()} `}
                    {formatBalanceWithoutSuffix(tx.fee, wallet?.preferredBalanceUnit ?? BitcoinUnit.BTC, true)}
                    {wallet?.preferredBalanceUnit !== BitcoinUnit.LOCAL_CURRENCY && wallet?.preferredBalanceUnit}
                  </ShroudText>
                </View>
              )}

              <View style={styles.confirmations}>
                <Text style={styles.confirmationsText}>
                  {loc.formatString(loc.transactions.confirmations_lowercase, {
                    confirmations: tx.confirmations > 6 ? '6+' : tx.confirmations,
                  })}
                </Text>
              </View>
              {eta ? (
                <View style={styles.eta}>
                  <Spacing10 />
                  <Text style={styles.confirmationsText}>{eta}</Text>
                </View>
              ) : null}
            </ShroudCard>
          </View>
        </>
      )}
    </SafeArea>
  );
};

export default TransactionStatus;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  center: {
    alignItems: 'center',
  },
  value: {
    fontSize: 36,
    fontWeight: '600',
  },
  valueUnit: {
    fontSize: 16,
    fontWeight: '600',
  },
  memo: {
    alignItems: 'center',
    marginVertical: 8,
  },
  memoText: {
    color: '#9aa0aa',
    fontSize: 14,
  },
  iconRoot: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    justifyContent: 'center',
    marginTop: 43,
    marginBottom: 53,
  },
  iconWrap: {
    minWidth: 30,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    borderRadius: 15,
  },
  margin: {
    marginBottom: -40,
  },
  icon: {
    width: 25,
  },
  fee: {
    marginTop: 15,
    marginBottom: 13,
  },
  feeText: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    color: '#00c49f',
    alignSelf: 'center',
  },
  confirmations: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationsText: {
    color: '#9aa0aa',
    fontSize: 13,
  },
  eta: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
