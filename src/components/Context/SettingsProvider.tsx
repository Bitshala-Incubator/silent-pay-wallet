import * as Electrum from '../../modules/Electrum';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import DefaultPreference from 'react-native-default-preference';
import { isReadClipboardAllowed } from '../../modules/clipboard';
import { getPreferredCurrency, GROUP_IO_SHROUD, initCurrencyDaemon, setPreferredCurrency } from '../../modules/currency';
import { ShroudApp } from '../../class';

import { FiatUnit, TFiatUnit } from '../../models/fiatUnit';
import { useStorage } from '../../hooks/context/useStorage';
import { BitcoinUnit } from '../../models/bitcoinUnits';

const TotalWalletsBalanceKey = 'TotalWalletsBalance';
const TotalWalletsBalancePreferredUnit = 'TotalWalletsBalancePreferredUnit';

const getDoNotTrackStorage = async (): Promise<boolean> => {
  try {
    await DefaultPreference.setName(GROUP_IO_SHROUD);
    const doNotTrack = await DefaultPreference.get(ShroudApp.DO_NOT_TRACK);
    return doNotTrack === '1';
  } catch {
    console.error('Error getting DoNotTrack');
    return false;
  }
};

const getIsTotalBalanceViewEnabled = async (): Promise<boolean> => {
  try {
    await DefaultPreference.setName(GROUP_IO_SHROUD);
    const isEnabledValue = (await DefaultPreference.get(TotalWalletsBalanceKey)) ?? 'true';
    console.debug('getIsTotalBalanceViewEnabled', isEnabledValue);
    return isEnabledValue === 'true';
  } catch (e) {
    console.error('Error getting TotalBalanceViewEnabled:', e);
    return true;
  }
};

const setTotalBalancePreferredUnitStorageFunc = async (unit: BitcoinUnit): Promise<void> => {
  try {
    await DefaultPreference.setName(GROUP_IO_SHROUD);
    await DefaultPreference.set(TotalWalletsBalancePreferredUnit, unit);
  } catch (e) {
    console.error('Error setting TotalBalancePreferredUnit:', e);
  }
};

const getTotalBalancePreferredUnit = async (): Promise<BitcoinUnit> => {
  try {
    await DefaultPreference.setName(GROUP_IO_SHROUD);
    const unit = (await DefaultPreference.get(TotalWalletsBalancePreferredUnit)) as BitcoinUnit | null;
    return unit ?? BitcoinUnit.BTC;
  } catch (e) {
    console.error('Error getting TotalBalancePreferredUnit:', e);
    return BitcoinUnit.BTC;
  }
};

interface SettingsContextType {
  preferredFiatCurrency: TFiatUnit;
  setPreferredFiatCurrencyStorage: (currency: TFiatUnit) => Promise<void>;
  isPrivacyBlurEnabled: boolean;
  isDoNotTrackEnabled: boolean;
  isClipboardGetContentEnabled: boolean;
  isTotalBalanceEnabled: boolean;
  totalBalancePreferredUnit: BitcoinUnit;
  setTotalBalancePreferredUnitStorage: (unit: BitcoinUnit) => Promise<void>;
  isElectrumDisabled: boolean;
  setIsElectrumDisabled: (value: boolean) => void;
}

const defaultSettingsContext: SettingsContextType = {
  preferredFiatCurrency: FiatUnit.USD,
  setPreferredFiatCurrencyStorage: async () => {},
  isPrivacyBlurEnabled: true,
  isDoNotTrackEnabled: false,
  isClipboardGetContentEnabled: true,
  isTotalBalanceEnabled: true,
  totalBalancePreferredUnit: BitcoinUnit.BTC,
  setTotalBalancePreferredUnitStorage: async () => {},
  isElectrumDisabled: false,
  setIsElectrumDisabled: () => {},
};

