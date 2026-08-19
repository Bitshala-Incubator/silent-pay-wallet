import React, { useRef, useCallback, useReducer, useEffect, useMemo, FC } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Keyboard } from 'react-native';
import { useTheme, Theme } from '../components/themes';
import loc from '../loc';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SendDetailsStackParamList } from '../navigation/SendDetailsStackParamList';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NetworkTransactionFeeType } from '../models/networkTransactionFees';
import { ClashFont } from '../constants/fonts';
import { satoshiToBTC } from '../modules/currency';
import { feeSpeedTierForRate, estimateFeeForRate } from '../helpers/send/format';
import LightningIcon from '../components/icons/LightningIcon';
import ClockIcon from '../components/icons/ClockIcon';
import Button from '../components/Button';
import SafeArea from '../components/SafeArea';

enum FeeScreenActions {
  SET_CUSTOM_FEE_VALUE = 'SET_CUSTOM_FEE_VALUE',
  SET_CUSTOM_FEE_FOCUSED = 'SET_CUSTOM_FEE_FOCUSED',
  SET_CUSTOM_FEE_BLURRED = 'SET_CUSTOM_FEE_BLURRED',
  CLEAR_CUSTOM_FEE = 'CLEAR_CUSTOM_FEE',
  SET_OPTIONS = 'SET_OPTIONS',
  SELECT_FEE = 'SELECT_FEE',
}

interface FeeOption {
  label: string;
  time: string;
  fee: number | null;
  rate: number;
  feeType: NetworkTransactionFeeType;
  active: boolean;
  disabled?: boolean;
}

interface FeeScreenState {
  customFeeValue: string;
  isCustomFeeFocused: boolean;
  options: FeeOption[];
  isCustomFeeSelected: boolean;
}

type FeeScreenAction =
  | { type: FeeScreenActions.SET_CUSTOM_FEE_VALUE; payload: string }
  | { type: FeeScreenActions.SET_CUSTOM_FEE_FOCUSED }
  | { type: FeeScreenActions.SET_CUSTOM_FEE_BLURRED }
  | { type: FeeScreenActions.CLEAR_CUSTOM_FEE }
  | { type: FeeScreenActions.SET_OPTIONS; payload: { options: FeeOption[]; currentFeeRate: number } }
  | { type: FeeScreenActions.SELECT_FEE; payload: { feeType: NetworkTransactionFeeType } };

const feeScreenReducer = (state: FeeScreenState, action: FeeScreenAction): FeeScreenState => {
  switch (action.type) {
    case FeeScreenActions.SET_CUSTOM_FEE_VALUE:
      return { ...state, customFeeValue: action.payload };
    case FeeScreenActions.SET_CUSTOM_FEE_FOCUSED:
      return {
        ...state,
        isCustomFeeFocused: true,
        isCustomFeeSelected: true,
        options: state.options.map(opt => ({ ...opt, active: false })),
      };
    case FeeScreenActions.SET_CUSTOM_FEE_BLURRED:
      return { ...state, isCustomFeeFocused: false };
    case FeeScreenActions.CLEAR_CUSTOM_FEE:
      return { ...state, customFeeValue: '' };
    case FeeScreenActions.SET_OPTIONS: {
      const { options, currentFeeRate } = action.payload;
      const matchesPresetOption = options.some(option => !option.disabled && currentFeeRate === option.rate);
      const keepCustom = state.isCustomFeeFocused || (state.isCustomFeeSelected && !matchesPresetOption);
      let updatedOptions;
      if (keepCustom) {
        updatedOptions = options.map(option => ({ ...option, active: false }));
      } else if (matchesPresetOption) {
        updatedOptions = options.map(option => ({
          ...option,
          active: currentFeeRate === option.rate,
        }));
      } else {
        const firstEnabled = options.find(opt => !opt.disabled);
        updatedOptions = options.map(option => ({
          ...option,
          active: option === firstEnabled,
        }));
      }
      return {
        ...state,
        options: updatedOptions,
        isCustomFeeSelected: keepCustom,
      };
    }
    case FeeScreenActions.SELECT_FEE: {
      const { feeType } = action.payload;
      return {
        ...state,
        isCustomFeeSelected: false,
        options: state.options.map(opt => ({ ...opt, active: opt.feeType === feeType })),
      };
    }
    default:
      return state;
  }
};

interface FeeCardProps {
  label: string;
  fee: number | null;
  rate: number;
  eta: string;
  icon: React.ReactNode;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  colors: Theme['colors'];
}

