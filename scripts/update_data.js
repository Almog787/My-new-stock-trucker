import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';

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
      
      const newEntry = {
        timestamp: new Date().toISOString(),
        prices,
        exchangeRate: brokerRate
      };
      
      history.push(newEntry);
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      console.log(`Successfully updated stock history with ${Object.keys(prices).length} prices.`);
      
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
          const shares = portfolio[ticker].amount;
          const avgPrice = portfolio[ticker].avg_price;
          const costBasisUSD = shares * avgPrice;
          const currentValueUSD = shares * currentPrice;
          const pnlUSD = currentValueUSD - costBasisUSD;
          const pnlILS = pnlUSD * brokerRate;
          const pnlPercent = ((currentPrice / avgPrice) - 1) * 100;
          const taxILS = pnlILS > 0 ? pnlILS * 0.25 : 0;
          const netPnLILS = pnlILS - taxILS;
          const weightPct = totalCurrentUSD > 0 ? (currentValueUSD / totalCurrentUSD) * 100 : 0;
          const divInfo = tickerDividendSummaries[ticker];
          const div12mUSD = divInfo?.l12mGrossUSD || 0;
          const div12mNetUSD = divInfo?.l12mNetUSD || 0;

          const pnlBadge = pnlPercent >= 0 ? `🟢 +${pnlPercent.toFixed(2)}%` : `🔴 ${pnlPercent.toFixed(2)}%`;
          const divBadge = div12mUSD > 0 ? `$${div12mUSD.toFixed(1)} ($${div12mNetUSD.toFixed(1)} נטו)` : '—';
          const assetName = ASSET_META[ticker]?.name || ticker;

          enhancedHoldingsRows.push(`| **${ticker}** <br><sub>${assetName}</sub> | ${shares} | $${avgPrice.toFixed(2)} | $${currentPrice.toFixed(2)} | $${Math.round(currentValueUSD).toLocaleString()} <br><sub>₪${Math.round(currentValueUSD * brokerRate).toLocaleString()}</sub> | ${pnlBadge} <br><sub>₪${Math.round(pnlILS).toLocaleString()}</sub> | ₪${Math.round(netPnLILS).toLocaleString()} | ${weightPct.toFixed(1)}% | ${divBadge} |`);
        }
      });

      // Calculate totals for README using the dynamic broker rate
      const totalInvestedILS = totalInvestedUSD * brokerRate;
      const totalCurrentILS = totalCurrentUSD * brokerRate;
      const totalPnLUSD = totalCurrentUSD - totalInvestedUSD;
      const totalPnLILS = totalCurrentILS - totalInvestedILS;
      const totalPnLPercent = totalInvestedILS > 0 ? ((totalCurrentILS / totalInvestedILS) - 1) * 100 : 0;
      
      // Calculate Israeli Capital Gains Tax (25%)
      let totalUnrealizedTaxILS = 0;
      let totalUnrealizedTaxUSD = 0;
      quotes.forEach(quote => {
        if (quote && quote.symbol && quote.regularMarketPrice) {
          const ticker = quote.symbol;
          const shares = portfolio[ticker].amount;
          const cost = shares * portfolio[ticker].avg_price;
          const cur = shares * quote.regularMarketPrice;
          const gainUSD = cur - cost;
          if (gainUSD > 0) {
            totalUnrealizedTaxUSD += gainUSD * 0.25;
            totalUnrealizedTaxILS += (gainUSD * brokerRate) * 0.25;
          }
        }
      });

      const totalNetPnLUSD = totalPnLUSD - totalUnrealizedTaxUSD;
      const totalNetPnLILS = totalPnLILS - totalUnrealizedTaxILS;
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

      await downloadQuickChart(allocationConfig, path.join(dataHubDir, 'asset_allocation.png'));
      await downloadQuickChart(performanceConfig, path.join(dataHubDir, 'portfolio_performance.png'));
      console.log('Charts generated successfully.');

      // Formatting Date: DD/MM/YYYY HH:MM
      const now = new Date();
      const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // Generate README content with logical categories & clean formatting
      const readmeContent = `# 📈 Stock Tracker & Portfolio Analytics | מעקב תיק השקעות

[![Interactive Web Dashboard](https://img.shields.io/badge/Live_Dashboard-Open_App-4f46e5?style=for-the-badge&logo=google-chrome&logoColor=white)](https://almog787.github.io/My-new-stock-trucker/)
[![Total Portfolio Value](https://img.shields.io/badge/Portfolio_Value-₪${Math.round(totalCurrentILS).toLocaleString('en-US').replace(/,/g, '%2C')}-0284c7?style=for-the-badge&logo=cashapp)](https://almog787.github.io/My-new-stock-trucker/)
[![YTD Monthly Income](https://img.shields.io/badge/Monthly_Income-+₪${Math.round(ytdMonthlyAvgILS).toLocaleString('en-US').replace(/,/g, '%2C')}%2Fmo-4338ca?style=for-the-badge)](https://almog787.github.io/My-new-stock-trucker/)
[![Dividends 12M](https://img.shields.io/badge/Dividends_12M-₪${Math.round(l12mReceivedGrossUSD * brokerRate).toLocaleString('en-US').replace(/,/g, '%2C')}-059669?style=for-the-badge)](https://almog787.github.io/My-new-stock-trucker/)
[![Total Profit](https://img.shields.io/badge/Total_Profit-${formatPercent(totalPnLPercent).replace('%', '%25')}-${totalPnLPercent >= 0 ? '16a34a' : 'dc2626'}?style=for-the-badge)](https://almog787.github.io/My-new-stock-trucker/)

> **מערכת ניהול, מעקב וניתוח תיק השקעות בזמן אמת** הכוללת תמיכה כפולה במטבעות ($ / ₪), חישוב מס רווחי הון ישראלי (25%), מעקב תוספת הכנסה חודשית למשק הבית, ויומן דיבידנדים היסטורי מלא מאירועי שוק ההון.

---

### 🕒 סטטוס עדכון
- **מועד עדכון אחרון:** \`${formattedDate}\`
- **שער חליפין רציף (USD/ILS כולל מרווח ברוקר):** \`₪${usdIlsRate.toFixed(3)}\`

---

## 💎 1. מדדים מרכזיים ושווי תיק (Executive KPI Dashboard)

### 📊 שווי תיק ורווחיות (Valuation & Returns)
| מדד / Metric | ערך בדולר ($) | ערך בשקלים (₪) | הסבר ומשמעות |
| :--- | :--- | :--- | :--- |
| **שווי נוכחי כולל (Current Value)** | \`$${Math.round(totalCurrentUSD).toLocaleString('en-US')}\` | \`₪${Math.round(totalCurrentILS).toLocaleString('en-US')}\` | שווי השוק הנוכחי של כלל הנכסים |
| **עלות השקעה כוללת (Cost Basis)** | \`$${Math.round(totalInvestedUSD).toLocaleString('en-US')}\` | \`₪${Math.round(totalInvestedILS).toLocaleString('en-US')}\` | סך הקרן המושקעת המקורית |
| **רווח/הפסד כולל ברוטו (Total P&L Gross)** | \`${totalPnLUSD >= 0 ? '+' : ''}$${Math.round(totalPnLUSD).toLocaleString('en-US')}\` | \`${totalPnLILS >= 0 ? '+' : ''}₪${Math.round(totalPnLILS).toLocaleString('en-US')}\` | **${formatPercent(totalPnLPercent)}** תשואה על הקרן |
| **מס רווחי הון צפוי (Israeli Tax 25%)** | \`-$${Math.round(totalUnrealizedTaxUSD).toLocaleString('en-US')}\` | \`-₪${Math.round(totalUnrealizedTaxILS).toLocaleString('en-US')}\` | מס ריאלי משוער למימוש |
| **רווח כולל נטו (Total P&L Net)** | \`${totalNetPnLUSD >= 0 ? '+' : ''}$${Math.round(totalNetPnLUSD).toLocaleString('en-US')}\` | \`${totalNetPnLILS >= 0 ? '+' : ''}₪${Math.round(totalNetPnLILS).toLocaleString('en-US')}\` | **${formatPercent(totalNetPnLPercent)}** נטו לאחר מס |
| **שינוי יומי (Daily Change)** | \`${dailyPnLUSD >= 0 ? '+' : ''}$${Math.round(dailyPnLUSD).toLocaleString('en-US')}\` | \`${dailyPnLILS >= 0 ? '+' : ''}₪${Math.round(dailyPnLILS).toLocaleString('en-US')}\` | **${formatPercent(dailyChangePercent)}** |

### 💵 תזרים והכנסות שוטפות (Cash Flow & Income Generation)
| סוג הכנסה / Metric | ערך ברוטו | ערך נטו (לאחר 25% מס) | תיאור |
| :--- | :--- | :--- | :--- |
| **תוספת חודשית ממוצעת (YTD Monthly)** | \`+₪${Math.round(ytdMonthlyAvgILS).toLocaleString('en-US')}/חודש\` (+$${Math.round(ytdMonthlyAvgUSD).toLocaleString('en-US')}) | \`+₪${Math.round(ytdNetMonthlyAvgILS).toLocaleString('en-US')}/חודש\` (+$${Math.round(ytdNetMonthlyAvgUSD).toLocaleString('en-US')}) | תרומת התיק השנתית כהכנסה פאסיבית חודשית |
| **דיבידנדים בפועל ב-12 חודשים (12M)** | \`₪${Math.round(l12mReceivedGrossUSD * brokerRate).toLocaleString('en-US')}\` ($${Math.round(l12mReceivedGrossUSD).toLocaleString('en-US')}) | \`₪${Math.round(l12mReceivedGrossUSD * 0.75 * brokerRate).toLocaleString('en-US')}\` ($${Math.round(l12mReceivedGrossUSD * 0.75).toLocaleString('en-US')}) | **${((l12mReceivedGrossUSD / totalCurrentUSD) * 100).toFixed(2)}%** תשואת דיבידנד שנתית לתיק |
| **סך דיבידנדים מצטבר היסטורי (All-Time)** | \`₪${Math.round(totalReceivedGrossUSD * brokerRate).toLocaleString('en-US')}\` ($${Math.round(totalReceivedGrossUSD).toLocaleString('en-US')}) | \`₪${Math.round(totalReceivedGrossUSD * 0.75 * brokerRate).toLocaleString('en-US')}\` ($${Math.round(totalReceivedGrossUSD * 0.75).toLocaleString('en-US')}) | סה"כ ${allDividendEvents.length} אירועי חלוקה רשמיים שהתקבלו |

---

## 📜 2. פירוט החזקות בתיק (Holdings Matrix)

| סימול ונכס | יחידות | שער ממוצע | שער נוכחי | שווי שוק | רווח/הפסד (ברוטו) | רווח נטו (25% מס) | משקל בתיק | דיבידנד (12M) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${enhancedHoldingsRows.join('\n')}

---

## 📈 3. גרפים ומגמות (Visual Analytics)

| ביצועי תיק 30 ימים (Portfolio Performance) | התפלגות נכסים (Asset Allocation) |
| :---: | :---: |
| ![Performance](./data_hub/portfolio_performance.png) | ![Allocation](./data_hub/asset_allocation.png) |

---

## 🚀 4. תכונות המערכת האינטראקטיבית (Web Features)

- 🇮🇱 **התאמת מס רווחי הון ישראלי (25%):** מעבר בלחיצת כפתור בין מצב **משולב (נטו + ברוטו)**, **נטו בלבד** או **ברוטו בלבד**.
- 💵 **יומן דיבידנדים היסטורי אינטראקטיבי:** צפייה בכל 67+ תשלומי הדיבידנדים שהתקבלו בפועל עם סינון לפי מניה, שער הדולר וניכוי מס 25%.
- 📅 **לוח שנה ופילוח חודשי (Calendar Monthly Breakdown):** מעקב רווחיות לפי חודש קלנדרי (YTD / שנתי / 12 חודשים) והצגת הכנסה ממוצעת חודשית.
- 🎯 **השוואת ביצועים ו-Alpha מול מדד S&P 500 (VOO Benchmark):** חישוב בזמן אמת של התשואה העודפת לעומת השוק.
- ⚡ **אוטומציה מלאה דרך GitHub Actions:** עדכון יומי אוטומטי של מחירים, דיבידנדים, גרפים ודוחות ללא צורך בהתערבות ידנית.
- 🌓 **עיצוב מודרני מותאם מובייל עם מצב כהה/בהיר (Dark/Light Mode).**

---
📂 *Portfolio Tracker Engine & Analytics by Almog787*
`;

      fs.writeFileSync(readmePath, readmeContent);
      console.log('Successfully updated README.md');
    }
  } catch (error) {
    console.error('Error updating stock prices:', error);
    process.exit(1);
  }
}

fetchAndUpdatePrices();
