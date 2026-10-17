# Your live paper test

The home screen is now the forward paper dashboard: http://127.0.0.1:8788 . Historical research is at /research.

## What you do

Double-click Start-Paper-Lab.cmd. Leave the server window open or minimized and the PC awake with internet. You can game and close the browser; the server still works. There are no daily manual trades to place. Open the dashboard whenever you want to check results. To stop, close the server or use Ctrl+C. Start it again later to restore the saved wallets.

Each independent wallet starts with 1,000 fake USDT:

- 4-hour trend: decides at 01:00, 05:00, 09:00, 13:00, 17:00 and 21:00 Pakistan time.
- Daily trend: decides at 05:00 Pakistan time, when the UTC daily candle completes.
- Buy & hold: buys with 20% once on the first successful observation, then holds BTC.

The trend wallets use the fixed slow-trend rules already backtested: completed EMA20 above EMA50 and close above EMA200 means a long position; otherwise exit. Each entry uses 20% of available cash, without adding to an open position. Checks run about every 30 seconds; actual trade observations can be delayed. Fills are current public quotes with simulated costs, not actual exchange fills.

## How long to leave it running

24/7 is best for a continuous test. Start with 8–12 weeks of observations and review the number of completed trades; this is an observation period, not a profitability qualification. The daily strategy can need several months or longer. There is no required daily number of trades.

Running only during gaming hours is allowed, but it is an intermittent experiment. It can miss daily decisions (particularly the 05:00 check). Sleep, shutdown and network failures stop observation. The app reports monitoring gaps, skips missed buys and never invents historical fills. A holding can change in value while offline; it is not automatically protected during a shutdown.

The chart records a point about every 5 minutes and retains approximately 7 days of observed points; gaps break the line. Trades persist independently of chart sampling. The first chart starts empty because this is a real forward experiment, not a historical replay. Fees and adverse fill assumptions can make buy & hold slightly negative immediately after its first purchase.

Pause new buys applies to the three new wallets; trend exits remain active. It does not sell positions or stop the server. Old research and the original EMA paper wallet are preserved separately in existing state files.

For always-on hosting while your PC is off, see HEROKU.md. Hosting preparation is complete locally; nothing has been published or paid for.
