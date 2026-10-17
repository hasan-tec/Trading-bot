# Extended BTC research results — 17 October 2026

Source: Binance public API. Dataset: 31,200 validated hourly candles, 27 March 2023 through 17 October 2026. Replay evaluation: 18 October 2023 14:00 through 17 October 2026 13:59:59 Asia/Karachi (1,095 days); 4,920 preceding hourly warm-up candles.

Every strategy starts with 1,000 simulated USDT and allocates 20% of available cash per entry. One long position, no leverage. Fees 0.1% per side, adverse fill allowance 0.05% per side. Orders use the next hourly open after the signal candle closes. Four-hour/daily bars are complete and UTC-aligned. Open positions are marked to the final close, without a forced sale or hypothetical exit fee. Returns below are total returns, not annual returns.

| Strategy | Final USDT | Total return | Maximum drawdown | Closed trades | Win rate |
|---|---:|---:|---:|---:|---:|
| EMA 9/21 | 859.75 | -14.02% | 23.13% | 588 | 26.36% |
| SMA 9/21 | 802.44 | -19.76% | 28.56% | 717 | 30.68% |
| EMA + trend filter | 886.42 | -11.36% | 19.11% | 341 | 19.65% |
| 48h breakout | 1044.76 | 4.48% | 11.70% | 176 | 34.09% |
| Combined confirmation | 981.30 | -1.87% | 6.28% | 60 | 28.33% |
| 4h slow trend | 1235.63 | 23.56% | 7.83% | 83 | 22.89% |
| Daily slow trend | 1312.83 | 31.28% | 12.32% | 8 | 37.50% |
| 4h RSI / Bollinger | 979.62 | -2.04% | 7.45% | 66 | 60.61% |
| 4h market-condition switch | 1032.53 | 3.25% | 7.71% | 171 | 26.32% |

Allocation-matched buy-and-hold: 37.14%, final 1,371.40 USDT. It buys BTC with 20% of initial funds and retains 80% cash. No new strategy beats that total return in this period. Exposure differs across strategies.

## Later chronological checks

Validation: 22 September 2025 14:00 through 17 October 2026 13:59:59 Asia/Karachi. Each run resets to 1,000 USDT. The last 30% of downloaded history is chronological validation, not independent unseen evidence: recent data had already been inspected in earlier experiments. Thirteen separate monthly windows also reset to cash and must not be compounded.

| New candidate | Base-cost return | Higher-cost return | Closed trades |
|---|---:|---:|---:|
| 4h slow trend | 0.73% | 0.16% | 28 |
| Daily slow trend | -0.69% | -0.75% | 3 |
| 4h RSI / Bollinger | -4.01% | -4.60% | 31 |
| 4h market-condition switch | 0.23% | -0.51% | 37 |

Higher-cost checks increase adverse fill allowance to 0.1% per side while retaining 0.1% fees. Four-hour slow trend is positive but barely so under higher costs; daily trend has only eight completed trades across three years and includes an open position at the end. RSI/Bollinger has a 60.61% win rate yet loses money. There is no demonstrated reliable live edge.

## Fixed candidate rules

- 4h slow trend: Completed 4h candles: hold long when EMA20 > EMA50 and close > EMA200; otherwise exit. 20% allocation.
- Daily slow trend: Completed UTC daily candles: hold long when EMA20 > EMA50 and close > EMA200; otherwise exit. 20% allocation.
- 4h RSI / Bollinger: Completed 4h close below the 20-bar lower Bollinger band (2 standard deviations) and RSI14 < 30: buy. Exit at the middle band or RSI > 55. Exit at a 3% close-based loss or after 30 four-hour bars.
- 4h market-condition switch: 4h 20-bar efficiency ratio >= 0.35: use slow trend. Ratio <= 0.20: use RSI/Bollinger mean reversion. Otherwise stay in cash. Mean-reversion entries have a 3% close-based loss exit and 30-bar time limit. One position only.

These rule thresholds were implemented before fetching the extended dataset, without a parameter search. Market-condition efficiency ratio is absolute 20-bar price change divided by the sum of absolute bar changes. Range-entry loss and time limits are checked only at completed four-hour closes, with fills at the next hourly open. A gap can cause a loss beyond 3%. Trend positions do not use that range-specific stop.

## Verification and limits

21 automated tests pass. Browser checks exercised all replay controls and new strategy selection with no JavaScript exceptions. Screenshot: state/dashboard-candidates.png. Chart sampling affects display only; all hourly candles determine accounting and metrics.

An initial 250-day warm-up request encountered one malformed hourly row and a missing hour in March 2023. It was rejected. The final request used 205 days of warm-up, preserving the entire 1,095-day evaluation period and sufficient daily EMA200 history; no synthetic candle or interpolation was introduced.

All variants are historical research candidates. Prospective paper wallet still runs the original EMA baseline, and research never promotes a winner or changes its wallet. Live orders, exchange quantity constraints, order-book fills, spreads varying over time and forward-wallet entry locks are not simulated by these historical comparisons.
