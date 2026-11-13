import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'public', 'data');

console.log('🔍 Starting Data & Financial Calculation Validation...');

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
  assert(typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount > 0, `${t}: valid amount (${item.amount})`);
  assert(typeof item.avg_price === 'number' && Number.isFinite(item.avg_price) && item.avg_price > 0, `${t}: valid avg_price ($${item.avg_price})`);
});

// 2. Validate meta.json
console.log('\n🌐 Checking meta.json...');
const metaPath = path.join(dataDir, 'meta.json');
assert(fs.existsSync(metaPath), 'meta.json exists');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
assert(typeof meta.usdIlsRate === 'number' && Number.isFinite(meta.usdIlsRate) && meta.usdIlsRate > 1 && meta.usdIlsRate < 10, `Valid USD/ILS broker rate: ₪${meta.usdIlsRate}`);
assert(typeof meta.lastUpdate === 'string' && !isNaN(Date.parse(meta.lastUpdate)), `Valid lastUpdate timestamp: ${meta.lastUpdate}`);

// 3. Validate stock_history.json & Chronological Integrity
console.log('\n📈 Checking stock_history.json...');
const historyPath = path.join(dataDir, 'stock_history.json');
assert(fs.existsSync(historyPath), 'stock_history.json exists');
const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
assert(Array.isArray(history) && history.length > 0, `History contains ${history.length} snapshots`);

let isSorted = true;
for (let i = 1; i < history.length; i++) {
  if (Date.parse(history[i].timestamp) < Date.parse(history[i - 1].timestamp)) {
    isSorted = false;
    break;
  }
}
assert(isSorted, 'History snapshots are chronologically ordered');

const latestPoint = history[history.length - 1];
assert(typeof latestPoint.timestamp === 'string' && !isNaN(Date.parse(latestPoint.timestamp)), `Latest timestamp valid: ${latestPoint.timestamp}`);
assert(typeof latestPoint.prices === 'object' && latestPoint.prices !== null, 'Latest point contains prices object');

tickers.forEach(t => {
  const price = latestPoint.prices[t];
  assert(typeof price === 'number' && Number.isFinite(price) && price > 0, `Latest price for ${t} is valid: $${price}`);
});

// 4. Financial & Non-Offsetting Capital Gains Tax Calculations Audit
console.log('\n🧮 Auditing Financial & Tax Math (25% strictly without loss offsetting)...');
let totalCostUSD = 0;
let totalCurrentUSD = 0;
let noOffsetTaxUSD = 0;
let grossNetPortfolioPnL = 0;

tickers.forEach(t => {
  const { amount, avg_price } = portfolio[t];
  const curPrice = latestPoint.prices[t];
  const cost = amount * avg_price;
  const val = amount * curPrice;
  const pnl = val - cost;
  totalCostUSD += cost;
  totalCurrentUSD += val;
  grossNetPortfolioPnL += pnl;
  if (pnl > 0) {
    noOffsetTaxUSD += pnl * 0.25;
  }
});

const offsetPortfolioTaxUSD = Math.max(0, grossNetPortfolioPnL * 0.25);
assert(Number.isFinite(totalCostUSD) && totalCostUSD > 0, `Total cost basis valid: $${totalCostUSD.toFixed(2)}`);
assert(Number.isFinite(totalCurrentUSD) && totalCurrentUSD > 0, `Total current value valid: $${totalCurrentUSD.toFixed(2)}`);
assert(Math.abs((totalCurrentUSD - totalCostUSD) - grossNetPortfolioPnL) < 1e-6, 'Portfolio PnL equals sum of individual position PnLs');
assert(noOffsetTaxUSD >= offsetPortfolioTaxUSD - 1e-9, `No-offset tax ($${noOffsetTaxUSD.toFixed(2)}) >= portfolio-offset tax ($${offsetPortfolioTaxUSD.toFixed(2)})`);

