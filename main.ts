// WashoutHunter -- cbBTC bot for btc-race-24h-20261118-1444.
//
// Built on RangeRider round 8 (btc-race-20261117-0603, commit 8e74576),
// which graded +$8.60 on its dev window but LOST -$10.00 live: its
// 240-bar warmup blinded it for the first 4 hours, so it bought the
// washout dip 24 bars late, near the top of the bounce, and the 1%
// loss-cap latch then ended its race. The winners study
// (btc-race-20261117-winners-study.md) showed the leaders most likely
// traded the washout itself: -3.11% to $63,347.82, then a +1.61%
// V-bounce in 15 minutes, worth +$13.60 on that live window.
//
// THIS race's dev window (2026-11-17 14:44 UTC -> 2026-11-18 14:44 UTC)
// starts AFTER the $65,383 race high, so the same washout measures only
// -2.56% against this window's own high -- the study's L2 micro
// (3.0% dip) NEVER fires here, and L2 as specified scores -$8.52 on
// this dev window (it would FAIL the dev gate). The micro below is
// re-validated on THIS dev window, not copied blindly:
//
// WASHOUT MICRO -- the new mode, and the only change that matters.
// Entry when the trailing 30-minute LOW is at least 2.6% below the
// trailing 150-minute high of bar highs, the close is at/above that
// low (rec 0: buy AT the low, not after a bounce), AND the close 30
// bars ago was within 1.0% of that high (VELOCITY: the dip formed in
// <=30 bars -- a sharp washout, not a slow grind). Size 100% of cash.
// Exits: +1.2% take-profit, -0.8% hard stop, 0.2% trailing stop once
// +0.2% up, 120-bar hold, 40-bar cooldown between micro trades.
// Gated by the loss-cap latch like the snap (no micro while latched).
// Why the velocity filter: at a 2.6-2.8% dip the micro fires into the
// 20261113 slow grind-down and loses -$20.20 there; the velocity
// filter blocks every grind trigger (15/30 bars ago the grind was
// already 1.5-2.1% below its high) while passing both washouts
// (newdev: 30 bars ago -0.67%; live17: -0.28%). The filter is a
// structural separator (sharp fall vs slow grind), not a fitted point:
// vel 0.8-1.2% and vel_win 25-35 all give the same newdev result.
//
// POST-MICRO SNAP COOLDOWN -- snap entries are blocked for 90 bars
// after any micro exit. After the washout trade the snap would
// otherwise re-enter the still-falling market on a stale dip (the
// exact trade that killed round 8 live: -$10.93). 60 bars gives
// +$17.00 on newdev, 90-120 give +$19.92-20.38 (a plateau); 90 is
// the middle.
//
// WARMUP 30 (was 240): the washout on this dev window bottoms at bar
// ~68; a 240-bar warmup cannot see it at all. 30 bars of history is
// enough for every lookback this bot uses (longest is 420, and the
// rolling windows simply start short).
//
// NO ENTRY IN THE FINAL 5 BARS: a position opened on bar 1438 fills
// on the last bar and is flattened at the close -- a guaranteed fee
// loser (-$3.67 on this dev window). No new entries from bar 1435
// onward (24h x 60min = 1440 bars; the same rule applies to the race
// window). The bar count comes from state.seq, not closes.length
// (closes[] is capped at HISTORY).
//
// Everything else is round 8 unchanged: snapback (2.0%/2.7% dip vs
// the trailing 420-min high, recovery gate 0.2% above the trailing
// 30-min low, TP +1.0%/+0.8%, SL -0.8%/-2.5%, armed trail 0.8%,
// 240-bar hold, 20/40-bar cooldown, 1% loss cap latching snap
// entries off below $990 realised equity, re-arming once flat equity
// is back at $990), deep-V tiers (5.0%/5.3% below the trailing
// 360-min high, 40% then all-in, TP +4.5%, trail 1.2%, stop 1.5%),
// breakout rider (0.3% above the trailing 240-min high, MA8>MA21,
// 50% size). Deterministic integer math; no clock, no randomness,
// no network, no files. Standard library only, plus the kit's
// TypeScript shim vendored under vendor/ (byte-for-byte copy).
//
// Honest numbers (bit-perfect Python simulator sim21, same integer
// fill math as the kit; kit grade-local below must reproduce the
// newdev line):
//   dev 20261118 (this race): +$20.38, 4 trades, max DD 0.62%
//     micro buy 69 @ 63514.93 -> sell 81 @ 64291.76 (+$11.42)
//     snap  buy 181 @ 63836.61 -> sell 407 @ 64453.47 (+$8.96)
//   dev 20261117 (prev race): +$8.60, 2 trades, max DD 0.57%
//   prev race window 20261113: +$9.31, 6 trades, max DD 2.15%
//   prev race window 20261115: +$40.06, 6 trades, max DD 1.61%
//   mirrored dev window:       +$18.04, 4 trades, max DD 0.53%
//   live 20261117 (345 bars, truncated window, flatten artifact):
//                              +$7.26, 3 trades, max DD 0.43%
//     micro buy 214 @ 63492.34 -> sell 227 @ 64225.91 (+$10.74,
//     the exact washout trade the winners study inferred)
// Worst full window +$8.60, mean +$19.38. The micro is provably
// dormant on the 20261117 dev, 20261113, 20261115 and mirrored
// windows (identical to round 8 there) -- it only fires on a sharp
// washout, which is the one regime round 8 had no answer for.
// Neighbourhood checks (one parameter at a time): vel 0.8/1.0/1.2%
// newdev identical; hi_win 130/150/160 identical; dip 2.5/2.6%
// +$19.98/+$20.38; snap_cd_micro 60/90/120 +$17.00/+$20.38/+$19.92;
// warmup 30/60 identical. Max 12 waves per window; at most one
// position at a time.
//
// Costs: a full-size round trip pays about 26 bps in fees, slippage
// and impact, so the micro's 1.2% take-profit clears it with room,
// and the 0.2% trail banks a winner before it gives the move back.
// Every order caps slippage at 400 bps against the latest close;
// fills normally move 10-30 bps, so a fast minute cannot reject
// the entry that matters.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Snapback (round 8, unchanged).
const SNAP_DIP1 = 20n; // 2.0% below the trailing 420-min high of highs
const SNAP_DIP2 = 27n; // 2.7% below that high (tier 2)
const SNAP_HI_WIN = 420;
const SNAP_SIZE_PCT = 100n;
const SNAP_TAKE1 = 10n; // +1.0% over entry (tier 1)
const SNAP_STOP1 = 8n; // 0.8% under entry (tier 1)
const SNAP_TAKE2 = 8n; // +0.8% over entry (tier 2)
const SNAP_STOP2 = 25n; // 2.5% under entry (tier 2)
const SNAP_ARM = 8n; // trail arms once +0.8% up
const SNAP_TRAIL = 8n; // 0.8% below the peak since entry
const SNAP_HOLD = 240; // bars, then out
const SNAP_COOLDOWN = 20; // bars after an exit fill before re-entering
const SNAP_COOLDOWN_LOSS = 40; // bars after a LOSING snap exit
const SNAP_RECOVERY = 2n; // 0.2% above the trailing 30-min low
const SNAP_RECOVERY_WIN = 30;
const LOSS_CAP_USDC = 990_000_000n; // stop snap entries below $990 equity
const SNAP_CD_MICRO = 90; // bars after a micro exit fill before snap re-entry

