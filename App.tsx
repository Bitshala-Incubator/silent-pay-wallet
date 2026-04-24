import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SizeClassProvider } from './components/Context/SizeClassProvider';
import { SettingsProvider } from './components/Context/SettingsProvider';
import { BlueDefaultTheme } from './components/themes';
import MasterView from './navigation/MasterView';
import { navigationRef } from './NavigationService';
import { useLogger } from '@react-navigation/devtools';
import { StorageProvider } from './components/Context/StorageProvider';
import { initializeIndexer } from './blue_modules/SilentPaymentIndexer';
import { initializeRustJsiBridge } from './blue_modules/RustJsiBridge';

const App = () => {
  initializeRustJsiBridge();
  initializeIndexer({
    baseUrl: 'https://superparamount-kendal-halting.ngrok-free.dev/',
    onionUrl: 'http://azzaasniov2hjxrkhpvjyse3a4jaww74n76umntatcerp4drzwotk5yd.onion',
    timeout: 100000, // 100 seconds for blockchain scanning operations (increased for slower connections)
  });

  useLogger(navigationRef);

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
