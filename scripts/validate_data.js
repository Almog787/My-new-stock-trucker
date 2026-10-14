import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'public', 'data');

console.log('🔍 Starting Data Integrity Validation...');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// 1. Validate portfolio.json
console.log('\n📦 Checking portfolio.json...');
const portfolioPath = path.join(dataDir, 'portfolio.json');
assert(fs.existsSync(portfolioPath), 'portfolio.json exists');
const portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
const tickers = Object.keys(portfolio);
assert(tickers.length > 0, `Contains ${tickers.length} tickers (${tickers.join(', ')})`);

tickers.forEach(t => {
  const item = portfolio[t];
  assert(typeof item.amount === 'number' && item.amount > 0, `${t}: valid amount (${item.amount})`);
  assert(typeof item.avg_price === 'number' && item.avg_price > 0, `${t}: valid avg_price ($${item.avg_price})`);
});

// 2. Validate meta.json
console.log('\n🌐 Checking meta.json...');
const metaPath = path.join(dataDir, 'meta.json');
assert(fs.existsSync(metaPath), 'meta.json exists');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
assert(typeof meta.usdIlsRate === 'number' && meta.usdIlsRate > 1 && meta.usdIlsRate < 10, `Valid USD/ILS rate: ₪${meta.usdIlsRate}`);
assert(typeof meta.lastUpdate === 'string' && !isNaN(Date.parse(meta.lastUpdate)), `Valid lastUpdate timestamp: ${meta.lastUpdate}`);

// 3. Validate stock_history.json
console.log('\n📈 Checking stock_history.json...');
const historyPath = path.join(dataDir, 'stock_history.json');
assert(fs.existsSync(historyPath), 'stock_history.json exists');
const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
assert(Array.isArray(history) && history.length > 0, `History contains ${history.length} snapshots`);

const latestPoint = history[history.length - 1];
assert(typeof latestPoint.timestamp === 'string' && !isNaN(Date.parse(latestPoint.timestamp)), `Latest timestamp valid: ${latestPoint.timestamp}`);
assert(typeof latestPoint.prices === 'object' && latestPoint.prices !== null, 'Latest point contains prices object');

tickers.forEach(t => {
  const price = latestPoint.prices[t];
  assert(typeof price === 'number' && !isNaN(price) && price > 0, `Latest price for ${t} is valid: $${price}`);
});

// 4. Validate dividends.json
console.log('\n💰 Checking dividends.json...');
const dividendsPath = path.join(dataDir, 'dividends.json');
if (fs.existsSync(dividendsPath)) {
  const dividends = JSON.parse(fs.readFileSync(dividendsPath, 'utf8'));
  assert(typeof dividends.summary === 'object', 'Dividends summary object exists');
  assert(typeof dividends.summary.totalReceivedGrossUSD === 'number' && !isNaN(dividends.summary.totalReceivedGrossUSD), `Total dividends gross USD: $${dividends.summary.totalReceivedGrossUSD}`);
  assert(Array.isArray(dividends.events), `Dividends events list exists (${dividends.events.length} records)`);
} else {
  console.warn('  ⚠️ dividends.json not present (optional)');
}

// 5. Validate forecast.json
console.log('\n🤖 Checking forecast.json (TimesFM)...');
const forecastPath = path.join(dataDir, 'forecast.json');
if (fs.existsSync(forecastPath)) {
  const forecast = JSON.parse(fs.readFileSync(forecastPath, 'utf8'));
  assert(typeof forecast.modelInfo === 'object' && forecast.modelInfo !== null, 'Forecast modelInfo metadata exists');
  assert(typeof forecast.portfolio === 'object', 'Forecast portfolio predictions exist');
  assert(typeof forecast.portfolio.forecast30dUSD_P50 === 'number' && !isNaN(forecast.portfolio.forecast30dUSD_P50), `30d P50 forecast: $${forecast.portfolio.forecast30dUSD_P50}`);
  assert(Array.isArray(forecast.portfolio.timeline) && forecast.portfolio.timeline.length > 0, `Forecast timeline contains ${forecast.portfolio.timeline.length} days`);
} else {
  console.warn('  ⚠️ forecast.json not present (optional)');
}

console.log('\n' + '='.repeat(50));
console.log(`📊 Result: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50) + '\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
