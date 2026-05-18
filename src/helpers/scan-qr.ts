import { Camera } from 'expo-camera';
import { navigationRef } from '../navigation/NavigationService';

const isCameraAuthorizationStatusGranted = async () => {
  const { status } = await Camera.getCameraPermissionsAsync();
  return status === 'granted';
};

const requestCameraAuthorization = async () => {
  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === 'granted';
};

const scanQrHelper = async (): Promise<string> => {
  await requestCameraAuthorization();
  return new Promise(resolve => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('ScanQRCode', {
        showFileImportButton: true,
        onBarScanned: (data: string) => {
          resolve(data);
        },
      });
    }
  });
};

export { isCameraAuthorizationStatusGranted, requestCameraAuthorization, scanQrHelper };