// Check YTD non-offsetting tax calculation consistency
const currentYear = new Date(latestPoint.timestamp).getFullYear();
const pointsPriorToYear = history.filter(h => new Date(h.timestamp).getFullYear() < currentYear);
if (pointsPriorToYear.length > 0) {
  const startPoint = pointsPriorToYear[pointsPriorToYear.length - 1];
  let ytdGross = 0;
  let ytdNoOffsetTax = 0;
  tickers.forEach(t => {
    const baseP = startPoint.prices[t] || portfolio[t].avg_price;
    const curP = latestPoint.prices[t];
    const assetYtd = (curP - baseP) * portfolio[t].amount;
    ytdGross += assetYtd;
    if (assetYtd > 0) ytdNoOffsetTax += assetYtd * 0.25;
  });
  const ytdOffsetTax = Math.max(0, ytdGross * 0.25);
  assert(ytdNoOffsetTax >= ytdOffsetTax - 1e-9, `YTD no-offset tax ($${ytdNoOffsetTax.toFixed(2)}) >= YTD offset tax ($${ytdOffsetTax.toFixed(2)})`);
}

// 5. Validate dividends.json
console.log('\n💰 Checking dividends.json...');
const dividendsPath = path.join(dataDir, 'dividends.json');
if (fs.existsSync(dividendsPath)) {
  const dividends = JSON.parse(fs.readFileSync(dividendsPath, 'utf8'));
  const s = dividends.summary;
  assert(typeof s === 'object' && s !== null, 'Dividends summary object exists');
  assert(typeof s.totalReceivedGrossUSD === 'number' && Number.isFinite(s.totalReceivedGrossUSD), `Total dividends gross USD: $${s.totalReceivedGrossUSD.toFixed(2)}`);
  assert(Math.abs((s.totalReceivedGrossUSD * 0.75) - s.totalReceivedNetUSD) < 1e-4, 'Dividends net equals 75% of gross (25% withholding tax)');
  assert(Array.isArray(dividends.events), `Dividends events list exists (${dividends.events.length} records)`);
} else {
  console.warn('  ⚠️ dividends.json not present (optional)');
}

// 6. Validate forecast.json
console.log('\n🤖 Checking forecast.json (TimesFM)...');
const forecastPath = path.join(dataDir, 'forecast.json');
if (fs.existsSync(forecastPath)) {
  const forecast = JSON.parse(fs.readFileSync(forecastPath, 'utf8'));
  assert(typeof forecast.modelInfo === 'object' && forecast.modelInfo !== null, 'Forecast modelInfo metadata exists');
  assert(typeof forecast.portfolio === 'object', 'Forecast portfolio predictions exist');
  assert(typeof forecast.portfolio.forecast30dUSD_P50 === 'number' && Number.isFinite(forecast.portfolio.forecast30dUSD_P50), `30d P50 forecast: $${forecast.portfolio.forecast30dUSD_P50}`);
  assert(forecast.portfolio.forecast30dUSD_P10 <= forecast.portfolio.forecast30dUSD_P50 && forecast.portfolio.forecast30dUSD_P50 <= forecast.portfolio.forecast30dUSD_P90, 'Forecast quantile ordering P10 <= P50 <= P90 holds');
  assert(Array.isArray(forecast.portfolio.timeline) && forecast.portfolio.timeline.length > 0, `Forecast timeline contains ${forecast.portfolio.timeline.length} days`);
} else {
  console.warn('  ⚠️ forecast.json not present (optional)');
}

// 7. Validate README formatting (no broken minus signs like ₪- or +₪-)
console.log('\n📝 Checking README.md formatting...');
const readmePath = path.join(rootDir, 'README.md');
if (fs.existsSync(readmePath)) {
  const readmeText = fs.readFileSync(readmePath, 'utf8');
  assert(!readmeText.includes('₪-') && !readmeText.includes('+₪-') && !readmeText.includes('$-'), 'README contains no malformed currency signs (₪-, +₪-, $-)');
}

console.log('\n' + '='.repeat(50));
console.log(`📊 Result: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50) + '\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
