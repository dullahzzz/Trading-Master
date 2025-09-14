
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const alpha = require('alphavantage');
const Indicators = require('technicalindicators');

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

const av = alpha({ key: process.env.ALPHA_VANTAGE_API_KEY });

const assets = ['EURUSD', 'GBPUSD', 'XAUUSD'];

// --- Strategy Parameters ---
const EMA_FAST_PERIOD = 12;
const EMA_SLOW_PERIOD = 26;
const RSI_PERIOD = 14;
const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;
const ATR_PERIOD = 14;
const ATR_MULTIPLIER_SL = 2; // Multiplier for Stop Loss
const ATR_MULTIPLIER_TP = 4; // Multiplier for Take Profit

let lastSignals = {};

async function generateSignals() {
  const newSignals = {};

  for (const asset of assets) {
    try {
      // 1. Fetch historical data
      const data = await av.forex.daily(asset);
      const timeSeries = data['Time Series FX (Daily)'];
      const closes = Object.values(timeSeries).map((d) => parseFloat(d['4. close'])).reverse();
      const highs = Object.values(timeSeries).map((d) => parseFloat(d['2. high'])).reverse();
      const lows = Object.values(timeSeries).map((d) => parseFloat(d['3. low'])).reverse();

      if (closes.length < EMA_SLOW_PERIOD) {
        console.warn(`Not enough data for ${asset} to generate a signal.`);
        continue;
      }

      // 2. Calculate Indicators
      const emaFast = Indicators.EMA.calculate({ period: EMA_FAST_PERIOD, values: closes });
      const emaSlow = Indicators.EMA.calculate({ period: EMA_SLOW_PERIOD, values: closes });
      const rsi = Indicators.RSI.calculate({ period: RSI_PERIOD, values: closes });
      const atr = Indicators.ATR.calculate({
        period: ATR_PERIOD,
        high: highs,
        low: lows,
        close: closes,
      });

      // Get the latest values
      const latestClose = closes[closes.length - 1];
      const latestEmaFast = emaFast[emaFast.length - 1];
      const latestEmaSlow = emaSlow[emaSlow.length - 1];
      const prevEmaFast = emaFast[emaFast.length - 2];
      const prevEmaSlow = emaSlow[emaSlow.length - 2];
      const latestRSI = rsi[rsi.length - 1];
      const latestATR = atr[atr.length - 1];

      let signal = 'hold';
      let sl = 0;
      let tp = 0;

      // 3. Define Trading Logic
      const isGoldenCross = prevEmaFast <= prevEmaSlow && latestEmaFast > latestEmaSlow;
      const isDeathCross = prevEmaFast >= prevEmaSlow && latestEmaFast < latestEmaSlow;

      if (isGoldenCross && latestRSI < RSI_OVERBOUGHT) {
        // Bullish signal
        signal = 'buy';
        sl = latestClose - latestATR * ATR_MULTIPLIER_SL;
        tp = latestClose + latestATR * ATR_MULTIPLIER_TP;
      } else if (isDeathCross && latestRSI > RSI_OVERSOLD) {
        // Bearish signal
        signal = 'sell';
        sl = latestClose + latestATR * ATR_MULTIPLIER_SL;
        tp = latestClose - latestATR * ATR_MULTIPLIER_TP;
      }

      newSignals[asset] = {
        signal,
        sl: sl.toFixed(5),
        tp: tp.toFixed(5),
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error(`Error generating signal for ${asset}:`, error);
    }
  }

  lastSignals = newSignals;
  return newSignals;
}

function getLastSignals() {
  return lastSignals;
}

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    console.log("Client connected", socket.id);
    // Send current signals on connection
    socket.emit("signals", getLastSignals());

    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
    });
  });

  // Start polling if not already
  setInterval(async () => {
    const signals = await generateSignals();
    io.emit("signals", signals);
  }, 5 * 60 * 1000); // Every 5 minutes

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
