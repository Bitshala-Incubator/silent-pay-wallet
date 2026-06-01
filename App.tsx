import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SizeClassProvider } from './src/components/Context/SizeClassProvider';
import { SettingsProvider } from './src/components/Context/SettingsProvider';
import { BlueDefaultTheme } from './src/components/themes';
import MasterView from './src/navigation/MasterView';
import { navigationRef } from './src/navigation/NavigationService';
import { useLogger } from '@react-navigation/devtools';
import { StorageProvider } from './src/components/Context/StorageProvider';
import { initializeIndexer } from './src/modules/SilentPaymentIndexer';
import { initializeRustJsiBridge } from './src/modules/RustJsiBridge';
import { INDEXER_BASE_URL } from '@env';

const App = () => {
  initializeRustJsiBridge();

  if (!INDEXER_BASE_URL) throw new Error('INDEXER_BASE_URL is not set');

  initializeIndexer({
    baseUrl: INDEXER_BASE_URL,
    timeout: 100000, // 100 seconds for blockchain scanning operations (increased for slower connections)
  });

  useLogger(navigationRef as any);

  return (
    <SizeClassProvider>
      <NavigationContainer ref={navigationRef} theme={BlueDefaultTheme}>
        <SafeAreaProvider>
          <StorageProvider>
            <SettingsProvider>
              <MasterView />
            </SettingsProvider>
          </StorageProvider>
        </SafeAreaProvider>
      </NavigationContainer>
    </SizeClassProvider>
  );
};

export default App;
