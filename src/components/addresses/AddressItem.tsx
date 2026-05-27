import React, { useMemo, useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import { StyleSheet, Text, View } from 'react-native';
import { ListItem } from '@rneui/themed';
import Share from 'react-native-share';
import loc, { formatBalance } from '../../loc';
import { BitcoinUnit } from '../../models/bitcoinUnits';
import QRCodeComponent from '../QRCodeComponent';
import { useTheme } from '../themes';
import { AddressTypeBadge } from './AddressTypeBadge';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';
import ToolTipMenu from '../TooltipMenu';
import { CommonToolTipActions } from '../../typings/CommonToolTipActions';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import HighlightedText from '../HighlightedText';

interface AddressItemProps {
  item: any;
  balanceUnit: BitcoinUnit;
  walletID: string;
  onPress?: () => void;
  searchQuery?: string;
  renderHighlightedText?: (text: string, query: string) => JSX.Element;
}

type NavigationProps = NativeStackNavigationProp<DetailViewStackParamList>;

const AddressItem = ({ item, balanceUnit, walletID, onPress, searchQuery = '', renderHighlightedText }: AddressItemProps) => {
  const { colors } = useTheme();

  const hasTransactions = item.transactions > 0;

  const stylesHook = StyleSheet.create({
    container: {
      borderBottomColor: colors.lightBorder,
      backgroundColor: colors.elevated,
    },

    index: {
      color: colors.alternativeTextColor,
    },
    balance: {
      color: colors.alternativeTextColor,
    },
    address: {
      color: hasTransactions ? colors.darkGray : colors.buttonTextColor,
    },
  });

  const { navigate } = useExtendedNavigation<NavigationProps>();

  const navigateToReceive = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      navigate('ReceiveDetails', {
        walletID,
        address: item.address,
      });
    }
  }, [navigate, walletID, item.address, onPress]);

  const menuActions = useMemo(() => [CommonToolTipActions.CopyToClipboard, CommonToolTipActions.Share], []);

  const balance = formatBalance(item.balance, balanceUnit, true);

  const handleCopyPress = useCallback(() => {
    Clipboard.setStringAsync(item.address);
  }, [item.address]);

  const handleSharePress = useCallback(() => {
    Share.open({ message: item.address }).catch(error => console.log(error));
  }, [item.address]);


  const onToolTipPress = useCallback(
    (id: string) => {
      if (id === CommonToolTipActions.CopyToClipboard.id) {
        handleCopyPress();
      } else if (id === CommonToolTipActions.Share.id) {
        handleSharePress();
      }
    },
    [handleCopyPress, handleSharePress],
  );

  const renderPreview = useCallback(() => <QRCodeComponent value={item.address} isMenuAvailable={false} />, [item.address]);

  // Render address with highlighting if a search query is provided
  const renderAddressContent = () => {
    if (searchQuery && searchQuery.length > 0) {
      if (renderHighlightedText) {
        return renderHighlightedText(item.address, searchQuery);
      }
      return (
        <HighlightedText
          text={item.address}
          query={searchQuery}
          caseSensitive={false}
          highlightOnlyFirstMatch={searchQuery.length === 1}
          style={[stylesHook.address, styles.address]}
        />
      );
    }

    return (
      <Text style={[stylesHook.address, styles.address]} numberOfLines={1} ellipsizeMode="middle">
        {item.address}
      </Text>
    );
  };

  return (
    <ToolTipMenu
      title={item.address}
      actions={menuActions}
      onPressMenuItem={onToolTipPress}
      // Revisit once RNMenu has renderPreview prop
      renderPreview={renderPreview}
      onPress={navigateToReceive}
      isButton
    >
      <ListItem key={item.key} containerStyle={stylesHook.container}>
        <ListItem.Content>
          <View style={styles.row}>
            <View style={styles.leftSection}>
              <Text style={[styles.index, stylesHook.index]}>{item.index}</Text>
            </View>
            <View style={styles.middleSection}>
              {renderAddressContent()}
              <Text style={[stylesHook.balance, styles.balance]}>{balance}</Text>
            </View>
          </View>
        </ListItem.Content>
        <View style={styles.rightContainer}>
          <AddressTypeBadge isInternal={item.isInternal} hasTransactions={hasTransactions} />
          <Text style={[stylesHook.balance, styles.balance]}>
            {loc.addresses.transactions}: {item.transactions ?? 0}
          </Text>
        </View>
      </ListItem>
    </ToolTipMenu>
  );
};

const styles = StyleSheet.create({
  address: {
    fontWeight: 'bold',
    marginHorizontal: 4,
  },
  index: {
    fontSize: 15,
  },
  balance: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftSection: {
    marginRight: 8,
  },
  middleSection: {
    flex: 1,
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});

export { AddressItem };
