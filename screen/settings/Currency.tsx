import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPreferredCurrency, initCurrencyDaemon, setPreferredCurrency } from '../../modules/currency';
import presentAlert from '../../components/Alert';
import SearchField from '../../components/SearchField';
import SettingsRow from '../../components/SettingsRow';
import CheckmarkIcon from '../../components/icons/CheckmarkIcon';
import { useTheme } from '../../components/themes';
import loc from '../../loc';
import { FiatUnit, FiatUnitType, getFiatRate } from '../../models/fiatUnit';
import { useSettings } from '../../hooks/context/useSettings';
import { ClashFont } from '../../constants/fonts';

// 88 (20 + 48 + 20) plus the hairline separator SettingsRow draws on all but the last row
const ITEM_HEIGHT = 89;

const TOP_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'CHF'];

const currencyShortName = (item: FiatUnitType) => item.country.match(/\(([^)]+)\)/)?.[1] ?? item.country;

const ALL_CURRENCIES = Object.values(FiatUnit);
const SHORT_NAMES: Record<string, string> = Object.fromEntries(ALL_CURRENCIES.map(item => [item.endPointKey, currencyShortName(item)]));
const DEFAULT_ORDER = [
  ...TOP_CURRENCIES.map(code => FiatUnit[code]),
  ...ALL_CURRENCIES.filter(item => !TOP_CURRENCIES.includes(item.endPointKey)),
];

const Currency: React.FC = () => {
  const { setPreferredFiatCurrencyStorage } = useSettings();
  const [isSavingNewPreferredCurrency, setIsSavingNewPreferredCurrency] = useState<FiatUnitType | undefined>();
  const [selectedCurrency, setSelectedCurrency] = useState<FiatUnitType>(FiatUnit.USD);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const data = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return DEFAULT_ORDER;

    const codeMatches = ALL_CURRENCIES.filter(item => item.endPointKey.toLowerCase().startsWith(query));
    const nameMatches = ALL_CURRENCIES.filter(
      item =>
        !item.endPointKey.toLowerCase().startsWith(query) &&
        (SHORT_NAMES[item.endPointKey].toLowerCase().includes(query) || item.country.toLowerCase().includes(query)),
    );
    return [...codeMatches, ...nameMatches];
  }, [search]);

  const symbolIcons = useMemo(
    () =>
      Object.fromEntries(
        ALL_CURRENCIES.map(item => [
          item.endPointKey,
          <Text
            key={item.endPointKey}
            style={[styles.symbol, { color: colors.settingsRowTitle }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {item.symbol}
          </Text>,
        ]),
      ),
    [colors.settingsRowTitle],
  );

  const checkmarkElement = useMemo(() => <CheckmarkIcon color={colors.successCheck} size={20} />, [colors.successCheck]);

  const fetchCurrency = useCallback(async () => {
    try {
      const preferredCurrency = await getPreferredCurrency();
      if (preferredCurrency === null) {
        throw Error();
      }
      setSelectedCurrency(preferredCurrency);
    } catch (_error) {
      setSelectedCurrency(FiatUnit.USD);
    }
  }, []);

  useEffect(() => {
    fetchCurrency();
  }, [fetchCurrency]);

  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    (p: { item: FiatUnitType; index: number }) => {
      const isSelected = selectedCurrency.endPointKey === p.item.endPointKey;
      const isLoading = isSavingNewPreferredCurrency === p.item;
      const isDisabled = isLoading || isSelected;

      return (
        <SettingsRow
          disabled={isDisabled}
          selected={isSelected}
          isLoading={isLoading}
          showSeparator={p.index < data.length - 1}
          circle
          icon={symbolIcons[p.item.endPointKey]}
          title={p.item.endPointKey}
          subtitle={SHORT_NAMES[p.item.endPointKey]}
          rightElement={isSelected ? checkmarkElement : null}
          onPress={async () => {
            if (isDisabled) return;

            Keyboard.dismiss();
            setIsSavingNewPreferredCurrency(p.item);
            try {
              await getFiatRate(p.item.endPointKey);
              await setPreferredCurrency(p.item);
              await initCurrencyDaemon(true);
              await fetchCurrency();
              setSelectedCurrency(p.item);
              setPreferredFiatCurrencyStorage(FiatUnit[p.item.endPointKey]);
            } catch (error: any) {
              console.log(error);
              presentAlert({
                message: error.message ? `${loc.settings.currency_fetch_error}: ${error.message}` : loc.settings.currency_fetch_error,
              });
            } finally {
              setIsSavingNewPreferredCurrency(undefined);
            }
          }}
        />
      );
    },
    [
      isSavingNewPreferredCurrency,
      selectedCurrency,
      data.length,
      symbolIcons,
      checkmarkElement,
      fetchCurrency,
      setPreferredFiatCurrencyStorage,
    ],
  );

  const keyExtractor = useCallback((item: FiatUnitType) => `${item.endPointKey}-${item.locale}`, []);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <SearchField value={search} onChangeText={setSearch} placeholder={loc.settings.search_currency} style={styles.searchField} />
      <View style={[styles.listCard, { backgroundColor: colors.settingsCardBackground, marginBottom: insets.bottom }]}>
        <FlatList
          keyboardShouldPersistTaps="always"
          automaticallyAdjustKeyboardInsets
          keyExtractor={keyExtractor}
          data={data}
          extraData={selectedCurrency}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          getItemLayout={getItemLayout}
          renderItem={renderItem}
        />
      </View>
    </View>
  );
};

export default Currency;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  searchField: {
    marginHorizontal: 24,
    marginTop: 16,
  },
  listCard: {
    flex: 1,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  symbol: {
    fontSize: 16,
    fontFamily: ClashFont.regular,
    maxWidth: 36,
    textAlign: 'center',
  },
});