export const SettingsContext = createContext<SettingsContextType>(defaultSettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = React.memo(({ children }: { children: React.ReactNode }) => {
  const [preferredFiatCurrency, setPreferredFiatCurrencyState] = useState<TFiatUnit>(FiatUnit.USD);
  const isPrivacyBlurEnabled = true;
  const [isDoNotTrackEnabled, setIsDoNotTrackEnabled] = useState<boolean>(false);
  const [isClipboardGetContentEnabled, setIsClipboardGetContentEnabled] = useState<boolean>(true);
  const [isTotalBalanceEnabled, setIsTotalBalanceEnabled] = useState<boolean>(true);
  const [totalBalancePreferredUnit, setTotalBalancePreferredUnit] = useState<BitcoinUnit>(BitcoinUnit.BTC);
  const [isElectrumDisabled, setIsElectrumDisabled] = useState<boolean>(true);

  const { walletsInitialized } = useStorage();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        await DefaultPreference.setName(GROUP_IO_SHROUD);
      } catch (e) {
        console.error('Error setting preference name:', e);
      }

      const promises: Promise<void>[] = [
        Electrum.isDisabled().then(disabled => {
          setIsElectrumDisabled(disabled);
        }),
        isReadClipboardAllowed().then(clipboardEnabled => {
          setIsClipboardGetContentEnabled(clipboardEnabled);
        }),
        getDoNotTrackStorage().then(doNotTrack => {
          setIsDoNotTrackEnabled(doNotTrack);
        }),
        getIsTotalBalanceViewEnabled().then(totalBalanceEnabled => {
          setIsTotalBalanceEnabled(totalBalanceEnabled);
        }),
        getTotalBalancePreferredUnit().then(preferredUnit => {
          setTotalBalancePreferredUnit(preferredUnit);
        }),
      ];

      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Error loading setting ${index}:`, result.reason);
        }
      });
    };

    loadSettings();
  }, []);

  useEffect(() => {
    initCurrencyDaemon()
      .then(getPreferredCurrency)
      .then(currency => {
        console.debug('SettingsContext currency:', currency);
        setPreferredFiatCurrencyState(currency as TFiatUnit);
      })
      .catch(e => {
        console.error('Error initializing currency daemon or getting preferred currency:', e);
      });
  }, []);

  useEffect(() => {
    if (walletsInitialized) {
      isElectrumDisabled ? Electrum.forceDisconnect() : Electrum.connectMain();
    }
  }, [isElectrumDisabled, walletsInitialized]);

  const setPreferredFiatCurrencyStorage = useCallback(async (currency: TFiatUnit): Promise<void> => {
    try {
      await setPreferredCurrency(currency);
      setPreferredFiatCurrencyState(currency);
    } catch (e) {
      console.error('Error setting preferredFiatCurrency:', e);
    }
  }, []);

  const setTotalBalancePreferredUnitStorage = useCallback(async (unit: BitcoinUnit): Promise<void> => {
    try {
      await setTotalBalancePreferredUnitStorageFunc(unit);
      setTotalBalancePreferredUnit(unit);
    } catch (e) {
      console.error('Error setting totalBalancePreferredUnit:', e);
    }
  }, []);

  const value = useMemo(
    () => ({
      preferredFiatCurrency,
      setPreferredFiatCurrencyStorage,
      isPrivacyBlurEnabled,
      isDoNotTrackEnabled,
      isClipboardGetContentEnabled,
      isTotalBalanceEnabled,
      totalBalancePreferredUnit,
      setTotalBalancePreferredUnitStorage,
      isElectrumDisabled,
      setIsElectrumDisabled,
    }),
    [
      preferredFiatCurrency,
      setPreferredFiatCurrencyStorage,
      isPrivacyBlurEnabled,
      isDoNotTrackEnabled,
      isClipboardGetContentEnabled,
      isTotalBalanceEnabled,
      totalBalancePreferredUnit,
      setTotalBalancePreferredUnitStorage,
      isElectrumDisabled,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
});
