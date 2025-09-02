import React, { useCallback, useEffect, useReducer, useRef, useMemo } from 'react';
import { useFocusEffect, useIsFocused, useRoute, RouteProp } from '@react-navigation/native';
import { Alert, findNodeHandle, Image, InteractionManager, StyleSheet, Text, useWindowDimensions, View, TouchableOpacity } from 'react-native';
import A from '../../blue_modules/analytics';
import { getClipboardContent } from '../../blue_modules/clipboard';
import { isDesktop } from '../../blue_modules/environment';
import * as fs from '../../blue_modules/fs';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../blue_modules/hapticFeedback';
import DeeplinkSchemaMatch from '../../class/deeplink-schema-match';
import { ExtendedTransaction, Transaction, TWallet } from '../../class/wallets/types';
import presentAlert from '../../components/Alert';
import { FButton, FContainer } from '../../components/FloatButtons';
import { useTheme } from '../../components/themes';
import { TransactionListItem } from '../../components/TransactionListItem';
import WalletsCarousel from '../../components/WalletsCarousel';
import { useSizeClass, SizeClass } from '../../blue_modules/sizeClass';
import loc from '../../loc';
import ActionSheet from '../ActionSheet';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { useStorage } from '../../hooks/context/useStorage';
import TotalWalletsBalance from '../../components/TotalWalletsBalance';
import { useSettings } from '../../hooks/context/useSettings';
import useMenuElements from '../../hooks/useMenuElements';
import SafeAreaSectionList from '../../components/SafeAreaSectionList';
import { scanQrHelper } from '../../helpers/scan-qr.ts';
import { HDSegwitBech32Wallet } from '../../class/index';import { render } from '@testing-library/react-native';

const WalletsListSections = { CAROUSEL: 'CAROUSEL', TRANSACTIONS: 'TRANSACTIONS' };

type SectionData = {
  key: string;
  data: Transaction[] | string[];
};

enum ActionTypes {
  SET_LOADING,
  SET_WALLETS,
  SET_CURRENT_INDEX,
  SET_REFRESH_FUNCTION,
}

interface SetLoadingAction {
  type: ActionTypes.SET_LOADING;
  payload: boolean;
}

interface SetWalletsAction {
  type: ActionTypes.SET_WALLETS;
  payload: TWallet[];
}

interface SetCurrentIndexAction {
  type: ActionTypes.SET_CURRENT_INDEX;
  payload: number;
}

interface SetRefreshFunctionAction {
  type: ActionTypes.SET_REFRESH_FUNCTION;
  payload: () => void;
}

type WalletListAction = SetLoadingAction | SetWalletsAction | SetCurrentIndexAction | SetRefreshFunctionAction;

interface WalletListState {
  isLoading: boolean;
  wallets: TWallet[];
  currentWalletIndex: number;
  refreshFunction: () => void;
}

const initialState = {
  isLoading: false,
  wallets: [],
  currentWalletIndex: 0,
  refreshFunction: () => {},
};

function reducer(state: WalletListState, action: WalletListAction) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case ActionTypes.SET_WALLETS:
      return { ...state, wallets: action.payload };
    case ActionTypes.SET_CURRENT_INDEX:
      return { ...state, currentWalletIndex: action.payload };
    case ActionTypes.SET_REFRESH_FUNCTION:
      return { ...state, refreshFunction: action.payload };
    default:
      return state;
  }
}

type NavigationProps = NativeStackNavigationProp<DetailViewStackParamList, 'WalletsList'>;
type RouteProps = RouteProp<DetailViewStackParamList, 'WalletsList'>;

