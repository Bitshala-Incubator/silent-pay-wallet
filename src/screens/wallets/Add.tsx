import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, LayoutAnimation, Platform, TextInput, useColorScheme, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useRoute } from '@react-navigation/native';

import triggerHapticFeedback, { HapticFeedbackTypes } from '../../modules/hapticFeedback';
import { ShroudButtonLink, ShroudFormLabel, ShroudText } from '../../components/ShroudComponents';
import presentAlert from '../../components/Alert';
import Button from '../../components/Button';
import HeaderMenuButton from '../../components/HeaderMenuButton';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';
import { Spacing20, Spacing40 } from '../../components/Spacing';
import { useTheme } from '../../components/themes';
import { Action } from '../../components/types';
import { useStorage } from '../../hooks/context/useStorage';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import loc from '../../loc';
import { AddWalletStackParamList } from '../../navigation/AddWalletStack';
import { CommonToolTipActions } from '../../typings/CommonToolTipActions';
import { HDSilentPaymentsWallet } from '../../class/wallets/hd-bip352-wallet';

type NavigationProps = NativeStackNavigationProp<AddWalletStackParamList, 'AddWallet'>;
type RouteProps = RouteProp<AddWalletStackParamList, 'AddWallet'>;

const WalletsAdd: React.FC = () => {
  const { colors } = useTheme();
  const colorScheme = useColorScheme();
  const { addWallet, saveToDisk } = useStorage();
  const { entropy: entropyHex, words } = useRoute<RouteProps>().params || {};
  const entropy = entropyHex ? Buffer.from(entropyHex, 'hex') : undefined;
  const { navigate, setOptions, setParams } = useExtendedNavigation<NavigationProps>();

  const [isLoading, setIsLoading] = useState(false);
  const [label, setLabel] = useState('');
  const stylesHook = {
    label: {
      borderColor: colors.formBorder,
      borderBottomColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
    },
    root: {
      backgroundColor: colors.elevated,
    },
    helperText: {
      color: colors.feeText,
    },
  };

  const entropyButtonText = useMemo(() => {
    if (!entropy) {
      return loc.wallets.add_entropy_provide;
    }

    return loc.formatString(loc.wallets.add_entropy_bytes, {
      bytes: entropy.length,
    });
  }, [entropy]);

  const confirmResetEntropy = useCallback(() => {
    if (entropy || words) {
      Alert.alert(
        loc.wallets.add_entropy_reset_title,
        loc.wallets.add_entropy_reset_message,
        [
          {
            text: loc._.cancel,
            style: 'cancel',
          },
          {
            text: loc._.ok,
            style: 'destructive',
            onPress: () => {
              setParams({ entropy: undefined, words: undefined });
            },
          },
        ],
        { cancelable: true },
      );
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setParams({ entropy: undefined, words: undefined });
    }
  }, [entropy, setParams, words]);

  const toolTipActions = useMemo<Action[]>(() => {
    return [
      {
        ...CommonToolTipActions.Entropy,
        text: entropyButtonText,
        subactions: [
          {
            id: '12_words',
            text: loc.wallets.add_wallet_seed_length_12,
            subtitle: loc.wallets.add_wallet_seed_length,
            menuState: words === 12,
          },
          {
            id: '24_words',
            text: loc.wallets.add_wallet_seed_length_24,
            subtitle: loc.wallets.add_wallet_seed_length,
            menuState: words === 24,
          },
          { ...CommonToolTipActions.ResetToDefault, hidden: !entropy },
        ],
      },
    ];
  }, [entropy, entropyButtonText, words]);

  const headerRight = useMemo(
    () => (
      <HeaderMenuButton
        onPressMenuItem={(id: string) => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          if (id === '12_words') {
            navigate('ProvideEntropy', { words: 12, entropy: entropy?.toString('hex') });
          } else if (id === '24_words') {
            navigate('ProvideEntropy', { words: 24, entropy: entropy?.toString('hex') });
          } else if (id === CommonToolTipActions.ResetToDefault.id) {
            confirmResetEntropy();
          }
        }}
        actions={toolTipActions}
      />
    ),
    [confirmResetEntropy, entropy, navigate, toolTipActions],
  );

  useEffect(() => {
    setOptions({
      headerRight: () => headerRight,
      statusBarStyle: Platform.select({ ios: 'light', default: colorScheme === 'dark' ? 'light' : 'dark' }),
    });
  }, [colorScheme, headerRight, setOptions]);

  const createWallet = async () => {
    setIsLoading(true);

    try {
      const wallet = new HDSilentPaymentsWallet();
      wallet.setLabel(label || loc.wallets.details_title);

      if (entropy) {
        await wallet.generateFromEntropy(entropy);
      } else {
        await wallet.generate();
      }

      addWallet(wallet);
      await saveToDisk();
      triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);

      navigate('PleaseBackup', {
        walletID: wallet.getID(),
      });
    } catch (error: any) {
      presentAlert({ message: error?.message || String(error) });
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaScrollView
      style={stylesHook.root}
      testID="ScrollView"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustContentInsets
      automaticallyAdjustsScrollIndicatorInsets
    >
      <Spacing20 />
      <ShroudFormLabel>{loc.wallets.add_wallet_name}</ShroudFormLabel>
      <View style={[styles.label, stylesHook.label]}>
        <TextInput
          testID="WalletNameInput"
          value={label}
          placeholderTextColor="#81868e"
          placeholder={loc.wallets.add_placeholder}
          onChangeText={setLabel}
          style={styles.textInputCommon}
          editable={!isLoading}
          underlineColorAndroid="transparent"
        />
      </View>
      <ShroudFormLabel>{loc.wallets.add_wallet_type}</ShroudFormLabel>
      <View style={styles.typeCard}>
        <ShroudText>{HDSilentPaymentsWallet.typeReadable}</ShroudText>
        <ShroudText style={stylesHook.helperText}>{loc.wallets.add_create}</ShroudText>
      </View>
      <View style={styles.advanced}>
        <Spacing20 />
        {!isLoading ? (
          <>
            <Button testID="Create" title={loc.wallets.add_create} onPress={createWallet} />
            <ShroudButtonLink
              testID="ImportWallet"
              style={styles.import}
              title={loc.wallets.add_import_wallet}
              onPress={() => navigate('ImportWallet')}
            />
            <Spacing40 />
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    </SafeAreaScrollView>
  );
};

const styles = {
  label: {
    flexDirection: 'row' as const,
    borderWidth: 1,
    borderBottomWidth: 0.5,
    minHeight: 44,
    height: 44,
    marginHorizontal: 20,
    alignItems: 'center' as const,
    marginVertical: 16,
    borderRadius: 4,
  },
  textInputCommon: {
    flex: 1,
    marginHorizontal: 8,
    color: '#81868e',
  },
  typeCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    gap: 4,
  },
  advanced: {
    marginHorizontal: 20,
  },
  import: {
    marginVertical: 24,
  },
};

export default WalletsAdd;
