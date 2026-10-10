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

// 6. Validate Quant & Macro Metrics (Stages 1 & 2)
console.log('\n🌐 Checking quant_metrics.json (Macro & Quant Risk)...');
const quantPath = path.join(dataDir, 'quant_metrics.json');
if (fs.existsSync(quantPath)) {
  const quant = JSON.parse(fs.readFileSync(quantPath, 'utf8'));
  assert(typeof quant.macroIndicators === 'object', 'Macro indicators object exists');
  assert(typeof quant.macroIndicators.vix === 'object' && typeof quant.macroIndicators.vix.price === 'number', `VIX quote exists: ${quant.macroIndicators.vix?.price}`);
  assert(typeof quant.macroIndicators.tnx === 'object' && typeof quant.macroIndicators.tnx.price === 'number', `10Y Yield quote exists: ${quant.macroIndicators.tnx?.price}%`);
  assert(typeof quant.macroIndicators.oil === 'object' && typeof quant.macroIndicators.oil.price === 'number', `WTI Oil quote exists: $${quant.macroIndicators.oil?.price}`);
  assert(typeof quant.macroIndicators.dxy === 'object' && typeof quant.macroIndicators.dxy.price === 'number', `DXY Index quote exists: ${quant.macroIndicators.dxy?.price}`);
  assert(typeof quant.riskMetrics === 'object', 'Quantitative risk metrics exist');
  assert(typeof quant.riskMetrics.sharpeRatio === 'number', `Sharpe ratio computed: ${quant.riskMetrics.sharpeRatio}`);
  assert(typeof quant.riskMetrics.portfolioBeta === 'number', `Portfolio beta computed: ${quant.riskMetrics.portfolioBeta}`);
  assert(typeof quant.riskMetrics.var95 === 'object', 'Value at Risk (VaR 95%) computed');
  assert(typeof quant.correlationMatrix === 'object', 'Cross-asset correlation matrix computed');

  // Stage 3 Validation
  assert(typeof quant.stage3Predictive === 'object', 'Stage 3 predictive synthesis object exists');
  assert(typeof quant.stage3Predictive?.monteCarlo === 'object', 'Monte Carlo stochastic simulations exist');
  assert(typeof quant.stage3Predictive?.monteCarlo?.horizon30d?.p50USD === 'number', `Monte Carlo 30d P50 target: $${quant.stage3Predictive?.monteCarlo?.horizon30d?.p50USD}`);
  assert(typeof quant.stage3Predictive?.monteCarlo?.horizon365d?.p50USD === 'number', `Monte Carlo 365d P50 target: $${quant.stage3Predictive?.monteCarlo?.horizon365d?.p50USD}`);
  assert(typeof quant.stage3Predictive?.factorModel === 'object', 'Multi-factor asset scoring model exists');
  assert(typeof quant.stage3Predictive?.factorModel?.portfolioCompositeScore === 'number', `Portfolio factor score: ${quant.stage3Predictive?.factorModel?.portfolioCompositeScore}/100`);
  assert(Array.isArray(quant.stage3Predictive?.macroScenarios) && quant.stage3Predictive.macroScenarios.length >= 4, `4 Forward macro stress scenarios computed (${quant.stage3Predictive?.macroScenarios?.length} scenarios)`);
  assert(Array.isArray(quant.stage3Predictive?.metricsExplanations) && quant.stage3Predictive.metricsExplanations.length >= 5, `Plain-language metric explanations exist (${quant.stage3Predictive?.metricsExplanations?.length} items)`);
} else {
  console.warn('  ⚠️ quant_metrics.json not present (optional)');
}