const FeeCard: FC<FeeCardProps> = ({ label, fee, rate, eta, icon, selected, disabled, onPress, colors }) => {
  /* eslint-disable react-native/no-unused-styles */
  const stylesHook = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: selected ? colors.surfaceSubtle : colors.white,
          borderColor: selected ? colors.feeCardSelectedBorder : colors.feeCardBorder,
        },
        iconCircle: { backgroundColor: selected ? colors.white : colors.surfaceSubtle },
        label: { color: colors.black },
        subtitlePrimary: { color: colors.textPrimary },
        subtitleSecondary: { color: colors.textSecondary, fontFamily: ClashFont.regular },
        eta: { color: selected ? colors.brandPrimary : colors.amountMeta },
      }),
    [selected, colors],
  );
  /* eslint-enable react-native/no-unused-styles */

  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.card, stylesHook.card, disabled && styles.cardDisabled]}
    >
      <View style={[styles.iconCircle, stylesHook.iconCircle]}>{icon}</View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardLabel, stylesHook.label]}>{label}</Text>
        <Text style={[styles.cardSubtitle, stylesHook.subtitlePrimary]}>
          {fee != null ? `${satoshiToBTC(fee)} BTC · ` : '— '}
          <Text style={stylesHook.subtitleSecondary}>{fee != null ? `${rate} ${loc.units.sat_vbyte}` : loc.units.sat_vbyte}</Text>
        </Text>
      </View>
      <Text style={[styles.cardEta, stylesHook.eta]}>{eta}</Text>
    </TouchableOpacity>
  );
};

type SelectFeeScreenNavigationProp = NativeStackNavigationProp<SendDetailsStackParamList, 'SelectFee'>;
type SelectFeeScreenRouteProp = RouteProp<SendDetailsStackParamList, 'SelectFee'>;