// Washout micro (new; see header). Entry: trailing 30-min low at
// least 2.6% below the trailing 150-min high, close at/above that
// low, and the close 30 bars ago within 1.0% of that high (sharp
// washout, not a slow grind).
const MICRO_DIP = 26n; // 2.6% below the trailing 150-min high
const MICRO_HI_WIN = 150;
const MICRO_REC_WIN = 30;
const MICRO_VEL = 10n; // 1.0%: close 30 bars ago vs the high
const MICRO_VEL_WIN = 30;
const MICRO_SIZE_PCT = 100n; // spend 100% of cash
const MICRO_TAKE = 12n; // +1.2% over entry
const MICRO_STOP = 8n; // 0.8% under entry
const MICRO_ARM = 2n; // trail arms once +0.2% up
const MICRO_TRAIL = 2n; // 0.2% below the peak since entry
const MICRO_HOLD = 120; // bars, then out
const MICRO_CD = 40; // bars after a micro exit fill before re-entering
const MICRO_MAX_WAVES = 20;

// Deep V tiers (round 8, unchanged).
const DEEP1_DD = 50n; // 5.0% below the trailing 360-min high, tier 1
const DEEP2_DD = 53n; // 5.3% below the trailing 360-min high, tier 2
const DEEP_HIGH_WIN = 360;
const DEEP1_SIZE_PCT = 40n; // tier 1 spends 40% of cash
const DEEP_TAKE = 45n; // +4.5% over the blended entry
const DEEP_TRAIL = 12n; // 1.2% below the peak since entry
const DEEP_STOP = 15n; // 1.5% under entry
const DEEP_HOLD = 240;

