import fs from 'fs';
import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();

async function run() {
  const period1 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const chartData = {};
  const round5m = (dateStr) => {
      const d = new Date(dateStr);
      const ms = Math.round(d.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
      return new Date(ms).toISOString();
  };

  const tickers = ['AAPL', 'MSFT'];
  for (const ticker of tickers) {
      const res = await yf.chart(ticker, { period1, interval: '5m' });
      for (const q of res.quotes) {
          if (!q.close) continue;
          const ts = round5m(q.date);
          if (!chartData[ts]) chartData[ts] = { prices: {} };
          chartData[ts].prices[ticker] = q.close;
      }
  }

  const resIls = await yf.chart('ILS=X', { period1, interval: '5m' });
  for (const q of resIls.quotes) {
      if (!q.close) continue;
      const ts = round5m(q.date);
      if (!chartData[ts]) chartData[ts] = { prices: {} };
      chartData[ts].exchangeRate = q.close + 0.008; 
  }

  const sortedTs = Object.keys(chartData).sort();
  let validPoints = 0;
  for (const ts of sortedTs) {
      if (Object.keys(chartData[ts].prices).length > 0) {
          validPoints++;
      }
  }
  console.log('Valid 5m points:', validPoints);
  console.log('Sample:', Object.entries(chartData).filter(x => Object.keys(x[1].prices).length > 0).slice(-2));
}
run();
