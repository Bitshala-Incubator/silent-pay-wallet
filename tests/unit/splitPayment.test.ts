import {
  SPLIT_MIN_OUTPUT_SATS,
  economicFloor,
  FLOOR_K,
  SPEND_INPUT_VBYTES,
  maxFeasibleCount,
  SPLIT_MAX_OUTPUTS,
  logUniformPartition,
  deRound,
  SPLIT_ROUND_MODULUS,
  planChangeOutputs,
  planSplitOutputs,
  estimateSplitExtraFee,
  canSplitPayment,
  partitionPaymentAmounts,
  SPLIT_SPREAD_RATIO,
} from '../../helpers/silent-payments/splitPayment';

// deterministic rng: every byte = value (default 0) so jitter is reproducible
const fixedRng =
  (value = 0) =>
  (size: number) =>
    Buffer.alloc(size, value);

describe('economicFloor', () => {
  it('is at least the absolute minimum at low fee rates', () => {
    const floor = economicFloor(1, fixedRng(0));
    expect(floor).toBeGreaterThanOrEqual(SPLIT_MIN_OUTPUT_SATS);
  });

  it('scales with fee rate above the minimum', () => {
    const floor = economicFloor(100, fixedRng(0)); // FLOOR_K * 58 * 100 = 17400... but >= MIN
    expect(floor).toBeGreaterThanOrEqual(FLOOR_K * SPEND_INPUT_VBYTES * 100);
  });

  it('adds bounded jitter (<= 10% of base) above the floor', () => {
    const base = economicFloor(50, fixedRng(0)); // jitter byte 0 -> jitter 0
    const jittered = economicFloor(50, fixedRng(0xff)); // max jitter
    expect(jittered).toBeGreaterThanOrEqual(base);
    expect(jittered - base).toBeLessThanOrEqual(Math.ceil(0.1 * base) + 1);
  });
});

describe('maxFeasibleCount', () => {
  it('caps at SPLIT_MAX_OUTPUTS for large amounts', () => {
    expect(maxFeasibleCount(10_000_000, 25_000)).toBe(SPLIT_MAX_OUTPUTS);
  });
  it('is limited by floor plus headroom for small amounts', () => {
    expect(maxFeasibleCount(80_000, 25_000)).toBe(2);
  });
  it('can be below 2 (not splittable) for tiny amounts', () => {
    expect(maxFeasibleCount(60_000, 25_000)).toBeLessThan(2);
  });
});

describe('logUniformPartition', () => {
  it('returns exactly n parts summing to total, each >= floor', () => {
    for (let trial = 0; trial < 30; trial++) {
      const parts = logUniformPartition(500_000, 4, 25_000);
      expect(parts).toHaveLength(4);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(500_000);
      for (const p of parts) expect(p).toBeGreaterThanOrEqual(25_000);
    }
  });

  it('returns whole-sat integers', () => {
    const parts = logUniformPartition(123_457, 3, 25_000);
    for (const p of parts) expect(Number.isInteger(p)).toBe(true);
  });

  it('spreads amounts (not a tight uniform cluster) across trials', () => {
    let sawSpread = false;
    for (let trial = 0; trial < 30 && !sawSpread; trial++) {
      const parts = logUniformPartition(1_000_000, 4, 25_000);
      const max = Math.max(...parts);
      const min = Math.min(...parts);
      if (max / min > 2) sawSpread = true; // log-uniform produces real spread
    }
    expect(sawSpread).toBe(true);
  });

  it('throws when total is too small for n parts above floor', () => {
    expect(() => logUniformPartition(40_000, 2, 25_000)).toThrow('too small');
  });
});

