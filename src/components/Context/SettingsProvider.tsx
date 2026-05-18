import { BLOCK_EXPLORERS, getBlockExplorerUrl, saveBlockExplorer, BlockExplorer, normalizeUrl } from '../../models/blockExplorer';
import * as Electrum from '../../modules/Electrum';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import DefaultPreference from 'react-native-default-preference';
import { isReadClipboardAllowed, setReadClipboardAllowed } from '../../modules/clipboard';
import { getPreferredCurrency, GROUP_IO_SHROUD, initCurrencyDaemon, setPreferredCurrency } from '../../modules/currency';
import { clearUseURv1, isURv1Enabled, setUseURv1 } from '../../modules/ur';
import { ShroudApp } from '../../class';

import { FiatUnit, TFiatUnit } from '../../models/fiatUnit';
import {
  getEnabled as getIsDeviceQuickActionsEnabled,
  setEnabled as setIsDeviceQuickActionsEnabled,
} from '../../hooks/useDeviceQuickActions';
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

export const setTotalBalanceViewEnabledStorage = async (value: boolean): Promise<void> => {
  try {
    await DefaultPreference.setName(GROUP_IO_SHROUD);
    await DefaultPreference.set(TotalWalletsBalanceKey, value ? 'true' : 'false');
    console.debug('setTotalBalanceViewEnabledStorage value:', value);
  } catch (e) {
    console.error('Error setting TotalBalanceViewEnabled:', e);
  }
};

