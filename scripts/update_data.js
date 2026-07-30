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
      devicePixelRatio: 2
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
    const usdIlsRate = ilsQuote.regularMarketPrice;

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
        const pnlILS = (currentValueUSD - costBasisUSD) * usdIlsRate;
        
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
        prices
      };
      
      history.push(newEntry);
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      console.log(`Successfully updated stock history with ${Object.keys(prices).length} prices.`);
      
      // Calculate totals for README
      const totalInvestedILS = totalInvestedUSD * usdIlsRate;
      const totalCurrentILS = totalCurrentUSD * usdIlsRate;
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
            borderWidth: 2
          }]
        },
        options: {
          plugins: {
            legend: { position: 'right', labels: { font: { size: 14 } } },
            datalabels: { display: false }
          }
        }
      };

      const historyValues = history.map(entry => {
        let total = 0;
        for (const [t, p] of Object.entries(entry.prices)) {
           if (portfolio[t]) {
             total += portfolio[t].amount * p;
           }
        }
        const d = new Date(entry.timestamp);
        return { date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}`, value: total };
      });

      const chartHistory = historyValues.slice(-30);
      
      const performanceConfig = {
        type: 'line',
        data: {
          labels: chartHistory.map(h => h.date),
          datasets: [{
            label: 'Portfolio Value (USD)',
            data: chartHistory.map(h => h.value),
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            borderWidth: 2,
            fill: true,
            pointRadius: 3
          }]
        },
        options: {
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: false
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
