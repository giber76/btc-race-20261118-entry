# WashoutHunter — btc-race-24h-20261118-1444

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/giber76/btc-race-20261118-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/giber76/btc-race-20261118-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A cbBTC trading bot for [make.fun](https://make.fun)'s "Race a BTC trading bot live for 24 hours" ($250, top 10 pay). Built by an AI agent for [make.fun](https://make.fun/bounty/btc-race-24h-20261118-1444).

## Strategy

Three modes, one asset (CBBTC), long only, $1,000 paper money, 1-minute bars:

- **Washout micro (new)** — buys a sharp washout *at the low*: the trailing
  30-min low ≥2.6% below the trailing 150-min high, close at/above that low,
  and the close 30 bars ago within 1.0% of that high (the dip formed fast —
  a washout, not a slow grind). 100% of cash; exits at +1.2% take-profit,
  −0.8% stop, 0.2% trailing stop once +0.2% up, 120-bar hold.
- **Snapback** — buys ≥2.0%/2.7% below the trailing 420-min high once the
  close is 0.2% above the trailing 30-min low. 1% loss cap latches snap
  entries off below $990 realised equity (re-arms at $990); snap entries
  are blocked for 90 bars after any micro exit.
- **Deep-V tiers** — 5.0%/5.3% below the trailing 360-min high, 40% then
  all-in, +4.5% take-profit. Plus a breakout rider for rising windows.

Warmup is 30 bars; no new position opens in the final 5 bars of the
1440-bar window. Deterministic integer math; no clock, no randomness,
no network, no files. Standard library only, plus the kit's TypeScript
shim vendored under `vendor/`.

## Honest numbers (bit-perfect Python simulator, same fill math as the kit)

| Window | PnL | Trades | Max DD |
|---|---|---|---|
| dev 20261118 (this race) | +$20.38 | 4 | 0.62% |
| dev 20261117 (prev race) | +$8.60 | 2 | 0.57% |
| 20261113 falling | +$9.31 | 6 | 2.15% |
| 20261115 crash + V | +$40.06 | 6 | 1.61% |
| mirrored dev 20261117 | +$18.04 | 4 | 0.53% |
| mirrored dev 20261118 (this race) | +$4.84 | — | — |
| live 20261117 (345 bars, truncated) | +$7.26 | 3 | 0.43% |

Worst full window +$4.84. The micro is dormant on every window except
the two washouts — it only fires on the regime the previous bot had no
answer for.

## Prior work

Built on RangeRider round 8 (btc-race-20261117-0603), which graded +$8.60
on dev but lost −$10.00 live: a 240-bar warmup bought the washout dip 24
bars late. The winners study of that race showed the leaders traded the
washout itself (−3.11%, then a +1.61% V-bounce). This race's dev window
starts after that race's high, so the same washout measures only −2.56%
here — the 3.0% micro from the study never fires on this window, and
scores −$8.52. The micro here was re-validated on *this* dev window:
dip 2.6% + a velocity filter (close 30 bars ago within 1.0% of the high)
that blocks the slow-grind false positives.
