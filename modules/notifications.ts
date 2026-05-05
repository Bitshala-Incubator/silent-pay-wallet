import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import loc from '../loc';
import { groundControlUri } from './constants';
import { fetch } from '../util/fetch';

const PUSH_TOKEN = 'PUSH_TOKEN';
const GROUNDCONTROL_BASE_URI = 'GROUNDCONTROL_BASE_URI';
const NOTIFICATIONS_STORAGE = 'NOTIFICATIONS_STORAGE';
export const NOTIFICATIONS_NO_AND_DONT_ASK_FLAG = 'NOTIFICATIONS_NO_AND_DONT_ASK_FLAG';
let alreadyConfigured = false;
let baseURI = groundControlUri;

type TPushToken = {
  token: string;
  os: string;
};

type TPayload = {
  subText?: string;
  message?: string | object;
  foreground: boolean;
  userInteraction: boolean;
  address?: string;
  txid?: string;
  type?: number;
  hash?: string;
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const checkAndroidNotificationPermission = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('Failed to check notification permission:', err);
    return false;
  }
};

export const checkNotificationPermissionStatus = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (error) {
    console.error('Failed to check notification permissions:', error);
    return 'unavailable';
  }
};

let currentPermissionStatus = 'unavailable';
const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  if (nextAppState === 'active') {
    const isDisabledByUser = (await AsyncStorage.getItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG)) === 'true';
    if (!isDisabledByUser) {
      const newPermissionStatus = await checkNotificationPermissionStatus();
      if (newPermissionStatus !== currentPermissionStatus) {
        currentPermissionStatus = newPermissionStatus;
        if (newPermissionStatus === 'granted') {
          await initializeNotifications();
        }
      }
    }
  }
};

AppState.addEventListener('change', handleAppStateChange);

export const cleanUserOptOutFlag = async () => {
  return AsyncStorage.removeItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG);
};

