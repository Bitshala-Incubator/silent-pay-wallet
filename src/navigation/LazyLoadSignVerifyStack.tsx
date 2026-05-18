import React, { lazy, Suspense } from 'react';

import { LazyLoadingIndicator } from './LazyLoadingIndicator';

const SignVerify = lazy(() => import('../screens/wallets/signVerify'));

export const SignVerifyComponent = () => (
  <Suspense fallback={<LazyLoadingIndicator />}>
    <SignVerify />
  </Suspense>
);