export const getIsTotalBalanceViewEnabled = async (): Promise<boolean> => {
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

export const setTotalBalancePreferredUnitStorageFunc = async (unit: BitcoinUnit): Promise<void> => {
  try {
    await DefaultPreference.setName(GROUP_IO_SHROUD);
    await DefaultPreference.set(TotalWalletsBalancePreferredUnit, unit);
  } catch (e) {
    console.error('Error setting TotalBalancePreferredUnit:', e);
  }
};

export const getTotalBalancePreferredUnit = async (): Promise<BitcoinUnit> => {
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
  setIsPrivacyBlurEnabled: (value: boolean) => void;
  isDoNotTrackEnabled: boolean;
  setDoNotTrackStorage: (value: boolean) => Promise<void>;
  isLegacyURv1Enabled: boolean;
  setIsLegacyURv1EnabledStorage: (value: boolean) => Promise<void>;
  isClipboardGetContentEnabled: boolean;
  setIsClipboardGetContentEnabledStorage: (value: boolean) => Promise<void>;
  isQuickActionsEnabled: boolean;
  setIsQuickActionsEnabledStorage: (value: boolean) => Promise<void>;
  isTotalBalanceEnabled: boolean;
  setIsTotalBalanceEnabledStorage: (value: boolean) => Promise<void>;
  totalBalancePreferredUnit: BitcoinUnit;
  setTotalBalancePreferredUnitStorage: (unit: BitcoinUnit) => Promise<void>;
  selectedBlockExplorer: BlockExplorer;
  setBlockExplorerStorage: (explorer: BlockExplorer) => Promise<boolean>;
  isElectrumDisabled: boolean;
  setIsElectrumDisabled: (value: boolean) => void;
}

const defaultSettingsContext: SettingsContextType = {
  preferredFiatCurrency: FiatUnit.USD,
  setPreferredFiatCurrencyStorage: async () => {},
  isPrivacyBlurEnabled: true,
  setIsPrivacyBlurEnabled: () => {},
  isDoNotTrackEnabled: false,
  setDoNotTrackStorage: async () => {},
  isLegacyURv1Enabled: false,
  setIsLegacyURv1EnabledStorage: async () => {},
  isClipboardGetContentEnabled: true,
  setIsClipboardGetContentEnabledStorage: async () => {},
  isQuickActionsEnabled: true,
  setIsQuickActionsEnabledStorage: async () => {},
  isTotalBalanceEnabled: true,
  setIsTotalBalanceEnabledStorage: async () => {},
  totalBalancePreferredUnit: BitcoinUnit.BTC,
  setTotalBalancePreferredUnitStorage: async () => {},
  selectedBlockExplorer: BLOCK_EXPLORERS.default,
  setBlockExplorerStorage: async () => false,
  isElectrumDisabled: false,
  setIsElectrumDisabled: () => {},
};

export const SettingsContext = createContext<SettingsContextType>(defaultSettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = React.memo(({ children }: { children: React.ReactNode }) => {
  const [preferredFiatCurrency, setPreferredFiatCurrencyState] = useState<TFiatUnit>(FiatUnit.USD);
  const [isPrivacyBlurEnabled, setIsPrivacyBlurEnabled] = useState<boolean>(true);
  const [isDoNotTrackEnabled, setIsDoNotTrackEnabled] = useState<boolean>(false);
  const [isLegacyURv1Enabled, setIsLegacyURv1Enabled] = useState<boolean>(false);
  const [isClipboardGetContentEnabled, setIsClipboardGetContentEnabled] = useState<boolean>(true);
  const [isQuickActionsEnabled, setIsQuickActionsEnabled] = useState<boolean>(true);
  const [isTotalBalanceEnabled, setIsTotalBalanceEnabled] = useState<boolean>(true);
  const [totalBalancePreferredUnit, setTotalBalancePreferredUnit] = useState<BitcoinUnit>(BitcoinUnit.BTC);
  const [selectedBlockExplorer, setSelectedBlockExplorer] = useState<BlockExplorer>(BLOCK_EXPLORERS.default);
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
        isURv1Enabled().then(urv1Enabled => {
          setIsLegacyURv1Enabled(urv1Enabled);
        }),
        isReadClipboardAllowed().then(clipboardEnabled => {
          setIsClipboardGetContentEnabled(clipboardEnabled);
        }),
        getIsDeviceQuickActionsEnabled().then(quickActionsEnabled => {
          setIsQuickActionsEnabled(quickActionsEnabled);
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
        getBlockExplorerUrl().then(url => {
          const predefinedExplorer = Object.values(BLOCK_EXPLORERS).find(explorer => normalizeUrl(explorer.url) === normalizeUrl(url));
          setSelectedBlockExplorer(predefinedExplorer ?? ({ key: 'custom', name: 'Custom', url } as BlockExplorer));
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

  const setDoNotTrackStorage = useCallback(async (value: boolean): Promise<void> => {
    try {
      await DefaultPreference.setName(GROUP_IO_SHROUD);
      if (value) {
        await DefaultPreference.set(ShroudApp.DO_NOT_TRACK, '1');
      } else {
        await DefaultPreference.clear(ShroudApp.DO_NOT_TRACK);
      }
      setIsDoNotTrackEnabled(value);
    } catch (e) {
      console.error('Error setting DoNotTrack:', e);
    }
  }, []);

  const setIsLegacyURv1EnabledStorage = useCallback(async (value: boolean): Promise<void> => {
    try {
      if (value) {
        await setUseURv1();
      } else {
        await clearUseURv1();
      }
      setIsLegacyURv1Enabled(value);
    } catch (e) {
      console.error('Error setting isLegacyURv1Enabled:', e);
    }
  }, []);

  const setIsClipboardGetContentEnabledStorage = useCallback(async (value: boolean): Promise<void> => {
    try {
      await setReadClipboardAllowed(value);
      setIsClipboardGetContentEnabled(value);
    } catch (e) {
      console.error('Error setting isClipboardGetContentEnabled:', e);
    }
  }, []);

  const setIsQuickActionsEnabledStorage = useCallback(async (value: boolean): Promise<void> => {
    try {
      await setIsDeviceQuickActionsEnabled(value);
      setIsQuickActionsEnabled(value);
    } catch (e) {
      console.error('Error setting isQuickActionsEnabled:', e);
    }
  }, []);
  const setIsTotalBalanceEnabledStorage = useCallback(async (value: boolean): Promise<void> => {
    try {
      await setTotalBalanceViewEnabledStorage(value);
      setIsTotalBalanceEnabled(value);
    } catch (e) {
      console.error('Error setting isTotalBalanceEnabled:', e);
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

  const setBlockExplorerStorage = useCallback(async (explorer: BlockExplorer): Promise<boolean> => {
    try {
      const success = await saveBlockExplorer(explorer.url);
      if (success) {
        setSelectedBlockExplorer(explorer);
      }
      return success;
    } catch (e) {
      console.error('Error setting BlockExplorer:', e);
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      preferredFiatCurrency,
      setPreferredFiatCurrencyStorage,
      isPrivacyBlurEnabled,
      setIsPrivacyBlurEnabled,
      isDoNotTrackEnabled,
      setDoNotTrackStorage,
      isLegacyURv1Enabled,
      setIsLegacyURv1EnabledStorage,
      isClipboardGetContentEnabled,
      setIsClipboardGetContentEnabledStorage,
      isQuickActionsEnabled,
      setIsQuickActionsEnabledStorage,
      isTotalBalanceEnabled,
      setIsTotalBalanceEnabledStorage,
      totalBalancePreferredUnit,
      setTotalBalancePreferredUnitStorage,
      selectedBlockExplorer,
      setBlockExplorerStorage,
      isElectrumDisabled,
      setIsElectrumDisabled,
    }),
    [
      preferredFiatCurrency,
      setPreferredFiatCurrencyStorage,
      isPrivacyBlurEnabled,
      setIsPrivacyBlurEnabled,
      isDoNotTrackEnabled,
      setDoNotTrackStorage,
      isLegacyURv1Enabled,
      setIsLegacyURv1EnabledStorage,
      isClipboardGetContentEnabled,
      setIsClipboardGetContentEnabledStorage,
      isQuickActionsEnabled,
      setIsQuickActionsEnabledStorage,
      isTotalBalanceEnabled,
      setIsTotalBalanceEnabledStorage,
      totalBalancePreferredUnit,
      setTotalBalancePreferredUnitStorage,
      selectedBlockExplorer,
      setBlockExplorerStorage,
      isElectrumDisabled,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
});
