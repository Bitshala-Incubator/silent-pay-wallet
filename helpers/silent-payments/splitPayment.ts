import { randomBytes } from '../../class/rng';

export const SPLIT_MAX_OUTPUTS = 2;
export const SPLIT_MIN_OUTPUT_SATS = 4000;
export const SPLIT_SPREAD_RATIO = 8;
export const FLOOR_K = 5;
export const SPLIT_HEADROOM = 1.5;
export const SPEND_INPUT_VBYTES = 58;
export const OUTPUT_VBYTES = 44;
export const SPLIT_ROUND_MODULUS = 1000;
export const DEFAULT_DUST_THRESHOLD = 330;
const MAX_CHANGE_OUTPUTS = 4;

export type RandomSource = (size: number) => Buffer;

function floatFromBytes(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset) / 0x100000000;
}

export function baseFloor(feeRate: number): number {
  const inputCost = Math.ceil(SPEND_INPUT_VBYTES * Math.max(1, feeRate));
  return Math.max(SPLIT_MIN_OUTPUT_SATS, FLOOR_K * inputCost);
}

export function economicFloor(feeRate: number, rng: RandomSource = randomBytes): number {
  const base = baseFloor(feeRate);
  const buf = rng(4);
  const jitter = Math.floor(floatFromBytes(buf, 0) * 0.1 * base);
  return base + jitter;
}

export function maxFeasibleCount(paymentValue: number, floor: number): number {
  const byFloor = Math.floor(paymentValue / (SPLIT_HEADROOM * floor));
  return Math.min(SPLIT_MAX_OUTPUTS, byFloor);
}

export function logUniformPartition(total: number, n: number, floor: number, rng: RandomSource = randomBytes): number[] {
  if (n <= 0) throw new Error('n must be at least 1');
  // defensive, deal with floating point imprecision in caller's total
  total = Math.round(total);
  if (n === 1) return [total];
  const budget = total - n * floor;
  if (budget < 0) throw new Error('total too small to split into n parts above the floor');

  const buf = rng(n * 4 + 1);
  const lnR = Math.log(SPLIT_SPREAD_RATIO);
  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    weights.push(Math.exp(floatFromBytes(buf, i * 4) * lnR));
  }
  const sumW = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map(w => floor + Math.floor((w / sumW) * budget));

  const slack = total - parts.reduce((a, b) => a + b, 0);
  parts[buf[n * 4] % n] += slack;
  return parts;
}

export function deRound(amounts: number[], floor: number, rng: RandomSource = randomBytes): number[] {
  const out = amounts.slice();
  if (out.length < 2) return out;

  // Iterate to a fixed point (bounded): near-floor partitions routinely leave no partner with a
  // full `delta` of headroom, and a compensating subtraction can re-land a partner exactly on a
  // round value. Each pass takes from the partner with the MOST headroom and shrinks the delta to
  // fit whatever is actually available, so a single sat of slack anywhere is enough to de-round.
  for (let pass = 0; pass < out.length + 1; pass++) {
    let changed = false;
    for (let i = 0; i < out.length; i++) {
      if (out[i] % SPLIT_ROUND_MODULUS !== 0) continue;
      let partner = -1;
      let bestHeadroom = 0;
      for (let j = 0; j < out.length; j++) {
        if (j === i) continue;
        const headroom = out[j] - floor;
        if (headroom > bestHeadroom) {
          bestHeadroom = headroom;
          partner = j;
        }
      }
      if (partner === -1) continue; // every other element is already at the floor; nothing to give

      const buf = rng(2);
      const wantedDelta = 1 + (buf.readUInt16BE(0) % (SPLIT_ROUND_MODULUS - 1));
      const delta = Math.min(wantedDelta, bestHeadroom);
      out[i] += delta;
      out[partner] -= delta;
      changed = true;
    }
    if (!changed) break;
  }

  return out;
}

