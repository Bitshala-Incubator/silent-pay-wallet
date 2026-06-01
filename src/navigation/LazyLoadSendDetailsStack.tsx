import React, { lazy, Suspense } from 'react';

import { LazyLoadingIndicator } from './LazyLoadingIndicator';

const SendDetails = lazy(() => import('../screens/send/SendDetails'));
const Confirm = lazy(() => import('../screens/send/Confirm'));
const PsbtWithHardwareWallet = lazy(() => import('../screens/send/psbtWithHardwareWallet'));
const CreateTransaction = lazy(() => import('../screens/send/create'));
const Success = lazy(() => import('../screens/send/success'));
const CoinControl = lazy(() => import('../screens/send/CoinControl'));

// Export each component with its lazy loader and optional configurations
export const SendDetailsComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <SendDetails />
  </Suspense>
);
export const ConfirmComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <Confirm />
  </Suspense>
);
export const PsbtWithHardwareWalletComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <PsbtWithHardwareWallet />
  </Suspense>
);
export const CreateTransactionComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <CreateTransaction />
  </Suspense>
);
export const SuccessComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <Success />
  </Suspense>
);
export const CoinControlComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <CoinControl />
  </Suspense>
);
