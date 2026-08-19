import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { TOptions } from 'bip21';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, LayoutAnimation, ScrollView, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { SilentPayment } from 'silent-payments';
import SplitIcon from '../../components/icons/SplitIcon';
import InfoIcon from '../../components/icons/InfoIcon';
import { ClashFont } from '../../constants/fonts';
import { btcToSatoshi, satoshiToBTC, satoshiToLocalCurrency } from '../../modules/currency';
import { canSplitPayment } from '../../helpers/silent-payments';
import triggerHapticFeedback, { HapticFeedbackTypes, triggerSelectionHapticFeedback } from '../../modules/hapticFeedback';
import DeeplinkSchemaMatch from '../../class/deeplink-schema-match';
import { HDSilentPaymentsWallet } from '../../class/wallets/hd-bip352-wallet';
import { CreateTransactionTarget, CreateTransactionUtxo, TWallet } from '../../class/wallets/types';
import presentAlert from '../../components/Alert';
import AmountHero from '../../components/AmountHero';
import Button from '../../components/Button';
import CoinsSelected from '../../components/CoinsSelected';
import { DismissKeyboardInputAccessory } from '../../components/DismissKeyboardInputAccessory';
import HeaderMenuButton from '../../components/HeaderMenuButton';
import ChevronRightIcon from '../../components/icons/ChevronRightIcon';
import ScanQRIcon from '../../components/icons/ScanQRIcon';
import LabeledField from '../../components/LabeledField';
import SafeArea from '../../components/SafeArea';
import { useTheme } from '../../components/themes';
import { Action } from '../../components/types';
import { isAmountEmpty, sanitizeAmountInput, displayAmountForUnit, feeSpeedTierForRate } from '../../helpers/send/format';
import { useStorage } from '../../hooks/context/useStorage';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import { useKeyboard } from '../../hooks/useKeyboard';
import loc, { formatBalance } from '../../loc';
import { BitcoinUnit, Chain } from '../../models/bitcoinUnits';
import NetworkTransactionFees, { NetworkTransactionFee, NetworkTransactionFeeType } from '../../models/networkTransactionFees';
import { SendDetailsStackParamList } from '../../navigation/SendDetailsStackParamList';
import { CommonToolTipActions, ToolTipAction } from '../../typings/CommonToolTipActions';
import ActionSheet from '../ActionSheet';

interface IPaymentDestinations {
  address: string; // btc address or payment code
  amountSats?: number | string;
  amount?: string | number | 'MAX';
  key: string; // random id to look up this record
  unit: BitcoinUnit;
}

export interface IFee {
  current: number | null;
  slowFee: number | null;
  mediumFee: number | null;
  fastestFee: number | null;
}
type NavigationProps = NativeStackNavigationProp<SendDetailsStackParamList, 'SendDetails'>;
type RouteProps = RouteProp<SendDetailsStackParamList, 'SendDetails'>;

