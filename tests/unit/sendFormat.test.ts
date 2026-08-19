import {
  formatFeeOptionSubtitle,
  computeTotalSats,
  isAmountEmpty,
  sanitizeAmountInput,
  displayAmountForUnit,
  feeSpeedTierForRate,
  estimateFeeForRate,
} from '../../helpers/send/format';
import { BitcoinUnit } from '../../models/bitcoinUnits';

describe('send/format', () => {
  describe('formatFeeOptionSubtitle', () => {
    it('composes the btc amount, rate and unit', () => {
      expect(formatFeeOptionSubtitle('0.00000714', 7, 'sat/vByte')).toBe('0.00000714 BTC · 7 sat/vByte');
    });
  });

  describe('computeTotalSats', () => {
    it('adds amount and fee', () => {
      expect(computeTotalSats(4000, 511)).toBe(4511);
    });
    it('treats NaN inputs as zero', () => {
      expect(computeTotalSats(NaN, 511)).toBe(511);
      expect(computeTotalSats(4000, NaN)).toBe(4000);
    });
  });

  describe('isAmountEmpty', () => {
    it('is true for undefined, empty, zero, and non-numeric strings', () => {
      expect(isAmountEmpty(undefined)).toBe(true);
      expect(isAmountEmpty('')).toBe(true);
      expect(isAmountEmpty('0')).toBe(true);
      expect(isAmountEmpty(0)).toBe(true);
      expect(isAmountEmpty('.')).toBe(true);
      expect(isAmountEmpty(',')).toBe(true);
    });
    it('is false for a positive amount and for MAX', () => {
      expect(isAmountEmpty('0.0001')).toBe(false);
      expect(isAmountEmpty('MAX')).toBe(false);
    });
  });

  describe('sanitizeAmountInput', () => {
    it('keeps digits and a single dot in BTC mode, dropping extras', () => {
      expect(sanitizeAmountInput('0.0000344', BitcoinUnit.BTC)).toBe('0.0000344');
      expect(sanitizeAmountInput('abc1.2.3', BitcoinUnit.BTC)).toBe('1.23');
      expect(sanitizeAmountInput('1,000.5', BitcoinUnit.BTC)).toBe('1.0005');
      expect(sanitizeAmountInput('1.2.3.4', BitcoinUnit.BTC)).toBe('1.234');
    });
    it('clamps BTC input to 8 decimal places (1 sat), the smallest unit', () => {
      expect(sanitizeAmountInput('0.123456789', BitcoinUnit.BTC)).toBe('0.12345678');
      expect(sanitizeAmountInput('1.234567891234', BitcoinUnit.BTC)).toBe('1.23456789');
      expect(sanitizeAmountInput('0.00000001', BitcoinUnit.BTC)).toBe('0.00000001'); // exactly 8 unaffected
    });
    it('keeps digits only in sats mode, dropping dots and separators', () => {
      expect(sanitizeAmountInput('3440', BitcoinUnit.SATS)).toBe('3440');
      expect(sanitizeAmountInput('3,440 sats', BitcoinUnit.SATS)).toBe('3440');
      expect(sanitizeAmountInput('0.5', BitcoinUnit.SATS)).toBe('05');
    });
    it('returns empty string for empty input in either unit', () => {
      expect(sanitizeAmountInput('', BitcoinUnit.BTC)).toBe('');
      expect(sanitizeAmountInput('', BitcoinUnit.SATS)).toBe('');
    });
  });

  describe('displayAmountForUnit', () => {
    it('shows the BTC string in BTC mode', () => {
      expect(displayAmountForUnit('0.0000344', 3440, BitcoinUnit.BTC)).toBe('0.0000344');
    });
    it('shows the integer sats string in sats mode', () => {
      expect(displayAmountForUnit('0.0000344', 3440, BitcoinUnit.SATS)).toBe('3440');
    });
    it('returns empty string when the amount is empty, in either unit', () => {
      expect(displayAmountForUnit('', 0, BitcoinUnit.BTC)).toBe('');
      expect(displayAmountForUnit('', 0, BitcoinUnit.SATS)).toBe('');
    });
    it('preserves in-progress BTC typing like "0."', () => {
      expect(displayAmountForUnit('0.', 0, BitcoinUnit.BTC)).toBe('0.');
    });
    it('returns empty string in sats mode when sats is not finite', () => {
      expect(displayAmountForUnit('.', NaN, BitcoinUnit.SATS)).toBe('');
    });
  });

  describe('feeSpeedTierForRate', () => {
    it('picks fast at or above the fastest preset rate', () => {
      expect(feeSpeedTierForRate(8, 8, 5)).toBe('fast');
      expect(feeSpeedTierForRate(20, 8, 5)).toBe('fast');
    });
    it('picks medium between the medium and fastest preset rates', () => {
      expect(feeSpeedTierForRate(5, 8, 5)).toBe('medium');
      expect(feeSpeedTierForRate(7, 8, 5)).toBe('medium');
    });
    it('picks slow below the medium preset rate', () => {
      expect(feeSpeedTierForRate(1, 8, 5)).toBe('slow');
    });
  });

  describe('estimateFeeForRate', () => {
    it('scales a known fee/rate pair linearly to a new rate', () => {
      expect(estimateFeeForRate(4, 1024, 8)).toBe(512);
    });
    it('returns 0 when the known rate is 0 (avoids divide-by-zero)', () => {
      expect(estimateFeeForRate(4, 1024, 0)).toBe(0);
    });
  });
});
