# Verification — 17 October 2026

- All 12 tests pass, including new replay checks for exactly 120 evaluation hours, warm-up exclusion, next-open execution and consistent accounting.
- Updated server running at http://127.0.0.1:8788. Confirmed live Binance ticker, PAPER RUNNING status, successful historical refresh through HTTP and direct Binance API source (not cache).
- Inspected Chrome screenshot state/dashboard.png: price and averages, four EMA buy/sell markers, trade journal, costs and final equity render correctly. Interactive playback controls were not manually clicked; script parsing and backend were tested.
- Five-day period: 12 October 2026 14:00 through 17 October 2026 13:59:59 Asia/Karachi. 120 hourly candles plus 100 prior warm-up hours. Initial balance 1,000 USDT, 20% allocation, 0.1% fee and 0.05% slippage per side.
- EMA: final 993.9474837 USDT, net -6.0525163 (-0.60525%), two completed trades, zero wins, fees 0.7928084 USDT, no ending BTC position.
- SMA: final 993.5989249 USDT, net -6.4010751 (-0.64011%), three completed trades, zero wins, fees 1.1909233 USDT, no ending BTC position.
- Allocation-matched buy-and-hold returned -0.45632%. Both crossover strategies underperformed it in this window. No profitability or live-trading qualification claimed.
- Occupied ports now show a readable message; favicon returns 204. Old 8787 server was left untouched.
- No private keys or real orders used. Binance and browser checks used approved access outside the restricted environment.

## Longer-window update

- 15 tests pass, adding future-data invariance for all five variants, previous-high breakout exclusion of the current candle, next-open fills, common evaluation boundaries, and window/account reset checks.
- Downloaded 9,072 completed Binance hourly candles (378 days). Ran 30, 90, 180 and 365-day evaluations from that dataset. Detailed metrics in state/window-comparison.json.
- 180-day net returns: EMA -2.755%, SMA -2.876%, trend filter +0.942%, breakout -2.723%, combined -0.587%; allocation-matched buy-and-hold +1.839%.
- 365-day net returns: EMA -14.967%, SMA -13.522%, trend filter -6.675%, breakout -5.544%, combined -3.504%; allocation-matched buy-and-hold -4.440%. Combined had only 23 completed trades.
- Updated local API accepted the 365-day request and returned five variants, 20 chronological/cost comparison rows and four validation windows. Live status PAPER RUNNING; no account keys or real orders.
- Visually inspected state/dashboard-multi.png from a real hidden Chrome render. The one-year comparison table, window/strategy selectors, monthly summary and replay markers render. Interactive controls were not manually exercised in this check.

## Three-year candidate implementation

21 tests now pass, including completed UTC aggregation, Wilder RSI seeding, multi-timeframe future independence, close-based loss/time exits with adverse gaps, and sampled-chart accounting alignment. Nine variants are compared; 36 chronological/cost rows and 13 monthly windows were generated.

Three-year results and caveats are recorded in RESEARCH_RESULTS.md. 31,200 real Binance hourly rows passed strict validation. No prices were invented or interpolated. Successful browser automation exercised strategy selection, play, pause, slider and final result; no JavaScript runtime errors. Screenshot state/dashboard-candidates.png. Forward paper configuration unchanged.

## Forward paper dashboard and local Heroku preparation

29 tests pass, including independent wallet accounting, first-start watermarks, benchmark purchase exactly once, JSON restore, fresh-candle entries, pause with continuing exits, offline gaps, skipped historical entries, stale-data rejection, hosted configuration/authentication, and PostgreSQL emulator upsert/reload. Duplicate hosted writer rejection is unit-tested; actual PostgreSQL advisory-lock contention and TLS must be checked on real infrastructure.

The running home screen has three new wallets, a compact API, selected-wallet chart/activity, next decision, monitoring coverage and desktop/mobile layouts. Browser controls passed with no runtime exceptions; screenshots state/dashboard-forward.png and state/dashboard-forward-mobile.png. The benchmark made one real-quote paper purchase; both trend wallets began flat and wait for fresh decision candles. Synthetic tests never populated live wallet state.

Heroku preparation includes private access, required persistent Postgres in hosted mode, a single-writer database lease, deployment manifest, source ignore rules and HEROKU.md. No Heroku CLI is installed here, no external repository was created and nothing was deployed. PostgreSQL queries were tested with pg-mem, not a real hosted database.

A real local server restart preserved all three wallet balances/holdings, the experiment start time and the one-time benchmark trade without duplicates. Latest check returned RUNNING. Result: state/restart-check.json.
