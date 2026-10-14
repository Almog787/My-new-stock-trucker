import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
async function test() {
  const result = await yahooFinance.chart('AAPL', { period1: '2026-09-17', interval: '15m' });
  console.log(result.quotes.slice(-2));
}
test();