export const tryToObtainPermissions = async () => {
  if (!isNotificationsCapable) return false;

  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (status !== 'granted') return false;

    return configureNotifications();
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

export const majorTomToGroundControl = async (addresses: string[], hashes: string[], txids: string[]) => {
  try {
    const noAndDontAskFlag = await AsyncStorage.getItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG);
    if (noAndDontAskFlag === 'true') return;

    if (!Array.isArray(addresses) || !Array.isArray(hashes) || !Array.isArray(txids)) {
      throw new Error('No addresses, hashes, or txids provided');
    }

    const pushToken = await getPushToken();
    if (!pushToken || !pushToken.token || !pushToken.os) return;

    const requestBody = JSON.stringify({
      addresses,
      hashes,
      txids,
      token: pushToken.token,
      os: pushToken.os,
    });

    const response = await fetch(`${baseURI}/majorTomToGroundControl`, {
      method: 'POST',
      headers: _getHeaders(),
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error(`Ground Control request failed with status ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    if (responseText) {
      return JSON.parse(responseText);
    }
    return {};
  } catch (error) {
    console.error('Error in majorTomToGroundControl:', error);
    throw error;
  }
};

export const checkPermissions = async () => {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
};

export const setLevels = async (levelAll: boolean) => {
  const pushToken = await getPushToken();
  if (!pushToken || !pushToken.token || !pushToken.os) return;

  try {
    const response = await fetch(`${baseURI}/setTokenConfiguration`, {
      method: 'POST',
      headers: _getHeaders(),
      body: JSON.stringify({
        level_all: !!levelAll,
        token: pushToken.token,
        os: pushToken.os,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to set token configuration: ' + response.statusText);
    }

    if (!levelAll) {
      await Notifications.dismissAllNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
      await AsyncStorage.setItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG, 'true');
    } else {
      await AsyncStorage.removeItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG);
    }
  } catch (error) {
    console.error('Error setting notification levels:', error);
  }
};

export const addNotification = async (notification: TPayload) => {
  let notifications: TPayload[] = [];
  try {
    const stringified = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE);
    if (stringified) notifications = JSON.parse(stringified);
  } catch (e) {
    notifications = [];
  }

  notifications.push(notification);
  await AsyncStorage.setItem(NOTIFICATIONS_STORAGE, JSON.stringify(notifications));
};

const postTokenConfig = async () => {
  const pushToken = await getPushToken();
  if (!pushToken || !pushToken.token || !pushToken.os) return;

  try {
    const lang = (await AsyncStorage.getItem('lang')) || 'en';
    const appVersion = Device.osName + ' ' + Device.osVersion + ';' + Application.applicationName + ' ' + Application.nativeApplicationVersion;

    await fetch(`${baseURI}/setTokenConfiguration`, {
      method: 'POST',
      headers: _getHeaders(),
      body: JSON.stringify({
        token: pushToken.token,
        os: pushToken.os,
        lang,
        app_version: appVersion,
      }),
    });
  } catch (e) {
    await AsyncStorage.setItem('lang', 'en');
    throw e;
  }
};

const _setPushToken = async (token: TPushToken) => {
  await AsyncStorage.setItem(PUSH_TOKEN, JSON.stringify(token));
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const configureNotifications = async (onProcessNotifications?: () => void) => {
  if (alreadyConfigured) return true;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return false;

    const expoToken = await Notifications.getDevicePushTokenAsync();
    const tokenStr = expoToken.data;
    const pushToken: TPushToken = { token: tokenStr, os: Platform.OS };

    await _setPushToken(pushToken);
    alreadyConfigured = true;

    Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data;
      const payload: TPayload = {
        subText: notification.request.content.subtitle || undefined,
        message: notification.request.content.body || undefined,
        foreground: AppState.currentState === 'active',
        userInteraction: false,
        ...data,
      };

      await addNotification(payload);

      if (payload.foreground && onProcessNotifications) {
        onProcessNotifications();
      }
    });

    Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      const payload: TPayload = {
        subText: response.notification.request.content.subtitle || undefined,
        message: response.notification.request.content.body || undefined,
        foreground: false,
        userInteraction: true,
        ...data,
      };

      await addNotification(payload);

      if (onProcessNotifications) {
        onProcessNotifications();
      }
    });

    return true;
  } catch (error) {
    console.error('Error configuring notifications:', error);
    return false;
  }
};

export const isGroundControlUriValid = async (uri: string) => {
  try {
    const response = await fetch(`${uri}/ping`, { headers: _getHeaders() });
    const json = await response.json();
    return !!json.description;
  } catch (_) {
    return false;
  }
};

export const isNotificationsCapable = true;

export const getPushToken = async (): Promise<TPushToken | null> => {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN);
    return token ? (JSON.parse(token) as TPushToken) : null;
  } catch (e) {
    await AsyncStorage.removeItem(PUSH_TOKEN);
    throw e;
  }
};

const getLevels = async () => {
  const pushToken = await getPushToken();
  if (!pushToken || !pushToken.token || !pushToken.os) return {};

  try {
    const response = await fetch(`${baseURI}/getTokenConfiguration`, {
      method: 'POST',
      headers: _getHeaders(),
      body: JSON.stringify({
        token: pushToken.token,
        os: pushToken.os,
      }),
    });

    if (!response) return {};
    return await response.json();
  } catch (_) {
    return {};
  }
};

export const unsubscribe = async (addresses: string[], hashes: string[], txids: string[]) => {
  if (!Array.isArray(addresses) || !Array.isArray(hashes) || !Array.isArray(txids)) {
    throw new Error('No addresses, hashes, or txids provided');
  }

  const token = await getPushToken();
  if (!token?.token || !token?.os) return;

  const body = JSON.stringify({
    addresses,
    hashes,
    txids,
    token: token.token,
    os: token.os,
  });

  try {
    const response = await fetch(`${baseURI}/unsubscribe`, {
      method: 'POST',
      headers: _getHeaders(),
      body,
    });

    if (!response.ok) {
      console.error('Failed to unsubscribe:', response.statusText);
      return;
    }

    return response;
  } catch (error) {
    console.error('Error during unsubscribe:', error);
    throw error;
  }
};

const _getHeaders = () => {
  return {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
};

export const clearStoredNotifications = async () => {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE, JSON.stringify([]));
  } catch (_) {}
};

export const getDeliveredNotifications = async () => {
  return Notifications.getPresentedNotificationsAsync();
};

export const removeDeliveredNotifications = async (identifiers: string[] = []) => {
  for (const id of identifiers) {
    await Notifications.dismissNotificationAsync(id);
  }
};

export const setApplicationIconBadgeNumber = async (badges: number) => {
  await Notifications.setBadgeCountAsync(badges);
};

export const removeAllDeliveredNotifications = async () => {
  await Notifications.dismissAllNotificationsAsync();
};

export const getDefaultUri = () => {
  return groundControlUri;
};

export const saveUri = async (uri: string) => {
  try {
    baseURI = uri || groundControlUri;
    await AsyncStorage.setItem(GROUNDCONTROL_BASE_URI, baseURI);
  } catch (error) {
    console.error('Error saving URI:', error);
    throw error;
  }
};

export const getSavedUri = async () => {
  try {
    const baseUriStored = await AsyncStorage.getItem(GROUNDCONTROL_BASE_URI);
    if (baseUriStored) {
      baseURI = baseUriStored;
    }
    return baseUriStored;
  } catch (e) {
    await AsyncStorage.setItem(GROUNDCONTROL_BASE_URI, groundControlUri);
    throw e;
  }
};

export const isNotificationsEnabled = async () => {
  try {
    const levels = await getLevels();
    const token = await getPushToken();
    const isDisabledByUser = (await AsyncStorage.getItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG)) === 'true';

    return !isDisabledByUser && !!token && !!levels.level_all;
  } catch (error) {
    if (error instanceof SyntaxError) throw error;
    return false;
  }
};

export const getStoredNotifications = async (): Promise<TPayload[]> => {
  let notifications: TPayload[] = [];
  try {
    const stringified = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE);
    if (stringified) notifications = JSON.parse(stringified);
    if (!Array.isArray(notifications)) notifications = [];
  } catch (e) {
    if (e instanceof SyntaxError) {
      notifications = [];
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE, '[]');
    } else {
      throw e;
    }
  }

  return notifications;
};

export const initializeNotifications = async (onProcessNotifications?: () => void) => {
  try {
    const noAndDontAskFlag = await AsyncStorage.getItem(NOTIFICATIONS_NO_AND_DONT_ASK_FLAG);
    if (noAndDontAskFlag === 'true') return;

    const baseUriStored = await AsyncStorage.getItem(GROUNDCONTROL_BASE_URI);
    baseURI = baseUriStored || groundControlUri;

    await setApplicationIconBadgeNumber(0);

    currentPermissionStatus = await checkNotificationPermissionStatus();

    const canProceed =
      Platform.OS === 'android'
        ? isNotificationsCapable && (await checkAndroidNotificationPermission())
        : currentPermissionStatus === 'granted';

    if (canProceed) {
      const token = await getPushToken();

      if (token) {
        await configureNotifications(onProcessNotifications);
        await postTokenConfig();
      } else {
        await tryToObtainPermissions();
      }
    }
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
    baseURI = groundControlUri;
    await AsyncStorage.setItem(GROUNDCONTROL_BASE_URI, groundControlUri).catch(() => {});
  }
};
