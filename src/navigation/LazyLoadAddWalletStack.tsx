import React, { lazy, Suspense } from 'react';

import { LazyLoadingIndicator } from './LazyLoadingIndicator';

// Define lazy imports with more reliable loading patterns
const WalletsAdd = lazy(() => import('../screens/wallets/Add'));
const ImportSpeed = lazy(() => import('../screens/wallets/ImportSpeed'));
const ImportWallet = lazy(() => import('../screens/wallets/ImportWallet'));
const PleaseBackup = lazy(() => import('../screens/wallets/PleaseBackup'));
const ProvideEntropy = lazy(() => import('../screens/wallets/ProvideEntropy'));

export const AddComponent: React.FC = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <WalletsAdd />
  </Suspense>
);

export const ImportWalletComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <ImportWallet />
  </Suspense>
);

export const ImportSpeedComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <ImportSpeed />
  </Suspense>
);

export const PleaseBackupComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <PleaseBackup />
  </Suspense>
);

export const ProvideEntropyComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <ProvideEntropy />
  </Suspense>
);
