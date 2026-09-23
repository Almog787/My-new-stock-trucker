import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const portfolioPath = path.join(process.cwd(), 'public', 'data', 'portfolio.json');
const historyPath = path.join(process.cwd(), 'public', 'data', 'stock_history.json');

const round5m = (dateInput) => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const ms = Math.round(d.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
  return new Date(ms).toISOString();
};

async function backfillHistory() {
  console.log('=== Starting Historical Stock Data Backfill & Gap-Filling ===');
  
  if (!fs.existsSync(portfolioPath) || !fs.existsSync(historyPath)) {
    console.error('Error: Required data files (portfolio.json or stock_history.json) not found.');
    process.exit(1);
  }

  const portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
  const tickers = Object.keys(portfolio);
  console.log(`Target portfolio tickers: ${tickers.join(', ')}`);

  let existingHistory = [];
  try {
    existingHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch (err) {
    console.warn('Could not parse existing stock_history.json, starting fresh:', err.message);
  }

  console.log(`Loaded ${existingHistory.length} existing points from stock_history.json.`);

  // 1. Build initial timeline map from existing file
  const historyMap = {};
  let normalizedCount = 0;

  for (const entry of existingHistory) {
    const normTs = round5m(entry.timestamp);
    if (!normTs) continue;
    
    if (!historyMap[normTs]) {
      historyMap[normTs] = {
        timestamp: normTs,
        prices: { ...(entry.prices || {}) },
        exchangeRate: entry.exchangeRate || null
      };
      normalizedCount++;
    } else {
      // Merge prices & exchange rate
      historyMap[normTs].prices = { ...historyMap[normTs].prices, ...entry.prices };
      if (entry.exchangeRate) historyMap[normTs].exchangeRate = entry.exchangeRate;
    }
  }

  console.log(`Normalized ${normalizedCount} unique 5-minute time buckets from existing file.`);

  // Parse CLI args for days back (default 60 days for 5m intraday, or 365 for 1d)
  const args = process.argv.slice(2);
  let daysBack = 60;
  if (args.includes('--days')) {
    const idx = args.indexOf('--days');
    if (idx !== -1 && args[idx + 1]) {
      daysBack = parseInt(args[idx + 1], 10) || 60;
    }
  }

  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log(`Fetching free Yahoo Finance historical chart data starting from ${startDate} (${daysBack} days back)...`);

  const fetchedDataMap = {}; // ts -> { prices: {}, exchangeRate: null }

  // 2. Fetch 5-minute interval historical data for all tickers (up to last 60 days)
  for (const ticker of tickers) {
    try {
      console.log(`Fetching 5m historical intraday data for ${ticker}...`);
      const res = await yahooFinance.chart(ticker, { period1: startDate, interval: '5m' });
      let count = 0;
      if (res && res.quotes) {
        for (const q of res.quotes) {
          if (!q.close || !q.date) continue;
          const ts = round5m(q.date);
          if (!ts) continue;
          if (!fetchedDataMap[ts]) fetchedDataMap[ts] = { prices: {} };
          fetchedDataMap[ts].prices[ticker] = q.close;
          count++;
        }
      }
      console.log(`  -> Retrieved ${count} 5m quotes for ${ticker}`);
    } catch (e) {
      console.warn(`Warning: Could not fetch 5m data for ${ticker}:`, e.message);
    }
  }

  // 3. Fetch 5-minute interval exchange rate (ILS=X)
  try {
    console.log('Fetching 5m exchange rate historical data for ILS=X...');
    const resIls = await yahooFinance.chart('ILS=X', { period1: startDate, interval: '5m' });
    let count = 0;
    if (resIls && resIls.quotes) {
      for (const q of resIls.quotes) {
        if (!q.close || !q.date) continue;
        const ts = round5m(q.date);
        if (!ts) continue;
        if (!fetchedDataMap[ts]) fetchedDataMap[ts] = { prices: {} };
        fetchedDataMap[ts].exchangeRate = q.close + 0.008; // Apply standard broker spread matching update_data.js
        count++;
      }
    }
    console.log(`  -> Retrieved ${count} exchange rate quotes for ILS=X`);
  } catch (e) {
    console.warn('Warning: Could not fetch 5m data for ILS=X:', e.message);
  }

  // 4. Merge fetched Yahoo Finance points into historyMap
  let newBucketsAdded = 0;
  let existingBucketsEnriched = 0;

  for (const [ts, data] of Object.entries(fetchedDataMap)) {
    if (Object.keys(data.prices).length === 0) continue;

    if (!historyMap[ts]) {
      historyMap[ts] = {
        timestamp: ts,
        prices: { ...data.prices },
        exchangeRate: data.exchangeRate || null
      };
      newBucketsAdded++;
    } else {
      // Enrich existing bucket with missing ticker prices or exchange rate
      let enriched = false;
      for (const [ticker, price] of Object.entries(data.prices)) {
        if (!historyMap[ts].prices[ticker]) {
          historyMap[ts].prices[ticker] = price;
          enriched = true;
        }
      }
      if (!historyMap[ts].exchangeRate && data.exchangeRate) {
        historyMap[ts].exchangeRate = data.exchangeRate;
        enriched = true;
      }
      if (enriched) existingBucketsEnriched++;
    }
  }

  console.log(`Merged Yahoo Finance data: ${newBucketsAdded} new time buckets created, ${existingBucketsEnriched} existing buckets enriched.`);

  // 5. Sort timeline chronologically & perform forward-fill for missing ticker gaps
  const sortedTimestamps = Object.keys(historyMap).sort((a, b) => new Date(a) - new Date(b));

  let lastKnownPrices = {};
  let lastKnownRate = 3.02; // Default fallback
  let filledValuesCount = 0;

  const finalHistory = sortedTimestamps.map(ts => {
    const entry = historyMap[ts];
    
    // Update rate
    if (entry.exchangeRate) {
      lastKnownRate = entry.exchangeRate;
    } else {
      entry.exchangeRate = lastKnownRate;
    }

    // Check & forward-fill missing ticker prices
    for (const ticker of tickers) {
      if (entry.prices[ticker] !== undefined && entry.prices[ticker] !== null) {
        lastKnownPrices[ticker] = entry.prices[ticker];
      } else if (lastKnownPrices[ticker] !== undefined) {
        entry.prices[ticker] = lastKnownPrices[ticker];
        filledValuesCount++;
      }
    }

    return entry;
  });

  // Filter out points where no ticker has a valid price
  const cleanHistory = finalHistory.filter(item => {
    return Object.keys(item.prices).some(t => tickers.includes(t) && item.prices[t] > 0);
  });

  console.log(`Completed forward-fill: ${filledValuesCount} missing individual ticker values completed.`);
  console.log(`Final backfilled stock_history.json count: ${cleanHistory.length} entries.`);

  // Write updated history back to file
  fs.writeFileSync(historyPath, JSON.stringify(cleanHistory, null, 2), 'utf8');
  console.log('Successfully saved updated history to public/data/stock_history.json.');

  // 6. Re-run data update script & AI TimesFM forecast to update meta.json, README & charts
  console.log('\n=== Re-calculating Portfolio Stats, Charts & AI Forecast ===');
  try {
    execSync('node scripts/update_data.js', { stdio: 'inherit' });
    console.log('Successfully updated portfolio analytics, README and charts.');
  } catch (err) {
    console.error('Error re-running update_data.js:', err.message);
  }
}

backfillHistory().catch(err => {
  console.error('Unhandled error during history backfill:', err);
  process.exit(1);
});