export function planChangeOutputs(params: {
  change: number;
  pMax: number;
  floor: number;
  feeRate: number;
  paymentCount: number;
  coinSelectOutputCount?: number;
  outputVBytes?: number;
  dustThreshold?: number;
  splitChange?: boolean;
  rng?: RandomSource;
}): number[] {
  const { change, pMax, floor, feeRate, paymentCount } = params;
  const outputVBytes = params.outputVBytes ?? OUTPUT_VBYTES;
  const dustThreshold = params.dustThreshold ?? DEFAULT_DUST_THRESHOLD;
  const rng = params.rng ?? randomBytes;
  if (change <= 0) return [];

  const PRICED_OUTPUTS = params.coinSelectOutputCount ?? 2;
  const feePerOutput = Math.ceil(outputVBytes * feeRate);
  // Splitting change is the sender's choice. Declining caps the plan at the single change output
  // the plain builder would have produced; the payment itself still splits.
  const maxChangeOutputs = params.splitChange === false ? 1 : MAX_CHANGE_OUTPUTS;

  for (let m = Math.min(maxChangeOutputs, Math.max(1, Math.ceil(change / pMax))); m >= 1; m--) {
    const extraFee = Math.max(0, paymentCount + m - PRICED_OUTPUTS) * feePerOutput;
    const distributable = change - extraFee;
    if (distributable < dustThreshold) continue;
    if (m === 1) return [distributable];
    // Needs a modulus of slack above m * floor, not just m * floor: with zero budget every part
    // lands exactly on the floor, and deRound can't move value between parts that are all at the
    // floor — the whole set ships round. Fall back to fewer, roomier parts instead.
    if (distributable < m * floor + SPLIT_ROUND_MODULUS) continue;
    return logUniformPartition(distributable, m, floor, rng);
  }
  return [];
}

// partition a total value into `n` randomised, non-round amounts.
export function partitionPaymentAmounts(value: number, n: number, feeRate: number, rng: RandomSource = randomBytes): number[] {
  const floor = economicFloor(feeRate, rng);
  return deRound(logUniformPartition(value, n, floor, rng), floor, rng);
}

export function planSplitOutputs(params: {
  paymentValue: number;
  changeValue: number;
  feeRate: number;
  coinSelectOutputCount?: number;
  outputVBytes?: number;
  dustThreshold?: number;
  splitChange?: boolean;
  rng?: RandomSource;
  precalculatedPaymentAmounts?: number[];
}): { paymentAmounts: number[]; changeAmounts: number[] } {
  const { paymentValue, changeValue, feeRate } = params;
  const rng = params.rng ?? randomBytes;
  const outputVBytes = params.outputVBytes ?? OUTPUT_VBYTES;
  const dustThreshold = params.dustThreshold ?? DEFAULT_DUST_THRESHOLD;
  const coinSelectOutputCount = params.coinSelectOutputCount ?? 2;

  const floor = economicFloor(feeRate, rng);
  const feePerOutput = Math.ceil(outputVBytes * feeRate);

  const pinnedAmounts =
    params.precalculatedPaymentAmounts &&
    params.precalculatedPaymentAmounts.length >= 2 &&
    params.precalculatedPaymentAmounts.reduce((a, b) => a + b, 0) === paymentValue
      ? params.precalculatedPaymentAmounts
      : undefined;

  // A pinned split (from a preview dry run) fixes `n` up front, so a different economicFloor
  // draw at send time than at preview time can't flip `n` back to 1 and silently re-randomize
  // amounts the user already approved.
  let n = pinnedAmounts ? pinnedAmounts.length : maxFeasibleCount(paymentValue, floor) >= 2 ? 2 : 1;
  // The change budget still overrides a pin. This threshold is exactly the point below which
  // planChangeOutputs() can return no change output at all, and the builders only check
  // paymentCount — so letting a (possibly stale) pin through here burns the change to fees.
  // Falling back to n = 1 makes the builders decline instead, which is safe and visible.
  if (n >= 2 && changeValue < Math.max(0, 3 - coinSelectOutputCount) * feePerOutput + dustThreshold) {
    n = 1;
  }

  let paymentAmounts: number[];
  if (n < 2) {
    paymentAmounts = [paymentValue];
  } else if (
    params.precalculatedPaymentAmounts &&
    params.precalculatedPaymentAmounts.length === n &&
    params.precalculatedPaymentAmounts.reduce((a, b) => a + b, 0) === paymentValue
  ) {
    paymentAmounts = params.precalculatedPaymentAmounts;
  } else {
    paymentAmounts = partitionPaymentAmounts(paymentValue, n, feeRate, rng);
  }

  const pMax = Math.max(...paymentAmounts);
  let changeAmounts = planChangeOutputs({
    change: changeValue,
    pMax,
    floor,
    feeRate,
    paymentCount: paymentAmounts.length,
    coinSelectOutputCount,
    outputVBytes,
    dustThreshold,
    splitChange: params.splitChange,
    rng,
  });
  if (changeAmounts.length > 1) {
    changeAmounts = deRound(changeAmounts, floor, rng);
  }
  return { paymentAmounts, changeAmounts };
}

export function canSplitPayment(paymentValue: number, feeRate: number): boolean {
  const floorEstimate = Math.ceil(baseFloor(feeRate) * 1.1);
  return maxFeasibleCount(paymentValue, floorEstimate) >= 2;
}

export function estimateSplitExtraFee(feeRate: number, extraOutputs: number): number {
  return Math.ceil(OUTPUT_VBYTES * Math.max(1, feeRate)) * Math.max(0, extraOutputs);
}