const SendDetails = () => {
  const { wallets, sleep, txMetadata, saveToDisk } = useStorage();
  const navigation = useExtendedNavigation<NavigationProps>();
  const selectedDataProcessor = useRef<ToolTipAction | undefined>();
  const setParams = navigation.setParams;
  const route = useRoute<RouteProps>();
  const feeUnit = route.params?.feeUnit ?? BitcoinUnit.BTC;
  const amountUnit = route.params?.amountUnit ?? BitcoinUnit.BTC;
  const frozenBalance = route.params?.frozenBalance ?? 0;
  const transactionMemo = route.params?.transactionMemo;
  const utxos = route.params?.utxos;
  const isTransactionReplaceable = route.params?.isTransactionReplaceable;
  const routeParams = route.params;
  const { colors } = useTheme();

  // state
  const [isLoading, setIsLoading] = useState(false);
  const [wallet, setWallet] = useState<TWallet | null>(null);
  const { isVisible } = useKeyboard();
  const [addresses, setAddresses] = useState<IPaymentDestinations[]>([{ address: '', key: String(Math.random()), unit: amountUnit }]);
  const [networkTransactionFees, setNetworkTransactionFees] = useState(new NetworkTransactionFee(3, 2, 1));
  const [networkTransactionFeesIsLoading, setNetworkTransactionFeesIsLoading] = useState(false);
  const [customFee, setCustomFee] = useState<string | null>(null);
  const [selectedPresetFeeRate, setSelectedPresetFeeRate] = useState<string | null>(null);
  const [feePrecalc, setFeePrecalc] = useState<IFee>({ current: null, slowFee: null, mediumFee: null, fastestFee: null });
  const [changeAddress, setChangeAddress] = useState<string | null>(null);
  const [dumb, setDumb] = useState(false);
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  // Splitting change is opt-out: it's the privacy-preserving default, but it leaves the wallet with
  // more (smaller) UTXOs to spend later, so the sender gets to decline.
  const [isChangeSplitEnabled, setIsChangeSplitEnabled] = useState(true);
  const [splitPreview, setSplitPreview] = useState<{ paymentAmounts: number[]; changeCount: number; fee: number; feeDelta: number } | null>(
    null,
  );
  // The toggle's eligibility gate only knows the amount; the builder also needs a change budget it
  // can pay the extra outputs from. When it declines, say so here instead of silently sending one
  // output after showing the user a split card.
  const [splitDeclined, setSplitDeclined] = useState(false);
  const [displayUnit, setDisplayUnit] = useState<BitcoinUnit>(BitcoinUnit.BTC);
  const { isEditable } = routeParams;
  // if utxo is limited we use it to calculate available balance
  const balance: number = utxos ? utxos.reduce((prev, curr) => prev + curr.value, 0) : (wallet?.getBalance() ?? 0);
  // single-recipient helpers
  const recipient = addresses[0];
  const isMaxActive = recipient?.amount === BitcoinUnit.MAX;
  const displayAmount = isMaxActive
    ? displayAmountForUnit(String(satoshiToBTC(balance)), balance, displayUnit)
    : displayAmountForUnit(recipient?.amount ? String(recipient.amount) : '', Number(recipient?.amountSats), displayUnit);
  // when sending max, amountSats holds the 'MAX' sentinel, so derive the fiat estimate from the full balance
  const amountSatsNum = isMaxActive ? balance : Number(recipient?.amountSats) || 0;
  const fiatEstimate = `≈ ${satoshiToLocalCurrency(amountSatsNum)}`;
  const isFormValid = !!recipient?.address && amountSatsNum > 0;
  const hasFeeEstimate = !!feePrecalc.current && amountSatsNum > 0;

  const onChangeAmount = useCallback(
    (text: string) => {
      const sanitized = sanitizeAmountInput(text, displayUnit);
      setAddresses(addrs => {
        const a = { ...addrs[0] };
        if (displayUnit === BitcoinUnit.SATS) {
          const sats = sanitized === '' ? 0 : Number(sanitized);
          a.amountSats = sats;
          a.amount = sanitized === '' ? '' : satoshiToBTC(sats);
        } else {
          a.amount = sanitized;
          a.amountSats = btcToSatoshi(sanitized);
        }
        // canonical storage is always BTC; displayUnit is a view concern only
        a.unit = BitcoinUnit.BTC;
        return [a, ...addrs.slice(1)];
      });
    },
    [displayUnit],
  );

  const onToggleUnit = useCallback(() => {
    triggerSelectionHapticFeedback();
    setDisplayUnit(u => (u === BitcoinUnit.SATS ? BitcoinUnit.BTC : BitcoinUnit.SATS));
  }, []);

  const onChangeAddress = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      const looksLikeUri = trimmed.includes(':') || trimmed.includes('?');
      if (looksLikeUri) {
        const { address, amount, memo } = DeeplinkSchemaMatch.decodeBitcoinUri(trimmed);
        setAddresses(addrs => {
          const a = { ...addrs[0] };
          a.address = address || trimmed;
          if (amount) {
            a.amount = String(amount);
            a.amountSats = btcToSatoshi(String(amount));
          }
          return [a, ...addrs.slice(1)];
        });
        if (memo) setParams({ transactionMemo: memo });
      } else {
        setAddresses(addrs => {
          const a = { ...addrs[0] };
          a.address = trimmed;
          return [a, ...addrs.slice(1)];
        });
      }
      setIsLoading(false);
    },
    [setParams],
  );

  // if cutomFee is not set, we need to choose highest possible fee for wallet balance
  // if there are no funds for even Slow option, use 1 sat/vbyte fee
  const feeRate = useMemo(() => {
    console.log('SendDetails: feeRate useMemo - customFee:', customFee);
    console.log('SendDetails: feeRate useMemo - selectedPresetFeeRate:', selectedPresetFeeRate);
    console.log('SendDetails: feeRate useMemo - feePrecalc:', feePrecalc);
    console.log('SendDetails: feeRate useMemo - networkTransactionFees:', networkTransactionFees);

    if (customFee) {
      console.log('SendDetails: Using customFee:', customFee);
      return customFee;
    }

    if (selectedPresetFeeRate) {
      console.log('SendDetails: Using selectedPresetFeeRate:', selectedPresetFeeRate);
      return selectedPresetFeeRate;
    }

    // If we have precalculated fees, use them to determine the default fee
    if (feePrecalc.slowFee !== null) {
      let initialFee;
      if (feePrecalc.fastestFee !== null) {
        initialFee = String(networkTransactionFees.fastestFee);
        console.log('SendDetails: Using fastestFee:', initialFee);
      } else if (feePrecalc.mediumFee !== null) {
        initialFee = String(networkTransactionFees.mediumFee);
        console.log('SendDetails: Using mediumFee:', initialFee);
      } else {
        initialFee = String(networkTransactionFees.slowFee);
        console.log('SendDetails: Using slowFee:', initialFee);
      }
      console.log('SendDetails: Final feeRate:', initialFee);
      return initialFee;
    }

    // If no precalc fees yet, default to fastestFee from network fees
    const defaultFee = String(networkTransactionFees.fastestFee);
    console.log('SendDetails: No precalc fees yet, using default networkTransactionFees.fastestFee:', defaultFee);
    return defaultFee;
  }, [customFee, selectedPresetFeeRate, feePrecalc, networkTransactionFees]);

  const isSPAddress = SilentPayment.isPaymentCodeValid(recipient?.address ?? '');
  const isSplitEligible = isSPAddress && !isMaxActive && amountSatsNum > 0 && canSplitPayment(amountSatsNum, Number(feeRate) || 1);
  // Reset split when the recipient no longer qualifies (amount dropped, address changed to non-SP, fee rate rose, etc.)
  useEffect(() => {
    if (!isSplitEligible) setIsSplitEnabled(false);
  }, [isSplitEligible]);

  // Debounced dry run of the real builder: replaces three independent estimates
  // (partitionPaymentAmounts preview, estimateSplitExtraFee, the canSplitPayment gate) with one
  // call to the actual coinselect+split path, so the preview can never disagree with the signed
  // tx. Both calls are side-effect-free (dryRun skips the SP-UTXO pending-input reservation).
  useEffect(() => {
    if (!(isSplitEnabled && isSplitEligible && wallet && amountSatsNum > 0 && recipient?.address)) {
      setSplitPreview(null);
      setSplitDeclined(false);
      return;
    }

    // Drop the previous result up front, not just on completion: during the debounce window it
    // is stale, and createPsbtTransaction() would still pin the signed tx to it. Changing only
    // the fee rate keeps the amount (so the pin's sum check still passes) while shrinking the
    // change — enough to push the plan below the change budget.
    setSplitPreview(null);
    setSplitDeclined(false);

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const change = await getChangeAddressAsync();
        if (!change || cancelled) return;

        const feeR = Number(feeRate) || 1;
        const lutxo = (utxos || wallet.getUtxo()) as CreateTransactionUtxo[];
        const targets: CreateTransactionTarget[] = [{ address: recipient.address, value: amountSatsNum }];
        const sequence = isTransactionReplaceable ? HDSilentPaymentsWallet.defaultRBFSequence : HDSilentPaymentsWallet.finalRBFSequence;
        const spWallet = wallet as HDSilentPaymentsWallet;

        const baseline = spWallet.createTransaction(lutxo, targets, feeR, change, sequence, true, 0, { enabled: false, dryRun: true });
        const split = spWallet.createTransaction(lutxo, targets, feeR, change, sequence, true, 0, {
          enabled: true,
          splitChange: isChangeSplitEnabled,
          dryRun: true,
        });
        if (cancelled) return;

        const changeAddresses = split.changeAddresses ?? [change];
        const changeSet = new Set(changeAddresses);
        const paymentAmounts = split.outputs.filter(o => o.address && !changeSet.has(o.address)).map(o => o.value);

        if (paymentAmounts.length < 2) {
          // Subsumes the eligibility gate: the builder declined to split this payment (below
          // the floor, fee cap, no change budget), so don't show a preview it won't honor.
          setSplitPreview(null);
          setSplitDeclined(true);
          return;
        }

        setSplitPreview({ paymentAmounts, changeCount: changeAddresses.length, fee: split.fee, feeDelta: split.fee - baseline.fee });
      } catch (e) {
        // coinselect throws "Not enough balance..." at the margins; treat as "no preview"
        if (!cancelled) {
          setSplitPreview(null);
          setSplitDeclined(true);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSplitEnabled,
    isChangeSplitEnabled,
    isSplitEligible,
    wallet,
    amountSatsNum,
    feeRate,
    recipient?.address,
    utxos,
    isTransactionReplaceable,
  ]);

  // Ordinals ("Output 1"/"Output 2") don't match `shuffleOutputs`, which is correct and stays —
  // display-order only, sorted by value; the on-chain output order is never touched.
  const previewOutputs: Array<{ sats: number }> = (splitPreview?.paymentAmounts ?? [])
    .slice()
    .sort((a, b) => b - a)
    .map(sats => ({ sats }));

  useEffect(() => {
    // decode route params
    const currentAddress = addresses[0];
    if (routeParams.uri) {
      try {
        const { address, amount, memo } = DeeplinkSchemaMatch.decodeBitcoinUri(routeParams.uri);

        setAddresses(addrs => {
          addrs[0].unit = BitcoinUnit.BTC;
          return [...addrs];
        });

        setAddresses(addrs => {
          if (currentAddress) {
            currentAddress.address = address;
            if (Number(amount) > 0) {
              currentAddress.amount = amount!;
              currentAddress.amountSats = btcToSatoshi(amount!);
            }
            addrs[0] = currentAddress;
            return [...addrs];
          } else {
            return [...addrs, { address, amount, amountSats: btcToSatoshi(amount!), key: String(Math.random()), unit: amountUnit }];
          }
        });

        if (memo?.trim().length > 0) {
          setParams({ transactionMemo: memo });
        }
        setParams({ amountUnit: BitcoinUnit.BTC });
      } catch (error) {
        console.log(error);
        triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
        presentAlert({ title: loc.errors.error, message: loc.send.details_error_decode });
      }
    } else if (routeParams.address) {
      // screen was called with `address` parameter, so we just prefill it
      setAddresses(prevAddresses => {
        const updatedAddresses = [...prevAddresses];
        updatedAddresses[0] = {
          ...updatedAddresses[0],
          address: routeParams.address!,
          amount: 0,
          amountSats: 0,
        };
        return updatedAddresses;
      });
    } else if (routeParams.addRecipientParams) {
      // used to add a recipient, mainly from contacts aka paymentcodes screen
      const { address, amount } = routeParams.addRecipientParams;

      setAddresses(prevAddresses => {
        const updatedAddresses = [...prevAddresses];
        if (address) {
          updatedAddresses[0] = {
            ...updatedAddresses[0],
            address,
            amount: amount ?? updatedAddresses[0].amount,
            amountSats: amount ? btcToSatoshi(amount) : updatedAddresses[0].amountSats,
          };
        }
        return updatedAddresses;
      });

      // @ts-ignore: Fix later
      setParams(prevParams => ({ ...prevParams, addRecipientParams: undefined }));
    } else {
      setAddresses([{ address: '', key: String(Math.random()), unit: amountUnit }]);
    }
    // this effect only to run once when screen is mounted or params change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.uri, routeParams.address, routeParams.addRecipientParams]);

  useEffect(() => {
    // check if we have a suitable wallet
    const suitable = wallets.filter(w => w.chain === Chain.ONCHAIN && w.allowSend());
    if (suitable.length === 0) {
      triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
      presentAlert({ title: loc.errors.error, message: loc.send.details_wallet_before_tx });
      navigation.goBack();
      return;
    }
    const newWallet = (routeParams.walletID && wallets.find(w => w.getID() === routeParams.walletID)) || suitable[0];
    setWallet(newWallet);
    setParams({ feeUnit: newWallet.getPreferredBalanceUnit(), amountUnit: newWallet.getPreferredBalanceUnit() });

    // we are ready!
    setIsLoading(false);

    // load cached fees
    AsyncStorage.getItem(NetworkTransactionFee.StorageKey)
      .then(res => {
        if (!res) return;
        const fees = JSON.parse(res);
        if (!fees?.fastestFee) return;
        setNetworkTransactionFees(fees);
      })
      .catch(e => console.log('loading cached recommendedFees error', e));

    // load fresh fees from servers

    setNetworkTransactionFeesIsLoading(true);
    NetworkTransactionFees.recommendedFees()
      .then(async fees => {
        if (!fees?.fastestFee) return;
        setNetworkTransactionFees(fees);
        await AsyncStorage.setItem(NetworkTransactionFee.StorageKey, JSON.stringify(fees));
      })
      .catch(e => console.log('loading recommendedFees error', e))
      .finally(() => {
        setNetworkTransactionFeesIsLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // change header and reset state on wallet change
  useEffect(() => {
    if (!wallet) return;

    // reset other values
    setChangeAddress(null);
    setParams({
      utxos: null,
      isTransactionReplaceable: wallet.type === HDSilentPaymentsWallet.type && !routeParams.isTransactionReplaceable ? true : undefined,
    });
    // update wallet UTXO
    wallet
      .fetchUtxo()
      .then(() => {
        // we need to re-calculate fees
        setDumb(v => !v);
      })
      .catch(e => console.log('fetchUtxo error', e));
  }, [wallet]); // eslint-disable-line react-hooks/exhaustive-deps

  // recalc fees in effect so we don't block render
  useEffect(() => {
    if (!wallet) return; // wait for it
    const fees = networkTransactionFees;
    const requestedSatPerByte = Number(feeRate);
    const lutxo = (utxos || wallet.getUtxo()) as CreateTransactionUtxo[];
    let frozen = 0;
    if (!utxos) {
      // if utxo is not limited search for frozen outputs and calc it's balance
      frozen = wallet
        .getUtxo(true)
        .filter(o => !lutxo.some(i => i.txid === o.txid && i.vout === o.vout))
        .reduce((prev, curr) => prev + curr.value, 0);
    }

    const options = [
      { key: 'current', fee: requestedSatPerByte },
      { key: 'slowFee', fee: fees.slowFee },
      { key: 'mediumFee', fee: fees.mediumFee },
      { key: 'fastestFee', fee: fees.fastestFee },
    ] as const;

    const newFeePrecalc: /* Record<string, any> */ IFee = { ...feePrecalc };

    let targets = [];
    for (const transaction of addresses) {
      if (transaction.amount === BitcoinUnit.MAX) {
        // single output with MAX
        targets = [{ address: transaction.address }];
        break;
      }
      const value = transaction.amountSats;
      if (Number(value) > 0) {
        targets.push({ address: transaction.address, value });
      } else if (transaction.amount) {
        if (btcToSatoshi(transaction.amount) > 0) {
          targets.push({ address: transaction.address, value: btcToSatoshi(transaction.amount) });
        }
      }
    }

    // if targets is empty, insert dust
    if (targets.length === 0) {
      targets.push({ address: '36JxaUrpDzkEerkTf1FzwHNE1Hb7cCjgJV', value: 546 });
    }

    // replace wrong addresses with dump
    targets = targets.map(t => {
      if (!wallet.isAddressValid(t.address)) {
        return { ...t, address: '36JxaUrpDzkEerkTf1FzwHNE1Hb7cCjgJV' };
      } else {
        return t;
      }
    });

    for (const opt of options) {
      let flag = false;
      while (true) {
        try {
          const { fee } = wallet.coinselect(lutxo, targets, opt.fee);
          newFeePrecalc[opt.key] = fee;
          break;
        } catch (e: any) {
          if (e.message.includes('Not enough') && !flag) {
            flag = true;
            targets = targets.map((t, index) => (index > 0 ? { ...t, value: 546 } : { address: t.address }));
            continue;
          }
          newFeePrecalc[opt.key] = null;
          break;
        }
      }
    }

    setFeePrecalc(newFeePrecalc);
    setParams({ frozenBalance: frozen });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, networkTransactionFees, utxos, addresses, feeRate, dumb]);

  // we need to re-calculate fees if user opens-closes coin control
  useFocusEffect(
    useCallback(() => {
      setIsLoading(false);
      setDumb(v => !v);
      return () => {};
    }, []),
  );

  const getChangeAddressAsync = async () => {
    if (changeAddress) return changeAddress; // cache

    let change;
    // call widely-used getChangeAddressAsync()
    try {
      change = await Promise.race([sleep(2000), wallet?.getChangeAddressAsync()]);
    } catch (_) {}

    if (!change) {
      // either sleep expired or getChangeAddressAsync threw an exception
      change = wallet!._getInternalAddressByIndex(wallet!.getNextFreeChangeAddressIndex());
    }

    if (change) setChangeAddress(change); // cache

    return change;
  };
  /**
   * TODO: refactor this mess, get rid of regexp, use https://github.com/bitcoinjs/bitcoinjs-lib/issues/890 etc etc
   *
   * @param data {String} Can be address or `bitcoin:xxxxxxx` uri scheme, or invalid garbage
   */

  const processAddressData = useCallback(
    (data: string | { data?: any }) => {
      assert(wallet, 'Internal error: wallet not set');
      if (typeof data !== 'string') {
        data = String(data.data);
      }
      setIsLoading(true);
      if (!data.replace) {
        // user probably scanned PSBT and got an object instead of string..?
        setIsLoading(false);
        triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
        return presentAlert({ title: loc.errors.error, message: loc.send.details_address_field_is_not_valid });
      }

      const dataWithoutSchema = data.replace('bitcoin:', '').replace('BITCOIN:', '');
      if (wallet.isAddressValid(dataWithoutSchema) || SilentPayment.isPaymentCodeValid(dataWithoutSchema)) {
        setAddresses(addrs => {
          addrs[0].address = dataWithoutSchema;
          return [...addrs];
        });
        setIsLoading(false);
        return;
      }

      let address = '';
      let options: TOptions;
      try {
        if (!data.toLowerCase().startsWith('bitcoin:')) data = `bitcoin:${data}`;
        const decoded = DeeplinkSchemaMatch.bip21decode(data);
        address = decoded.address;
        options = decoded.options;
      } catch (error) {
        data = data.replace(/(amount)=([^&]+)/g, '').replace(/(amount)=([^&]+)&/g, '');
        const decoded = DeeplinkSchemaMatch.bip21decode(data);
        decoded.options.amount = 0;
        address = decoded.address;
        options = decoded.options;
      }

      console.log('options', options);
      if (wallet.isAddressValid(address)) {
        setAddresses(addrs => {
          addrs[0].address = address;
          addrs[0].amount = options?.amount ?? 0;
          addrs[0].amountSats = new BigNumber(options?.amount ?? 0).multipliedBy(100000000).toNumber();
          return [...addrs];
        });
        setAddresses(addrs => {
          addrs[0].unit = BitcoinUnit.BTC;
          return [...addrs];
        });
        setParams({ transactionMemo: options.label || '', amountUnit: BitcoinUnit.BTC }); // there used to be `options.message` here as well. bug?
      }

      setIsLoading(false);
    },
    [setParams, wallet],
  );

  const createTransaction = async () => {
    assert(wallet, 'Internal error: wallet is not set');
    Keyboard.dismiss();
    setIsLoading(true);
    const requestedSatPerByte = feeRate;
    for (const transaction of addresses) {
      let error;
      if (!transaction.amount || Number(transaction.amount) < 0 || parseFloat(String(transaction.amount)) === 0) {
        error = loc.send.details_amount_field_is_not_valid;
        console.log('validation error');
      } else if (parseFloat(String(transaction.amountSats)) <= 500) {
        error = loc.send.details_amount_field_is_less_than_minimum_amount_sat;
        console.log('validation error');
      } else if (!requestedSatPerByte || parseFloat(requestedSatPerByte) < 0) {
        error = loc.send.details_fee_field_is_not_valid;
        console.log('validation error');
      } else if (!transaction.address) {
        error = loc.send.details_address_field_is_not_valid;
        console.log('validation error');
      } else if (balance - Number(transaction.amountSats) < 0) {
        // first sanity check is that sending amount is not bigger than available balance
        error = frozenBalance > 0 ? loc.send.details_total_exceeds_balance_frozen : loc.send.details_total_exceeds_balance;
        console.log('validation error');
      } else if (transaction.address) {
        // address validation handled below
      }

      if (!error) {
        const isSilentPayment = SilentPayment.isPaymentCodeValid(transaction.address);
        if (!wallet.isAddressValid(transaction.address) && !isSilentPayment) {
          console.log('validation error');
          error = loc.send.details_address_field_is_not_valid;
        } else if (isSilentPayment && !wallet.allowSilentPaymentSend()) {
          console.log('validation error');
          error = loc.send.cant_send_to_silentpayment_adress;
        }
      }

      if (error) {
        setIsLoading(false);
        presentAlert({ message: error });
        triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
        return;
      }
    }

    try {
      await createPsbtTransaction();
    } catch (Err: any) {
      setIsLoading(false);
      presentAlert({ title: loc.errors.error, message: Err.message });
      triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
    }
  };
  const navigateToQRCodeScanner = useCallback(() => {
    navigation.navigate('ScanQRCode', {
      showFileImportButton: true,
    });
  }, [navigation]);

  const createPsbtTransaction = async () => {
    if (!wallet) return;

    const requestedSatPerByte = Number(feeRate);
    const lutxo: CreateTransactionUtxo[] = (utxos || (wallet?.getUtxo() ?? [])) as CreateTransactionUtxo[];
    console.log({ requestedSatPerByte, lutxo: lutxo.length });

    let change: string | undefined = await getChangeAddressAsync();

    // An SP wallet sends change to its label-0 silent payment address, but only when the
    // silent payment builder will actually run — the regular builder can't encode an sp1
    // change output. The wallet owns that decision so this screen and the builder agree.
    if (wallet.type === HDSilentPaymentsWallet.type) {
      change = (wallet as HDSilentPaymentsWallet).getChangeAddressForUtxos(lutxo, change);
    }

    assert(change, 'Could not get change address');

    const targets: CreateTransactionTarget[] = [];
    for (const transaction of addresses) {
      if (transaction.amount === BitcoinUnit.MAX) {
        // output with MAX
        targets.push({ address: transaction.address });
        continue;
      }
      const value = parseInt(String(transaction.amountSats), 10);
      if (value > 0) {
        targets.push({ address: transaction.address, value });
      } else if (transaction.amount) {
        if (btcToSatoshi(transaction.amount) > 0) {
          targets.push({ address: transaction.address, value: btcToSatoshi(transaction.amount) });
        }
      }
    }

    // without forcing `HDSegwitBech32Wallet` i had a weird ts error, complaining about last argument (fp)
    const { tx, outputs, psbt, fee, changeAddresses } = (wallet as HDSilentPaymentsWallet)?.createTransaction(
      lutxo,
      targets,
      requestedSatPerByte,
      change,
      isTransactionReplaceable ? HDSilentPaymentsWallet.defaultRBFSequence : HDSilentPaymentsWallet.finalRBFSequence,
      false,
      0,
      {
        enabled: isSplitEnabled,
        splitChange: isChangeSplitEnabled,
        // Pin the actual signed tx to what the dry-run preview showed the user — otherwise a
        // different economicFloor draw at send time could flip the split count and silently
        // re-randomize the amounts the user already approved.
        precalculatedPaymentAmounts: splitPreview && splitPreview.paymentAmounts.length > 0 ? splitPreview.paymentAmounts : undefined,
      },
    );

    if (tx && routeParams.launchedBy && psbt) {
      console.warn('navigating back to ', routeParams.launchedBy);

      // @ts-ignore idk how to fix FIXME?

      navigation.navigate(routeParams.launchedBy, { psbt });
    }

    assert(tx, 'createTRansaction failed');

    txMetadata[tx.getId()] = {
      memo: transactionMemo,
    };
    await saveToDisk();

    const changeSet = new Set([...(changeAddresses ?? []), change]);
    let recipients = outputs.filter(({ address }) => !!address && !changeSet.has(address));

    if (recipients.length === 0) {
      // special case. maybe the only destination in this transaction is our own change address..?
      // (ez can be the case for single-address wallet when doing self-payment for consolidation)
      recipients = outputs;
    }

    navigation.navigate('Confirm', {
      fee: new BigNumber(fee).dividedBy(100000000).toNumber(),
      memo: transactionMemo,
      walletID: wallet.getID(),
      tx: tx.toHex(),
      recipients,
      satoshiPerByte: requestedSatPerByte,
      splitOutputCount: isSplitEnabled && recipients.length > 1 ? recipients.length : undefined,
      spRecipientAddress: isSplitEnabled && recipients.length > 1 ? addresses[0].address : undefined,
    });
    setIsLoading(false);
  };

  useEffect(() => {
    const newWallet = wallets.find(w => w.getID() === routeParams.walletID);
    if (newWallet) {
      setWallet(newWallet);
    }
  }, [routeParams.walletID, wallets]);

  const setTransactionMemo = (memo: string) => {
    setParams({ transactionMemo: memo });
  };

  useEffect(() => {
    const data = routeParams.onBarScanned;
    if (data) {
      processAddressData(data);
    }
    selectedDataProcessor.current = undefined;
    setParams({ onBarScanned: undefined });
  }, [routeParams.onBarScanned, setParams, processAddressData]);

  const handleCoinControl = useCallback(() => {
    if (!wallet) return;
    navigation.navigate('CoinControl', {
      walletID: wallet?.getID(),
    });
  }, [navigation, wallet]);

  const onReplaceableFeeSwitchValueChanged = useCallback(
    (value: boolean) => {
      setParams({ isTransactionReplaceable: value });
    },
    [setParams],
  );

  const onUseAllPressed = useCallback(() => {
    // toggle off if we're already sending max
    if (recipient?.amount === BitcoinUnit.MAX) {
      setAddresses(addrs => {
        const a = { ...addrs[0], amount: '', amountSats: 0, unit: BitcoinUnit.BTC };
        return [a, ...addrs.slice(1)];
      });
      return;
    }

    const applyMax = () => {
      Keyboard.dismiss();
      setAddresses(addrs => {
        const a = { ...addrs[0], amount: BitcoinUnit.MAX, amountSats: BitcoinUnit.MAX, unit: BitcoinUnit.BTC };
        return [a, ...addrs.slice(1)];
      });
    };

    // keep a confirmation only when frozen coins are present, otherwise apply max instantly
    if (frozenBalance > 0) {
      triggerHapticFeedback(HapticFeedbackTypes.NotificationWarning);
      ActionSheet.showActionSheetWithOptions(
        {
          title: loc.send.details_adv_full,
          message: loc.send.details_adv_full_sure_frozen,
          options: [loc._.cancel, loc._.ok],
          cancelButtonIndex: 0,
        },
        buttonIndex => {
          if (buttonIndex === 1) applyMax();
        },
      );
      return;
    }

    applyMax();
  }, [recipient?.amount, frozenBalance]);
  // Header Right Button

  const headerRightOnPress = useCallback(
    (id: string) => {
      Keyboard.dismiss();
      if (id === CommonToolTipActions.SignPSBT.id) {
        selectedDataProcessor.current = CommonToolTipActions.SignPSBT;
        navigateToQRCodeScanner();
      } else if (id === CommonToolTipActions.SendMax.id) {
        onUseAllPressed();
      } else if (id === CommonToolTipActions.AllowRBF.id) {
        onReplaceableFeeSwitchValueChanged(!isTransactionReplaceable);
      } else if (id === CommonToolTipActions.CoinControl.id) {
        handleCoinControl();
      }
    },
    [navigateToQRCodeScanner, onUseAllPressed, onReplaceableFeeSwitchValueChanged, isTransactionReplaceable, handleCoinControl],
  );

  const headerRightActions = useCallback(() => {
    if (!wallet) return [];

    const walletActions: Action[][] = [];

    const isSendMaxUsed = addresses.some(element => element.amount === BitcoinUnit.MAX);
    const sendMaxAction: Action[] = [
      {
        ...CommonToolTipActions.SendMax,
        disabled: wallet.getBalance() === 0 || isSendMaxUsed,
        hidden: !isEditable || !(Number(wallet.getBalance()) > 0),
      },
    ];
    walletActions.push(sendMaxAction);

    walletActions.push([CommonToolTipActions.CoinControl]);

    walletActions.push([CommonToolTipActions.SignPSBT]);

    return walletActions;
  }, [addresses, isEditable, wallet]);

  // TODO: update the design of this as well
  const HeaderRight = useCallback(
    () => <HeaderMenuButton disabled onPressMenuItem={headerRightOnPress} actions={headerRightActions()} />,
    [headerRightOnPress, headerRightActions],
  );

  const setHeaderRightOptions = useCallback(() => {
    navigation.setOptions({
      headerRight: HeaderRight,
    });
  }, [HeaderRight, navigation]);

  useEffect(() => {
    console.log('send/details - useEffect');
    if (wallet) {
      setHeaderRightOptions();
    }
  }, [colors, wallet, isTransactionReplaceable, balance, addresses, isEditable, isLoading, setHeaderRightOptions]);

  // Handle selectedFeeRate and selectedFeeType returned from SelectFeeScreen
  useEffect(() => {
    const selectedFeeRate = routeParams.selectedFeeRate;
    const selectedFeeType = routeParams.selectedFeeType;

    console.log('SendDetails: Fee selection useEffect triggered');
    console.log('SendDetails: selectedFeeRate:', selectedFeeRate);
    console.log('SendDetails: selectedFeeType:', selectedFeeType);
    console.log('SendDetails: current customFee:', customFee);
    console.log('SendDetails: current selectedPresetFeeRate:', selectedPresetFeeRate);
    console.log('SendDetails: networkTransactionFees:', networkTransactionFees);

    if (selectedFeeRate !== undefined || selectedFeeType !== undefined) {
      console.log('SendDetails: Processing fee selection...');

      if (selectedFeeType === NetworkTransactionFeeType.CUSTOM) {
        console.log('SendDetails: CUSTOM fee selected, setting customFee to:', selectedFeeRate);
        // Custom fee was selected - set the custom fee rate and clear preset
        setCustomFee(selectedFeeRate || null);
        setSelectedPresetFeeRate(null);
      } else if (
        selectedFeeType === NetworkTransactionFeeType.FAST ||
        selectedFeeType === NetworkTransactionFeeType.MEDIUM ||
        selectedFeeType === NetworkTransactionFeeType.SLOW
      ) {
        console.log('SendDetails: Preset fee selected:', selectedFeeType);
        console.log('SendDetails: Setting selectedPresetFeeRate to:', selectedFeeRate);
        // Preset fee was selected - set the preset fee rate and clear custom fee
        setSelectedPresetFeeRate(selectedFeeRate || null);
        setCustomFee(null);
      }

      console.log('SendDetails: Clearing route params...');
      // Clear the parameters to prevent re-processing
      setParams({ selectedFeeRate: undefined, selectedFeeType: undefined });
    }
  }, [routeParams.selectedFeeRate, routeParams.selectedFeeType, networkTransactionFees, setParams, customFee, selectedPresetFeeRate]);

  const formatFee = (fee: number) => formatBalance(fee, feeUnit!, true);

  const feeEtaLabel = {
    fast: loc.send.fee_10m,
    medium: loc.send.fee_3h,
    slow: loc.send.fee_1d,
  }[feeSpeedTierForRate(Number(feeRate), networkTransactionFees.fastestFee, networkTransactionFees.mediumFee)];

  const stylesHook = StyleSheet.create({
    splitCard: {
      borderColor: isSplitEnabled ? colors.brandPrimary : colors.splitCardDisabledBorderColor,
      backgroundColor: isSplitEnabled ? colors.splitCardEnabledBGColor : colors.splitCardDisabledBGColor,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    splitIconCircle: {
      backgroundColor: isSplitEnabled ? colors.splitIconEnabledBGColor : colors.searchIconBackground,
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    splitToggleTrack: {
      backgroundColor: isSplitEnabled ? colors.brandPrimary : colors.splitToggleDisabledBGColor,
    },
    splitCardSubtitle: { color: colors.textSecondary },
    splitInfoBox: {
      backgroundColor: colors.bannerBackground,
      borderColor: colors.splitInfoBoxBorderColor,
    },
    splitInfoText: { color: colors.splitInfoBoxTextColor },
    splitCardTitle: { color: colors.textPrimary },
    splitToggleThumb: { backgroundColor: isSplitEnabled ? colors.white : colors.searchIconBackground },
    changeToggleTrack: { backgroundColor: isChangeSplitEnabled ? colors.brandPrimary : colors.splitToggleDisabledBGColor },
    changeToggleThumb: { backgroundColor: isChangeSplitEnabled ? colors.white : colors.searchIconBackground },
    splitOutputAmount: { color: colors.textPrimary },
    splitOutputLabel: { color: colors.textSecondary },
    splitFeeIncreaseRow: {
      backgroundColor: colors.splitFeeIncreaseBGColor,
      borderColor: colors.splitFeeIncreaseBorderColor,
      borderWidth: 1,
    },
    splitFeeIncreaseLabel: { color: colors.splitFeeIncreaseTextColor },
    splitFeeIncreaseValue: { color: colors.brandPrimary },

    root: {
      backgroundColor: colors.background,
    },
    selectLabel: {
      color: colors.white,
    },
    fieldInput: { color: colors.textPrimary },
    scanBtn: { backgroundColor: colors.white, shadowColor: colors.black, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
    feeSummary: { borderColor: colors.summaryBorder },
    feeSummaryLabel: { color: colors.textSecondary },
    feeSummaryValue: { color: colors.black },
    feeSummaryValueMeta: { color: colors.amountMeta },
  });

  const renderCoinsSelected = () => {
    if (isVisible) return null;
    if (utxos && utxos?.length > 0) {
      return (
        <View style={styles.select}>
          <CoinsSelected
            number={utxos.length}
            onContainerPress={handleCoinControl}
            onClose={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setParams({ utxos: null });
            }}
          />
        </View>
      );
    }

    return (
      <View style={styles.select}>
        <View style={styles.selectWrap}>
          <Text style={[styles.selectLabel, stylesHook.selectLabel]}>{wallet?.getLabel()}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeArea style={[styles.root, stylesHook.root]}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <AmountHero
          editable
          amount={displayAmount}
          fiat={fiatEstimate}
          unit={displayUnit}
          unitMarginBottom={8}
          onToggleUnit={onToggleUnit}
          onChangeAmount={onChangeAmount}
          showHint={isAmountEmpty(recipient?.amount)}
          onUseMax={onUseAllPressed}
          useMaxDisabled={balance <= 0}
          isMax={isMaxActive}
        />

        <LabeledField
          label={loc.send.label_address}
          tinted={!!recipient?.address}
          trailing={
            !recipient?.address ? (
              <Pressable accessibilityRole="button" onPress={navigateToQRCodeScanner} style={[styles.scanBtn, stylesHook.scanBtn]}>
                <ScanQRIcon color={colors.brandPrimary} size={20} />
              </Pressable>
            ) : undefined
          }
        >
          <TextInput
            style={[styles.fieldInput, stylesHook.fieldInput, styles.addressFieldInput]}
            placeholder={loc.send.paste_or_scan}
            placeholderTextColor={colors.placeholderTextColor}
            value={recipient?.address}
            onChangeText={onChangeAddress}
            editable={isEditable}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            underlineColorAndroid="transparent"
            testID="AddressInput"
          />
        </LabeledField>

        <LabeledField label={loc.send.label_note}>
          <TextInput
            style={[styles.fieldInput, stylesHook.fieldInput]}
            placeholder={loc.send.note_visible_to_you}
            placeholderTextColor={colors.placeholderTextColor}
            value={transactionMemo}
            onChangeText={setTransactionMemo}
            editable={!isLoading}
            underlineColorAndroid="transparent"
            testID="NoteInput"
          />
        </LabeledField>

        <Pressable
          testID="chooseFee"
          accessibilityRole="button"
          onPress={() => {
            Keyboard.dismiss();
            navigation.navigate('SelectFee', {
              networkTransactionFees,
              feePrecalc,
              feeRate,
              feeUnit,
              walletID: wallet?.getID() || '',
              customFee,
            });
          }}
          disabled={isLoading || !hasFeeEstimate}
          style={[styles.feeSummary, stylesHook.feeSummary]}
        >
          <View style={[styles.feeSummaryTexts, !hasFeeEstimate && styles.feeSummaryTextsDisabled]}>
            <Text style={[styles.feeSummaryLabel, stylesHook.feeSummaryLabel]}>{loc.send.network_fee}</Text>
            {networkTransactionFeesIsLoading ? (
              <ActivityIndicator style={styles.feeSummaryLoader} />
            ) : hasFeeEstimate ? (
              <Text style={[styles.feeSummaryValue, stylesHook.feeSummaryValue]}>
                {formatFee(feePrecalc.current!)}
                <Text style={[styles.feeSummaryValueMeta, stylesHook.feeSummaryValueMeta]}>
                  {` · ${feeRate} ${loc.units.sat_vbyte} ≈ ${feeEtaLabel}`}
                </Text>
              </Text>
            ) : (
              <Text style={[styles.feeSummaryValue, stylesHook.feeSummaryValue]}>{loc.send.enter_amount_to_estimate}</Text>
            )}
          </View>
          <ChevronRightIcon color={colors.chevron} />
        </Pressable>

        {isSplitEligible && (
          <View style={[styles.splitCard, stylesHook.splitCard]}>
            {/* Header row */}
            <View style={styles.splitCardHeader}>
              <View style={[styles.splitIconCircle, stylesHook.splitIconCircle]}>
                <SplitIcon size={19} />
              </View>
              <View style={styles.splitCardContent}>
                <View style={styles.splitTitleRow}>
                  <Text style={[styles.splitCardTitle, stylesHook.splitCardTitle]}>{loc.send.split_payment}</Text>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityLabel={loc.send.split_payment}
                    accessibilityState={{ checked: isSplitEnabled }}
                    testID="splitPaymentToggle"
                    onPress={() => setIsSplitEnabled(v => !v)}
                    style={[styles.splitToggleTrack, stylesHook.splitToggleTrack]}
                  >
                    <View style={[styles.splitToggleThumb, stylesHook.splitToggleThumb, isSplitEnabled && styles.splitToggleThumbOn]} />
                  </Pressable>
                </View>
                <Text style={[styles.splitCardSubtitle, stylesHook.splitCardSubtitle]}>{loc.send.split_payment_subtitle}</Text>
              </View>
            </View>

            {/* Split Details — shown when enabled */}
            {isSplitEnabled && (
              <>
                {/* Info box */}
                <View style={[styles.splitInfoBox, stylesHook.splitInfoBox]}>
                  <InfoIcon color={colors.brandPrimary} size={20} />
                  <Text style={[styles.splitInfoText, stylesHook.splitInfoText]}>
                    {loc.send.split_payment_info}
                    <Text style={styles.splitInfoTextEmphasis}>{loc.send.split_payment_info_emphasis}</Text>
                  </Text>
                </View>

                {splitDeclined && (
                  <View style={[styles.splitInfoBox, stylesHook.splitInfoBox]}>
                    <InfoIcon color={colors.brandPrimary} size={20} />
                    <Text style={[styles.splitInfoText, stylesHook.splitInfoText]}>{loc.send.split_payment_unavailable}</Text>
                  </View>
                )}

                {/* Output preview — from the dry-run above, not a separate estimate, so these
                    numbers exactly match what gets signed. Outputs are display-sorted by value
                    (never the on-chain order, which stays shuffled). */}
                {previewOutputs.length > 0 && (
                  <View style={styles.splitOutputsSection}>
                    {previewOutputs.map((output, i) => (
                      <React.Fragment key={i}>
                        <View style={styles.splitOutputRow}>
                          <Text style={[styles.splitOutputLabel, stylesHook.splitOutputLabel]}>
                            {loc.formatString(loc.send.split_output_label, { number: i + 1 })}
                          </Text>
                          <Text style={[styles.splitOutputAmount, stylesHook.splitOutputAmount]}>
                            {satoshiToBTC(output.sats)} {loc.units[BitcoinUnit.BTC]}
                          </Text>
                        </View>
                        {i < previewOutputs.length - 1 && <View style={styles.splitOutputDivider} />}
                      </React.Fragment>
                    ))}
                  </View>
                )}

                {/* Splitting the change is a second, separate choice — it only applies once the
                    split builder is running, so it lives inside this card. */}
                <View style={styles.splitChangeSection}>
                  <View style={styles.splitChangeHeader}>
                    <View style={styles.splitTitleRow}>
                      <Text style={[styles.splitChangeTitle, stylesHook.splitCardTitle]}>{loc.send.split_change}</Text>
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityLabel={loc.send.split_change}
                        accessibilityState={{ checked: isChangeSplitEnabled }}
                        testID="splitChangeToggle"
                        onPress={() => setIsChangeSplitEnabled(v => !v)}
                        style={[styles.splitToggleTrack, stylesHook.changeToggleTrack]}
                      >
                        <View
                          style={[styles.splitToggleThumb, stylesHook.changeToggleThumb, isChangeSplitEnabled && styles.splitToggleThumbOn]}
                        />
                      </Pressable>
                    </View>
                    <Text style={[styles.splitCardSubtitle, stylesHook.splitCardSubtitle]}>{loc.send.split_change_subtitle}</Text>
                  </View>

                  {isChangeSplitEnabled && (
                    <View style={[styles.splitInfoBox, styles.splitChangeInfoBox, stylesHook.splitInfoBox]}>
                      <View style={styles.splitChangeInfoRow}>
                        <InfoIcon color={colors.brandPrimary} size={20} />
                        <Text style={[styles.splitInfoText, stylesHook.splitInfoText]}>{loc.send.split_change_info}</Text>
                      </View>
                      {/* The count comes from the same dry run as the amounts above — the planner
                          picks it from the change budget, so there is nothing here to set. */}
                      {splitPreview && (
                        <View style={styles.splitOutputRow}>
                          <Text style={[styles.splitOutputLabel, stylesHook.splitOutputLabel]}>
                            {splitPreview.changeCount === 1
                              ? loc.send.split_change_output_single
                              : loc.formatString(loc.send.split_change_outputs, { count: splitPreview.changeCount })}
                          </Text>
                          <Text style={[styles.splitOutputAmount, stylesHook.splitOutputAmount]}>{loc.send.split_change_auto}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {previewOutputs.length > 0 && (
                  <View style={[styles.splitFeeIncreaseRow, stylesHook.splitFeeIncreaseRow]}>
                    <Text style={[styles.splitFeeIncreaseLabel, stylesHook.splitFeeIncreaseLabel]}>{loc.send.fee_increase}</Text>
                    <Text style={[styles.splitFeeIncreaseValue, stylesHook.splitFeeIncreaseValue]}>
                      {`+${satoshiToBTC(splitPreview?.feeDelta ?? 0)} ${loc.units[BitcoinUnit.BTC]}`}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <DismissKeyboardInputAccessory />

      {renderCoinsSelected()}

      <View style={styles.bottom}>
        <Button
          testID="sendNextButton"
          title={loc.send.details_next}
          backgroundColor={colors.brandPrimary}
          disabledBackgroundColor={colors.ctaDisabled}
          disabledTextColor={colors.white}
          disabled={!isFormValid || isLoading}
          onPress={createTransaction}
          borderRadius={16}
          style={styles.nextButton}
          textStyle={styles.nextButtonText}
        />
      </View>
    </SafeArea>
  );
};

export default SendDetails;

const styles = StyleSheet.create({
  splitCard: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  splitCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  splitIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  splitCardContent: {
    flex: 1,
    gap: 4,
  },
  splitTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitCardTitle: {
    fontFamily: ClashFont.medium,
    fontSize: 16,
    lineHeight: 20,
  },
  splitToggleTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  splitToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  splitToggleThumbOn: {
    alignSelf: 'flex-end',
  },
  splitCardSubtitle: {
    fontFamily: ClashFont.regular,
    fontSize: 12,
    lineHeight: 20,
  },
  splitInfoBox: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 0.54,
    paddingVertical: 19,
    paddingHorizontal: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  splitInfoText: {
    flex: 1,
    fontFamily: ClashFont.regular,
    fontSize: 12,
    lineHeight: 20,
  },
  splitInfoTextEmphasis: {
    fontFamily: ClashFont.medium,
  },
  splitOutputsSection: {
    gap: 8,
  },
  splitChangeSection: {
    gap: 12,
  },
  splitChangeHeader: {
    gap: 4,
  },
  splitChangeTitle: {
    fontFamily: ClashFont.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  splitChangeInfoBox: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  splitChangeInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  splitOutputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 1,
  },
  splitOutputLabel: {
    fontFamily: ClashFont.regular,
    fontSize: 12,
    lineHeight: 26,
  },
  splitOutputAmount: {
    fontFamily: ClashFont.medium,
    fontSize: 12,
    lineHeight: 26,
  },
  splitOutputDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(230, 228, 228, 0.6)',
  },
  splitFeeIncreaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  splitFeeIncreaseLabel: {
    fontFamily: ClashFont.regular,
    fontSize: 12,
    lineHeight: 20,
  },
  splitFeeIncreaseValue: {
    fontFamily: ClashFont.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  root: {
    flex: 1,
    justifyContent: 'space-between',
  },
  select: {
    marginBottom: 24,
    marginHorizontal: 24,
    alignItems: 'center',
  },
  selectWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  selectLabel: {
    fontFamily: ClashFont.regular,
    fontSize: 14,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 24,
  },
  fieldInput: {
    flex: 1,
    width: '100%',
    fontFamily: ClashFont.regular,
    fontSize: 14,
    lineHeight: 20,
    padding: 0,
  },
  addressFieldInput: {
    // grows with wrapped text up to ~5 lines (comfortably fits a full silent-payment
    // address with no scrolling); caps further growth for pathological pastes instead
    // of letting the screen layout balloon
    maxHeight: 100,
  },
  scanBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  feeSummaryTexts: {
    flex: 1,
    gap: 2,
  },
  feeSummaryTextsDisabled: {
    opacity: 0.5,
  },
  feeSummaryLoader: {
    alignSelf: 'flex-start',
  },
  feeSummaryLabel: {
    fontFamily: ClashFont.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  feeSummaryValue: {
    fontFamily: ClashFont.medium,
    fontSize: 16,
    lineHeight: 26,
  },
  feeSummaryValueMeta: {
    fontFamily: ClashFont.regular,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  nextButton: {
    height: 56,
    minHeight: 56,
    maxHeight: 56,
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  nextButtonText: {
    fontFamily: ClashFont.medium,
    fontSize: 16,
    lineHeight: 26,
    marginHorizontal: 0,
  },
});
