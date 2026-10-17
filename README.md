# Binance Paper Lab

A private, paper-only BTC experiment. No real Binance account, keys, deposits, orders or leverage.

## Run locally

Requires Node.js 22. Run npm ci once to install dependencies, then npm test. Double-click Start-Paper-Lab.cmd or run npm start. Open http://127.0.0.1:8788 . Keep the server running and PC awake; the browser can be closed. See QUICK_START.md for the daily routine and decision times.

## Simple home screen

Three independent 1,000 USDT virtual wallets: 4-hour slow trend, daily slow trend, and a one-time 20% buy-and-hold benchmark. Select a wallet for its balance, cash, BTC holdings, fees, drawdown, next decision and activity. Price/wallet charts build from actual forward observations, with buy/sell markers and visible monitoring gaps. The default is no retroactive strategy entries on startup. Missed buys are skipped; current exits may execute after reconnection. Pause blocks new entries but permits exits.

Signals use completed UTC-aligned bars and fixed EMA20/50/200 trend rules. Market checks occur about every 30 seconds. Simulated fills use the current quote with assumed 0.1% fees and 0.05% adverse price adjustment per side; these are not measured exchange executions or your personal fee rate. There is no guaranteed stop, liquidation on pause, or protection while the server is offline.

Start with 8–12 weeks of continuous observation; low-frequency daily trades can require months or longer. Intermittent PC use is valid but misses decisions and must not be reported as continuous forward testing.

## Historical research

Research is available at /research. Nine fixed variants, replay windows from 5 days to 3 years, matched starting capital/allocation, chronological comparisons, cost sensitivity and monthly checks. Inspected periods are exploratory, not fresh holdout evidence. RESEARCH_RESULTS.md records the extended test and limitations. Chart thinning changes presentation only; complete candle accounting determines historical results.

## State and hosting

Local state lives in state/forward.json. Existing paper.json, research.json and history.json are retained separately. All wallets and trade accounting persist between starts. Chart observations retain about 7 days; each strategy's full trades remain in saved state, with the latest 100 served to the simple dashboard. Observed-time and gap durations are approximate.

Heroku preparation is in HEROKU.md. Hosted mode requires a database, private dashboard password and exact HTTPS origin. PostgreSQL persists state across dyno restarts; a database advisory lock prevents concurrent hosted writers. Local file mode remains supported. Source repository: https://github.com/hasan-tec/Trading-bot . Heroku deployment is not active. Costs and final deployment checks are documented in HEROKU.md.

## Checks

npm test runs 29 tests. Optional real-browser checks require a dedicated hidden Chrome debugging session on port 9333: npm run test:browser:forward checks the simple dashboard; npm run test:browser checks the historical research page. Never use a personal Chrome profile for these checks.

Storage queries are tested with a PostgreSQL emulator. A real hosted database, TLS session and Heroku deployment have not been exercised.
