import React, { useCallback, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import WalletGradient from '../class/wallet-gradient';
import { TWallet } from '../class/wallets/types';
import loc, { formatBalance, formatBalanceWithoutSuffix } from '../loc';
import { BitcoinUnit } from '../models/bitcoinUnits';
import { FiatUnit } from '../models/fiatUnit';
import { BlurredBalanceView } from './BlurredBalanceView';
import { useSettings } from '../hooks/context/useSettings';
import ToolTipMenu from './TooltipMenu';
import useAnimateOnChange from '../hooks/useAnimateOnChange';

interface TransactionsNavigationHeaderProps {
  wallet: TWallet;
  unit: BitcoinUnit;
  onWalletUnitChange: (unit: BitcoinUnit) => void;
  onWalletBalanceVisibilityChange?: (isShouldBeVisible: boolean) => void;
}

const TransactionsNavigationHeader: React.FC<TransactionsNavigationHeaderProps> = ({
  wallet,
  onWalletUnitChange,
  onWalletBalanceVisibilityChange,
  unit = BitcoinUnit.BTC,
}) => {
  const { hideBalance } = wallet;
  const { preferredFiatCurrency } = useSettings();

  const handleCopyPress = useCallback(() => {
    const value = formatBalance(wallet.getBalance(), unit);
    if (value) {
      Clipboard.setStringAsync(value);
    }
  }, [unit, wallet]);

  const handleBalanceVisibility = useCallback(() => {
    onWalletBalanceVisibilityChange?.(!hideBalance);
  }, [onWalletBalanceVisibilityChange, hideBalance]);

  const changeWalletBalanceUnit = () => {
    let newWalletPreferredUnit = wallet.getPreferredBalanceUnit();

    if (newWalletPreferredUnit === BitcoinUnit.BTC) {
      newWalletPreferredUnit = BitcoinUnit.SATS;
    } else if (newWalletPreferredUnit === BitcoinUnit.SATS) {
      newWalletPreferredUnit = BitcoinUnit.LOCAL_CURRENCY;
    } else {
      newWalletPreferredUnit = BitcoinUnit.BTC;
    }

    onWalletUnitChange(newWalletPreferredUnit);
  };

  const onPressMenuItem = useCallback(
    (id: string) => {
      if (id === 'walletBalanceVisibility') {
        handleBalanceVisibility();
      } else if (id === 'copyToClipboard') {
        handleCopyPress();
      }
    },
    [handleBalanceVisibility, handleCopyPress],
  );

  const currentBalance = wallet ? wallet.getBalance() : 0;
  const formattedBalance = useMemo(() => {
    return unit === BitcoinUnit.LOCAL_CURRENCY
      ? formatBalance(currentBalance, unit, true)
      : formatBalanceWithoutSuffix(currentBalance, unit, true);
  }, [unit, currentBalance]);

  const balance = !wallet.hideBalance && formattedBalance;

  const toolTipWalletBalanceActions = useMemo(() => {
    return hideBalance
      ? [
          {
            id: 'walletBalanceVisibility',
            text: loc.transactions.details_balance_show,
            icon: {
              iconValue: 'eye',
            },
          },
        ]
      : [
          {
            id: 'walletBalanceVisibility',
            text: loc.transactions.details_balance_hide,
            icon: {
              iconValue: 'eye.slash',
            },
          },
          {
            id: 'copyToClipboard',
            text: loc.transactions.details_copy,
            icon: {
              iconValue: 'doc.on.doc',
            },
          },
        ];
  }, [hideBalance]);

  const imageSource = useMemo(() => {
    switch (wallet.type) {
      default:
        return require('../img/btc-shape.png');
    }
  }, [wallet.type]);

  useAnimateOnChange(balance);
  useAnimateOnChange(hideBalance);
  useAnimateOnChange(unit);
  useAnimateOnChange(wallet.getID?.());

  return (
    <LinearGradient
      colors={WalletGradient.gradientsFor(wallet.type)}
      style={styles.lineaderGradient}
      {...WalletGradient.linearGradientProps(wallet.type)}
    >
      <ImageBackground source={imageSource} style={styles.chainIcon} />

      <Text testID="WalletLabel" numberOfLines={1} style={styles.walletLabel}>
        {wallet.getLabel()}
      </Text>
      <View style={styles.walletBalanceAndUnitContainer}>
        <ToolTipMenu
          isMenuPrimaryAction
          isButton
          enableAndroidRipple={false}
          buttonStyle={styles.walletBalance}
          onPressMenuItem={onPressMenuItem}
          actions={toolTipWalletBalanceActions}
        >
          <View style={styles.walletBalance}>
            {hideBalance ? (
              <BlurredBalanceView />
            ) : (
              <View>
                <Text
                  key={String(balance)} // force component recreation on balance change. To fix right-to-left languages, like Farsis
                  testID="WalletBalance"
                  numberOfLines={1}
                  minimumFontScale={0.5}
                  adjustsFontSizeToFit
                  style={styles.walletBalanceText}
                >
                  {balance}
                </Text>
              </View>
            )}
          </View>
        </ToolTipMenu>
        <TouchableOpacity style={styles.walletPreferredUnitView} onPress={changeWalletBalanceUnit}>
          <Text style={styles.walletPreferredUnitText}>
            {unit === BitcoinUnit.LOCAL_CURRENCY ? (preferredFiatCurrency?.endPointKey ?? FiatUnit.USD) : unit}
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  lineaderGradient: {
    padding: 15,
    minHeight: 140,
    justifyContent: 'center',
  },
  chainIcon: {
    width: 99,
    height: 94,
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  walletLabel: {
    backgroundColor: 'transparent',
    fontSize: 19,
    color: '#fff',
    marginBottom: 10,
  },
  walletBalance: {
    flexShrink: 1,
    marginRight: 6,
  },
  walletBalanceAndUnitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10, // Ensure there's some padding to the right
  },
  walletBalanceText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 36,
    flexShrink: 1, // Allow the text to shrink if there's not enough space
  },
  walletPreferredUnitView: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
    minHeight: 35,
    minWidth: 65,
  },
  walletPreferredUnitText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export const actionKeys = {
  CopyToClipboard: 'copyToClipboard',
  WalletBalanceVisibility: 'walletBalanceVisibility',
};

export const actionIcons = {
  Eye: {
    iconValue: 'eye',
  },
  EyeSlash: {
    iconValue: 'eye.slash',
  },
  Clipboard: {
    iconValue: 'doc.on.doc',
  },
};

export default TransactionsNavigationHeader;