const SelectFeeScreen = () => {
  const navigation = useNavigation<SelectFeeScreenNavigationProp>();
  const route = useRoute<SelectFeeScreenRouteProp>();
  const { colors } = useTheme();

  const { networkTransactionFees, feePrecalc, feeRate, walletID, customFee } = route.params;

  const [state, dispatch] = useReducer(feeScreenReducer, {
    customFeeValue: customFee || '',
    isCustomFeeFocused: false,
    options: [],
    isCustomFeeSelected: !!customFee,
  });

  const customFeeInputRef = useRef<TextInput>(null);
  const focusCustomOnRenderRef = useRef(false);
  const nf = networkTransactionFees;

  const stylesHook = StyleSheet.create({
    container: {
      backgroundColor: colors.background,
    },
    customCard: { backgroundColor: colors.white, borderColor: colors.feeCardBorder },
    customCardSelected: { backgroundColor: colors.surfaceSubtle, borderColor: colors.feeCardSelectedBorder },
    customLabel: { color: colors.black },
    customSubtitle: { color: colors.textSecondary },
    customInputRow: { backgroundColor: colors.white },
    satVbyteText: { color: colors.textSecondary },
    customFeeInputColors: { color: colors.textPrimary },
    customEstimateText: { color: colors.textPrimary },
    customEstimateRate: { color: colors.textSecondary, fontFamily: ClashFont.regular },
    customEstimateEta: { color: colors.brandPrimary },
  });

  useEffect(() => {
    const options: FeeOption[] = [
      {
        label: loc.send.fee_fast,
        time: loc.send.fee_10m,
        fee: feePrecalc.fastestFee,
        rate: nf.fastestFee,
        feeType: NetworkTransactionFeeType.FAST,
        active: false,
      },
      {
        label: loc.send.fee_medium,
        time: loc.send.fee_3h,
        fee: feePrecalc.mediumFee,
        rate: nf.mediumFee,
        feeType: NetworkTransactionFeeType.MEDIUM,
        active: false,
        disabled: nf.mediumFee === nf.fastestFee,
      },
      {
        label: loc.send.fee_slow,
        time: loc.send.fee_1d,
        fee: feePrecalc.slowFee,
        rate: nf.slowFee,
        feeType: NetworkTransactionFeeType.SLOW,
        active: false,
        disabled: nf.slowFee === nf.mediumFee || nf.slowFee === nf.fastestFee,
      },
    ];
    dispatch({ type: FeeScreenActions.SET_OPTIONS, payload: { options, currentFeeRate: Number(feeRate) } });
  }, [feePrecalc, nf, feeRate]);

  const navigateWithFee = useCallback(
    (feeRateValue: string, feeType: NetworkTransactionFeeType) => {
      navigation.popTo('SendDetails', { walletID, selectedFeeRate: feeRateValue, selectedFeeType: feeType }, { merge: true });
    },
    [navigation, walletID],
  );

  const handleFeeOptionPress = useCallback((_rate: number, feeType: NetworkTransactionFeeType) => {
    dispatch({ type: FeeScreenActions.SELECT_FEE, payload: { feeType } });
  }, []);

  const handleCustomFeeChange = useCallback((value: string) => {
    const cleanValue = value.replace(/[^\d.,]/g, '').replace(/([.,].*?)[.,]/g, '$1');
    dispatch({ type: FeeScreenActions.SET_CUSTOM_FEE_VALUE, payload: cleanValue });
  }, []);

  const handleCustomFeeSubmit = useCallback(() => {
    if (state.isCustomFeeSelected) {
      const numericValue = state.customFeeValue.replace(',', '.');
      if (numericValue && Number(numericValue) > 0) {
        navigateWithFee(numericValue, NetworkTransactionFeeType.CUSTOM);
      }
    } else {
      const activeOption = state.options.find(opt => opt.active);
      if (activeOption) {
        navigateWithFee(activeOption.rate.toString(), activeOption.feeType);
      }
    }
  }, [state.isCustomFeeSelected, state.customFeeValue, state.options, navigateWithFee]);

  const handleCustomFeeBlur = useCallback(() => {
    dispatch({ type: FeeScreenActions.SET_CUSTOM_FEE_BLURRED });
    const numericValue = Number(state.customFeeValue.replace(',', '.'));
    if (!state.customFeeValue || !Number.isFinite(numericValue) || numericValue <= 0) {
      dispatch({ type: FeeScreenActions.CLEAR_CUSTOM_FEE });
    }
  }, [state.customFeeValue]);

  const handleCustomFocus = useCallback(() => dispatch({ type: FeeScreenActions.SET_CUSTOM_FEE_FOCUSED }), []);

  const handleCustomPress = useCallback(() => {
    if (state.isCustomFeeSelected) {
      customFeeInputRef.current?.focus();
    } else {
      focusCustomOnRenderRef.current = true;
      dispatch({ type: FeeScreenActions.SET_CUSTOM_FEE_FOCUSED });
    }
  }, [state.isCustomFeeSelected]);

  useEffect(() => {
    if (state.isCustomFeeSelected && focusCustomOnRenderRef.current) {
      focusCustomOnRenderRef.current = false;
      customFeeInputRef.current?.focus();
    }
  }, [state.isCustomFeeSelected]);

  useFocusEffect(
    useCallback(() => {
      Keyboard.dismiss();
      return () => Keyboard.dismiss();
    }, []),
  );

  const isNextDisabled = state.isCustomFeeSelected
    ? !(state.customFeeValue && Number(state.customFeeValue.replace(',', '.')) > 0)
    : !state.options.some(opt => opt.active);

  const knownFeeRatePair = useMemo(() => {
    if (feePrecalc.fastestFee != null && nf.fastestFee > 0) return { fee: feePrecalc.fastestFee, rate: nf.fastestFee };
    if (feePrecalc.mediumFee != null && nf.mediumFee > 0) return { fee: feePrecalc.mediumFee, rate: nf.mediumFee };
    if (feePrecalc.slowFee != null && nf.slowFee > 0) return { fee: feePrecalc.slowFee, rate: nf.slowFee };
    return null;
  }, [feePrecalc, nf]);

  const customRateNum = Number(state.customFeeValue.replace(',', '.'));
  const customEstimate =
    knownFeeRatePair && customRateNum > 0
      ? {
          fee: estimateFeeForRate(customRateNum, knownFeeRatePair.fee, knownFeeRatePair.rate),
          eta: { fast: loc.send.fee_10m, medium: loc.send.fee_3h, slow: loc.send.fee_1d }[
            feeSpeedTierForRate(customRateNum, nf.fastestFee, nf.mediumFee)
          ],
        }
      : null;

  return (
    <SafeArea style={[stylesHook.container, styles.screenContainer]}>
      <View style={styles.contentContainer}>
        <Text style={[styles.subtitle, stylesHook.customSubtitle]}>{loc.send.network_fee_subtitle}</Text>

        <View style={styles.optionsList}>
          {state.options.map(({ label, time, fee, rate, active, disabled, feeType }) => (
            <FeeCard
              key={label}
              label={label}
              fee={fee}
              rate={rate}
              eta={`~${time}`}
              icon={
                feeType === NetworkTransactionFeeType.FAST ? (
                  <LightningIcon size={24} color={colors.brandPrimary} />
                ) : (
                  <ClockIcon size={24} color={colors.brandPrimary} />
                )
              }
              selected={active}
              disabled={disabled}
              onPress={() => handleFeeOptionPress(rate, feeType)}
              colors={colors}
            />
          ))}

          <TouchableOpacity
            accessibilityRole="button"
            testID="feeCustomContainerButton"
            onPress={handleCustomPress}
            style={[styles.customCardContainer, state.isCustomFeeSelected ? stylesHook.customCardSelected : stylesHook.customCard]}
          >
            <View style={styles.customHeaderRow}>
              <View style={styles.cardBody}>
                <Text style={[styles.cardLabel, stylesHook.customLabel]}>{loc.send.fee_custom}</Text>
                <Text style={[styles.customCardSubtitle, stylesHook.customSubtitle]}>{loc.send.set_your_own_fee_rate}</Text>
              </View>
            </View>

            {state.isCustomFeeSelected && (
              <View style={[styles.customInputRow, stylesHook.customInputRow]}>
                <TextInput
                  ref={customFeeInputRef}
                  style={[styles.customFeeInput, stylesHook.customFeeInputColors]}
                  keyboardType="numeric"
                  placeholder={loc.send.insert_custom_fee}
                  value={state.customFeeValue}
                  placeholderTextColor={colors.textSecondary}
                  onChangeText={handleCustomFeeChange}
                  onSubmitEditing={handleCustomFeeSubmit}
                  onFocus={handleCustomFocus}
                  onBlur={handleCustomFeeBlur}
                  enablesReturnKeyAutomatically
                  returnKeyType="done"
                  accessibilityLabel={loc.send.create_fee}
                  underlineColorAndroid="transparent"
                  testID="feeCustom"
                />
                <Text style={[styles.satVbyteText, stylesHook.satVbyteText]}>{loc.units.sat_vbyte}</Text>
              </View>
            )}

            {state.isCustomFeeSelected && customEstimate && (
              <View style={styles.customEstimateRow}>
                <Text style={[styles.customEstimateText, stylesHook.customEstimateText]}>
                  {`${satoshiToBTC(customEstimate.fee)} BTC · `}
                  <Text style={stylesHook.customEstimateRate}>{`${customRateNum} ${loc.units.sat_vbyte}`}</Text>
                </Text>
                <Text style={[styles.customEstimateEta, stylesHook.customEstimateEta]}>{`~${customEstimate.eta}`}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottom}>
        <Button
          testID="feeNextButton"
          title={loc.send.details_next}
          backgroundColor={colors.brandPrimary}
          disabledBackgroundColor={colors.ctaDisabled}
          disabledTextColor={colors.white}
          disabled={isNextDisabled}
          onPress={handleCustomFeeSubmit}
          borderRadius={16}
          style={styles.nextButton}
          textStyle={styles.nextButtonText}
        />
      </View>
    </SafeArea>
  );
};

export default SelectFeeScreen;

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  contentContainer: {
    paddingTop: 16,
    gap: 24,
    paddingHorizontal: 24,
  },
  optionsList: {
    gap: 16,
  },
  subtitle: {
    fontFamily: ClashFont.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    fontFamily: ClashFont.medium,
    fontSize: 16,
    lineHeight: 26,
  },
  cardSubtitle: {
    fontFamily: ClashFont.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  cardEta: {
    fontFamily: ClashFont.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
  },
  customCardContainer: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  customHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customCardSubtitle: {
    fontFamily: ClashFont.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  customInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  customFeeInput: {
    flex: 1,
    fontFamily: ClashFont.regular,
    fontSize: 14,
    height: 32,
    padding: 0,
    marginRight: 8,
  },
  satVbyteText: {
    fontFamily: ClashFont.regular,
    fontSize: 16,
    lineHeight: 26,
  },
  customEstimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customEstimateText: {
    fontFamily: ClashFont.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  customEstimateEta: {
    fontFamily: ClashFont.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  bottom: {
    paddingBottom: 24,
    paddingHorizontal: 24,
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
