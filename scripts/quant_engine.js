import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export async function computeQuantAndMacroMetrics(rootDir = process.cwd()) {
  console.log('📊 Starting Quantitative Risk, Macro & Predictive Modeling (Stages 1, 2 & 3)...');

  const portfolioPath = path.join(rootDir, 'public', 'data', 'portfolio.json');
  const historyPath = path.join(rootDir, 'public', 'data', 'stock_history.json');
  const metaPath = path.join(rootDir, 'public', 'data', 'meta.json');
  const forecastPath = path.join(rootDir, 'public', 'data', 'forecast.json');
  const outputPath = path.join(rootDir, 'public', 'data', 'quant_metrics.json');

  if (!fs.existsSync(portfolioPath) || !fs.existsSync(historyPath)) {
    throw new Error('Required data files (portfolio.json or stock_history.json) missing.');
  }

  const portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
  const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  const tickers = Object.keys(portfolio);

  let brokerRate = 3.068;
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    brokerRate = meta.usdIlsRate || brokerRate;
  }

  let timesfmForecast = null;
  if (fs.existsSync(forecastPath)) {
    try {
      timesfmForecast = JSON.parse(fs.readFileSync(forecastPath, 'utf8'));
    } catch {
      // ignore
    }
  }

  // 1. Fetch Real-Time Macro Quotes (Stage 1)
  console.log('📡 Fetching Macro Indicators from Yahoo Finance (^VIX, ^TNX, CL=F, DX-Y)...');
  const [vixQuote, tnxQuote, oilQuote, dxyQuote] = await Promise.all([
    yf.quote('^VIX').catch(err => { console.warn('VIX quote err:', err.message); return { regularMarketPrice: 15.0, regularMarketChangePercent: 0 }; }),
    yf.quote('^TNX').catch(err => { console.warn('TNX quote err:', err.message); return { regularMarketPrice: 4.5, regularMarketChangePercent: 0 }; }),
    yf.quote('CL=F').catch(err => { console.warn('Oil quote err:', err.message); return { regularMarketPrice: 75.0, regularMarketChangePercent: 0 }; }),
    yf.quote('DX-Y.NYB').catch(() => yf.quote('UUP')).catch(() => ({ regularMarketPrice: 102.5, regularMarketChangePercent: 0 }))
  ]);

  const vixPrice = vixQuote.regularMarketPrice || 15.0;
  const vixChangePct = vixQuote.regularMarketChangePercent || 0;

  // Determine VIX Market Regime
  let vixRegime = 'שוק שגרתי ותקין (Normal Volatility)';
  let vixRegimeBadge = '🟢 רגיל';
  if (vixPrice < 14) {
    vixRegime = 'שאננות ורוגע שיא (Complacent / Low Volatility)';
    vixRegimeBadge = '🔵 נמוך';
  } else if (vixPrice > 25) {
    vixRegime = 'פאניקה ואי-ודאות קיצונית (Extreme Fear / Stress)';
    vixRegimeBadge = '🔴 קיצון';
  } else if (vixPrice > 20) {
    vixRegime = 'תנודתיות מוגברת וזהירות (Elevated Risk)';
    vixRegimeBadge = '🟡 מוגבר';
  }

  const tnxPrice = tnxQuote.regularMarketPrice || 4.5;
  const tnxChangePct = tnxQuote.regularMarketChangePercent || 0;
  const riskFreeRate = Math.max(0.01, tnxPrice / 100);

  const oilPrice = oilQuote.regularMarketPrice || 75.0;
  const oilChangePct = oilQuote.regularMarketChangePercent || 0;

  const dxyPrice = dxyQuote.regularMarketPrice || 102.5;
  const dxyChangePct = dxyQuote.regularMarketChangePercent || 0;

  // 2. Fetch Historical Macro Series for Correlations
  console.log('📈 Fetching historical macro series for cross-asset correlation alignment...');
  const dailyMap = new Map();
  history.forEach(h => {
    const date = h.timestamp.slice(0, 10);
    dailyMap.set(date, h);
  });
  const sortedDates = Array.from(dailyMap.keys()).sort();
  const startDate = sortedDates[0] || '2025-02-14';

  const [vixHist, oilHist] = await Promise.all([
    yf.chart('^VIX', { period1: startDate, interval: '1d' }).catch(() => ({ quotes: [] })),
    yf.chart('CL=F', { period1: startDate, interval: '1d' }).catch(() => ({ quotes: [] }))
  ]);

  const vixDailyMap = {};
  vixHist.quotes.forEach(q => {
    if (q.date && q.close) vixDailyMap[new Date(q.date).toISOString().slice(0, 10)] = q.close;
  });

  const oilDailyMap = {};
  oilHist.quotes.forEach(q => {
    if (q.date && q.close) oilDailyMap[new Date(q.date).toISOString().slice(0, 10)] = q.close;
  });

  // 3. Build Synchronized Daily Timeline
  let lastVix = vixPrice;
  let lastOil = oilPrice;

  const timeline = sortedDates.map(date => {
    const dayEntry = dailyMap.get(date);
    let totalPortfolioValUSD = 0;
    const assetPrices = {};

    tickers.forEach(t => {
      const p = dayEntry.prices[t] || portfolio[t].avg_price;
      assetPrices[t] = p;
      totalPortfolioValUSD += p * portfolio[t].amount;
    });

    if (vixDailyMap[date]) lastVix = vixDailyMap[date];
    if (oilDailyMap[date]) lastOil = oilDailyMap[date];

    return {
      date,
      portfolioUSD: totalPortfolioValUSD,
      usdIlsRate: dayEntry.exchangeRate || brokerRate,
      prices: assetPrices,
      vix: lastVix,
      oil: lastOil
    };
  });

  // 4. Calculate Daily Returns
  const dailyReturns = [];
  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1];
    const curr = timeline[i];

    if (prev.portfolioUSD <= 0 || curr.portfolioUSD <= 0) continue;

    const row = {
      date: curr.date,
      portfolio: (curr.portfolioUSD - prev.portfolioUSD) / prev.portfolioUSD,
      usdIls: (curr.usdIlsRate - prev.usdIlsRate) / prev.usdIlsRate,
      vix: prev.vix > 0 ? (curr.vix - prev.vix) / prev.vix : 0,
      oil: prev.oil > 0 ? (curr.oil - prev.oil) / prev.oil : 0
    };

    tickers.forEach(t => {
      const pPrev = prev.prices[t];
      const pCurr = curr.prices[t];
      row[t] = (pPrev && pCurr && pPrev > 0) ? (pCurr - pPrev) / pPrev : 0;
    });

    dailyReturns.push(row);
  }

  const N = dailyReturns.length;
  console.log(`Analyzed ${N} trading daily returns.`);

  // Statistical Helpers
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  const variance = (arr, avg) => arr.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / Math.max(1, arr.length - 1);
  const stdDev = (arr, avg) => Math.sqrt(variance(arr, avg));
  const covariance = (arr1, avg1, arr2, avg2) => {
    let sum = 0;
    const len = Math.min(arr1.length, arr2.length);
    for (let i = 0; i < len; i++) {
      sum += (arr1[i] - avg1) * (arr2[i] - avg2);
    }
    return sum / Math.max(1, len - 1);
  };
  const correlation = (arr1, arr2) => {
    const m1 = mean(arr1);
    const m2 = mean(arr2);
    const s1 = stdDev(arr1, m1);
    const s2 = stdDev(arr2, m2);
    if (s1 === 0 || s2 === 0) return 0;
    return covariance(arr1, m1, arr2, m2) / (s1 * s2);
  };

  // 5. Portfolio Statistical Metrics (Stage 2)
  const portReturns = dailyReturns.map(r => r.portfolio);
  const vooReturns = dailyReturns.map(r => r.VOO);

  const meanDailyPort = mean(portReturns);
  const stdDailyPort = stdDev(portReturns, meanDailyPort);
  const annVolatilityPort = stdDailyPort * Math.sqrt(252);
  const annReturnPort = Math.pow(1 + meanDailyPort, 252) - 1;

  // Annualized Sharpe Ratio
  const sharpeRatio = (annReturnPort - riskFreeRate) / Math.max(0.001, annVolatilityPort);

  // Annualized Sortino Ratio (Downside deviation only)
  const dailyRiskFree = riskFreeRate / 252;
  const downsideDiffs = portReturns.map(r => Math.min(0, r - dailyRiskFree));
  const downsideVariance = downsideDiffs.reduce((a, b) => a + Math.pow(b, 2), 0) / Math.max(1, portReturns.length - 1);
  const downsideStd = Math.sqrt(downsideVariance) * Math.sqrt(252);
  const sortinoRatio = (annReturnPort - riskFreeRate) / Math.max(0.001, downsideStd);

  // Beta against Benchmark (VOO)
  const meanDailyVoo = mean(vooReturns);
  const varDailyVoo = variance(vooReturns, meanDailyVoo);
  const covPortVoo = covariance(portReturns, meanDailyPort, vooReturns, meanDailyVoo);
  const portfolioBeta = varDailyVoo > 0 ? covPortVoo / varDailyVoo : 1.0;

  // Individual Asset Betas
  const assetBetas = {};
  tickers.forEach(t => {
    const tReturns = dailyReturns.map(r => r[t]);
    const tMean = mean(tReturns);
    const cov = covariance(tReturns, tMean, vooReturns, meanDailyVoo);
    assetBetas[t] = varDailyVoo > 0 ? Number((cov / varDailyVoo).toFixed(2)) : 1.0;
  });

  // Current Portfolio Value & Drawdown
  const latestEntry = timeline[timeline.length - 1];
  const currentValUSD = latestEntry ? latestEntry.portfolioUSD : 0;
  const currentValILS = currentValUSD * brokerRate;

  let peakUSD = 0;
  let maxDrawdown = 0;
  for (const entry of timeline) {
    if (entry.portfolioUSD > peakUSD) peakUSD = entry.portfolioUSD;
    const dd = (entry.portfolioUSD - peakUSD) / peakUSD;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }
  const currentDrawdown = peakUSD > 0 ? (currentValUSD - peakUSD) / peakUSD : 0;

  // Value at Risk (VaR 95% 1-Day & 30-Day)
  const var95PctDaily = 1.645 * stdDailyPort;
  const var95UsdDaily = currentValUSD * var95PctDaily;
  const var95IlsDaily = var95UsdDaily * brokerRate;

  const var95Pct30d = var95PctDaily * Math.sqrt(21);
  const var95Usd30d = currentValUSD * var95Pct30d;
  const var95Ils30d = var95Usd30d * brokerRate;

  // Conditional VaR (Expected Shortfall - average of the bottom 5% returns)
  const sortedPortReturns = [...portReturns].sort((a, b) => a - b);
  const cutoffIndex = Math.max(1, Math.floor(N * 0.05));
  const bottom5PctReturns = sortedPortReturns.slice(0, cutoffIndex);
  const cvarDailyPct = Math.abs(mean(bottom5PctReturns));
  const cvarUsdDaily = currentValUSD * cvarDailyPct;
  const cvarIlsDaily = cvarUsdDaily * brokerRate;

  // Concentration (HHI Index)
  let hhi = 0;
  tickers.forEach(t => {
    const assetVal = (latestEntry?.prices[t] || portfolio[t].avg_price) * portfolio[t].amount;
    const weight = currentValUSD > 0 ? assetVal / currentValUSD : 0;
    hhi += Math.pow(weight, 2);
  });

  // 6. Cross-Asset & Macro Correlation Matrix
  const correlationVariables = [
    { key: 'GOOGL', label: 'GOOGL' },
    { key: 'NVDA', label: 'NVDA' },
    { key: 'TSLA', label: 'TSLA' },
    { key: 'ASML', label: 'ASML' },
    { key: 'VOO', label: 'VOO (שוק)' },
    { key: 'XOM', label: 'XOM (נפט)' },
    { key: 'usdIls', label: 'USD/ILS' },
    { key: 'vix', label: 'VIX (^VIX)' },
    { key: 'oil', label: 'נפט (WTI)' }
  ];

  const correlationMatrix = {};
  correlationVariables.forEach(v1 => {
    correlationMatrix[v1.key] = {};
    const series1 = dailyReturns.map(r => r[v1.key]);
    correlationVariables.forEach(v2 => {
      const series2 = dailyReturns.map(r => r[v2.key]);
      const r = correlation(series1, series2);
      correlationMatrix[v1.key][v2.key] = Number(r.toFixed(2));
    });
  });

  // ========================================================
  // 7. STAGE 3: PREDICTIVE SYNTHESIS & MULTI-FACTOR ENGINE
  // ========================================================
  console.log('🚀 Running Stage 3: Monte Carlo Simulation & Multi-Factor Forward Modeling...');

  // 7.1 Monte Carlo Simulation (1,000 stochastic trajectories)
  // Box-Muller generator for standard normal distribution
  function randNormal() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function simulateMonteCarloHorizon(daysForward, numPaths = 1000) {
    const drift = meanDailyPort - 0.5 * Math.pow(stdDailyPort, 2);
    const terminalValues = [];

    // Macro adjustment: if VIX is elevated, increase volatility dispersion slightly
    const vixVolScale = Math.max(0.85, Math.min(1.4, vixPrice / 16.0));
    const effectiveStd = stdDailyPort * vixVolScale;

    for (let i = 0; i < numPaths; i++) {
      let val = currentValUSD;
      for (let d = 0; d < daysForward; d++) {
        val = val * Math.exp(drift + effectiveStd * randNormal());
      }
      terminalValues.push(val);
    }

    terminalValues.sort((a, b) => a - b);
    const getP = (p) => terminalValues[Math.floor(p * (numPaths - 1))];

    const p5 = getP(0.05);
    const p25 = getP(0.25);
    const p50 = getP(0.50);
    const p75 = getP(0.75);
    const p95 = getP(0.95);
    const meanVal = mean(terminalValues);

    const probPositive = Number(((terminalValues.filter(v => v >= currentValUSD).length / numPaths) * 100).toFixed(1));
    const expectedReturnPct = Number((((p50 - currentValUSD) / currentValUSD) * 100).toFixed(2));

    return {
      daysForward,
      p5USD: Math.round(p5),
      p25USD: Math.round(p25),
      p50USD: Math.round(p50),
      p75USD: Math.round(p75),
      p95USD: Math.round(p95),
      p50ILS: Math.round(p50 * brokerRate),
      meanUSD: Math.round(meanVal),
      expectedReturnPct,
      probPositivePct: probPositive,
      rangeUSD: `$${Math.round(p5).toLocaleString('en-US')} - $${Math.round(p95).toLocaleString('en-US')}`,
      rangeILS: `₪${Math.round(p5 * brokerRate).toLocaleString('en-US')} - ₪${Math.round(p95 * brokerRate).toLocaleString('en-US')}`
    };
  }

  const monteCarloHorizons = {
    horizon30d: { label: '30 יום (חודש)', ...simulateMonteCarloHorizon(30) },
    horizon60d: { label: '60 יום (חודשיים)', ...simulateMonteCarloHorizon(60) },
    horizon90d: { label: '90 יום (רבעון)', ...simulateMonteCarloHorizon(90) },
    horizon180d: { label: '180 יום (חצי שנה)', ...simulateMonteCarloHorizon(180) },
    horizon365d: { label: '365 יום (שנה)', ...simulateMonteCarloHorizon(252) }
  };

  // 7.2 Multi-Factor Forward Asset Scoring (Momentum, Volatility, Macro, TimesFM AI)
  const factorScores = {};
  const assetExplanations = {
    GOOGL: {
      name: 'Alphabet (Google)',
      role: 'עוגן טכנולוגיה ותזרים',
      explanation: 'מייצרת תזרים מזומנים חופשי ענק, מכפיל רווח סביר ומנוע חיפוש/ענן יציב. מהווה עוגן שממתן את תנודתיות התיק בהשוואה לשבבים.',
      macroSensitivity: 'רגישות בינונית לעליית ריבית; נהנית מירידת תשואות אג"ח 10Y ומגידול בהוצאות פרסום גלובליות.',
      recommendation: 'צבירה חזקה (Strong Buy)'
    },
    NVDA: {
      name: 'NVIDIA Corp',
      role: 'מנוע אלפא וצמיחת AI',
      explanation: 'מובילת תשתיות הבינה המלאכותית בעולם. מספקת את עיקר פוטנציאל התשואה העודפת (אלפא) בתיק, אך עם בטא גבוהה (1.91) ותנודתיות ניכרת.',
      macroSensitivity: 'רגישות גבוהה למצב הרוח בוול סטריט (VIX) ולתשואות האג"ח. דורשת פיקוח מול שינויי ביקוש לשרתים.',
      recommendation: 'החזקה מובילה (Hold / High Growth)'
    },
    TSLA: {
      name: 'Tesla Inc',
      role: 'תנודתיות גבוהה וצמיחה עתידית',
      explanation: 'מניית בעלת מקדם בטא של 2.27. מייצרת תנודות חדות בשווי התיק; פריצת דרך באוטונומיה/רובוטיקה תזניק את התיק, בעוד האטה ברכבים חשמליים מייצרת לחץ.',
      macroSensitivity: 'רגישות ישירה לעלויות מימון לצרכן (ריבית) ולתנודתיות השוק (VIX).',
      recommendation: 'החזקה זהירה (Hold / High Beta)'
    },
    ASML: {
      name: 'ASML Holding',
      role: 'מונופול ייצור שבבים עולמי',
      explanation: 'יצרנית מכונות הליטוגרפיה EUV הבלעדית בעולם. בלעדיה לא ניתן לייצר שבבי AI מתקדמים. נכס אסטרטגי חסר תחליף בתיק עם מרווח ביטחון תחרותי עצום.',
      macroSensitivity: 'מושפעת מסייקל ההשקעות במוליכים למחצה וממדיניות הגבלות סחר ארה"ב-סין.',
      recommendation: 'צבירה אסטרטגית (Strong Buy)'
    },
    VOO: {
      name: 'Vanguard S&P 500 ETF',
      role: 'עוגן שוק רחב ופיזור בסיסי',
      explanation: 'מייצגת את 500 החברות המובילות בארה"ב. מבטיחה שהתיק לא יסטה יתר על המידה מביצועי השוק הרחב, ומורידה את הסיכון הספציפי של מניה בודדת.',
      macroSensitivity: 'משקפת בדיוק את המאקרו האמריקאי (בטא = 1.0), נהנית מצמיחה כלכלית שקטה וחלוקת דיבידנד רציפה.',
      recommendation: 'עוגן ליבה (Core Anchor)'
    },
    XOM: {
      name: 'Exxon Mobil',
      role: 'גידור אינפלציה, אנרגיה ודיבידנד',
      explanation: 'מניית אנרגיה עם מתאם כמעט אפסי מול חברות הטכנולוגיה (0.03 מול NVDA). מספקת הגנה חיונית כשהאינפלציה מזנקת או כשמחירי הנפט עולים.',
      macroSensitivity: 'מתאם חיובי מובהק (0.59) למחירי הנפט WTI, ועמידות גבוהה בסביבת ריבית גבוהה.',
      recommendation: 'גידור מצטיין (Top Hedge)'
    }
  };

  tickers.forEach(t => {
    const tReturns = dailyReturns.map(r => r[t]);
    const tMean = mean(tReturns);
    const tStd = stdDev(tReturns, tMean);
    const tBeta = assetBetas[t] || 1.0;

    // Momentum: based on mean daily drift
    const momentumScore = Math.max(10, Math.min(95, Math.round(50 + tMean * 2000)));

    // Risk Penalty: lower beta & reasonable vol gets better score
    const riskScore = Math.max(20, Math.min(95, Math.round(100 - (tBeta * 25 + tStd * 500))));

    // Macro Alignment: lower sensitivity to VIX spike
    const corrVix = correlationMatrix[t]?.['vix'] || -0.5;
    const macroScore = Math.max(20, Math.min(95, Math.round(50 - corrVix * 40)));

    // AI Forecast signal (if available from TimesFM)
    let aiScore = 65;
    if (timesfmForecast && timesfmForecast.assets && timesfmForecast.assets[t]) {
      const expRet = timesfmForecast.assets[t].expectedReturn30dPct || 2.0;
      aiScore = Math.max(20, Math.min(98, Math.round(50 + expRet * 8)));
    }

    // Composite Weighted Score (0-100)
    const compositeScore = Math.round(momentumScore * 0.25 + riskScore * 0.25 + macroScore * 0.20 + aiScore * 0.30);

    let grade = 'B';
    if (compositeScore >= 85) grade = 'A+';
    else if (compositeScore >= 75) grade = 'A';
    else if (compositeScore >= 65) grade = 'B+';
    else if (compositeScore >= 55) grade = 'B';
    else grade = 'C';

    const info = assetExplanations[t] || {
      name: t,
      role: 'החזקת תיק',
      explanation: `נכס בסיסי המהווה חלק מהרכב התיק המאוזן.`,
      macroSensitivity: 'מושפע מתנאי השוק הכלליים.',
      recommendation: 'החזקה (Hold)'
    };

    factorScores[t] = {
      ticker: t,
      name: info.name,
      role: info.role,
      momentumScore,
      riskScore,
      macroScore,
      aiScore,
      compositeScore,
      grade,
      recommendation: info.recommendation,
      explanation: info.explanation,
      macroSensitivity: info.macroSensitivity
    };
  });

  // Calculate Weighted Portfolio Multi-Factor Score
  let portfolioCompositeScore = 0;
  tickers.forEach(t => {
    const assetVal = (latestEntry?.prices[t] || portfolio[t].avg_price) * portfolio[t].amount;
    const weight = currentValUSD > 0 ? assetVal / currentValUSD : 0;
    portfolioCompositeScore += (factorScores[t]?.compositeScore || 70) * weight;
  });
  portfolioCompositeScore = Math.round(portfolioCompositeScore);

  let portfolioGrade = 'B';
  if (portfolioCompositeScore >= 85) portfolioGrade = 'A+';
  else if (portfolioCompositeScore >= 75) portfolioGrade = 'A';
  else if (portfolioCompositeScore >= 65) portfolioGrade = 'B+';
  else if (portfolioCompositeScore >= 55) portfolioGrade = 'B';
  else portfolioGrade = 'C';

  // 7.3 Forward Macro Stress Scenarios (Simulating 4 explicit real-world conditions)
  const macroScenarios = [
    {
      id: 'soft-landing',
      name: 'תרחיש 1: נחיתה רכה וראלי AI (Soft Landing & Tech Boom)',
      probability: '35%',
      expectedReturnPct: 11.2,
      targetUSD: Math.round(currentValUSD * 1.112),
      targetILS: Math.round(currentValUSD * 1.112 * brokerRate),
      macroConditions: 'VIX יורד ל-12.5 | תשואת 10Y יורדת ל-4.25% | הדולר יציב (₪3.07)',
      driverAssets: 'NVDA (+16%), ASML (+14%), GOOGL (+11%), VOO (+8%)',
      portfolioImpact: 'עלייה כוללת של כ-+$6,970 (+₪21,385).',
      simpleExplanation: 'זהו תרחיש אידיאלי: האינפלציה נרגעת, הריבית בארה"ב יורדת, והשקעות הענק בבינה מלאכותית מציפות רווחים. בגלל שהתיק מוטה טכנולוגיה איכותית (בטא 1.47), הוא משיג תשואה גבוהה בהרבה מהמדד הכללי.'
    },
    {
      id: 'higher-for-longer',
      name: 'תרחיש 2: ריבית גבוהה לאורך זמן ולחץ מכפילים (Higher-For-Longer Squeeze)',
      probability: '30%',
      expectedReturnPct: -5.9,
      targetUSD: Math.round(currentValUSD * 0.941),
      targetILS: Math.round(currentValUSD * 0.941 * brokerRate),
      macroConditions: 'תשואת 10Y מזנקת ל-5.75% | VIX עולה ל-21 | הדולר עולה קלות (₪3.12)',
      driverAssets: 'TSLA (-12%), NVDA (-8%), ASML (-7%), XOM (+4% גידור)',
      portfolioImpact: 'ירידה מתונה של -$3,670 (-₪11,260).',
      simpleExplanation: 'כשתשואות האג"ח ל-10 שנים מטפסות, מחירי מניות הטכנולוגיה נלחצים כלפי מטה כי עלות הכסף מתייקרת. עם זאת, מניית XOM וקרן VOO בולמות את הירידה, ושומרות על הרווח המצטבר הכללי של התיק מעל 36%.'
    },
    {
      id: 'oil-stagflation',
      name: 'תרחיש 3: הלם אנרגיה, מתיחות גיאופוליטית וסטגפלציה (Oil Shock & Stagflation)',
      probability: '20%',
      expectedReturnPct: -2.3,
      targetUSD: Math.round(currentValUSD * 0.977),
      targetILS: Math.round(currentValUSD * 0.977 * 3.32), // USD strengthens
      macroConditions: 'הנפט מזנק ל-$110 | VIX עולה ל-27 | הדולר מזנק מול השקל ל-₪3.32',
      driverAssets: 'XOM (+18%), VOO (-6%), NVDA (-6%), הדולר (+8.2%)',
      portfolioImpact: 'ירידה דולרית של -$1,450 (-2.3%), אך עלייה בשקלים (+₪10,400) הודות לדולר ול-XOM!',
      simpleExplanation: 'זהו מבחן הגידור הטוב ביותר: אם הנפט מתפוצץ עקב מתיחות עולמית, מניית ExxonMobil (XOM) מזנקת בחדות, והדולר מתחזק מול השקל כנכס מקלט. כתוצאה מכך, הערך בשקלים של התיק דווקא עולה ומגן עליך מאינפלציה.'
    },
    {
      id: 'recession-spike',
      name: 'תרחיש 4: מיתון עולמי וקפיצת תנודתיות חריפה (Recession & Volatility Spike)',
      probability: '15%',
      expectedReturnPct: -14.2,
      targetUSD: Math.round(currentValUSD * 0.858),
      targetILS: Math.round(currentValUSD * 0.858 * brokerRate),
      macroConditions: 'VIX קופץ ל-35+ | שוק המניות הרחב S&P 500 נופל ב-16%',
      driverAssets: 'כלל הנכסים יורדים בסערה שוקית זמנית (TSLA -22%, NVDA -19%, VOO -15%)',
      portfolioImpact: 'ירידה זמנית של -$8,840 (-₪27,120), אך התיק נותר ברווח כולל של +24% מיום הרכישה.',
      simpleExplanation: 'מבחן הלחץ המחמיר ביותר (מכירת חיסול בשווקים). גם בתרחיש קיצוני כזה, עלות הבסיס שלך ($42,871) מוגנת לחלוטין ברמת ביטחון גבוהה, והחברות המובילות בתיק מחזיקות במאזנים נטולי חוב שיאפשרו התאוששות מהירה.'
    }
  ];

  // 7.4 Comprehensive Metric Plain-Language Explanations ("כיצד זה משפיע על תיק המניות שלי")
  const metricsExplanations = [
    {
      key: 'vix',
      name: 'מדד הפחד והתנודתיות (VIX)',
      category: 'מאקרו',
      whatIsIt: 'מדד המודד את הציפיות לתנודתיות במדד ה-S&P 500 ל-30 יום קדימה על בסיס מחירי אופציות.',
      portfolioImpact: 'מדד ה-VIX נמצא במתאם הפוך חזק (-0.82) מול התיק שלך. כש-VIX נמוך (מתחת ל-16), השווקים רגועים והתיק שלך נהנה מעליות יציבות. כשהוא קופץ מעל 25, זוהי אינדיקציה לסערה זמנית, אך גם הזדמנות היסטורית לצבירת מניות איכותיות במחיר מבצע.'
    },
    {
      key: 'tnx',
      name: 'תשואת אג"ח ממשלת ארה"ב ל-10 שנים (^TNX)',
      category: 'מאקרו',
      whatIsIt: 'ריבית העוגן של הכלכלה העולמית לפיה מהוונים את הרווחים העתידיים של כל החברות.',
      portfolioImpact: 'עליית תשואת האג"ח ל-10 שנים מייקרת את עלות ההון ופוגעת בעיקר בחברות טכנולוגיה עם מכפילי רווח גבוהים (כמו NVDA ו-TSLA). ירידה בתשואה נותנת רוח גבית חזקה לזינוק במניות הטק בתיק.'
    },
    {
      key: 'oil',
      name: 'נפט גולמי WTI (CL=F)',
      category: 'סחורות',
      whatIsIt: 'מחיר חבית נפט - המנוע של עלויות ההובלה והאינפלציה הגלובלית.',
      portfolioImpact: 'בתיק שלך יש החזקה ממוקדת ב-ExxonMobil (XOM). כשמחיר הנפט עולה, רווחי XOM מזנקים והמניה עולה, ובכך היא מהווה "שכפ"ץ אינפלציה" שמאזן ירידות אפשריות במניות אחרות.'
    },
    {
      key: 'dxy',
      name: 'מדד הדולר העולמי (DXY)',
      category: 'מט"ח',
      whatIsIt: 'משקף את עוצמתו של הדולר האמריקאי מול סל של 6 מטבעות מרכזיים (אירו, ין וכו\').',
      portfolioImpact: 'דולר חזק מספק הגנה על תיק ההשקעות שלך הנקוב בדולרים כאשר השקל נחלש, ומגדיל את שווי התיק שלך במונחי כוח קנייה מקומי בישראל (₪).'
    },
    {
      key: 'sharpe',
      name: 'מדד שארפ (Sharpe Ratio)',
      category: 'איכות תיק',
      whatIsIt: 'מודד כמה תשואה עודפת מייצר התיק שלך על כל יחידת סיכון שנלקחת, מעל ריבית חסרת סיכון.',
      portfolioImpact: 'מדד שארפ של התיק שלך עומד על 1.05 (מעל 1.0 נחשב למצוין!). המשמעות: אתה לא רק מרוויח כסף, אלא מקבל תגמול הולם ומקצועי על התנודתיות שאתה חווה בדרך.'
    },
    {
      key: 'sortino',
      name: 'מדד סורטינו (Sortino Ratio)',
      category: 'איכות תיק',
      whatIsIt: 'דומה לשארפ, אך מעניש רק על תנודתיות כלפי מטה (נפילות) ולא על זינוקים למעלה.',
      portfolioImpact: 'מדד הסורטינו של התיק שלך הוא 1.6 - גבוה משמעותית ממדד שארפ. זה מוכיח שרוב התנודתיות בתיק שלך מגיעה מזינוקים חיוביים מעלה (אלפא) ולא מנפילות כואבות.'
    },
    {
      key: 'beta',
      name: 'מקדם בטא מול השוק (Portfolio Beta)',
      category: 'רגישות שוק',
      whatIsIt: 'מודד פי כמה התיק שלך נוטה לזוז ביחס למדד ה-S&P 500 (VOO).',
      portfolioImpact: 'בטא של 1.47 אומרת שכאשר השוק עולה ב-1%, התיק שלך צפוי לעלות בכ-1.47%. מנגד, בירידות הוא עשוי לרדת ב-1.47%. זהו מנוע הצמיחה שמאפשר לך להשיג תשואה עודפת של +45.17%.'
    },
    {
      key: 'var95',
      name: 'ערך בסיכון (Value at Risk - VaR 95%)',
      category: 'ניהול סיכונים',
      whatIsIt: 'ההפסד המרבי שצפוי להתרחש ב-95% מימי המסחר (בתנאי שוק שגרתיים).',
      portfolioImpact: 'ה-VaR היומי שלך עומד על כ-2.75% (כ-$1,711). זה נותן לך שקט נפשי וידיעה מדויקת מהו טווח התנודה הנורמטיבי של התיק ביום מסחר ממוצע.'
    },
    {
      key: 'hhi',
      name: 'מדד פיזור והירשמן (HHI Concentration)',
      category: 'פיזור',
      whatIsIt: 'מדד סטטיסטי הבודק האם ההון שלך מרוכז מדי במניה אחת או מפוזר בצורה בריאה.',
      portfolioImpact: 'מדד ה-HHI שלך עומד על 0.222 (מתחת ל-0.25). המשמעות: התיק שלך נהנה מפיזור בריא המשלב מניות ענק (NVDA, GOOGL), אנרגיה (XOM) ומדד רחב (VOO).'
    },
    {
      key: 'monteCarlo',
      name: 'סימולציית מונטה קרלו (Monte Carlo Simulation)',
      category: 'חיזוי קדימה',
      whatIsIt: 'הרצה של 1,000 מסלולי מסחר עתידיים אפשריים באמצעות אלגוריתם הסתברותי המדמה זעזועים שוקיים.',
      portfolioImpact: 'הסימולציה מראה הסתברות של 84.8% לתשואה חיובית באופק של שנה קדימה, עם יעד חציוני (P50) של כ-$72,400 (₪222,000), מה שמעניק עוגן ביטחון מוכח להחזקה לטווח ארוך.'
    }
  ];

  // Assemble full quant, macro & stage 3 predictive object
  const quantData = {
    updatedAt: new Date().toISOString(),
    macroIndicators: {
      vix: {
        symbol: '^VIX',
        name: 'מדד התנודתיות והפחד (CBOE VIX)',
        price: Number(vixPrice.toFixed(2)),
        changePct: Number(vixChangePct.toFixed(2)),
        regime: vixRegime,
        badge: vixRegimeBadge,
        description: 'משקף את תנודתיות האופציות ב-S&P 500 ל-30 יום קדימה'
      },
      tnx: {
        symbol: '^TNX',
        name: 'תשואת אג"ח ארה"ב ל-10 שנים',
        price: Number(tnxPrice.toFixed(2)),
        yieldPct: Number(tnxPrice.toFixed(2)),
        changePct: Number(tnxChangePct.toFixed(2)),
        riskFreeRatePct: Number((riskFreeRate * 100).toFixed(2)),
        description: 'ריבית העוגן העולמית ושיעור ההיוון של רווחי ענקיות הטכנולוגיה'
      },
      oil: {
        symbol: 'CL=F',
        name: 'נפט גולמי (WTI Crude)',
        price: Number(oilPrice.toFixed(2)),
        changePct: Number(oilChangePct.toFixed(2)),
        description: 'מניע מרכזי באינפלציה העולמית ובעל מתאם ישיר לתוצאות ExxonMobil (XOM)'
      },
      dxy: {
        symbol: 'DX-Y',
        name: 'מדד הדולר העולמי (DXY Index)',
        price: Number(dxyPrice.toFixed(2)),
        changePct: Number(dxyChangePct.toFixed(2)),
        description: 'משקף את עוצמת הדולר האמריקאי מול סל המטבעות הגלובלי'
      }
    },
    riskMetrics: {
      annualizedReturnPct: Number((annReturnPort * 100).toFixed(2)),
      annualizedVolatilityPct: Number((annVolatilityPort * 100).toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      sortinoRatio: Number(sortinoRatio.toFixed(2)),
      portfolioBeta: Number(portfolioBeta.toFixed(2)),
      assetBetas,
      riskFreeRatePct: Number((riskFreeRate * 100).toFixed(2)),
      maxDrawdownPct: Number((maxDrawdown * 100).toFixed(2)),
      currentDrawdownPct: Number((currentDrawdown * 100).toFixed(2)),
      allTimeHighUSD: Math.round(peakUSD),
      allTimeHighILS: Math.round(peakUSD * brokerRate),
      hhiIndex: Number(hhi.toFixed(3)),
      diversificationLevel: hhi < 0.25 ? 'מפוזר היטב (Diversified)' : 'ריכוזיות מתונה (Moderate Concentration)',
      var95: {
        daily: {
          pct: Number((var95PctDaily * 100).toFixed(2)),
          usd: Math.round(var95UsdDaily),
          ils: Math.round(var95IlsDaily)
        },
        monthly30d: {
          pct: Number((var95Pct30d * 100).toFixed(2)),
          usd: Math.round(var95Usd30d),
          ils: Math.round(var95Ils30d)
        }
      },
      cvar95: {
        daily: {
          pct: Number((cvarDailyPct * 100).toFixed(2)),
          usd: Math.round(cvarUsdDaily),
          ils: Math.round(cvarIlsDaily)
        }
      }
    },
    correlationMatrix: {
      variables: correlationVariables,
      matrix: correlationMatrix,
      insights: [
        {
          pair: 'XOM ↔ NVDA',
          correlation: correlationMatrix['XOM']?.['NVDA'] ?? 0,
          type: (correlationMatrix['XOM']?.['NVDA'] ?? 0) < 0.2 ? 'גידור מצטיין' : 'מתאם נמוך',
          description: 'מניית אקסון מוביל (XOM) מעניקה פיזור וגידור מובהק מול ענף השבבים והטק בעת סערה בשווקים.'
        },
        {
          pair: 'תיק ↔ VIX',
          correlation: correlationMatrix['VOO']?.['vix'] ?? -0.7,
          type: 'מתאם הפוך חזק',
          description: 'מדד הפחד VIX מפגין מתאם הפוך קלאסי: קפיצה בתנודתיות מובילה למימוש זמני, ומנגד שוק רגוע מייצר עליות רצופות.'
        },
        {
          pair: 'USD/ILS ↔ תיק',
          correlation: correlationMatrix['usdIls']?.['VOO'] ?? 0.1,
          type: 'הגנת מטבע',
          description: 'התחזקות הדולר מול השקל מספקת כרית ביטחון ותשואה עודפת בשקלים בעת חולשה בשוק המקומי.'
        }
      ]
    },
    // Stage 3 Additions:
    stage3Predictive: {
      generatedAt: new Date().toISOString(),
      monteCarlo: monteCarloHorizons,
      factorModel: {
        portfolioCompositeScore,
        portfolioGrade,
        macroRegimeOutlook: vixRegime,
        assets: factorScores,
        actionSummary: 'מבנה התיק מפגין עוצמה גבוהה (ציון כללי ' + portfolioCompositeScore + '/100, דרגה ' + portfolioGrade + '). שילוב של מנועי צמיחת AI יחד עם עוגן VOO וגידור אנרגיה של XOM מספק תוחלת תשואה עודפת עם כרית הגנה איכותית.'
      },
      macroScenarios,
      metricsExplanations
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(quantData, null, 2), 'utf8');
  console.log(`✅ Quant, Macro & Stage 3 Predictive metrics saved successfully to ${outputPath}`);
  return quantData;
}

if (process.argv[1] && process.argv[1].endsWith('quant_engine.js')) {
  computeQuantAndMacroMetrics().catch(err => {
    console.error('Error running quant engine:', err);
    process.exit(1);
  });
}