describe('deRound', () => {
  it('removes round values while preserving the exact sum', () => {
    const input = [100_000, 73_321]; // first is round (divisible by 1000)
    const out = deRound(input, 25_000);
    expect(out.reduce((a, b) => a + b, 0)).toBe(173_321);
    expect(out[0] % SPLIT_ROUND_MODULUS).not.toBe(0);
  });

  it('keeps every element >= floor', () => {
    const input = [50_000, 50_000, 50_000];
    const out = deRound(input, 25_000);
    for (const v of out) expect(v).toBeGreaterThanOrEqual(25_000);
    expect(out.reduce((a, b) => a + b, 0)).toBe(150_000);
  });

  it('returns single-element arrays unchanged (cannot compensate)', () => {
    const out = deRound([100_000], 25_000);
    expect(out).toEqual([100_000]);
  });

  it('draws the nudge from two bytes, so deltas beyond 256 are reachable', () => {
    // all-0xff rng -> delta = 1 + (0xffff % 999) = 601; a single-byte draw caps at 256
    const out = deRound([100_000, 73_321], 25_000, fixedRng(0xff));
    expect(out[0] - 100_000).toBe(601);
    expect(out.reduce((a, b) => a + b, 0)).toBe(173_321);
  });

  it('never ships a round amount for the measured near-floor failure shape', () => {
    // [5000, 4100] @ floor 4000: on the pre-fix single pass this shipped a round value
    // 89.9% of the time over 100k trials (partner has < delta of headroom). Real entropy here
    // (not a fixed seed) so the re-check pass is proven over the actual RNG, not one draw.
    for (let trial = 0; trial < 2000; trial++) {
      const out = deRound([5000, 4100], 4000);
      expect(out.some(v => v % SPLIT_ROUND_MODULUS === 0)).toBe(false);
      expect(out.reduce((a, b) => a + b, 0)).toBe(9100);
      for (const v of out) expect(v).toBeGreaterThanOrEqual(4000);
    }
  });

  it('leaves an amount round only when literally no other element has headroom above the floor', () => {
    // [4000, 4000] @ floor 4000: both elements are exactly at the floor, so de-rounding either
    // one would push it below the floor invariant — there is no fix that doesn't violate that,
    // so deRound correctly leaves the round amount rather than breaking the floor guarantee.
    const out = deRound([4000, 4000], 4000);
    expect(out).toEqual([4000, 4000]);
  });
});