// Breakout rider (round 8, unchanged).
const RIDER_BREAKOUT = 3n; // 0.3% above the trailing 240-min high
const RIDER_HIGH_WIN = 240;
const RIDER_SIZE_PCT = 50n;

const MAX_WAVES = 12;
const WARMUP_BARS = 30; // bars of history before any decision (was 240)
const HISTORY = 720; // closes kept (longest lookback is 420)
const NO_ENTRY_FROM_SEQ = 1435; // stop opening from bar 1435 onward (1440-bar window)
const SLIPPAGE_BPS = 400; // cap vs the latest close
const MIN_NOTIONAL = 1_000_000n; // 1 USDC in quote units

type Mode = 'snap' | 'deep' | 'rider' | 'micro';

/** Closes at price scale 5, oldest first. */
const closes: bigint[] = [];
/** Bar highs at price scale 5, oldest first. */
const highs: bigint[] = [];
let entryPrice = 0n; // volume-weighted entry price, 0n = flat
let peakSinceEntry = 0n; // highest close since entry
let holdBars = 0; // bars held in the current position
let waves = 0; // flat-entry buys sent in this window
let microWaves = 0; // micro buys sent in this window
let prevQty = 0n;
let mode: Mode | null = null; // mode of the open position
let scaled = false; // deep tier-2 scale-in already sent
let snapTier = 0; // snapback tier of the open position (1 or 2)
let lastExitSeq = -1_000_000; // seq of the batch the last sell filled on
let lastMicroExitSeq = -1_000_000; // seq of the batch the last micro sell filled on
let stopped = false; // loss-cap latch: snap/micro entries off for the window
let cashAtOpen = 0n; // cash when the open position's first buy was sent
let lastExitMode: Mode | null = null; // mode of the last closed trade
let lastExitWasLoss = false; // the last closed trade lost money

function highest(n: number): bigint {
  const start = Math.max(0, closes.length - n);
  let hi = closes[start];
  for (let i = start + 1; i < closes.length; i++) if (closes[i] > hi) hi = closes[i];
  return hi;
}

function highestHigh(n: number): bigint {
  const start = Math.max(0, highs.length - n);
  let hi = highs[start];
  for (let i = start + 1; i < highs.length; i++) if (highs[i] > hi) hi = highs[i];
  return hi;
}

function lowest(n: number): bigint {
  const start = Math.max(0, closes.length - n);
  let lo = closes[start];
  for (let i = start; i < closes.length; i++) if (closes[i] < lo) lo = closes[i];
  return lo;
}

function mean(n: number): bigint {
  const start = Math.max(0, closes.length - n);
  let s = 0n;
  for (let i = start; i < closes.length; i++) s += closes[i];
  return s / BigInt(closes.length - start);
}

function buy(notional: bigint): OrderInput {
  return { side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: SLIPPAGE_BPS };
}

// Rider keeps the old shallow exit profile (take 0.8%, trail 0.5%,
// stop 0.8%, hold 180): it never fired on any tested window, so the
// numbers there are the simulator's, not a fresh fit.
const RIDER_TAKE = 8n;
const RIDER_TRAIL = 5n;
const RIDER_STOP = 8n;
const RIDER_HOLD = 180;

