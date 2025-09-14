import alpha from 'alphavantage';
import * as Indicators from 'technicalindicators';

/**
 * =================================================================================
 * DISCLAIMER:
 * This is a sample trading algorithm and is for educational purposes only.
 * It is not financial advice. Trading involves risk, and you should use
 * this information at your own risk.
 * =================================================================================
 */

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

let lastSignals: { [asset: string]: any } = {};

export async function generateSignals() {
  const newSignals = {};

  for (const asset of assets) {
    try {
      // 1. Fetch historical data
      const data = await av.forex.daily(asset);
      const timeSeries = data['Time Series FX (Daily)'];
      const closes = Object.values(timeSeries).map((d: any) => parseFloat(d['4. close'])).reverse();
      const highs = Object.values(timeSeries).map((d: any) => parseFloat(d['2. high'])).reverse();
      const lows = Object.values(timeSeries).map((d: any) => parseFloat(d['3. low'])).reverse();

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

export function getLastSignals() {
  return lastSignals;
}
