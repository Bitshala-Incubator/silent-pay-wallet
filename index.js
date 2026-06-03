import './gesture-handler';
import 'react-native-get-random-values';
import './shim.js';

import React, { useEffect } from 'react';
import { AppRegistry, LogBox } from 'react-native';

import App from './App';
import A from './modules/analytics';
import { restoreSavedPreferredFiatCurrencyAndExchangeFromStorage } from './modules/currency';
import BackgroundScanHeadless from './helpers/silent-payments/BackgroundScanHeadless';
import { requestBackgroundScanCancel } from './helpers/silent-payments/BackgroundScanTask';
import { getBackgroundScanEventEmitter } from './modules/BackgroundScanManager';

if (!Error.captureStackTrace) {
  // captureStackTrace is only available when debugging
  Error.captureStackTrace = () => {};
}

LogBox.ignoreLogs([
  'Require cycle:',
  'Battery state `unknown` and monitoring disabled, this is normal for simulators and tvOS.',
  'Open debugger to view warnings.',
  'Non-serializable values were found in the navigation state',
]);

const ShroudAppComponent = () => {
  useEffect(() => {
    restoreSavedPreferredFiatCurrencyAndExchangeFromStorage();
    A(A.ENUM.INIT);
  }, []);

  return <App />;
};

AppRegistry.registerComponent('Shroud', () => ShroudAppComponent);

// Android: WorkManager → BackgroundScanService starts this headless task.
AppRegistry.registerHeadlessTask('BackgroundScan', () => BackgroundScanHeadless);

// iOS: BGTaskScheduler tasks arrive as events from the BackgroundScanManager
// native module. Listeners attach at module scope (not in a component) so a
// cold background launch reaches JS as soon as the bundle loads.
const backgroundScanEmitter = getBackgroundScanEventEmitter();
if (backgroundScanEmitter) {
  backgroundScanEmitter.addListener('onBackgroundScanStart', event => BackgroundScanHeadless(event));
  backgroundScanEmitter.addListener('onBackgroundScanCancel', () => requestBackgroundScanCancel());
}
