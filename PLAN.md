# BTC paper bot plan

## Current MVP
Real Binance BTCUSDT hourly history; simulated money. Replay the last 120 completed hours with 100 preceding warm-up hours, EMA/SMA 9/21, next-open fills, trade fees and profit. A separate persistent wallet polls live prices every 30 seconds and acts on newly completed hourly crossovers. Leave the server running and PC awake. Simulated trades need no human approval.

Open http://127.0.0.1:8788 for the updated running app. Click Play replay, drag the slider, select EMA or SMA, or Show final result. Run / refresh BTC backtests fetches fresh history. Replay trades and prospective paper trades have separate journals. No trades for hours is normal for hourly crossovers. First connection does not buy old signals.

The supplied video transcript describes a 9/21 moving-average crossover but does not definitively specify SMA versus EMA. It mixes simulated paths, historical testing and forward testing; the claimed profit cannot be reproduced from the transcript alone.

## Research sequence
1. Keep the fixed crossover baseline. Five days demonstrates behavior, not an investment edge. Current assumptions: 0.1% fee and 0.05% adverse fill adjustment per side, with 20% cash allocation per entry.
2. Evaluate longer historical windows across multiple market regimes, ideally years of available hourly data. Predefine chronological development and untouched test windows. Existing viewed validation results cannot be reused as fresh holdout evidence.
3. Test a few hypotheses separately: a longer trend filter, ATR volatility filter or sizing rule, and a breakout baseline. Compare after costs with unchanged crossover and allocation-matched buy-and-hold. Avoid adding many indicators or tuning to five days.
4. Add rolling chronological evaluation, cost sensitivity, exposure, turnover and trade counts. Inspect dependence on a few lucky trades. Record every variant tried.
5. Collect weeks of forward paper observations, longer if trades are scarce. Check disconnections, missed signals, restarts and spread assumptions. Historical next-open fills and prospective 30-second polling are different approximations, neither guarantees actual fills.
6. After separate approval, implement Binance Spot Testnet order handling: exchange quantity/notional filters, duplicate prevention, reconciliation and restart recovery. This app currently uses a local paper wallet, not a Binance Testnet account.
7. Real trading needs a separate implementation and explicit decision. Confirm current regional/account requirements. Use a restricted trading API key, disable withdrawals, use IP allowlisting where available, store secrets outside browser code, verify actual commissions, define emergency stop and begin with a small capped allocation. Never paste keys into chat.

## Costs and operation
No paid dependencies, AI inference or hosting subscription in this app. Running locally uses your electricity and internet. Optional always-on hosting is separate. Public spot market data requires no account or key: https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md
Real trades incur account/pair-dependent commissions: https://github.com/binance/binance-spot-api-docs/blob/master/faqs/commission_faq.md and https://www.binance.com/en-GB/fee/trading
No algorithm has been established here as best or profitable.

The launcher defaults to port 8787. An occupied port now prints a readable message. Close the old server before starting another instance against the same state files: multiple instances must not independently trade one wallet. The old 8787 instance was left untouched; use the updated 8788 instance for this session.

## Implemented research expansion
30/90/180/365-day windows, trend-filter and breakout candidates, combined confirmation, profit factor and average trade, common chronological boundaries, higher-cost stress and monthly stability checks are now implemented. No parameter search or winner promotion was added. The one-year results are negative across these candidates, so continue prospective paper observation and test new hypotheses on genuinely subsequent data rather than treating the best viewed backtest as proven.

Backtests are hypothetical; source: https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-47
