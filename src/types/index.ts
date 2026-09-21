export interface PortfolioItem {
  amount: number;
  avg_price: number;
}

export interface Portfolio {
  [ticker: string]: PortfolioItem;
}

export interface HistoryPoint {
  timestamp: string;
  prices: {
    [ticker: string]: number;
  };
  exchangeRate?: number;
}

export interface DividendEvent {
  id: string;
  ticker: string;
  date: string;
  dividendPerShare: number;
  shares: number;
  grossUSD: number;
  grossILS: number;
  taxUSD: number;
  taxILS: number;
  netUSD: number;
  netILS: number;
  projected?: boolean;
}

export interface DividendSummary {
  totalReceivedGrossUSD: number;
  totalReceivedGrossILS: number;
  totalReceivedTaxUSD: number;
  totalReceivedTaxILS: number;
  totalReceivedNetUSD: number;
  totalReceivedNetILS: number;
  l12mReceivedGrossUSD: number;
  l12mReceivedGrossILS: number;
  l12mReceivedTaxUSD: number;
  l12mReceivedTaxILS: number;
  l12mReceivedNetUSD: number;
  l12mReceivedNetILS: number;
  ytdReceivedGrossUSD: number;
  ytdReceivedGrossILS: number;
  ytdReceivedTaxUSD: number;
  ytdReceivedTaxILS: number;
  ytdReceivedNetUSD: number;
  ytdReceivedNetILS: number;
  projectedNext12mNetUSD: number;
  projectedNext12mNetILS: number;
}

export interface DividendData {
  summary: DividendSummary;
  events: DividendEvent[];
}
