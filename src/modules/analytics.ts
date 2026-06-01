import Bugsnag from '@bugsnag/react-native';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { ShroudApp } from '../class';

const shroudApp = ShroudApp.getInstance();

/**
 * in case Bugsnag was started, but user decided to opt out while using the app, we have this
 * flag `userHasOptedOut` and we forbid logging in `onError` handler
 * @type {boolean}
 */
let userHasOptedOut: boolean = false;

(async () => {
  // Don't try to start Bugsnag again as it's already initialized in native code
  // Just configure the existing instance if tracking is allowed
  let uniqueID: string | null = null;
  if (Platform.OS === 'ios') {
    uniqueID = await Application.getIosIdForVendorAsync();
  } else if (Platform.OS === 'android') {
    uniqueID = Application.getAndroidId();
  }

  const doNotTrack = await shroudApp.isDoNotTrackEnabled();

  if (doNotTrack) {
    userHasOptedOut = true;
    return;
  }

  // Configure the existing Bugsnag instance instead of starting a new one
  if (uniqueID) {
    Bugsnag.setUser(uniqueID);
  }

  // Add additional configuration if needed
  Bugsnag.addOnError(function (event) {
    return !userHasOptedOut;
  });
})();

const A = async (event: string) => {};

A.ENUM = {
  INIT: 'INIT',
  GOT_NONZERO_BALANCE: 'GOT_NONZERO_BALANCE',
  GOT_ZERO_BALANCE: 'GOT_ZERO_BALANCE',
  CREATED_WALLET: 'CREATED_WALLET',
  CREATED_LIGHTNING_WALLET: 'CREATED_LIGHTNING_WALLET',
  APP_UNSUSPENDED: 'APP_UNSUSPENDED',
};

A.setOptOut = (value: boolean) => {
  if (value) userHasOptedOut = true;
};

A.logError = (errorString: string) => {
  console.error(errorString);
  Bugsnag.notify(new Error(String(errorString)));
};

export default A;