describe('planChangeOutputs', () => {
  const common = { floor: 25_000, feeRate: 1, paymentCount: 3 };

  it('drops change below dust (returns empty)', () => {
    const out = planChangeOutputs({
      ...common,
      change: 329, // Just below dust threshold
      pMax: 80_000,
      coinSelectOutputCount: 3,
    });
    expect(out).toEqual([]);
  });

  it('retains change outputs exactly at the dust boundary (330 sats)', () => {
    const out = planChangeOutputs({
      ...common,
      change: 330,
      pMax: 80_000,
      feeRate: 0, // Avoid extra fee deductions for this exact test
      coinSelectOutputCount: 3,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(330);
  });

  it('returns a single in-distribution change output when change <= pMax', () => {
    const out = planChangeOutputs({
      ...common,
      change: 60_000,
      pMax: 80_000,
    });
    expect(out).toHaveLength(1);
    // single change is reduced only by the extra-output fee, not partitioned
    expect(out[0]).toBeLessThanOrEqual(60_000);
    expect(out[0]).toBeGreaterThan(0);
  });

  it('splits change into multiple in-range pieces when change is an outlier', () => {
    const out = planChangeOutputs({
      ...common,
      change: 1_000_000,
      pMax: 80_000,
    });
    expect(out.length).toBeGreaterThan(1);
    for (const v of out) expect(v).toBeGreaterThanOrEqual(25_000);
  });

  it('keeps change in one output when the sender declines to split it', () => {
    const out = planChangeOutputs({
      ...common,
      change: 1_000_000,
      pMax: 80_000, // same shape as the case above, which splits into multiple pieces
      splitChange: false,
    });
    expect(out.length).toBe(1);
  });

  it('falls back to fewer parts rather than a zero-headroom partition', () => {
    // change == 2 * floor exactly: partitioning it in two would put both parts on the floor, and
    // deRound cannot move value out of a set that is entirely at the floor — both would ship as
    // the round floor value. One roomier output is the right call.
    const out = planChangeOutputs({
      change: 50_000,
      pMax: 20_000, // forces the loop to start at m = 3
      floor: 25_000,
      feeRate: 0,
      paymentCount: 2,
      coinSelectOutputCount: 2,
    });
    expect(out).toEqual([50_000]);
  });

  it('accounts for the extra-output fee in the distributed total', () => {
    const change = 1_000_000;
    const feeRate = 10;
    const out = planChangeOutputs({
      ...common,
      change,
      feeRate,
      pMax: 80_000,
    });
    const distributed = out.reduce((a, b) => a + b, 0);
    expect(distributed).toBeLessThan(change); // fee for added outputs came out of change
  });
});

describe('planSplitOutputs', () => {
  it('payments always sum to exactly the payment value', () => {
    for (let trial = 0; trial < 30; trial++) {
      const { paymentAmounts } = planSplitOutputs({
        paymentValue: 500_000,
        changeValue: 120_000,
        feeRate: 5,
      });
      expect(paymentAmounts.reduce((a, b) => a + b, 0)).toBe(500_000);
    }
  });

  it('does not split when the amount is too small for the fee-relative floor', () => {
    // very high fee -> floor large -> maxFeasible < 2 -> single payment output
    const { paymentAmounts } = planSplitOutputs({
      paymentValue: 60_000,
      changeValue: 0,
      feeRate: 500,
    });
    expect(paymentAmounts).toEqual([60_000]);
  });

  it('splits large change into floor-respecting, in-family pieces', () => {
    const { paymentAmounts, changeAmounts } = planSplitOutputs({
      paymentValue: 300_000,
      changeValue: 500_000, // < 4 * 150_000, so it doesn't hit the 4-output cap
      feeRate: 2,
    });
    expect(changeAmounts.length).toBeGreaterThan(1);
    const pMax = Math.max(...paymentAmounts);
    for (const c of changeAmounts) {
      expect(c).toBeGreaterThanOrEqual(SPLIT_MIN_OUTPUT_SATS); // same floor family as payments
      expect(c).toBeLessThanOrEqual(pMax * (SPLIT_SPREAD_RATIO + 1)); // bounded by the log-uniform spread
    }
    const sum = changeAmounts.reduce((a, b) => a + b, 0);
    expect(sum).toBeLessThanOrEqual(500_000); // change pieces never exceed the change total
    expect(sum).toBeGreaterThan(500_000 - 50_000); // only small added-output fees are removed
  });

  it('caps change outputs at MAX_CHANGE_OUTPUTS', () => {
    const { changeAmounts } = planSplitOutputs({
      paymentValue: 300_000,
      changeValue: 5_000_000,
      feeRate: 2,
    });
    expect(changeAmounts.length).toBeLessThanOrEqual(4);
  });

  it('still splits the payment when the sender declines to split change', () => {
    const { paymentAmounts, changeAmounts } = planSplitOutputs({
      paymentValue: 300_000,
      changeValue: 5_000_000,
      feeRate: 2,
      splitChange: false,
    });
    expect(paymentAmounts.length).toBe(2);
    expect(changeAmounts.length).toBe(1);
  });

  it('never burns change: when it splits, a change output survives above dust', () => {
    for (let trial = 0; trial < 30; trial++) {
      const { paymentAmounts, changeAmounts } = planSplitOutputs({
        paymentValue: 500_000,
        changeValue: 5_000,
        feeRate: 50,
      });
      expect(paymentAmounts.reduce((a, b) => a + b, 0)).toBe(500_000);
      expect(paymentAmounts.length).toBeGreaterThan(1); // n shrinks, split still fires
      expect(changeAmounts.length).toBeGreaterThan(0); // change never silently burned
      expect(changeAmounts.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(330);
    }
  });

  it('never burns change for a pinned split whose change budget has since shrunk', () => {
    // A pin from the preview dry run fixes `n` so a re-draw of the jittered floor can't silently
    // re-randomize approved amounts — but it must NOT override the change-budget check. Change
    // below feePerOutput + dustThreshold is exactly where planChangeOutputs returns no change
    // output at all, and the builders only inspect paymentCount, so honouring the pin here would
    // pay the change to miners. Reachable when only the fee rate changed between preview and send.
    const feeRate = 5;
    const feePerOutput = Math.ceil(44 * feeRate); // OUTPUT_VBYTES * feeRate = 220
    const { paymentAmounts, changeAmounts } = planSplitOutputs({
      paymentValue: 500_000,
      changeValue: feePerOutput + 330 - 1, // 549: one sat below the budget threshold
      feeRate,
      coinSelectOutputCount: 2,
      precalculatedPaymentAmounts: [260_137, 239_863], // sums to paymentValue, so the pin is valid
    });

    // Declining to split is the safe outcome: the builders fall back to the plain single-output
    // send, which keeps the change.
    expect(paymentAmounts).toEqual([500_000]);
    expect(changeAmounts.length).toBeGreaterThan(0);
  });

  it('honours a valid pin when the change budget does allow the split', () => {
    const pin = [260_137, 239_863];
    const { paymentAmounts, changeAmounts } = planSplitOutputs({
      paymentValue: 500_000,
      changeValue: 50_000,
      feeRate: 5,
      coinSelectOutputCount: 2,
      precalculatedPaymentAmounts: pin,
    });

    expect(paymentAmounts).toEqual(pin); // exactly what the preview showed, not a re-draw
    expect(changeAmounts.length).toBeGreaterThan(0);
  });

  it('avoids round payment amounts', () => {
    // Seeded through the RandomSource seam for determinism instead of live entropy.
    for (let seed = 0; seed < 30; seed++) {
      const { paymentAmounts } = planSplitOutputs({
        paymentValue: 400_000,
        changeValue: 90_000,
        feeRate: 3,
        rng: fixedRng(seed),
      });
      expect(paymentAmounts.some(a => a % 1000 === 0)).toBe(false);
    }
  });
});

describe('estimateSplitExtraFee', () => {
  it('prices one extra output at ceil(OUTPUT_VBYTES * feeRate) — the planner feePerOutput', () => {
    expect(estimateSplitExtraFee(10, 1)).toBe(440); // 44 * 10
    expect(estimateSplitExtraFee(3, 1)).toBe(132); // ceil(44 * 3)
  });
  it('rounds the per-output vbyte cost up before multiplying (matches the planner)', () => {
    expect(estimateSplitExtraFee(1.5, 1)).toBe(Math.ceil(44 * 1.5)); // 66, not 64.5
  });
  it('scales linearly with the number of extra outputs', () => {
    expect(estimateSplitExtraFee(5, 3)).toBe(Math.ceil(44 * 5) * 3); // 660
  });
  it('is zero when there are no extra outputs (2-output preview shows 1 extra)', () => {
    expect(estimateSplitExtraFee(50, 0)).toBe(0);
  });
});

describe('canSplitPayment', () => {
  it('returns true for splittable amounts', () => {
    expect(canSplitPayment(450_000, 1)).toBe(true);
  });
  it('returns false when below the economic floor', () => {
    expect(canSplitPayment(12_000, 1)).toBe(false);
  });
  it('suppresses splitting at high fee rates (floor scales with feerate)', () => {
    // baseFloor(200) = 5 * 58 * 200 = 58000; with jitter margin + headroom, 100k can't make 2 pieces
    expect(canSplitPayment(100_000, 200)).toBe(false);
  });
});

describe('partitionPaymentAmounts', () => {
  it('returns n parts summing to value', () => {
    const amounts = partitionPaymentAmounts(500_000, 2, 1);
    expect(amounts).toHaveLength(2);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(500_000);
  });
  it('returns non-round amounts (de-rounded)', () => {
    // Seeded through the RandomSource seam: live entropy would make this a flaky CI failure
    // rather than a caught bug.
    for (let seed = 0; seed < 20; seed++) {
      const amounts = partitionPaymentAmounts(400_000, 2, 3, fixedRng(seed));
      expect(amounts.some(a => a % SPLIT_ROUND_MODULUS === 0)).toBe(false);
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(400_000);
    }
  });
});
