import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SizeClassProvider } from './components/Context/SizeClassProvider';
import { SettingsProvider } from './components/Context/SettingsProvider';
import { BlueCurrentTheme, BlueDarkTheme, BlueDefaultTheme } from './components/themes';
import MasterView from './navigation/MasterView';
import { navigationRef } from './NavigationService';
import { useLogger } from '@react-navigation/devtools';
import { StorageProvider } from './components/Context/StorageProvider';
import { initializeIndexer } from './blue_modules/SilentPaymentIndexer';
import CustomAlert, { CustomAlertHandle } from './components/CustomAlert';
import { setCustomAlertRef } from './components/Alert';

const App = () => {
  const customAlertRef = React.useRef<CustomAlertHandle>(null);

  React.useEffect(() => {
    setCustomAlertRef(customAlertRef.current);
    initializeIndexer({
      baseUrl: 'https://cushionlike-isabel-retrievable.ngrok-free.dev/',
      timeout: 100000, // 100 seconds for blockchain scanning operations (increased for slower connections)
    });
    return () => setCustomAlertRef(null);
  }, []);

  const colorScheme = useColorScheme();

  React.useEffect(() => {
    BlueCurrentTheme.updateColorScheme();
  }, [colorScheme]);

  useLogger(navigationRef);

  return (
    <SizeClassProvider>
      <NavigationContainer ref={navigationRef} theme={colorScheme === 'dark' ? BlueDarkTheme : BlueDefaultTheme}>
        <SafeAreaProvider>
          <StorageProvider>
            <SettingsProvider>
              <MasterView />
            </SettingsProvider>
          </StorageProvider>
        </SafeAreaProvider>
      </NavigationContainer>
      <CustomAlert ref={customAlertRef} />
    </SizeClassProvider>
  );
};

export default App;