const WalletsList: React.FC = () => {
  const [state, dispatch] = useReducer<React.Reducer<WalletListState, WalletListAction>>(reducer, initialState);
  const { isLoading } = state;
  const { sizeClass, isLarge } = useSizeClass();
  const walletsCarousel = useRef<any>();
  const currentWalletIndex = useRef<number>(0);
  const { registerTransactionsHandler, unregisterTransactionsHandler } = useMenuElements();
  const { wallets, getTransactions, getBalance, refreshAllWalletTransactions } = useStorage();
  const { isTotalBalanceEnabled, isElectrumDisabled } = useSettings();
  const { width } = useWindowDimensions();
  const { colors, scanImage } = useTheme();
  const navigation = useExtendedNavigation<NavigationProps>();
  const isFocused = useIsFocused();
  const route = useRoute<RouteProps>();
  const dataSource = getTransactions(undefined, 10);
  const walletsCount = useRef<number>(wallets.length);
  const walletActionButtonsRef = useRef<any>();
  const { addWallet, saveToDisk } = useStorage();

  const stylesHook = StyleSheet.create({
    walletsListWrapper: {
      backgroundColor: colors.brandingColor,
    },
    listHeaderBack: {
      backgroundColor: colors.background,
      paddingTop: sizeClass === SizeClass.Large ? 8 : 0,
    },
    listHeaderText: {
      color: colors.foregroundColor,
      flexShrink: 1,
    },
  });

  const refreshWallets = useCallback(
    async (index: number | undefined, showLoadingIndicator = true, showUpdateStatusIndicator = false) => {
      if (isElectrumDisabled) return;
      dispatch({ type: ActionTypes.SET_LOADING, payload: showLoadingIndicator });
      try {
        await refreshAllWalletTransactions(index, showUpdateStatusIndicator);
      } catch (error) {
        console.error(error);
      } finally {
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      }
    },
    [isElectrumDisabled, refreshAllWalletTransactions],
  );

  /**
   * Forcefully fetches TXs and balance for ALL wallets.
   * Triggered manually by user on pull-to-refresh.
   */
  const refreshTransactions = useCallback(() => {
    refreshWallets(undefined, true, true);
  }, [refreshWallets]);

  useEffect(() => {
    // Initial load of transactions without triggering scroll
    const initialLoad = async () => {
      if (isElectrumDisabled) return;
      try {
        await refreshAllWalletTransactions(undefined, true);
      } catch (error) {
        console.error(error);
      }
    };

    initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(() => {
    console.debug('WalletsList onRefresh');
    refreshTransactions();
    // Optimized for Mac option doesn't like RN Refresh component. Menu Elements now handles it for macOS
  }, [refreshTransactions]);

  const verifyBalance = useCallback(() => {
    if (getBalance() !== 0) {
      A(A.ENUM.GOT_NONZERO_BALANCE);
    } else {
      A(A.ENUM.GOT_ZERO_BALANCE);
    }
  }, [getBalance]);

  useEffect(() => {
    const screenKey = route.name;
    console.log(`[WalletsList] Registering handler with key: ${screenKey}`);
    registerTransactionsHandler(onRefresh, screenKey);

    return () => {
      console.log(`[WalletsList] Unmounting - cleaning up handler for: ${screenKey}`);
      unregisterTransactionsHandler(screenKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefresh, registerTransactionsHandler, unregisterTransactionsHandler]);

  useFocusEffect(
    useCallback(() => {
      const screenKey = route.name;

      return () => {
        console.log(`[WalletsList] Blurred - cleaning up handler for: ${screenKey}`);
        unregisterTransactionsHandler(screenKey);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unregisterTransactionsHandler]),
  );

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        verifyBalance();
      });

      return () => {
        task.cancel();
      };
    }, [verifyBalance]),
  );

  useEffect(() => {
    // new wallet added - no longer auto-scrolls
    if (!isLarge) {
      // Just update the count, no scrolling
      walletsCount.current = wallets.length;
    }
  }, [isLarge, wallets]);

  const onBarScanned = useCallback(
    (value: any) => {
      if (!value) return;
      try {
        DeeplinkSchemaMatch.navigationRouteFor({ url: value }, completionValue => {
          triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
          // @ts-ignore: for now
          navigation.navigate(...completionValue);
        });
      } catch (e: any) {
        Alert.alert(loc.send.details_scan_error, e.message);
      }
    },
    [navigation],
  );

  const handleClick = useCallback(
    (item?: TWallet) => {
      if (item?.getID) {
        const walletID = item.getID();
        navigation.navigate('WalletTransactions', {
          walletID,
          walletType: item.type,
        });
      } else {
        navigation.navigate('AddWalletRoot');
      }
    },
    [navigation],
  );

  const onSnapToItem = useCallback(
    (e: { nativeEvent: { contentOffset: any } }) => {
      if (!isFocused) return;

      const contentOffset = e.nativeEvent.contentOffset;
      const index = Math.ceil(contentOffset.x / width);

      if (currentWalletIndex.current !== index) {
        console.debug('onSnapToItem', wallets.length === index ? 'NewWallet/Importing card' : index);
        if (wallets[index] && (wallets[index].timeToRefreshBalance() || wallets[index].timeToRefreshTransaction())) {
          refreshWallets(index, false, false);
        }
        currentWalletIndex.current = index;
      }
    },
    [isFocused, refreshWallets, wallets, width],
  );

  const renderListHeaderComponent = useCallback(() => {
    return (
      <View style={[styles.listHeaderBack, stylesHook.listHeaderBack]}>
        <Text
          textBreakStrategy="simple"
          style={[styles.listHeaderText, stylesHook.listHeaderText]}
          numberOfLines={2}
          adjustsFontSizeToFit={true}
        >
          {`${loc.transactions.list_title}${'  '}`}
        </Text>
      </View>
    );
  }, [stylesHook.listHeaderBack, stylesHook.listHeaderText]);

  const handleLongPress = useCallback(() => {
    navigation.navigate('ManageWallets');
  }, [navigation]);

  const renderTransactionListsRow = useCallback(
    (item: ExtendedTransaction) => (
      <TransactionListItem key={item.hash} item={item} itemPriceUnit={item.walletPreferredBalanceUnit} walletID={item.walletID} />
    ),
    [],
  );

  const renderWalletsCarousel = useCallback(() => {
    return (
      <>
        <WalletsCarousel
          data={wallets}
          extraData={[wallets]}
          onPress={handleClick}
          handleLongPress={handleLongPress}
          onMomentumScrollEnd={onSnapToItem}
          ref={walletsCarousel}
          onNewWalletPress={handleClick}
          testID="WalletsList"
          horizontal
          scrollEnabled={isFocused}
          animateChanges={true}
        />
      </>
    );
  }, [handleClick, handleLongPress, isFocused, onSnapToItem, wallets]);

  const renderSectionItem = useCallback(
    (item: { section: any; item: ExtendedTransaction }) => {
      switch (item.section.key) {
        case WalletsListSections.CAROUSEL:
          return sizeClass === SizeClass.Large ? null : renderWalletsCarousel();
        case WalletsListSections.TRANSACTIONS:
          return renderTransactionListsRow(item.item);
        default:
          return null;
      }
    },
    [sizeClass, renderTransactionListsRow, renderWalletsCarousel],
  );

  const renderSectionHeader = useCallback(
    (section: { section: { key: any } }) => {
      if (sizeClass === SizeClass.Large) {
        return null;
      }

      switch (section.section.key) {
        case WalletsListSections.TRANSACTIONS:
          return renderListHeaderComponent();
        case WalletsListSections.CAROUSEL: {
          return isTotalBalanceEnabled ? (
            <View style={stylesHook.walletsListWrapper}>
              <TotalWalletsBalance />
            </View>
          ) : null;
        }
        default:
          return null;
      }
    },
    [sizeClass, isTotalBalanceEnabled, renderListHeaderComponent, stylesHook.walletsListWrapper],
  );

  const renderSectionFooter = useCallback(
    (section: { section: { key: any } }) => {
      switch (section.section.key) {
        case WalletsListSections.TRANSACTIONS:
          if (dataSource.length === 0 && !isLoading) {
            return (
              <View style={styles.footerRoot} testID="NoTransactionsMessage">
                <Text style={styles.footerEmpty}>{loc.wallets.list_empty_txs1}</Text>
                <Text style={styles.footerStart}>{loc.wallets.list_empty_txs2}</Text>
              </View>
            );
          } else {
            return null;
          }
        default:
          return null;
      }
    },
    [dataSource.length, isLoading],
  );

  const renderScanButton = useCallback(() => {
    if (wallets.length > 0) {
      return (
        <FContainer ref={walletActionButtonsRef.current}>
          <FButton
            onPress={onScanButtonPressed}
            onLongPress={sendButtonLongPress}
            icon={<Image resizeMode="stretch" source={scanImage} />}
            text={loc.send.details_scan}
            testID="HomeScreenScanButton"
          />
        </FContainer>
      );
    } else {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanImage, wallets.length]);

  const sectionListKeyExtractor = useCallback((item: any, index: any) => {
    return `${item}${index}}`;
  }, []);

  const onScanButtonPressed = useCallback(() => {
    scanQrHelper().then(onBarScanned);
  }, [onBarScanned]);

  const pasteFromClipboard = useCallback(async () => {
    onBarScanned(await getClipboardContent());
  }, [onBarScanned]);

  const sendButtonLongPress = useCallback(async () => {
    const isClipboardEmpty = (await getClipboardContent())?.trim().length === 0;

    const options = [loc._.cancel, loc.wallets.list_long_choose, loc.wallets.list_long_scan];
    if (!isClipboardEmpty) {
      options.push(loc.wallets.paste_from_clipboard);
    }

    const props = { title: loc.send.header, options, cancelButtonIndex: 0 };

    const anchor = findNodeHandle(walletActionButtonsRef.current);

    if (anchor) {
      options.push(String(anchor));
    }

    ActionSheet.showActionSheetWithOptions(props, buttonIndex => {
      switch (buttonIndex) {
        case 0:
          break;
        case 1:
          fs.showImagePickerAndReadImage()
            .then(onBarScanned)
            .catch(error => {
              triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
              presentAlert({ title: loc.errors.error, message: error.message });
            });
          break;
        case 2:
          scanQrHelper().then(onBarScanned);
          break;
        case 3:
          if (!isClipboardEmpty) {
            pasteFromClipboard();
          }
          break;
      }
    });
  }, [onBarScanned, pasteFromClipboard]);

  const refreshProps = isDesktop || isElectrumDisabled ? {} : { refreshing: isLoading, onRefresh };

  const sections: SectionData[] = useMemo(() => {
    // On large screens, only show transactions section
    if (sizeClass === SizeClass.Large) {
      return [{ key: WalletsListSections.TRANSACTIONS, data: dataSource }];
    }

    // On smaller screens, show both carousel and transactions
    return [
      { key: WalletsListSections.CAROUSEL, data: [WalletsListSections.CAROUSEL] },
      { key: WalletsListSections.TRANSACTIONS, data: dataSource },
    ];
  }, [sizeClass, dataSource]);

  // Constants for layout calculations
  const TRANSACTION_ITEM_HEIGHT = 80;
  const CAROUSEL_HEIGHT = 195;
  const SECTION_HEADER_HEIGHT = 56; // Base height
  const LARGE_TITLE_EXTRA_HEIGHT = 20; // Additional height for large titles

  const getSectionHeaderHeight = useCallback(() => {
    return SECTION_HEADER_HEIGHT + (sizeClass === SizeClass.Large ? LARGE_TITLE_EXTRA_HEIGHT : 0);
  }, [sizeClass]);

  const getItemLayout = useCallback(
    (data: any, index: number) => {
      const headerHeight = getSectionHeaderHeight();

      if (sizeClass === SizeClass.Large) {
        // On large screens: only transaction items, no carousel
        return {
          length: TRANSACTION_ITEM_HEIGHT,
          offset: TRANSACTION_ITEM_HEIGHT * index,
          index,
        };
      } else {
        // On smaller screens: first item is carousel, rest are transactions
        // First section: Carousel
        if (index === 0) {
          return {
            length: CAROUSEL_HEIGHT,
            offset: 0,
            index,
          };
        }

        // Second section: Transactions
        // Need to account for:
        // 1. Carousel height
        // 2. Section header height for transactions section
        // 3. Transaction items
        const transactionIndex = index - 1; // Adjust index to account for carousel
        return {
          length: TRANSACTION_ITEM_HEIGHT,
          offset: CAROUSEL_HEIGHT + headerHeight + TRANSACTION_ITEM_HEIGHT * transactionIndex,
          index,
        };
      }
    },
    [sizeClass, getSectionHeaderHeight],
  );

    const createWallet = async () => {
    try {
      // Create a new HDSegwitBech32Wallet (native segwit) directly
      const w = new HDSegwitBech32Wallet();
      w.setLabel(loc.wallets.details_title);
      
      // Generate the wallet (this creates the seed phrase)
      await w.generate();
      
      // Add to storage immediately so it can be found by ID
      addWallet(w);
      await saveToDisk();
      
      // Analytics and haptic feedback
      A(A.ENUM.CREATED_WALLET);
      triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
      
      // Navigate to AddWalletRoot's PleaseBackup screen to show seed phrase
      // @ts-ignore - nested navigation typing issue, but this pattern works in the codebase
      navigation.navigate('AddWalletRoot', {
        screen: 'PleaseBackup',
        params: {
          walletID: w.getID(),
        },
      });
    } catch (error) {
      console.error('Error creating wallet:', error);
      // Fallback to normal flow
      navigation.navigate('AddWalletRoot');
    }
  };

  const renderWelcomeScreen = useCallback(() => {
      return (
        <View style={[styles.welcomeContainer, { backgroundColor: colors.background }]}>
          <View style={styles.welcomeContent}>
            <View style={styles.logoContainer}>
              <Image source={require('../../img/bitcoin.png')} style={styles.bitcoinLogo} />
            </View>
            
            <Text style={[styles.welcomeTitle, { color: colors.foregroundColor }]}>
              Bitcoin wallet
            </Text>
            
            <Text style={[styles.welcomeSubtitle, { color: colors.alternativeTextColor }]}>
              A simple bitcoin wallet for{'\n'}your enjoyment.
            </Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: colors.bitcoinOrange }]}
                onPress={createWallet}
                testID="CreateWalletButton"
              >
                <Text style={[styles.createButtonText, { color: colors.brandingColor }]}>
                  Create a new wallet
                </Text>
              </TouchableOpacity>
              
  
              {/* uncomment to add restore wallet button */}
              {/* <TouchableOpacity
                style={styles.restoreButton}
                onPress={() => navigation.navigate('AddWalletRoot')}
                testID="RestoreWalletButton"
              >
                <Text style={[styles.restoreButtonText, { color: colors.shadowColor }]}>
                  Restore existing wallet
                </Text>
              </TouchableOpacity> */}
            </View>
            
            <View style={styles.footerContainer}>
              <Text style={[styles.footerText, { color: colors.alternativeTextColor }]}>
                Your wallet, your coins{'\n'}100% open-source & open-design
              </Text>
            </View>
          </View>
        </View>
      );
  }, [colors, navigation]);

  
  return (
    <>
      {wallets.length === 0 ? (
        renderWelcomeScreen()
      ) : (
        <>
          <SafeAreaSectionList<any | string, SectionData>
            renderItem={renderSectionItem}
            keyExtractor={sectionListKeyExtractor}
            renderSectionHeader={renderSectionHeader}
            initialNumToRender={10}
            renderSectionFooter={renderSectionFooter}
            sections={sections}
            floatingButtonHeight={70}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            getItemLayout={getItemLayout}
            ignoreTopInset={true} // Ignore top inset as the screen header already handles it
            {...refreshProps}
          />
          {renderScanButton()}
        </>
      )}
    </>

  );
};

export default WalletsList;

const styles = StyleSheet.create({
  listHeaderBack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 56,
  },
  listHeaderText: {
    fontWeight: 'bold',
    fontSize: 24,
    marginVertical: 16,
    flexWrap: 'wrap',
  },
  footerRoot: {
    top: 80,
    height: 160,
    marginBottom: 80,
  },
  footerEmpty: {
    fontSize: 18,
    color: '#9aa0aa',
    textAlign: 'center',
  },
  footerStart: {
    fontSize: 18,
    color: '#9aa0aa',
    textAlign: 'center',
    fontWeight: '600',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeContent: {
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  logoContainer: {
    marginBottom: 40,
  },
  bitcoinLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 60,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 40,
  },
  createButton: {
    backgroundColor: '#ff9500',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  restoreButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  restoreButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerContainer: {
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
