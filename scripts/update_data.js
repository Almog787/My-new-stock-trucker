import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import YahooFinance from 'yahoo-finance2';
import { computeQuantAndMacroMetrics } from './quant_engine.js';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const portfolioPath = path.join(process.cwd(), 'public', 'data', 'portfolio.json');
const historyPath = path.join(process.cwd(), 'public', 'data', 'stock_history.json');
const dividendsPath = path.join(process.cwd(), 'public', 'data', 'dividends.json');
const readmePath = path.join(process.cwd(), 'README.md');

const formatPercent = (val) => {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
};

async function downloadQuickChart(chartConfig, outputPath) {
  const url = 'https://quickchart.io/chart';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chart: chartConfig,
      width: 800,
      height: 400,
      backgroundColor: 'white',
      format: 'png',
      devicePixelRatio: 2,
      version: '3'
    })
  });
  if (!response.ok) {
    throw new Error(`Failed to generate chart: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
}

async function fetchAndUpdatePrices() {
  try {
    console.log('Fetching stock prices and dividend data...');
    if (!fs.existsSync(portfolioPath)) {
      console.log('Portfolio file not found, skipping fetch.');
      return;
    }
    
    const portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
    const tickers = Object.keys(portfolio);
    
    if (tickers.length === 0) {
      console.log('No tickers found in portfolio.');
      return;
    }

    // Fetch ILS=X separately
    const ilsQuote = await yahooFinance.quote('ILS=X').catch(() => ({ regularMarketPrice: 3.7 }));
    const realUsdIlsRate = ilsQuote.regularMarketPrice || 3.7;
    
    // The broker applies a spread to the exchange rate (~0.8 agorot).
    const BROKER_SPREAD = 0.008; 
    const usdIlsRate = realUsdIlsRate + BROKER_SPREAD;
    const brokerRate = usdIlsRate; // Alias for clarity
    
    // Save to meta.json for the React app to use
    const dataDir = path.join(process.cwd(), 'public', 'data');
    const metaPath = path.join(dataDir, 'meta.json');
    fs.writeFileSync(metaPath, JSON.stringify({ usdIlsRate: brokerRate, lastUpdate: new Date().toISOString() }, null, 2));

    // Fetch quotes & historical dividend events for each ticker
    const quotes = await Promise.all(
      tickers.map(ticker => yahooFinance.quote(ticker).catch(err => {
        console.error(`Failed to fetch quote for ${ticker}:`, err.message);
        return null;
      }))
    );

    const dividendEventsByTicker = {};
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startPeriod = '2023-01-01';

    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const chartRes = await yahooFinance.chart(ticker, { period1: startPeriod, events: 'dividends' });
          dividendEventsByTicker[ticker] = chartRes.events?.dividends || [];
        } catch (err) {
          console.warn(`Could not fetch dividend history for ${ticker}:`, err.message);
          dividendEventsByTicker[ticker] = [];
        }
      })
    );

    const prices = {};
    let totalInvestedUSD = 0;
    let totalCurrentUSD = 0;
    let totalPreviousUSD = 0;
    
    const holdingsRows = [];
    const allocationLabels = [];
    const allocationData = [];

    // Process Dividend History and Aggregations
    const allDividendEvents = [];
    const tickerDividendSummaries = {};
    let totalReceivedGrossUSD = 0;
    let l12mReceivedGrossUSD = 0;
    let ytdReceivedGrossUSD = 0;
    const currentYear = new Date().getFullYear();

    quotes.forEach(quote => {
      if (quote && quote.symbol && quote.regularMarketPrice) {
        prices[quote.symbol] = quote.regularMarketPrice;
        
        const ticker = quote.symbol;
        const currentPrice = quote.regularMarketPrice;
        const changePercent = quote.regularMarketChangePercent || 0;
        
        const shares = portfolio[ticker].amount;
        const avgPrice = portfolio[ticker].avg_price;
        
        const costBasisUSD = shares * avgPrice;
        const currentValueUSD = shares * currentPrice;
        
        // previous day's close for this stock
        const previousValueUSD = currentValueUSD / (1 + changePercent / 100);
        
        totalInvestedUSD += costBasisUSD;
        totalCurrentUSD += currentValueUSD;
        totalPreviousUSD += previousValueUSD;
        
        const pnlPercent = ((currentPrice / avgPrice) - 1) * 100;
        const pnlILS = (currentValueUSD - costBasisUSD) * brokerRate;
        
        const icon = pnlPercent >= 0 ? '🟢' : '🔴';
        
        allocationLabels.push(ticker);
        allocationData.push(currentValueUSD);
        
        // Process this ticker's historical dividends
        const events = dividendEventsByTicker[ticker] || [];
        let tickerTotalGrossUSD = 0;
        let tickerL12mGrossUSD = 0;

        events.forEach(evt => {
          const evtDate = new Date(evt.date);
          const grossUSD = evt.amount * shares;
          const grossILS = grossUSD * brokerRate;
          const taxUSD = grossUSD * 0.25;
          const taxILS = grossILS * 0.25;
          const netUSD = grossUSD * 0.75;
          const netILS = grossILS * 0.75;

          tickerTotalGrossUSD += grossUSD;
          totalReceivedGrossUSD += grossUSD;

          if (evtDate >= oneYearAgo) {
            tickerL12mGrossUSD += grossUSD;
            l12mReceivedGrossUSD += grossUSD;
          }

          if (evtDate.getFullYear() === currentYear) {
            ytdReceivedGrossUSD += grossUSD;
          }

          allDividendEvents.push({
            id: `${ticker}-${evtDate.toISOString().slice(0, 10)}`,
            ticker,
            date: evtDate.toISOString().slice(0, 10),
            dividendPerShare: evt.amount,
            shares,
            grossUSD,
            grossILS,
            taxUSD,
            taxILS,
            netUSD,
            netILS
          });
        });

        // Declared / Trailing Yield & Rates
        const declaredRate = quote.dividendRate || quote.trailingAnnualDividendRate || (tickerL12mGrossUSD / shares) || 0;
        const declaredYield = quote.dividendYield || (quote.trailingAnnualDividendYield ? quote.trailingAnnualDividendYield * 100 : (currentPrice > 0 ? (declaredRate / currentPrice) * 100 : 0));

        tickerDividendSummaries[ticker] = {
          ticker,
          shares,
          eventsCount: events.length,
          totalGrossUSD: tickerTotalGrossUSD,
          totalGrossILS: tickerTotalGrossUSD * brokerRate,
          totalNetUSD: tickerTotalGrossUSD * 0.75,
          totalNetILS: (tickerTotalGrossUSD * 0.75) * brokerRate,
          l12mGrossUSD: tickerL12mGrossUSD,
          l12mGrossILS: tickerL12mGrossUSD * brokerRate,
          l12mNetUSD: tickerL12mGrossUSD * 0.75,
          l12mNetILS: (tickerL12mGrossUSD * 0.75) * brokerRate,
          declaredRate,
          declaredYield,
          exDividendDate: quote.exDividendDate ? new Date(quote.exDividendDate).toISOString().slice(0, 10) : null
        };

        const divBadge = tickerL12mGrossUSD > 0 ? `💵 $${tickerL12mGrossUSD.toFixed(1)}/שנה` : '—';
        holdingsRows.push(`| ${ticker} | ${shares} | $${avgPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} | $${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} | ${icon} ${formatPercent(pnlPercent)} | ₪${Math.round(pnlILS).toLocaleString('en-US')} | ${divBadge} |`);
      }
    });

    // Sort all events newest first
    allDividendEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Write dividends.json
    const dividendData = {
      lastUpdate: new Date().toISOString(),
      exchangeRate: brokerRate,
      summary: {
        totalReceivedGrossUSD,
        totalReceivedGrossILS: totalReceivedGrossUSD * brokerRate,
        totalReceivedTaxUSD: totalReceivedGrossUSD * 0.25,
        totalReceivedTaxILS: (totalReceivedGrossUSD * 0.25) * brokerRate,
        totalReceivedNetUSD: totalReceivedGrossUSD * 0.75,
        totalReceivedNetILS: (totalReceivedGrossUSD * 0.75) * brokerRate,
        
        l12mReceivedGrossUSD,
        l12mReceivedGrossILS: l12mReceivedGrossUSD * brokerRate,
        l12mReceivedTaxUSD: l12mReceivedGrossUSD * 0.25,
        l12mReceivedTaxILS: (l12mReceivedGrossUSD * 0.25) * brokerRate,
        l12mReceivedNetUSD: l12mReceivedGrossUSD * 0.75,
        l12mReceivedNetILS: (l12mReceivedGrossUSD * 0.75) * brokerRate,

        ytdReceivedGrossUSD,
        ytdReceivedGrossILS: ytdReceivedGrossUSD * brokerRate,
        ytdReceivedTaxUSD: ytdReceivedGrossUSD * 0.25,
        ytdReceivedTaxILS: (ytdReceivedGrossUSD * 0.25) * brokerRate,
        ytdReceivedNetUSD: ytdReceivedGrossUSD * 0.75,
        ytdReceivedNetILS: (ytdReceivedGrossUSD * 0.75) * brokerRate,

        trailingPortfolioYieldPct: totalCurrentUSD > 0 ? (l12mReceivedGrossUSD / totalCurrentUSD) * 100 : 0,
        trailingPortfolioNetYieldPct: totalCurrentUSD > 0 ? ((l12mReceivedGrossUSD * 0.75) / totalCurrentUSD) * 100 : 0,
        eventsCount: allDividendEvents.length
      },
      byTicker: tickerDividendSummaries,
      events: allDividendEvents
    };

    fs.writeFileSync(dividendsPath, JSON.stringify(dividendData, null, 2));
    console.log(`Saved dividends.json with ${allDividendEvents.length} historical dividend payments.`);

    if (Object.keys(prices).length > 0) {
      const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : [];
      
      console.log('Fetching intraday timeline (5m intervals) to backfill history...');
      const period1 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const chartData = {};
      const round5m = (dateStr) => {
          const d = new Date(dateStr);
          const ms = Math.round(d.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
          return new Date(ms).toISOString();
      };

      for (const ticker of tickers) {
          try {
              const res = await yahooFinance.chart(ticker, { period1, interval: '5m' });
              for (const q of res.quotes) {
                  if (!q.close) continue;
                  const ts = round5m(q.date);
                  if (!chartData[ts]) chartData[ts] = { prices: {} };
                  chartData[ts].prices[ticker] = q.close;
              }
          } catch(e) {
              console.warn(`Could not fetch 5m chart for ${ticker}:`, e.message);
          }
      }

      try {
          const resIls = await yahooFinance.chart('ILS=X', { period1, interval: '5m' });
          for (const q of resIls.quotes) {
              if (!q.close) continue;
              const ts = round5m(q.date);
              if (!chartData[ts]) chartData[ts] = { prices: {} };
              chartData[ts].exchangeRate = q.close + 0.008; 
          }
      } catch(e) {
          console.warn('Could not fetch 5m chart for ILS=X:', e.message);
      }

      const historyMap = {};
      for (const entry of history) {
          const ts = round5m(entry.timestamp);
          if (ts) historyMap[ts] = entry;
      }

      const sortedTs = Object.keys(chartData).sort();
      let addedPoints = 0;
      for (const ts of sortedTs) {
          const data = chartData[ts];
          if (Object.keys(data.prices).length === 0) continue; // Only keep points where market is open
          
          if (!historyMap[ts]) {
              historyMap[ts] = { timestamp: ts, prices: { ...data.prices }, exchangeRate: data.exchangeRate || null };
              addedPoints++;
          } else {
              // Update existing point with any potentially more accurate data
              historyMap[ts].prices = { ...historyMap[ts].prices, ...data.prices };
              if (data.exchangeRate) historyMap[ts].exchangeRate = data.exchangeRate;
          }
      }
      
      const currentTs = round5m(new Date().toISOString());
      if (currentTs) {
          if (!historyMap[currentTs]) {
              historyMap[currentTs] = { timestamp: currentTs, prices: { ...prices }, exchangeRate: brokerRate };
              addedPoints++;
          } else {
              historyMap[currentTs].prices = { ...historyMap[currentTs].prices, ...prices };
              historyMap[currentTs].exchangeRate = brokerRate;
          }
      }

      // Chronological forward-fill for any missing ticker values
      const sortedAllTs = Object.keys(historyMap).sort((a, b) => new Date(a) - new Date(b));
      let forwardPrices = {};
      let forwardRate = brokerRate;

      const finalHistory = sortedAllTs.map(ts => {
          const entry = historyMap[ts];
          if (entry.exchangeRate) {
              forwardRate = entry.exchangeRate;
          } else {
              entry.exchangeRate = forwardRate;
          }
          for (const ticker of tickers) {
              if (entry.prices[ticker] !== undefined && entry.prices[ticker] !== null) {
                  forwardPrices[ticker] = entry.prices[ticker];
              } else if (forwardPrices[ticker] !== undefined) {
                  entry.prices[ticker] = forwardPrices[ticker];
              }
          }
          return entry;
      }).filter(item => Object.keys(item.prices).some(t => tickers.includes(t) && item.prices[t] > 0));

      fs.writeFileSync(historyPath, JSON.stringify(finalHistory, null, 2));
      console.log(`Successfully updated stock history timeline. Added ${addedPoints} new points.`);
      
      // ASSET META for clean descriptive table
      const ASSET_META = {
        GOOGL: { name: 'Alphabet (Google)', sector: 'טכנולוגיה ותוכנה' },
        NVDA: { name: 'NVIDIA Corp', sector: 'מוליכים למחצה ושבבים' },
        TSLA: { name: 'Tesla Inc', sector: 'רכב חשמלי / אנרגיה' },
        ASML: { name: 'ASML Holding', sector: 'ציוד מוליכים למחצה' },
        VOO: { name: 'Vanguard S&P 500', sector: 'מדד S&P 500' },
        XOM: { name: 'Exxon Mobil', sector: 'אנרגיה ונפט' }
      };

      // Recalculate formatted holdings rows with rich logical columns
      const enhancedHoldingsRows = [];
      quotes.forEach(quote => {
        if (quote && quote.symbol && quote.regularMarketPrice) {
          const ticker = quote.symbol;
          const currentPrice = quote.regularMarketPrice;
          const changePercent = quote.regularMarketChangePercent || 0;
          const shares = portfolio[ticker].amount;
          const avgPrice = portfolio[ticker].avg_price;
          const costBasisUSD = shares * avgPrice;
          const currentValueUSD = shares * currentPrice;
          const currentValueILS = currentValueUSD * brokerRate;
          
          // Daily Change calculation
          const previousValueUSD = currentValueUSD / (1 + changePercent / 100);
          const dailyChangeUSD = currentValueUSD - previousValueUSD;
          const dailyChangeILS = dailyChangeUSD * brokerRate;
          const dailyBadge = changePercent >= 0 ? `🟢 +${changePercent.toFixed(2)}%` : `🔴 ${changePercent.toFixed(2)}%`;
          const dailyAmountStr = `${dailyChangeILS >= 0 ? '+' : ''}₪${Math.round(dailyChangeILS).toLocaleString('en-US')}`;

          // Inception / Total Change calculation
          const totalReturnUSD = currentValueUSD - costBasisUSD;
          const totalReturnILS = totalReturnUSD * brokerRate;
          const totalReturnPercent = ((currentPrice / avgPrice) - 1) * 100;
          const totalBadge = totalReturnPercent >= 0 ? `🟢 +${totalReturnPercent.toFixed(2)}%` : `🔴 ${totalReturnPercent.toFixed(2)}%`;
          const totalAmountStr = `${totalReturnILS >= 0 ? '+' : ''}₪${Math.round(totalReturnILS).toLocaleString('en-US')}`;

          const assetName = ASSET_META[ticker]?.name || ticker;

          enhancedHoldingsRows.push(`| **${ticker}** <br><sub>${assetName}</sub> | ${shares} | $${currentPrice.toFixed(2)} | ₪${Math.round(currentValueILS).toLocaleString('en-US')} <br><sub>($${Math.round(currentValueUSD).toLocaleString('en-US')})</sub> | ${dailyBadge} <br><sub>${dailyAmountStr}</sub> | ${totalBadge} <br><sub>${totalAmountStr}</sub> |`);
        }
      });

      // Calculate totals for README using the dynamic broker rate
      const totalInvestedILS = totalInvestedUSD * brokerRate;
      const totalCurrentILS = totalCurrentUSD * brokerRate;
      const totalPnLUSD = totalCurrentUSD - totalInvestedUSD;
      const totalPnLILS = totalCurrentILS - totalInvestedILS;
      const totalPnLPercent = totalInvestedILS > 0 ? ((totalCurrentILS / totalInvestedILS) - 1) * 100 : 0;
      
      // Calculate Israeli Capital Gains Tax (25%) with portfolio loss offsetting (סעיף 92 לפקודת מס הכנסה)
      const totalUnrealizedTaxUSD = totalPnLUSD > 0 ? totalPnLUSD * 0.25 : 0;
      const totalUnrealizedTaxILS = totalPnLILS > 0 ? totalPnLILS * 0.25 : 0;
      const totalNetPnLUSD = totalPnLUSD > 0 ? totalPnLUSD * 0.75 : totalPnLUSD;
      const totalNetPnLILS = totalPnLILS > 0 ? totalPnLILS * 0.75 : totalPnLILS;
      const totalNetPnLPercent = totalInvestedUSD > 0 ? (totalNetPnLUSD / totalInvestedUSD) * 100 : 0;
      
      // Calculate YTD Added Monthly Income (for household income)
      const currentMonthNumber = new Date().getMonth() + 1; // 1-12
      const pointsPriorToYear = history.filter(h => new Date(h.timestamp).getFullYear() < currentYear);
      let startOfYearUSD = totalInvestedUSD;
      if (pointsPriorToYear.length > 0) {
        const lastPriorPoint = pointsPriorToYear[pointsPriorToYear.length - 1];
        let val = 0;
        for (const [t, d] of Object.entries(portfolio)) {
          val += (lastPriorPoint.prices[t] || d.avg_price) * d.amount;
        }
        startOfYearUSD = val;
      }
      const ytdPnLUSD = totalCurrentUSD - startOfYearUSD;
      const ytdPnLILS = ytdPnLUSD * brokerRate;
      const ytdMonthlyAvgILS = ytdPnLILS / currentMonthNumber;
      const ytdMonthlyAvgUSD = ytdPnLUSD / currentMonthNumber;
      const ytdNetMonthlyAvgILS = (ytdPnLILS > 0 ? ytdPnLILS * 0.75 : ytdPnLILS) / currentMonthNumber;
      const ytdNetMonthlyAvgUSD = (ytdPnLUSD > 0 ? ytdPnLUSD * 0.75 : ytdPnLUSD) / currentMonthNumber;

      let dailyChangePercent = 0;
      let dailyPnLUSD = 0;
      let dailyPnLILS = 0;
      if (totalPreviousUSD > 0) {
         dailyChangePercent = ((totalCurrentUSD / totalPreviousUSD) - 1) * 100;
         dailyPnLUSD = totalCurrentUSD - totalPreviousUSD;
         dailyPnLILS = dailyPnLUSD * brokerRate;
      }
      
      // Generating Charts
      console.log('Generating charts...');
      const dataHubDir = path.join(process.cwd(), 'data_hub');
      if (!fs.existsSync(dataHubDir)) {
        fs.mkdirSync(dataHubDir, { recursive: true });
      }

      const allocationLabelsWithPercent = allocationLabels.map((label, i) => {
        const percent = ((allocationData[i] / totalCurrentUSD) * 100).toFixed(1);
        return `${label} (${percent}%)`;
      });

      const allocationConfig = {
        type: 'doughnut',
        data: {
          labels: allocationLabelsWithPercent,
          datasets: [{
            data: allocationData,
            backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          layout: { padding: 20 },
          plugins: {
            legend: { 
              position: 'right', 
              labels: { font: { size: 14, family: 'sans-serif' }, padding: 15, usePointStyle: true, pointStyle: 'circle' } 
            },
            datalabels: { display: false },
            title: {
              display: true,
              text: 'Asset Allocation',
              font: { size: 20, family: 'sans-serif', weight: 'bold' },
              padding: { bottom: 20 }
            }
          }
        }
      };

      // Group history entries by date (YYYY-MM-DD) to take the last snapshot of each day
      const dailyMap = new Map();
      let lastKnownPrices = {};
      
      history.forEach(entry => {
        for (const [t, p] of Object.entries(entry.prices)) {
           lastKnownPrices[t] = p;
        }
        let total = 0;
        for (const [t, amount] of Object.entries(portfolio)) {
           if (lastKnownPrices[t]) {
             total += amount.amount * lastKnownPrices[t];
           }
        }
        const d = new Date(entry.timestamp);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const displayDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        dailyMap.set(dateKey, { date: displayDate, value: total });
      });

      const dailyValues = Array.from(dailyMap.values());
      const chartHistory = dailyValues.slice(-30);
      
      const performanceConfig = {
        type: 'line',
        data: {
          labels: chartHistory.map(h => h.date),
          datasets: [{
            label: 'Portfolio Value (USD)',
            data: chartHistory.map(h => h.value),
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            borderWidth: 3,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#4f46e5',
            pointBorderWidth: 2,
            tension: 0.4
          }]
        },
        options: {
          layout: { padding: 20 },
          plugins: {
            legend: { display: false },
            datalabels: { display: false },
            title: {
              display: true,
              text: 'Portfolio Performance (30 Days)',
              font: { size: 20, family: 'sans-serif', weight: 'bold' },
              padding: { bottom: 20 }
            }
          },
          scales: {
            y: {
              beginAtZero: false,
              grid: { color: '#f3f4f6', drawBorder: false },
              ticks: { 
                font: { size: 12, family: 'sans-serif' },
                callback: 'function(val) { return "$" + val.toLocaleString(); }'
              }
            },
            x: {
              grid: { display: false, drawBorder: false },
              ticks: { font: { size: 12, family: 'sans-serif' }, maxTicksLimit: 10 }
            }
          }
        }
      };

      // 4. Run Google TimesFM Forecasting Engine
      const forecastPath = path.join(process.cwd(), 'public', 'data', 'forecast.json');
      try {
        console.log('Running Google Research TimesFM time series model...');
        execSync('python3 scripts/timesfm_forecast.py', { stdio: 'inherit' });
      } catch (err) {
        console.error('Warning: TimesFM python execution encountered an issue:', err.message);
      }

      let forecastData = null;
      if (fs.existsSync(forecastPath)) {
        try {
          forecastData = JSON.parse(fs.readFileSync(forecastPath, 'utf8'));
        } catch (e) {
          console.error('Failed to parse forecast.json', e);
        }
      }

      // 5. Run Quant and Macro Analytics Engine (Stages 1 & 2)
      let quantData = null;
      try {
        console.log('Running Quantitative Risk & Macro Indicators Analysis...');
        quantData = await computeQuantAndMacroMetrics();
      } catch (err) {
        console.error('Warning: Quant analysis encountered an issue:', err.message);
      }

      try {
        await downloadQuickChart(allocationConfig, path.join(dataHubDir, 'asset_allocation.png'));
        await downloadQuickChart(performanceConfig, path.join(dataHubDir, 'portfolio_performance.png'));
      } catch (chartErr) {
        console.warn('Warning: Could not download allocation/performance charts:', chartErr.message);
      }

      // Generate TimesFM Forecast Chart if data exists
      if (forecastData && forecastData.portfolio && forecastData.portfolio.timeline) {
        try {
          const hist15 = chartHistory.slice(-15);
          const timeline = forecastData.portfolio.timeline;
          
          const combinedLabels = [
            ...hist15.map(h => h.date),
            ...timeline.map(t => t.displayDate)
          ];

          // Historical series (padded with nulls for future)
          const histData = [
            ...hist15.map(h => h.value),
            ...new Array(timeline.length).fill(null)
          ];

          // P50 Target series (stitched from last historical point)
          const lastHistVal = hist15.length > 0 ? hist15[hist15.length - 1].value : forecastData.portfolio.currentUSD;
          const p50Data = [
            ...new Array(Math.max(0, hist15.length - 1)).fill(null),
            lastHistVal,
            ...timeline.map(t => t.p50USD)
          ];

          // P90 Optimistic series
          const p90Data = [
            ...new Array(Math.max(0, hist15.length - 1)).fill(null),
            lastHistVal,
            ...timeline.map(t => t.p90USD)
          ];

          // P10 Pessimistic series
          const p10Data = [
            ...new Array(Math.max(0, hist15.length - 1)).fill(null),
            lastHistVal,
            ...timeline.map(t => t.p10USD)
          ];

          const forecastChartConfig = {
            type: 'line',
            data: {
              labels: combinedLabels,
              datasets: [
                {
                  label: 'Historical',
                  data: histData,
                  borderColor: '#2563eb',
                  borderWidth: 2.5,
                  pointRadius: 2,
                  fill: false,
                  tension: 0.2
                },
                {
                  label: 'TimesFM Forecast (P50)',
                  data: p50Data,
                  borderColor: '#8b5cf6',
                  borderWidth: 3,
                  borderDash: [5, 5],
                  pointRadius: 2,
                  fill: false,
                  tension: 0.2
                },
                {
                  label: 'P90 Optimistic (90%)',
                  data: p90Data,
                  borderColor: 'rgba(16, 185, 129, 0.6)',
                  borderWidth: 1.5,
                  borderDash: [3, 3],
                  pointRadius: 0,
                  fill: false,
                  tension: 0.2
                },
                {
                  label: 'P10 Pessimistic (10%)',
                  data: p10Data,
                  borderColor: 'rgba(239, 68, 68, 0.6)',
                  borderWidth: 1.5,
                  borderDash: [3, 3],
                  pointRadius: 0,
                  fill: false,
                  tension: 0.2
                }
              ]
            },
            options: {
              layout: { padding: 20 },
              plugins: {
                legend: { display: true, position: 'top' },
                title: {
                  display: true,
                  text: 'Google Research TimesFM - 30 Day Portfolio Forecast',
                  font: { size: 18, family: 'sans-serif', weight: 'bold' }
                }
              },
              scales: {
                y: {
                  grid: { color: '#f3f4f6' },
                  ticks: { callback: 'function(val) { return "$" + val.toLocaleString(); }' }
                },
                x: {
                  grid: { display: false },
                  ticks: { maxTicksLimit: 12 }
                }
              }
            }
          };

          await downloadQuickChart(forecastChartConfig, path.join(dataHubDir, 'timesfm_forecast.png'));
        } catch (chartErr) {
          console.error('Failed to generate TimesFM chart:', chartErr.message);
        }
      }

      console.log('Charts generated successfully.');

      // Formatting Date: DD/MM/YYYY HH:MM
      const now = new Date();
      const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // 1. Generate TimesFM Assets Table for README
      let forecastTableMarkdown = '';
      if (forecastData && forecastData.assets) {
        const rows = Object.entries(forecastData.assets).map(([ticker, info]) => {
          const chgSign = info.expectedChangePct >= 0 ? '+' : '';
          const signalBadge = info.expectedChangePct >= 0 ? `🟢 ${info.signalHe}` : `🔴 ${info.signalHe}`;
          const vol = info.annualizedVolatilityPct ? `${info.annualizedVolatilityPct.toFixed(1)}%` : '—';
          return `| **${ticker}** | \`$${info.currentPrice.toFixed(2)}\` | \`$${info.forecastP50.toFixed(2)}\` | \`$${info.forecastP10.toFixed(2)} - $${info.forecastP90.toFixed(2)}\` | **${chgSign}${info.expectedChangePct.toFixed(2)}%** | ${signalBadge} | \`${vol}\` |`;
        });
        forecastTableMarkdown = [
          '| מניה (Asset) | שער נוכחי | יעד צפוי 30 יום (P50) | טווח ביטחון (P10 - P90) | תשואה חזויה | אות מודל (AI Signal) | תנודתיות שנתית |',
          '| :--- | :---: | :---: | :---: | :---: | :---: | :---: |',
          ...rows
        ].join('\n');
      }

      // 2. Generate Model Comparisons Table
      let modelComparisonsMarkdown = '';
      if (forecastData && forecastData.modelComparisons && Array.isArray(forecastData.modelComparisons)) {
        const rows = forecastData.modelComparisons.map(m => {
          const retSign = m.expectedReturnPct >= 0 ? '+' : '';
          const retBadge = m.expectedReturnPct >= 0 ? `🟢 **${retSign}${m.expectedReturnPct.toFixed(2)}%**` : `🔴 **${retSign}${m.expectedReturnPct.toFixed(2)}%**`;
          return `| **${m.nameHe}** <br><sub>${m.category}</sub> | \`$${Math.round(m.projectedUSD).toLocaleString('en-US')}\` <br><sub>(\`₪${Math.round(m.projectedILS).toLocaleString('en-US')}\`)</sub> | ${retBadge} | ${m.riskLevel} | ${m.methodology} |`;
        });
        modelComparisonsMarkdown = [
          '| מודל / גישת חיזוי | יעד שווי תיק (30 יום) | תשואה צפויה | רמת סיכון | מתודולוגיה ועקרון חישוב |',
          '| :--- | :---: | :---: | :---: | :--- |',
          ...rows
        ].join('\n');
      }

      // 3. Generate Multi-Horizon Forecast Table
      let horizonComparisonsMarkdown = '';
      if (forecastData && forecastData.horizonComparisons && Array.isArray(forecastData.horizonComparisons)) {
        const rows = forecastData.horizonComparisons.map(h => {
          const retSign = h.expectedReturnPct >= 0 ? '+' : '';
          const retBadge = h.expectedReturnPct >= 0 ? `🟢 **${retSign}${h.expectedReturnPct.toFixed(2)}%**` : `🔴 **${retSign}${h.expectedReturnPct.toFixed(2)}%**`;
          return `| **${h.horizonLabel}** | \`${h.targetDate}\` | \`$${Math.round(h.p50USD).toLocaleString('en-US')}\` <br><sub>(\`₪${Math.round(h.p50ILS).toLocaleString('en-US')}\`)</sub> | ${retBadge} | \`$${Math.round(h.p10USD).toLocaleString('en-US')} - $${Math.round(h.p90USD).toLocaleString('en-US')}\` | \`₪${h.expectedFx.toFixed(3)}\` |`;
        });
        horizonComparisonsMarkdown = [
          '| אופק זמן (Horizon) | תאריך יעד | יעד בסיס חזוי (P50) | תשואה צפויה | טווח הסתברותי (P10 - P90) | שער דולר חזוי |',
          '| :--- | :---: | :---: | :---: | :---: | :---: |',
          ...rows
        ].join('\n');
      }

      // 4. Generate Upcoming Dividends Projection Table
      let dividendProjectionMarkdown = '';
      if (forecastData && forecastData.dividendsForecast && forecastData.dividendsForecast.events) {
        const nextEvents = forecastData.dividendsForecast.events.slice(0, 8);
        const rows = nextEvents.map(e => {
          return `| **${e.ticker}** | \`${e.projectedDate}\` | \`$${e.estimatedGrossUSD.toFixed(2)}\` | \`-$${(e.estimatedGrossUSD * 0.25).toFixed(2)}\` | \`+$${e.estimatedNetUSD.toFixed(2)}\` (\`₪${e.estimatedNetILS.toFixed(0)}\`) |`;
        });
        dividendProjectionMarkdown = [
          '| נייר ערך | תאריך צפוי | ברוטו משוער | ניכוי מס 25% | נטו משוער לחשבון |',
          '| :--- | :---: | :---: | :---: | :---: |',
          ...rows
        ].join('\n');
      }

      // 5. Generate Macro Indicators Table (Stage 1)
      let macroTableMarkdown = '';
      if (quantData && quantData.macroIndicators) {
        const m = quantData.macroIndicators;
        macroTableMarkdown = [
          '| מדד מאקרו (Indicator) | סימול | שער נוכחי | שינוי יומי | משטר שוק / סטטוס | משמעות והשפעה על התיק |',
          '| :--- | :---: | :---: | :---: | :---: | :--- |',
          `| **מדד התנודתיות והפחד (VIX)** | \`${m.vix.symbol}\` | \`${m.vix.price}\` | ${m.vix.changePct >= 0 ? '🔴 +' : '🟢 '}\`${m.vix.changePct.toFixed(2)}%\` | ${m.vix.badge} ${m.vix.regime} | ${m.vix.description} |`,
          `| **תשואת אג"ח ארה"ב 10Y** | \`${m.tnx.symbol}\` | \`${m.tnx.price}%\` | ${m.tnx.changePct >= 0 ? '🔴 +' : '🟢 '}\`${m.tnx.changePct.toFixed(2)}%\` | ריבית חסרת סיכון (Rf = ${m.tnx.riskFreeRatePct}%) | ${m.tnx.description} |`,
          `| **נפט גולמי (WTI Crude)** | \`${m.oil.symbol}\` | \`$${m.oil.price}\` | ${m.oil.changePct >= 0 ? '🟢 +' : '🔴 '}\`${m.oil.changePct.toFixed(2)}%\` | סחורות ואנרגיה | ${m.oil.description} |`,
          `| **מדד הדולר העולמי (DXY)** | \`${m.dxy.symbol}\` | \`${m.dxy.price}\` | ${m.dxy.changePct >= 0 ? '🟢 +' : '🔴 '}\`${m.dxy.changePct.toFixed(2)}%\` | סל מטבעות גלובלי | ${m.dxy.description} |`
        ].join('\n');
      }

      // 6. Generate Quantitative Risk Metrics Table (Stage 2) & Stage 3 Tables
      let riskMetricsTableMarkdown = '';
      let assetBetasTableMarkdown = '';
      let correlationMatrixMarkdown = '';
      let correlationInsightsMarkdown = '';
      let monteCarloTableMarkdown = '';
      let factorScoresMarkdown = '';
      let macroScenariosMarkdown = '';
      let metricsExplanationsMarkdown = '';

      if (quantData && quantData.riskMetrics) {
        const r = quantData.riskMetrics;
        riskMetricsTableMarkdown = [
          '| מדד סטטיסטי / פיננסי | ערך כמותי | הערכת סיכון ומתודולוגיה |',
          '| :--- | :---: | :--- |',
          `| **תשואה שנתית היסטורית (Ann. Return)** | 🟢 \`+${r.annualizedReturnPct}%\` | קצב תשואה שנתי מצטבר מיום תחילת הרישום |`,
          `| **תנודתיות שנתית (Ann. Volatility)** | \`${r.annualizedVolatilityPct}%\` | סטיית תקן שנתית משוקללת ($\\sigma_{\\text{ann}} = \\sigma_{\\text{daily}} \\times \\sqrt{252}$) |`,
          `| **מדד שארפ שנתי (Sharpe Ratio)** | 🟢 \`${r.sharpeRatio}\` | תשואה עודפת מעל ריבית אג"ח (${r.riskFreeRatePct}%) לכל יחידת סיכון (>1.0 נחשב ביצועים איכותיים) |`,
          `| **מדד סורטינו שנתי (Sortino Ratio)** | 🟢 \`${r.sortinoRatio}\` | תשואה עודפת מול סיכון יורד בלבד (עליות חדות אינן נספרות כסיכון) |`,
          `| **בטא התיק מול השוק (Portfolio Beta vs VOO)** | \`${r.portfolioBeta}\` | תנודתיות התיק גבוהה ב-${Math.round((r.portfolioBeta - 1) * 100)}% ממדד ה-S&P 500 בעקבות משקל ענקיות ה-AI |`,
          `| **Value at Risk יומי (VaR 95% 1-Day)** | 🔴 \`-$${r.var95.daily.usd.toLocaleString()}\` (\`-₪${r.var95.daily.ils.toLocaleString()}\`) | הפסד יומי מרבי ברמת ביטחון של 95% (עד ${r.var95.daily.pct}% מהתיק) |`,
          `| **Value at Risk חודשי (VaR 95% 30-Day)** | 🔴 \`-$${r.var95.monthly30d.usd.toLocaleString()}\` (\`-₪${r.var95.monthly30d.ils.toLocaleString()}\`) | הפסד חודשי מרבי ברמת ביטחון של 95% תחת חודש מסחר (21 ימים) |`,
          `| **Conditional VaR יומי (CVaR / Expected Shortfall)** | 🔴 \`-$${r.cvar95.daily.usd.toLocaleString()}\` (\`-₪${r.cvar95.daily.ils.toLocaleString()}\`) | הפסד ממוצע צפוי בתרחיש חריגה קיצוני מ-VaR (ב-5% הימים הגרועים ביותר) |`,
          `| **מקסימום דרודאון היסטורי (Max Drawdown)** | 🔴 \`${r.maxDrawdownPct}%\` | הנפילה המרבית משיא כל הזמנים לשפל במהלך ההיסטוריה |`,
          `| **מרחק נוכחי משיא כל הזמנים (Current Drawdown)** | \`${r.currentDrawdownPct}%\` | שיא כל הזמנים: \`$${r.allTimeHighUSD.toLocaleString()}\` (\`₪${r.allTimeHighILS.toLocaleString()}\`) |`,
          `| **מדד ריכוזיות הירשמן (HHI Concentration)** | \`${r.hhiIndex}\` | **${r.diversificationLevel}** (מדד HHI תחת 0.25 מעיד על פיזור בריא) |`
        ].join('\n');

        if (r.assetBetas) {
          const betaRows = Object.entries(r.assetBetas).map(([t, b]) => {
            const role = b > 1.8 ? 'תנודתיות גבוהה / מנוע אלפא' : b > 1.2 ? 'צמיחה טכנולוגית' : b >= 0.9 ? 'עוגן שוק רחב' : 'גידור עצמאי מובהק';
            return `| **${t}** | \`${b}\` | ${role} |`;
          });
          assetBetasTableMarkdown = [
            '| נכס (Asset) | מקדם בטא מול VOO (S&P 500) | סיווג רגישות שוקית |',
            '| :--- | :---: | :--- |',
            ...betaRows
          ].join('\n');
        }

        if (quantData.correlationMatrix) {
          const vars = quantData.correlationMatrix.variables;
          const matrix = quantData.correlationMatrix.matrix;
          const header = '| נכס / מדד | ' + vars.map(v => v.label).join(' | ') + ' |';
          const align = '| :--- | ' + vars.map(() => ':---:').join(' | ') + ' |';
          const rows = vars.map(v1 => {
            const cells = vars.map(v2 => {
              const val = matrix[v1.key]?.[v2.key] ?? 0;
              const valStr = val.toFixed(2);
              if (v1.key === v2.key) return `\`1.00\``;
              if (val > 0.6) return `🟢 \`${valStr}\``;
              if (val < 0) return `🔴 \`${valStr}\``;
              return `\`${valStr}\``;
            });
            return `| **${v1.label}** | ` + cells.join(' | ') + ' |';
          });
          correlationMatrixMarkdown = [header, align, ...rows].join('\n');

          correlationInsightsMarkdown = quantData.correlationMatrix.insights.map(ins => {
            return `* 📌 **${ins.pair} (${ins.type} - מקדם ${ins.correlation}):** ${ins.description}`;
          }).join('\n');
        }
        // Stage 3 Predictive Synthesis Tables
        if (quantData && quantData.stage3Predictive) {
          const s3 = quantData.stage3Predictive;
          if (s3.monteCarlo) {
            const mcRows = Object.values(s3.monteCarlo).map(mc => {
              const sign = mc.expectedReturnPct >= 0 ? '+' : '';
              return `| **${mc.label}** | \`$${mc.p50USD.toLocaleString('en-US')}\` <br><sub>(\`₪${mc.p50ILS.toLocaleString('en-US')}\`)</sub> | 🟢 **${sign}${mc.expectedReturnPct.toFixed(2)}%** | \`${mc.rangeUSD}\` <br><sub>(\`${mc.rangeILS}\`)</sub> | 🎯 **${mc.probPositivePct}%** |`;
            });
            monteCarloTableMarkdown = [
              '| אופק זמן (Horizon) | יעד חציוני P50 | תשואה צפויה | טווח קונוס הסתברותי (P5 - P95) | הסתברות לרווח |',
              '| :--- | :---: | :---: | :---: | :---: |',
              ...mcRows
            ].join('\n');
          }

          if (s3.factorModel && s3.factorModel.assets) {
            const faRows = Object.values(s3.factorModel.assets).map(a => {
              return `| **${a.ticker}** <br><sub>${a.name}</sub> | ${a.role} | \`${a.momentumScore}/100\` | \`${a.riskScore}/100\` | \`${a.macroScore}/100\` | \`${a.aiScore}/100\` | **\`${a.compositeScore}/100\`** | \`${a.grade}\` | 🟢 **${a.recommendation}** |`;
            });
            factorScoresMarkdown = [
              '| נכס (Asset) | תפקיד אסטרטגי בתיק | מומנטום | ניהול סיכון | עמידות מאקרו | אות AI | ציון כולל | דרגה | המלצת מודל |',
              '| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |',
              ...faRows
            ].join('\n');
          }

          if (s3.macroScenarios) {
            const scRows = s3.macroScenarios.map(sc => {
              const retSign = sc.expectedReturnPct >= 0 ? '+' : '';
              return `| **${sc.name}** | \`${sc.probability}\` | \`$${sc.targetUSD.toLocaleString('en-US')}\` <br><sub>(\`₪${sc.targetILS.toLocaleString('en-US')}\`)</sub> | ${sc.expectedReturnPct >= 0 ? '🟢' : '🔴'} **${retSign}${sc.expectedReturnPct.toFixed(1)}%** | ${sc.macroConditions} | ${sc.portfolioImpact} |`;
            });
            macroScenariosMarkdown = [
              '| תרחיש מאקרו עתידי | הסתברות | שווי תיק צפוי | תשואה צפויה | תנאי מאקרו ומפתחות שוק | השפעה כספית ישירה על התיק |',
              '| :--- | :---: | :---: | :---: | :--- | :--- |',
              ...scRows
            ].join('\n');
          }

          if (s3.metricsExplanations) {
            const expRows = s3.metricsExplanations.map(e => {
              return `| **${e.name}** <br><sub>(${e.category})</sub> | ${e.whatIsIt} | 💡 **${e.portfolioImpact}** |`;
            });
            metricsExplanationsMarkdown = [
              '| מדד פיננסי / כמותי | מה המשמעות (הסבר פשוט)? | כיצד זה משפיע ישירות על תיק המניות שלי? |',
              '| :--- | :--- | :--- |',
              ...expRows
            ].join('\n');
          }
        }
      }

      // 7. Generate Standalone Comprehensive README
      const vixBadgeStr = quantData?.macroIndicators?.vix ? `![CBOE VIX](https://img.shields.io/badge/CBOE_VIX-${quantData.macroIndicators.vix.price}_(${quantData.macroIndicators.vix.badge.replace(/ /g, '_')})-059669?style=for-the-badge&logo=statuspage)` : '';
      const tnxBadgeStr = quantData?.macroIndicators?.tnx ? `![10Y Yield](https://img.shields.io/badge/US_10Y_Yield-${quantData.macroIndicators.tnx.price}%25-d97706?style=for-the-badge)` : '';
      const sharpeBadgeStr = quantData?.riskMetrics?.sharpeRatio ? `![Sharpe](https://img.shields.io/badge/Sharpe_Ratio-${quantData.riskMetrics.sharpeRatio}-4f46e5?style=for-the-badge)` : '';
      const betaBadgeStr = quantData?.riskMetrics?.portfolioBeta ? `![Beta](https://img.shields.io/badge/Portfolio_Beta-${quantData.riskMetrics.portfolioBeta}-8b5cf6?style=for-the-badge)` : '';
      const stage3BadgeStr = quantData?.stage3Predictive?.factorModel ? `![Stage 3](https://img.shields.io/badge/Stage_3_Score-${quantData.stage3Predictive.factorModel.portfolioCompositeScore}%2F100_(${quantData.stage3Predictive.factorModel.portfolioGrade})-8b5cf6?style=for-the-badge)` : '';

      const readmeContent = `<a id="top"></a>
# 📈 מעקב תיק השקעות, אנליטיקה כמותית והשוואת תחזיות AI

![Last Update](https://img.shields.io/badge/Last_Update-${formattedDate.replace(/ /g, '_').replace(/:/g, '%3A')}-4f46e5?style=for-the-badge&logo=githubactions)
![Portfolio Value](https://img.shields.io/badge/Portfolio_Value-₪${Math.round(totalCurrentILS).toLocaleString('en-US').replace(/,/g, '%2C')}-0284c7?style=for-the-badge&logo=cashapp)
![Total Profit](https://img.shields.io/badge/Total_Profit-${formatPercent(totalPnLPercent).replace('%', '%25')}-${totalPnLPercent >= 0 ? '16a34a' : 'dc2626'}?style=for-the-badge)
![TimesFM 30d Target](https://img.shields.io/badge/TimesFM_30d_Target-₪${forecastData ? Math.round(forecastData.portfolio.forecast30dILS_P50).toLocaleString('en-US').replace(/,/g, '%2C') : 'N/A'}-8b5cf6?style=for-the-badge&logo=google)
![USD/ILS Rate](https://img.shields.io/badge/USD%2FILS-₪${usdIlsRate.toFixed(3)}-059669?style=for-the-badge)
${vixBadgeStr} ${tnxBadgeStr} ${sharpeBadgeStr} ${betaBadgeStr} ${stage3BadgeStr}

> **מאגר אוטונומי למעקב, חישוב וניתוח מעמיק של תיק השקעות בזמן אמת.**  
> כל המידע, האנליטיקות, הגרפים, מדדי המאקרו, השוואות המודלים, סימולציות מונטה קרלו ותרחישי העתיד (שלבים 1, 2 ו-3) מרוכזים ומתעדכנים אוטומטית ישירות בקובץ זה באמצעות GitHub Actions ומודל **Google Research TimesFM**.

---

<a id="toc"></a>
## 🧭 תוכן עניינים וניווט מהיר

* [📊 1. תמונת מצב מנהלים (Executive Snapshot)](#snapshot)
* [📋 2. ביצועי מניות והחזקות התיק (Holdings Performance)](#holdings)
* [🔮 3. השוואת תחזיות ותרחישים מקיפה (Forecast Comparisons)](#forecasts)
  * [🔹 3.1 השוואת מודלים וגישות שונות (AI vs Market Beta vs Momentum vs Stress)](#models)
  * [🔹 3.2 השוואת אופקי זמן שונים (7, 14, 30 ו-90 יום)](#horizons)
  * [🔹 3.3 ניתוח תרחישי הסתברות (P10 פסימי | P50 בסיס | P90 אופטימי)](#scenarios)
  * [🔹 3.4 מטריצת אותות וסיכונים פר מניה (Cross-Asset AI Matrix)](#signals)
* [🌐 4. מדדי מאקרו ומפת שוק (Macroeconomic Indicators)](#macro)
* [📐 5. מדדי סיכון כמותיים ומטריצת קורלציות (Quantitative Risk & Correlations)](#risk-metrics)
  * [🔹 5.1 מדדי סיכון מרכזיים (Sharpe, Beta, VaR, MDD)](#risk-summary)
  * [🔹 5.2 בטא פר מניה מול S&P 500](#asset-betas)
  * [🔹 5.3 מטריצת מתאמים צולבת (Asset & Macro Correlation Matrix)](#correlations)
  * [🔹 5.4 תובנות פיזור וניהול סיכונים](#risk-insights)
* [🚀 6. מנוע חיזוי רב-גורמי, סימולציית מונטה קרלו ותרחישי עתיד (Predictive Synthesis - שלב 3)](#stage3-predictive)
  * [🔹 6.1 סימולציית מונטה קרלו (Monte Carlo Projections: 30d עד 365d)](#monte-carlo)
  * [🔹 6.2 דירוג מניות רב-גורמי והמלצות מודל (Factor Model Matrix)](#factor-model)
  * [🔹 6.3 מבחני לחץ ותרחישי מאקרו עתידיים (4 Forward Stress Scenarios)](#macro-scenarios)
  * [🔹 6.4 מדריך הסברים: כיצד כל מדד משפיע על תיק המניות שלי?](#explanations-guide)
* [💵 7. יומן דיבידנדים והכנסה פאסיבית (Dividends & Passive Income)](#dividends)
* [📈 8. גרפים ומגמות חזותיות (Visual Analytics)](#charts)
* [⚙️ 9. ארכיטקטורה ואוטומציה במאגר (System Architecture)](#architecture)

---

<a id="snapshot"></a>
## 📊 1. תמונת מצב מנהלים (Executive Snapshot)

| מדד פיננסי | ערך בדולר ($ USD) | ערך בשקלים (₪ ILS) | הערות ומשמעות כלכלית |
| :--- | :---: | :---: | :--- |
| **שווי תיק נוכחי** | \`$${Math.round(totalCurrentUSD).toLocaleString('en-US')}\` | \`₪${Math.round(totalCurrentILS).toLocaleString('en-US')}\` | שווי שוק עדכני לפי מחירי מסחר אחרונים ושער רציף |
| **עלות קנייה (Cost Basis)** | \`$${Math.round(totalInvestedUSD).toLocaleString('en-US')}\` | \`₪${Math.round(totalInvestedILS).toLocaleString('en-US')}\` | סך ההון המקורי שהושקע ברכישת הנכסים |
| **רווח כולל ברוטו** | \`${totalPnLUSD >= 0 ? '+' : ''}$${Math.round(totalPnLUSD).toLocaleString('en-US')}\` | \`${totalPnLILS >= 0 ? '+' : ''}₪${Math.round(totalPnLILS).toLocaleString('en-US')}\` | **${formatPercent(totalPnLPercent)}** תשואה כוללת מיום הרכישה |
| **רווח כולל נטו (לאחר מס)** | \`${totalNetPnLUSD >= 0 ? '+' : ''}$${Math.round(totalNetPnLUSD).toLocaleString('en-US')}\` | \`${totalNetPnLILS >= 0 ? '+' : ''}₪${Math.round(totalNetPnLILS).toLocaleString('en-US')}\` | **${formatPercent(totalNetPnLPercent)}** נטו בניכוי 25% מס רווחי הון |
| **חבות מס משוערת למימוש** | \`-$${Math.round(totalUnrealizedTaxUSD).toLocaleString('en-US')}\` | \`-₪${Math.round(totalUnrealizedTaxILS).toLocaleString('en-US')}\` | חישוב מס 25% עם קיזוז הפסדים מלא (סעיף 92 לפקודה) |
| **שינוי יומי (Daily Change)** | \`${dailyPnLUSD >= 0 ? '+' : ''}$${Math.round(dailyPnLUSD).toLocaleString('en-US')}\` | \`${dailyPnLILS >= 0 ? '+' : ''}₪${Math.round(dailyPnLILS).toLocaleString('en-US')}\` | **${formatPercent(dailyChangePercent)}** תנועה לעומת נעילה קודמת |
| **ממוצע רווח חודשי (YTD)** | \`+$${Math.round(ytdNetMonthlyAvgUSD).toLocaleString('en-US')}/חודש\` | \`+₪${Math.round(ytdNetMonthlyAvgILS).toLocaleString('en-US')}/חודש\` | הכנסה חודשית ממוצעת נטו מתחילת השנה (${currentMonthNumber} חודשים) |
| **סך דיבידנדים (L12M)** | \`$${Math.round(l12mReceivedGrossUSD * 0.75).toLocaleString('en-US')}\` | \`₪${Math.round(l12mReceivedGrossUSD * 0.75 * brokerRate).toLocaleString('en-US')}\` | תקבולי דיבידנד נטו ב-12 החודשים האחרונים |
| **שער המרה ברוקר** | \`$1.00\` | \`₪${usdIlsRate.toFixed(3)}\` | שער רציף בתוספת מרווח עסקת מט"ח (${(0.008 * 100).toFixed(1)} אג') |

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="holdings"></a>
## 📋 2. ביצועי מניות והחזקות התיק (Holdings Performance)

| נכס (Asset) | כמות | שער נוכחי | שווי שוק | שינוי יומי (Daily Change) | שינוי מהכניסה לתיק (Total Return) |
| :--- | :---: | :---: | :---: | :---: | :---: |
${enhancedHoldingsRows.join('\n')}

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="forecasts"></a>
## 🔮 3. השוואת תחזיות ותרחישים מקיפה (Forecast Comparisons)

המאגר מריץ באופן שוטף סדרת מודלים כמותיים ומודל בינה מלאכותית של **Google Research (TimesFM)** כדי להפיק תחזיות והערכות סיכון מזוויות שונות. להלן השוואה שיטתית של התוצאות:

<a id="models"></a>
### 🔹 3.1 השוואת מודלים וגישות שונות

השוואת התחזית לאופק של **30 ימים קדימה** בין 5 גישות מתודולוגיות שונות:

${modelComparisonsMarkdown || '*טבלת השוואת המודלים תתעדכן בריצה הקרובה.*'}

> 💡 **מסקנה אנליטית:** מודל ה-AI של Google TimesFM מזהה מגמה חיובית מאוזנת של **${forecastData ? (forecastData.portfolio.expectedReturn30dPct >= 0 ? '+' : '') + forecastData.portfolio.expectedReturn30dPct.toFixed(2) + '%' : 'N/A'}**, המתיישבת היטב עם מודל בטא השוק (${forecastData?.modelComparisons?.find(m => m.id === 'benchmark_beta')?.expectedReturnPct ?? 1.0}%), כאשר בתרחיש קיצון נשמרת תמיכה משמעותית מעל עלות הבסיס.

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="horizons"></a>
### 🔹 3.2 השוואת אופקי זמן שונים (Multi-Horizon)

התפתחות שווי התיק הצפוי ושער הדולר לאורך 4 אופקי זמן עתידיים:

${horizonComparisonsMarkdown || '*טבלת אופקי הזמן תתעדכן בריצה הקרובה.*'}

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="scenarios"></a>
### 🔹 3.3 ניתוח תרחישי הסתברות וקונוסי TimesFM

מודל TimesFM יוצר קונוס הסתברותי רציף המודד את אי-הוודאות בהתפלגות התשואות העתידית:

* 🟢 **תרחיש אופטימי (עשירון P90 - סיכוי של 10% לתוצאה גבוהה יותר):**
  * שווי תיק צפוי: \`$${forecastData ? Math.round(forecastData.portfolio.forecast30dUSD_P90).toLocaleString('en-US') : '—'}\` (\`₪${forecastData ? Math.round(forecastData.portfolio.forecast30dILS_P90).toLocaleString('en-US') : '—'}\`)
  * פוטנציאל תשואה עודף: **+${forecastData ? (((forecastData.portfolio.forecast30dUSD_P90 - totalCurrentUSD) / totalCurrentUSD) * 100).toFixed(2) : '—'}%**
* 🟡 **תרחיש בסיס מרכזי (חציון P50 - התרחיש הסביר ביותר):**
  * שווי תיק צפוי: \`$${forecastData ? Math.round(forecastData.portfolio.forecast30dUSD_P50).toLocaleString('en-US') : '—'}\` (\`₪${forecastData ? Math.round(forecastData.portfolio.forecast30dILS_P50).toLocaleString('en-US') : '—'}\`)
  * תשואה צפויה: **${forecastData ? (forecastData.portfolio.expectedReturn30dPct >= 0 ? '+' : '') + forecastData.portfolio.expectedReturn30dPct.toFixed(2) + '%' : '—'}**
* 🔴 **תרחיש פסימי מגן (עשירון P10 - מבחן לחץ ברמת ביטחון של 90%):**
  * שווי תיק מוגן: \`$${forecastData ? Math.round(forecastData.portfolio.forecast30dUSD_P10).toLocaleString('en-US') : '—'}\` (\`₪${forecastData ? Math.round(forecastData.portfolio.forecast30dILS_P10).toLocaleString('en-US') : '—'}\`)
  * ירידה מקסימלית תחת קונוס הביטחון: **${forecastData ? (((forecastData.portfolio.forecast30dUSD_P10 - totalCurrentUSD) / totalCurrentUSD) * 100).toFixed(2) : '—'}%**

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="signals"></a>
### 🔹 3.4 מטריצת אותות וסיכונים פר מניה

השוואת התחזית, התשואה החזויה, רמת הסיכון והאות של המודל עבור כל אחת ממניות התיק בנפרד:

${forecastTableMarkdown || '*מטריצת המניות תתעדכן בריצה הקרובה.*'}

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="macro"></a>
## 🌐 4. מדדי מאקרו ומפת שוק (Macroeconomic Indicators)

מדדי עוגן גלובליים הנאספים בזמן אמת ומספקים הקשר מאקרו-כלכלי לתנודות התיק:

${macroTableMarkdown || '*נתוני מאקרו יתעדכנו בריצה הקרובה.*'}

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="risk-metrics"></a>
## 📐 5. מדדי סיכון כמותיים ומטריצת קורלציות (Quantitative Risk & Correlations)

ניתוח סטטיסטי מעמיק מבוסס היסטוריית מחירי מסחר יומיים של נכסי התיק ומדדי השוק:

<a id="risk-summary"></a>
### 🔹 5.1 מדדי סיכון וביצועים מרכזיים

${riskMetricsTableMarkdown || '*מדדי סיכון יתעדכנו בריצה הקרובה.*'}

<a id="asset-betas"></a>
### 🔹 5.2 בטא פר מניה מול S&P 500 (VOO)

${assetBetasTableMarkdown || '*נתוני בטא יתעדכנו בריצה הקרובה.*'}

<a id="correlations"></a>
### 🔹 5.3 מטריצת מתאמים צולבת (Cross-Asset & Macro Correlation Matrix)

מקדם מתאם פירסון ($r \\in [-1, 1]$) המחושב על פני כל ימי המסחר ההיסטוריים:

${correlationMatrixMarkdown || '*מטריצת קורלציה תתעדכן בריצה הקרובה.*'}

<a id="risk-insights"></a>
### 🔹 5.4 תובנות פיזור וניהול סיכונים
${correlationInsightsMarkdown || '*תובנות מתאם יתעדכנו בריצה הקרובה.*'}

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="stage3-predictive"></a>
## 🚀 6. מנוע חיזוי רב-גורמי, סימולציית מונטה קרלו ותרחישי עתיד (Stage 3 Predictive Synthesis)

שקלול מעמיק של נתונים היסטוריים, מודל דירוג גורמים כמותי, 1,000 הרצות מונטה קרלו סטוכסטיות ו-4 תרחישי סטרס מאקרו-כלכליים:

<a id="monte-carlo"></a>
### 🔹 6.1 סימולציית מונטה קרלו הסתברותית (1,000 מסלולי מסחר סטוכסטיים)

${monteCarloTableMarkdown || '*נתוני מונטה קרלו יתעדכנו בריצה הקרובה.*'}

<a id="factor-model"></a>
### 🔹 6.2 דירוג מניות רב-גורמי והמלצות מודל (Factor Model Matrix)

${factorScoresMarkdown || '*דירוג המניות יתעדכן בריצה הקרובה.*'}

<a id="macro-scenarios"></a>
### 🔹 6.3 מבחני לחץ ותרחישי מאקרו עתידיים (Forward Macro Stress Scenarios)

${macroScenariosMarkdown || '*תרחישי המאקרו יתעדכנו בריצה הקרובה.*'}

<a id="explanations-guide"></a>
### 🔹 6.4 מדריך הסברים: כיצד כל מדד משפיע על תיק המניות שלי?

${metricsExplanationsMarkdown || '*מדריך ההסברים יתעדכן בריצה הקרובה.*'}

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="dividends"></a>
## 💵 7. יומן דיבידנדים והכנסה פאסיבית (Dividends & Passive Income)

* **סך הכל דיבידנדים שהתקבלו בפועל (All-Time):** \`$${totalReceivedGrossUSD.toFixed(2)}\` ברוטו | \`$${(totalReceivedGrossUSD * 0.75).toFixed(2)}\` נטו (\`₪${Math.round(totalReceivedGrossUSD * 0.75 * brokerRate).toLocaleString('en-US')}\`)
* **תקבולי דיבידנד 12 חודשים אחרונים (L12M):** \`$${l12mReceivedGrossUSD.toFixed(2)}\` ברוטו | \`$${(l12mReceivedGrossUSD * 0.75).toFixed(2)}\` נטו
* **תשואת דיבידנד שוטפת של התיק (Dividend Yield):** \`${totalCurrentUSD > 0 ? ((l12mReceivedGrossUSD / totalCurrentUSD) * 100).toFixed(2) : '0.00'}%\` ברוטו (\`${totalCurrentUSD > 0 ? ((l12mReceivedGrossUSD * 0.75 / totalCurrentUSD) * 100).toFixed(2) : '0.00'}%\` נטו)
* **תחזית חלוקה ל-12 החודשים הבאים (Forward 12M Projection):** \`$${forecastData?.dividendsForecast?.next12MonthsTotalNetUSD?.toFixed(2) ?? '—'}\` נטו (\`₪${forecastData?.dividendsForecast?.next12MonthsTotalNetILS?.toFixed(0) ?? '—'}\`)
* **ממוצע הכנסת דיבידנד חודשית צפויה:** \`₪${forecastData?.dividendsForecast?.projectedMonthlyAverageNetILS?.toFixed(0) ?? '—'}/חודש\` נטו

### 🗓️ לוח תשלומי דיבידנד צפויים (הקרנות קרובות):
${dividendProjectionMarkdown || '*טבלת הדיבידנדים תתעדכן בריצה הקרובה.*'}

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="charts"></a>
## 📈 8. גרפים ומגמות חזותיות (Visual Analytics)

<div align="center">

### תרחיש חיזוי תיק Google Research TimesFM (30 יום)
<img src="data_hub/timesfm_forecast.png" alt="Google TimesFM Portfolio Forecast" width="96%" style="border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />

<br/><br/>

<table width="100%">
<tr>
<td width="50%" align="center">
<h4>ביצועי תיק היסטוריים (30 יום)</h4>
<img src="data_hub/portfolio_performance.png" alt="Portfolio Performance" width="96%" style="border-radius: 10px;" />
</td>
<td width="50%" align="center">
<h4>פילוח הקצאת נכסים (Asset Allocation)</h4>
<img src="data_hub/asset_allocation.png" alt="Asset Allocation" width="96%" style="border-radius: 10px;" />
</td>
</tr>
</table>

</div>

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---

<a id="architecture"></a>
## ⚙️ 9. ארכיטקטורה ואוטומציה במאגר (System Architecture)

* ⏱️ **תדירות עדכון:** רץ אוטומטית כל 15 דקות בזמני המסחר בארה"ב (13:00 עד 21:59 UTC, ימים ב'-ו') בדקות לא עגולות (\`07\`, \`22\`, \`37\`, \`52\`).
* 📡 **מקורות נתונים:** שערי מסחר רציפים ומחירי סגירה היסטוריים מ-Yahoo Finance דרך \`yahoo-finance2\` (כולל מדדי מאקרו: VIX, אג"ח 10Y, נפט WTI, ומדד הדולר DXY).
* 🤖 **מודל בינה מלאכותית:** מנוע חיזוי סדרות עתיות **Google Research TimesFM (v1.1 Zero-Shot)** המנתח תנודתיות, מומנטום, התפלגות קונוסים והשוואת אופקים.
* 📐 **מנוע כמותי (Quant Engine):** חישוב בטא, שארפ, סורטינו, VaR 95%, Max Drawdown ומטריצת מתאמים צולבת.
* 🚀 **מנוע חיזוי רב-גורמי (שלב 3):** 1,000 סימולציות מונטה קרלו, דירוג גורמים (מומנטום, סיכון, מאקרו, AI) ו-4 תרחישי סטרס מאקרו.
* 🌐 **דשבורד PHP מלא:** אפליקציית ווב מבוססת PHP מלאה (\`php/index.php\`) הפורסת דשבורד גרפי אינטראקטיבי עם הסברים ברורים כיצד כל מדד משפיע על התיק.
* 🛡️ **שער איכות (Quality Gate):** אימות סינטקס, בדיקת טיפוסים, בדיקת שלמות קבצי JSON ואימות מבנה ה-README טרם כל קומיט למאגר.
* 📄 **מרכז המידע:** כל הניתוח והתחזיות מתועדים ישירות ב-README זה ובדשבורד ה-PHP.

[⬆️ חזרה לראש העמוד](#top) &nbsp;|&nbsp; [🧭 תוכן עניינים](#toc)

---
📂 *Portfolio Tracker & AI Forecasting Engine by Almog787 • Automated via GitHub Actions*
`;

      fs.writeFileSync(readmePath, readmeContent);
      console.log('Successfully updated README.md with comprehensive forecast comparisons, macro indicators, and quant metrics.');
    }
  } catch (error) {
    console.error('Error updating stock prices:', error);
    process.exit(1);
  }
}

fetchAndUpdatePrices();
