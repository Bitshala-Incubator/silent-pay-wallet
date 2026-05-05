import React, { useCallback, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { RouteProp, useFocusEffect, usePreventRemove, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import assert from 'assert';
import dayjs from 'dayjs';
import { InteractionManager, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../modules/hapticFeedback';
import { ShroudCard, ShroudText } from '../../ShroudComponents';
import { Transaction, TWallet } from '../../class/wallets/types';
import presentAlert from '../../components/Alert';
import CopyToClipboardButton from '../../components/CopyToClipboardButton';
import { useTheme } from '../../components/themes';
import ToolTipMenu from '../../components/TooltipMenu';
import loc from '../../loc';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import { useStorage } from '../../hooks/context/useStorage';
import { useSettings } from '../../hooks/context/useSettings';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';
import { Loading } from '../../components/Loading';

const actionKeys = {
  CopyToClipboard: 'copyToClipboard',
  GoToWallet: 'goToWallet',
};

const actionIcons = {
  Clipboard: {
    iconValue: 'doc.on.doc',
  },
  GoToWallet: {
    iconValue: 'wallet.pass',
  },
};

function onlyUnique(value: any, index: number, self: any[]) {
  return self.indexOf(value) === index;
}

function arrDiff(a1: any[], a2: any[]) {
  const ret = [];
  for (const v of a2) {
    if (a1.indexOf(v) === -1) {
      ret.push(v);
    }
  }
  return ret;
}

const toolTipMenuActions = [
  {
    id: actionKeys.CopyToClipboard,
    text: loc.transactions.copy_link,
    icon: actionIcons.Clipboard,
  },
];

type NavigationProps = NativeStackNavigationProp<DetailViewStackParamList, 'TransactionDetails'>;
type RouteProps = RouteProp<DetailViewStackParamList, 'TransactionDetails'>;

const TransactionDetails = () => {
  const { navigate } = useExtendedNavigation<NavigationProps>();
  const { hash, walletID } = useRoute<RouteProps>().params;
  const { saveToDisk, txMetadata, wallets, getTransactions } = useStorage();
  const { selectedBlockExplorer } = useSettings();
  const [from, setFrom] = useState<string[]>([]);
  const [to, setTo] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tx, setTX] = useState<Transaction>();
  const [memo, setMemo] = useState<string>('');
  const { colors } = useTheme();
  const stylesHooks = StyleSheet.create({
    memoTextInput: {
      borderColor: colors.formBorder,
      borderBottomColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
    },
    greyButton: {
      backgroundColor: colors.lightButton,
    },
    Link: {
      color: colors.buttonTextColor,
    },
  });

  const saveTransactionDetails = useCallback(() => {
    if (tx) {
      txMetadata[tx.hash] = { memo };
      saveToDisk();
    }
  }, [tx, txMetadata, memo, saveToDisk]);

  usePreventRemove(false, () => {
    saveTransactionDetails();
  });

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        let foundTx: Transaction | false = false;
        let newFrom: string[] = [];
        let newTo: string[] = [];
        for (const transaction of getTransactions(undefined, Infinity, true)) {
          if (transaction.hash === hash) {
            foundTx = transaction;
            for (const input of foundTx.inputs) {
              newFrom = newFrom.concat(input?.addresses ?? []);
            }
            for (const output of foundTx.outputs) {
              if (output?.scriptPubKey?.addresses) newTo = newTo.concat(output.scriptPubKey.addresses);
            }
          }
        }

        assert(foundTx, 'Internal error: could not find transaction');

        const wallet = wallets.find(w => w.getID() === walletID);
        assert(wallet, 'Internal error: could not find wallet');

        setMemo(txMetadata[foundTx.hash]?.memo ?? '');
        setTX(foundTx);
        setFrom(newFrom);
        setTo(newTo);
        setIsLoading(false);
      });
      return () => {
        task.cancel();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hash, wallets]),
  );

  const handleMemoBlur = useCallback(() => {
    saveTransactionDetails();
  }, [saveTransactionDetails]);

  const handleOnOpenTransactionOnBlockExplorerTapped = () => {
    const url = `${selectedBlockExplorer.url}/tx/${tx?.hash}`;
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          Linking.openURL(url).catch(e => {
            console.log('openURL failed in handleOnOpenTransactionOnBlockExplorerTapped');
            console.log(e.message);
            triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
            presentAlert({ message: e.message });
          });
        } else {
          console.log('canOpenURL supported is false in handleOnOpenTransactionOnBlockExplorerTapped');
          triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
          presentAlert({ message: loc.transactions.open_url_error });
        }
      })
      .catch(e => {
        console.log('canOpenURL failed in handleOnOpenTransactionOnBlockExplorerTapped');
        console.log(e.message);
        triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
        presentAlert({ message: e.message });
      });
  };

  const handleCopyPress = (stringToCopy: string) => {
    Clipboard.setStringAsync(stringToCopy !== actionKeys.CopyToClipboard ? stringToCopy : `${selectedBlockExplorer.url}/tx/${tx?.hash}`);
  };

  if (isLoading || !tx) {
    return <Loading />;
  }

  const weOwnAddress = (address: string): TWallet | null => {
    for (const w of wallets) {
      if (w.weOwnAddress(address)) {
        return w;
      }
    }
    return null;
  };

  const navigateToWallet = (wallet: TWallet) => {
    navigate('WalletTransactions', {
      walletID: wallet.getID(),
      walletType: wallet.type,
    });
  };

  const onPressMenuItem = (key: string) => {
    if (key === actionKeys.CopyToClipboard) {
      handleCopyPress(key);
    } else if (key === actionKeys.GoToWallet) {
      const wallet = weOwnAddress(key);
      if (wallet) {
        navigateToWallet(wallet);
      }
    }
  };

  const renderSection = (array: any[]) => {
    const fromArray = [];

    for (const [index, address] of array.entries()) {
      const actions = [];
      actions.push({
        id: actionKeys.CopyToClipboard,
        text: loc.transactions.details_copy,
        icon: actionIcons.Clipboard,
      });
      const isWeOwnAddress = weOwnAddress(address);
      if (isWeOwnAddress) {
        actions.push({
          id: actionKeys.GoToWallet,
          text: loc.formatString(loc.transactions.view_wallet, { walletLabel: isWeOwnAddress.getLabel() }),
          icon: actionIcons.GoToWallet,
        });
      }

      fromArray.push(
        <ToolTipMenu key={address} isButton title={address} isMenuPrimaryAction actions={actions} onPressMenuItem={onPressMenuItem}>
          <ShroudText style={isWeOwnAddress ? [styles.rowValue, styles.weOwnAddress] : styles.rowValue}>
            {address}
            {index === array.length - 1 ? null : ','}
          </ShroudText>
        </ToolTipMenu>,
      );
    }

    return fromArray;
  };

  return (
    <SafeAreaScrollView>
      <ShroudCard>
        <View>
          <TextInput
            placeholder={loc.send.details_note_placeholder}
            value={memo}
            placeholderTextColor="#81868e"
            clearButtonMode="while-editing"
            style={[styles.memoTextInput, stylesHooks.memoTextInput]}
            onChangeText={setMemo}
            onBlur={handleMemoBlur}
            testID="TransactionDetailsMemoInput"
          />
        </View>

        {from && (
          <>
            <View style={styles.rowHeader}>
              <ShroudText style={styles.rowCaption}>{loc.transactions.details_from}</ShroudText>
              <CopyToClipboardButton stringToCopy={from.filter(onlyUnique).join(', ')} />
            </View>
            {renderSection(from.filter(onlyUnique))}
            <View style={styles.marginBottom18} />
          </>
        )}

        {to && (
          <>
            <View style={styles.rowHeader}>
              <ShroudText style={styles.rowCaption}>{loc.transactions.details_to}</ShroudText>
              <CopyToClipboardButton stringToCopy={to.filter(onlyUnique).join(', ')} />
            </View>
            {renderSection(arrDiff(from, to.filter(onlyUnique)))}
            <View style={styles.marginBottom18} />
          </>
        )}

        {tx.hash && (
          <>
            <View style={styles.rowHeader}>
              <ShroudText style={styles.txid}>{loc.transactions.txid}</ShroudText>
              <CopyToClipboardButton stringToCopy={tx.hash} />
            </View>
            <ShroudText style={styles.rowValue}>{tx.hash}</ShroudText>
            <View style={styles.marginBottom18} />
          </>
        )}

        {tx.timestamp && (
          <>
            <ShroudText style={styles.rowCaption}>{loc.transactions.details_received}</ShroudText>
            <ShroudText style={styles.rowValue}>{dayjs(tx.timestamp * 1000).format('LLL')}</ShroudText>
            <View style={styles.marginBottom18} />
          </>
        )}

        {tx.inputs && (
          <>
            <ShroudText style={styles.rowCaption}>{loc.transactions.details_inputs}</ShroudText>
            <ShroudText style={styles.rowValue}>{tx.inputs.length}</ShroudText>
            <View style={styles.marginBottom18} />
          </>
        )}

        {tx.outputs?.length > 0 && (
          <>
            <ShroudText style={styles.rowCaption}>{loc.transactions.details_outputs}</ShroudText>
            <ShroudText style={styles.rowValue}>{tx.outputs.length}</ShroudText>
            <View style={styles.marginBottom18} />
          </>
        )}
        <ToolTipMenu
          isButton
          actions={toolTipMenuActions}
          onPressMenuItem={handleCopyPress}
          onPress={handleOnOpenTransactionOnBlockExplorerTapped}
          buttonStyle={StyleSheet.flatten([styles.greyButton, stylesHooks.greyButton])}
        >
          <Text style={[styles.Link, stylesHooks.Link]}>{loc.transactions.details_view_in_browser}</Text>
        </ToolTipMenu>
      </ShroudCard>
    </SafeAreaScrollView>
  );
};

const styles = StyleSheet.create({
  rowHeader: {
    flex: 1,
    flexDirection: 'row',
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  rowCaption: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  rowValue: {
    color: 'grey',
  },
  marginBottom18: {
    marginBottom: 18,
  },
  txid: {
    fontSize: 16,
    fontWeight: '500',
  },
  Link: {
    fontWeight: '600',
    fontSize: 15,
  },
  weOwnAddress: {
    fontWeight: '700',
  },
  memoTextInput: {
    flexDirection: 'row',
    borderWidth: 1,
    borderBottomWidth: 0.5,
    minHeight: 44,
    height: 44,
    alignItems: 'center',
    marginVertical: 8,
    borderRadius: 4,
    paddingHorizontal: 8,
    color: '#81868e',
  },
  greyButton: {
    borderRadius: 9,
    minHeight: 49,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'auto',
    flexGrow: 1,
    marginHorizontal: 4,
  },
});

export default TransactionDetails;
