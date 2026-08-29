# Trade Ideas

A pre-market trade planning app. Load the trade ideas you've researched from
your watchlist and scanners the night before, so when the market opens you
already know the tickers and setups you want to work that session.

Starting with the **Debit Spread** strategy (Wheel support to follow).

- Installable PWA (add to home screen on iPhone)
- Data stored locally in the browser (`localStorage`) — nothing leaves the
  device
- Add a trade idea: ticker, call spread / put spread, strikes & width,
  target entry premium

## Status

Design mockup only so far — see `design/` (a Claude Design canvas source:
`Main.dc.html` is the trade list screen, `AddTrade.dc.html` is the add-trade
form). The working PWA implementation (`index.html`, manifest, service
worker, app logic) comes next.
