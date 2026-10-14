import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();
async function run() {
  const period1 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const res = await yf.chart('ILS=X', { period1, interval: '15m' });
  console.log('ILS=X points:', res.quotes.length);
}
run();
