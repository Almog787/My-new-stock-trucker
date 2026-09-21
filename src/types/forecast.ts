export interface TimesFMModelInfo {
  name: string;
  version: string;
  contextLength: number;
  forecastHorizonDays: number;
  generatedAt: string;
  quantiles: number[];
}

export interface TimesFMPortfolioTimelinePoint {
  date: string;
  displayDate: string;
  p10USD: number;
  p50USD: number;
  p90USD: number;
  p50ILS: number;
  p10ILS: number;
  p90ILS: number;
}

export interface TimesFMPortfolioForecast {
  currentUSD: number;
  currentILS: number;
  forecast30dUSD_P50: number;
  forecast30dUSD_P10: number;
  forecast30dUSD_P90: number;
  forecast30dILS_P50: number;
  forecast30dILS_P10: number;
  forecast30dILS_P90: number;
  expectedReturn30dPct: number;
  volatilityAnnualizedPct: number;
  dates: string[];
  timeline: TimesFMPortfolioTimelinePoint[];
}

export interface TimesFMFXForecast {
  currentRate: number;
  forecast30dRate_P50: number;
  forecast30dRate_P10: number;
  forecast30dRate_P90: number;
  expectedChangePct: number;
  timeline: number[];
}

export interface TimesFMAssetForecast {
  ticker: string;
  currentPrice: number;
  forecastP10: number;
  forecastP50: number;
  forecastP90: number;
  expectedChangePct: number;
  signal: 'STRONG_BULLISH' | 'MODERATE_BULLISH' | 'NEUTRAL_RANGE' | 'BEARISH_CORRECTION';
  signalHe: string;
  annualizedVolatilityPct: number;
  trajectoryP50: number[];
  trajectoryP10: number[];
  trajectoryP90: number[];
}

export interface TimesFMAnomaly {
  ticker: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  description: string;
  deviationPct: number;
  timestamp: string;
}

export interface TimesFMDividendProjectedEvent {
  ticker: string;
  projectedDate: string;
  estimatedGrossUSD: number;
  estimatedNetUSD: number;
  estimatedNetILS: number;
}

export interface TimesFMDividendsForecast {
  next12MonthsTotalNetUSD: number;
  next12MonthsTotalNetILS: number;
  projectedMonthlyAverageNetILS: number;
  events: TimesFMDividendProjectedEvent[];
}

export interface ForecastData {
  modelInfo: TimesFMModelInfo;
  portfolio: TimesFMPortfolioForecast;
  exchangeRate: TimesFMFXForecast;
  assets: { [ticker: string]: TimesFMAssetForecast };
  anomalies: TimesFMAnomaly[];
  dividendsForecast: TimesFMDividendsForecast;
}