// 7. Validate README.md and Navigation Anchors
console.log('\n📄 Checking README.md...');
const readmePath = path.join(rootDir, 'README.md');
assert(fs.existsSync(readmePath), 'README.md exists');
const readmeContent = fs.readFileSync(readmePath, 'utf8');
assert(readmeContent.length > 5000, `README.md has comprehensive content (${readmeContent.length} bytes)`);
assert(readmeContent.includes('תמונת מצב מנהלים'), 'README contains Executive Snapshot');
assert(readmeContent.includes('ביצועי מניות והחזקות'), 'README contains Holdings Performance');
assert(readmeContent.includes('השוואת תחזיות ותרחישים'), 'README contains Forecast Comparisons');
assert(readmeContent.includes('השוואת מודלים וגישות'), 'README contains Multi-Model Comparisons (3.1)');
assert(readmeContent.includes('השוואת אופקי זמן'), 'README contains Multi-Horizon Comparisons (3.2)');
assert(readmeContent.includes('ניתוח תרחישי הסתברות'), 'README contains Probability Scenarios (3.3)');
assert(readmeContent.includes('מטריצת אותות וסיכונים'), 'README contains Asset Signals Matrix (3.4)');
assert(readmeContent.includes('מדדי מאקרו ומפת שוק'), 'README contains Macroeconomic Indicators (Section 4)');
assert(readmeContent.includes('מדדי סיכון כמותיים ומטריצת קורלציות'), 'README contains Quantitative Risk & Correlations (Section 5)');
assert(readmeContent.includes('מנוע חיזוי רב-גורמי, סימולציית מונטה קרלו ותרחישי עתיד'), 'README contains Stage 3 Predictive Synthesis (Section 6)');
assert(readmeContent.includes('יומן דיבידנדים'), 'README contains Dividends Journal');
assert(readmeContent.includes('גרפים ומגמות חזותיות'), 'README contains Visual Analytics section');
assert(readmeContent.includes('ארכיטקטורה ואוטומציה'), 'README contains Architecture section');
assert(readmeContent.includes('id="snapshot"') || readmeContent.includes('#snapshot'), 'README contains snapshot navigation anchor');
assert(readmeContent.includes('id="forecasts"') || readmeContent.includes('#forecasts'), 'README contains forecast comparisons navigation anchor');
assert(readmeContent.includes('id="macro"') || readmeContent.includes('#macro'), 'README contains macro navigation anchor');
assert(readmeContent.includes('id="risk-metrics"') || readmeContent.includes('#risk-metrics'), 'README contains risk-metrics navigation anchor');
assert(readmeContent.includes('id="stage3-predictive"') || readmeContent.includes('#stage3-predictive'), 'README contains stage3 navigation anchor');

// 8. Validate Standalone PHP Dashboard & GitHub Pages Action
console.log('\n🐘 Checking PHP Dashboard & GitHub Pages Action...');
assert(fs.existsSync(path.join(rootDir, 'php', 'index.php')), 'php/index.php dashboard exists');
assert(fs.existsSync(path.join(rootDir, 'php', 'api.php')), 'php/api.php JSON API endpoint exists');
assert(fs.existsSync(path.join(rootDir, 'index.php')), 'root index.php delegator exists');
const deployWorkflowPath = path.join(rootDir, '.github', 'workflows', 'deploy_php_dashboard.yml');
assert(fs.existsSync(deployWorkflowPath), 'PHP deployment GitHub Action workflow exists');
const workflowYaml = fs.readFileSync(deployWorkflowPath, 'utf8');
assert(workflowYaml.includes('deploy-pages') && workflowYaml.includes('github-pages'), 'deploy_php_dashboard.yml contains GitHub Pages deployment job');

const phpContent = fs.readFileSync(path.join(rootDir, 'php', 'index.php'), 'utf8');
assert(phpContent.includes('כיצד זה משפיע על תיק המניות שלי') || phpContent.includes('כיצד זה משפיע על התיק שלי'), 'PHP dashboard contains simple plain explanations of metric impacts');
assert(phpContent.includes('stage3Predictive') || phpContent.includes('monteCarloChart'), 'PHP dashboard incorporates Stage 3 predictive visualizations');

// 9. Validate data_hub Charts
console.log('\n🖼️ Checking data_hub charts...');
const dataHubDir = path.join(rootDir, 'data_hub');
assert(fs.existsSync(dataHubDir), 'data_hub directory exists');
assert(fs.existsSync(path.join(dataHubDir, 'timesfm_forecast.png')), 'timesfm_forecast.png chart exists');
assert(fs.existsSync(path.join(dataHubDir, 'portfolio_performance.png')), 'portfolio_performance.png chart exists');
assert(fs.existsSync(path.join(dataHubDir, 'asset_allocation.png')), 'asset_allocation.png chart exists');

console.log('\n' + '='.repeat(50));
console.log(`📊 Result: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50) + '\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
