import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import React, { lazy, Suspense } from 'react';
import UnlockWith from '../screens/UnlockWith';
import { LazyLoadingIndicator } from './LazyLoadingIndicator';
import { DetailViewStackParamList } from './DetailViewStackParamList';
import { useStorage } from '../hooks/context/useStorage';

// Lazy load all components except UnlockWith
const DrawerRoot = lazy(() => import('./DrawerRoot'));
const AddWalletStack = lazy(() => import('./AddWalletStack'));
const SendDetailsStack = lazy(() => import('./SendDetailsStack'));
const WalletExportStack = lazy(() => import('./WalletExportStack'));
const WalletXpubStackRoot = lazy(() => import('./WalletXpubStack'));
const ScanQRCode = lazy(() => import('../screens/send/ScanQRCode'));

const NavigationDefaultOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: 'modal',
  headerShadowVisible: false,
};
const NavigationFormNoSwipeDefaultOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: 'modal',
  headerShadowVisible: false,
  fullScreenGestureEnabled: false,
};
const StatusBarLightOptions: NativeStackNavigationOptions = { statusBarStyle: 'light' };

const DetailViewStack = createNativeStackNavigator<DetailViewStackParamList>();

// Lazy loading wrapper components
const LazyDrawerRoot = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <DrawerRoot />
  </Suspense>
);

const LazyAddWalletStack = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <AddWalletStack />
  </Suspense>
);

const LazySendDetailsStack = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <SendDetailsStack />
  </Suspense>
);

const LazyWalletExportStack = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <WalletExportStack />
  </Suspense>
);

const LazyWalletXpubStackRoot = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <WalletXpubStackRoot />
  </Suspense>
);

const LazyScanQRCodeComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <ScanQRCode />
  </Suspense>
);

const MainRoot = () => {
  const { walletsInitialized } = useStorage();

  return (
    <DetailViewStack.Navigator screenOptions={{ headerShown: false }}>
      {!walletsInitialized ? (
        <DetailViewStack.Screen name="UnlockWithScreen" component={UnlockWith} />
      ) : (
        <>
          <DetailViewStack.Screen name="DrawerRoot" component={LazyDrawerRoot} />

          {/* Modal stacks */}
          <DetailViewStack.Screen
            name="AddWalletRoot"
            component={LazyAddWalletStack}
            options={{
              ...NavigationDefaultOptions,
              presentation: 'fullScreenModal',
              fullScreenGestureEnabled: false,
              gestureEnabled: false,
            }}
          />
          <DetailViewStack.Screen name="SendDetailsRoot" component={LazySendDetailsStack} options={NavigationFormNoSwipeDefaultOptions} />
          <DetailViewStack.Screen
            name="WalletExportRoot"
            component={LazyWalletExportStack}
            options={{ ...NavigationDefaultOptions, ...StatusBarLightOptions }}
          />
          <DetailViewStack.Screen
            name="WalletXpubRoot"
            component={LazyWalletXpubStackRoot}
            options={{ ...NavigationDefaultOptions, ...StatusBarLightOptions }}
          />

          <DetailViewStack.Screen
            name="ScanQRCode"
            component={LazyScanQRCodeComponent}
            options={{
              headerShown: false,
              statusBarHidden: true,
              orientation: 'portrait',
              presentation: 'fullScreenModal',
            }}
          />
        </>
      )}
    </DetailViewStack.Navigator>
  );
};

export default MainRoot;
export { DetailViewStack };
