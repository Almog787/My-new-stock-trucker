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