function onBatch(state: BarsState): OrderInput[] {
  if (state.warmingUp) return [];
  const close = state.close(SYMBOL);
  if (close === null) return [];
  const bar = state.latest.get(SYMBOL);
  const high = bar === undefined ? close : BigInt(bar.h);
  closes.push(close);
  highs.push(high);
  if (closes.length > HISTORY) closes.shift();
  if (highs.length > HISTORY) highs.shift();

  const holding = state.positions.get(SYMBOL);
  const qty = holding === undefined ? 0n : holding.qty;

  // Loss cap, evaluated ONLY while flat and latching on REALISED equity:
  // an intra-trade trough no longer trips it. It does NOT gate deep
  // entries (the crash window's deep trade is what pays). It DOES gate
  // snap and micro entries.
  if (qty === 0n && state.equity < LOSS_CAP_USDC) stopped = true;

  // Re-arm: once flat and realised equity is back at or above the $990
  // line, the latch releases and snap/micro entries are allowed again.
  if (stopped && qty === 0n && state.equity >= LOSS_CAP_USDC) stopped = false;

  // A buy filled since the last batch: re-derive the averaged entry.
  // value(qty, price) = qty * price / 10**7, so price = cost * 10**7 / qty.
  if (qty > prevQty) {
    entryPrice = (holding!.cost * 10_000_000n) / qty;
    if (close > peakSinceEntry) peakSinceEntry = close;
    if (prevQty === 0n) holdBars = 0;
  }
  // A sell filled: the position is gone (this bot only ever sells all of it).
  if (qty === 0n && prevQty > 0n) {
    // Realised PnL of the closed trade: cash now minus cash when the
    // position's first buy was sent (drives the post-loss cooldown).
    lastExitWasLoss = state.cash < cashAtOpen;
    if (mode === 'micro') lastMicroExitSeq = state.seq;
    lastExitMode = mode;
    entryPrice = 0n;
    peakSinceEntry = 0n;
    holdBars = 0;
    mode = null;
    snapTier = 0;
    scaled = false;
    lastExitSeq = state.seq;
  }
  prevQty = qty;

  if (qty > 0n) {
    holdBars += 1;
    if (close > peakSinceEntry) peakSinceEntry = close;
    if (mode === 'deep') {
      if (
        close * 1000n >= entryPrice * (1000n + DEEP_TAKE) ||
        close * 1000n <= entryPrice * (1000n - DEEP_STOP) ||
        close * 1000n <= peakSinceEntry * (1000n - DEEP_TRAIL) ||
        holdBars >= DEEP_HOLD
      ) {
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: SLIPPAGE_BPS }];
      }
      // Deep tier 2: while holding tier 1, a further fall to 5.3% below
      // the trailing 360-minute high buys all remaining cash at the trough.
      if (!scaled && state.cash >= MIN_NOTIONAL) {
        const high360 = highest(DEEP_HIGH_WIN);
        if (close * 1000n <= high360 * (1000n - DEEP2_DD)) {
          scaled = true;
          return [buy(state.cash)];
        }
      }
      return [];
    }
    if (mode === 'micro') {
      // Washout micro exits: +1.2% take, -0.8% hard stop, 0.2%
      // trailing stop once +0.2% up, 120-bar hold.
      const armed = close * 1000n >= entryPrice * (1000n + MICRO_ARM);
      if (
        close * 1000n >= entryPrice * (1000n + MICRO_TAKE) ||
        close * 1000n <= entryPrice * (1000n - MICRO_STOP) ||
        (armed && close * 1000n <= peakSinceEntry * (1000n - MICRO_TRAIL)) ||
        holdBars >= MICRO_HOLD
      ) {
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: SLIPPAGE_BPS }];
      }
      return [];
    }
    if (mode === 'snap') {
      const take = snapTier === 2 ? SNAP_TAKE2 : SNAP_TAKE1;
      const stop = snapTier === 2 ? SNAP_STOP2 : SNAP_STOP1;
      const armed = close * 1000n >= entryPrice * (1000n + SNAP_ARM);
      if (
        close * 1000n >= entryPrice * (1000n + take) ||
        close * 1000n <= entryPrice * (1000n - stop) ||
        (armed && close * 1000n <= peakSinceEntry * (1000n - SNAP_TRAIL)) ||
        holdBars >= SNAP_HOLD
      ) {
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: SLIPPAGE_BPS }];
      }
      return [];
    }
    // Rider: plain trailing exit, no arm.
    if (
      close * 1000n >= entryPrice * (1000n + RIDER_TAKE) ||
      close * 1000n <= entryPrice * (1000n - RIDER_STOP) ||
      close * 1000n <= peakSinceEntry * (1000n - RIDER_TRAIL) ||
      holdBars >= RIDER_HOLD
    ) {
      return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: SLIPPAGE_BPS }];
    }
    return [];
  }

  if (closes.length < WARMUP_BARS || waves >= MAX_WAVES) return [];
  // No new position in the final 5 bars of a 1440-bar window: a fill
  // on the last bar is flattened at the close, a guaranteed fee loser.
  // NOTE: closes[] is capped at HISTORY (720), so the bar count must
  // come from state.seq, not closes.length.
  if (state.seq >= NO_ENTRY_FROM_SEQ) return [];

  const closeNow = close;
  const high360 = highest(DEEP_HIGH_WIN);

  // Deep tiers first: a crash window must not wait behind the snap rules.
  if (closeNow * 1000n <= high360 * (1000n - DEEP2_DD)) {
    waves += 1;
    mode = 'deep';
    cashAtOpen = state.cash;
    return [buy(state.cash)];
  }
  if (closeNow * 1000n <= high360 * (1000n - DEEP1_DD)) {
    waves += 1;
    mode = 'deep';
    cashAtOpen = state.cash;
    return [buy((state.cash * DEEP1_SIZE_PCT) / 100n)];
  }

  // Snapback: dip below the 420-minute high of bar highs, off a stopped
  // fall (close 0.2% above the trailing 30-minute low). Gated by the
  // 20/40-bar post-exit cooldown, the 2% loss-cap latch, and the
  // 90-bar post-micro cooldown (after a washout trade the snap must
  // not re-enter a still-falling market on a stale dip).
  const snapCd = lastExitMode === 'snap' && lastExitWasLoss ? SNAP_COOLDOWN_LOSS : SNAP_COOLDOWN;
  if (!stopped && state.seq - lastExitSeq >= snapCd && state.seq - lastMicroExitSeq >= SNAP_CD_MICRO) {
    const high420 = highestHigh(SNAP_HI_WIN);
    const low30 = lowest(SNAP_RECOVERY_WIN);
    if (closeNow * 1000n >= low30 * (1000n + SNAP_RECOVERY)) {
      if (closeNow * 1000n <= high420 * (1000n - SNAP_DIP2)) {
        waves += 1;
        mode = 'snap';
        snapTier = 2;
        cashAtOpen = state.cash;
        return [buy((state.cash * SNAP_SIZE_PCT) / 100n)];
      }
      if (closeNow * 1000n <= high420 * (1000n - SNAP_DIP1)) {
        waves += 1;
        mode = 'snap';
        snapTier = 1;
        cashAtOpen = state.cash;
        return [buy((state.cash * SNAP_SIZE_PCT) / 100n)];
      }
    }
  }

  // Washout micro: the trailing 30-minute low is at least 2.6% below
  // the trailing 150-minute high, the close is at/above that low
  // (buy AT the low), and the close 30 bars ago was within 1.0% of
  // that high (the dip formed fast -- a washout, not a slow grind).
  // Gated by the loss-cap latch and a 40-bar cooldown after a micro
  // exit. Tried after the snap so it never pre-empts the main trade.
  if (!stopped && microWaves < MICRO_MAX_WAVES && state.seq - lastMicroExitSeq >= MICRO_CD && closes.length > MICRO_VEL_WIN) {
    const high150 = highestHigh(MICRO_HI_WIN);
    const low30 = lowest(MICRO_REC_WIN);
    const close30Ago = closes[closes.length - 1 - MICRO_VEL_WIN];
    if (
      low30 * 1000n <= high150 * (1000n - MICRO_DIP) &&
      closeNow * 1000n >= low30 * 1000n &&
      close30Ago * 1000n >= high150 * (1000n - MICRO_VEL)
    ) {
      waves += 1;
      microWaves += 1;
      mode = 'micro';
      cashAtOpen = state.cash;
      return [buy((state.cash * MICRO_SIZE_PCT) / 100n)];
    }
  }

  // Breakout rider: a rising window where dips never come.
  const high240 = highest(RIDER_HIGH_WIN);
  if (
    closeNow * 1000n >= high240 * (1000n + RIDER_BREAKOUT) &&
    mean(8) > mean(21) &&
    closeNow > closes[closes.length - 5]
  ) {
    waves += 1;
    mode = 'rider';
    cashAtOpen = state.cash;
    return [buy((state.cash * RIDER_SIZE_PCT) / 100n)];
  }
  return [];
}

await runBars({ onBatch });
