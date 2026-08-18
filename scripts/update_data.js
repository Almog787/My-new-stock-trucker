import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const portfolioPath = path.join(process.cwd(), 'public', 'data', 'portfolio.json');
const historyPath = path.join(process.cwd(), 'public', 'data', 'stock_history.json');
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
    console.log('Fetching stock prices...');
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
    const realUsdIlsRate = ilsQuote.regularMarketPrice;
    
    // The broker applies a spread to the exchange rate. 
    // From reverse engineering the screenshots: current rate ~2.998, broker rate ~3.006.
    // That's a ~0.8 agorot difference (or about 0.26% spread).
    const BROKER_SPREAD = 0.008; 
    const usdIlsRate = realUsdIlsRate + BROKER_SPREAD;
    const brokerRate = usdIlsRate; // Alias for clarity
    
    // Save to meta.json for the React app to use
    const dataDir = path.join(process.cwd(), 'public', 'data');
    const metaPath = path.join(dataDir, 'meta.json');
    fs.writeFileSync(metaPath, JSON.stringify({ usdIlsRate: brokerRate, lastUpdate: new Date().toISOString() }, null, 2));

    const quotes = await Promise.all(
      tickers.map(ticker => yahooFinance.quote(ticker).catch(err => {
        console.error(`Failed to fetch quote for ${ticker}:`, err.message);
        return null;
      }))
    );

    const prices = {};
    let totalInvestedUSD = 0;
    let totalCurrentUSD = 0;
    let totalPreviousUSD = 0;
    
    const holdingsRows = [];
    const allocationLabels = [];
    const allocationData = [];

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
        const pnlILS = pnlPercent * costBasisUSD * brokerRate / 100; // or just (currentValueUSD - costBasisUSD) * brokerRate
        
        const icon = pnlPercent >= 0 ? '🟢' : '🔴';
        
        allocationLabels.push(ticker);
        allocationData.push(currentValueUSD);
        
        holdingsRows.push(`| ${ticker} | ${shares} | $${avgPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} | $${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} | ${icon} ${formatPercent(pnlPercent)} | ₪${Math.round(pnlILS).toLocaleString('en-US')} |`);
      }
    });

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
      
      // Calculate totals for README using the dynamic broker rate
      const totalInvestedILS = totalInvestedUSD * brokerRate;
      const totalCurrentILS = totalCurrentUSD * brokerRate;
      const totalPnLILS = totalCurrentILS - totalInvestedILS;
      const totalPnLPercent = ((totalCurrentILS / totalInvestedILS) - 1) * 100;
      
      let dailyChangePercent = 0;
      if (totalPreviousUSD > 0) {
         dailyChangePercent = ((totalCurrentUSD / totalPreviousUSD) - 1) * 100;
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
      
      // Generate README content
      const readmeContent = `# 📊 Portfolio Dashboard | מעקב תיק השקעות

[🚀 **View Interactive Web Dashboard**](https://almog787.github.io/My-new-stock-trucker-/)

![Total Value](https://img.shields.io/badge/Total_Value-₪${Math.round(totalCurrentILS).toLocaleString('en-US').replace(/,/g, '%2C')}-blue?style=for-the-badge&logo=cashapp) ![Daily Change](https://img.shields.io/badge/Daily_Change-${formatPercent(dailyChangePercent).replace('%', '%25')}-${dailyChangePercent >= 0 ? 'success' : 'critical'}?style=for-the-badge&logo=stocktwits) ![Total Profit](https://img.shields.io/badge/Total_Profit-${formatPercent(totalPnLPercent).replace('%', '%25')}-${totalPnLPercent >= 0 ? 'success' : 'critical'}?style=for-the-badge&logo=codeforces)

**Last Update:** ${formattedDate} | **USD/ILS:** ₪${usdIlsRate.toFixed(3)}

## 💰 Portfolio Summary | סיכום התיק
| Metric | Value | נתון |
| :--- | :--- | :--- |
| **Current Value** | \`₪${Math.round(totalCurrentILS).toLocaleString('en-US')}\` | **שווי נוכחי** |
| **Total Invested** | \`₪${Math.round(totalInvestedILS).toLocaleString('en-US')}\` | **סך השקעה** |
| **Total Profit/Loss** | \`${formatPercent(totalPnLPercent)}\` (₪${Math.round(totalPnLILS).toLocaleString('en-US')}) | **רווח/הפסד כולל** |
| **Daily Change** | \`${formatPercent(dailyChangePercent)}\` | **שינוי יומי** |

## 📜 Holdings | פירוט החזקות
| Ticker | Shares | Avg. Cost | Current Price | P&L % | P&L ILS |
| :--- | :--- | :--- | :--- | :--- | :--- |
${holdingsRows.join('\n')}

## 📈 Charts | גרפים
![Performance](./data_hub/portfolio_performance.png)
![Allocation](./data_hub/asset_allocation.png)

---
📂 *Created by Almog787*
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
