import { BitcoinUnit } from '../../models/bitcoinUnits';

/** Pure formatting/derivation helpers for the send flow. No React, no I/O. */

/** "0.00000714 BTC · 7 sat/vByte" */
export const formatFeeOptionSubtitle = (btcAmount: string, rate: number, unitLabel: string): string =>
  `${btcAmount} BTC · ${rate} ${unitLabel}`;

export type FeeSpeedTier = 'fast' | 'medium' | 'slow';

/** Which confirmation-speed bucket a sat/vByte rate falls into, given the preset thresholds. */
export const feeSpeedTierForRate = (rate: number, fastestRate: number, mediumRate: number): FeeSpeedTier => {
  if (rate >= fastestRate) return 'fast';
  if (rate >= mediumRate) return 'medium';
  return 'slow';
};

/**
 * Approximates the fee for an arbitrary rate by scaling a known (fee, rate) pair linearly.
 * assumes the same coin selection (vsize) holds across the rate range; good enough
 * for a live preview, upgrade to a real coinselect call if estimates drift noticeably.
 */
export const estimateFeeForRate = (rate: number, knownFee: number, knownRate: number): number =>
  knownRate > 0 ? Math.round((knownFee / knownRate) * rate) : 0;

/** Sum of send amount and fee in sats; NaN inputs are treated as 0. */
export const computeTotalSats = (amountSats: number, feeSats: number): number =>
  (Number.isNaN(amountSats) ? 0 : amountSats) + (Number.isNaN(feeSats) ? 0 : feeSats);

/** True when the amount is unset/zero. 'MAX' is NOT empty. */
export const isAmountEmpty = (amount?: string | number): boolean => {
  if (amount === undefined || amount === null) return true;
  if (amount === 'MAX') return false;
  const n = Number(amount);
  return Number.isNaN(n) || n === 0;
};

/**
 * Strips a raw amount input to the valid character set for the given unit.
 * BTC: digits plus at most one decimal point. SATS: digits only.
 */
export const sanitizeAmountInput = (text: string, unit: BitcoinUnit): string => {
  if (unit === BitcoinUnit.SATS) {
    return text.replace(/[^0-9]/g, '');
  }
  const cleaned = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const [intPart, ...rest] = cleaned.split('.');
  if (!rest.length) return intPart;
  // BTC has 8 decimal places (1 sat); anything past that isn't a valid amount and, left
  // unclamped, produces fractional sats that diverge between the preview and the signed tx.
  return `${intPart}.${rest.join('').slice(0, 8)}`;
};

/**
 * Picks the string to display for the active unit, given the canonical BTC
 * string and sats number. Empty canonical amount -> ''. In sats mode, a
 * non-finite sats value renders as '' (never 'NaN').
 */
export const displayAmountForUnit = (amountBtc: string, amountSats: number, unit: BitcoinUnit): string => {
  if (!amountBtc) return '';
  if (unit === BitcoinUnit.SATS) {
    return Number.isFinite(amountSats) ? String(amountSats) : '';
  }
  return amountBtc;
};
