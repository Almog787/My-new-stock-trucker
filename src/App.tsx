import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  Activity,
  BarChart3,
  Moon,
  Sun,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  Percent,
  Briefcase,
  Scale,
  Search,
  Globe,
  Wallet,
  Calendar,
  Coins,
  CalendarDays,
  Landmark,
  Receipt,
  HandCoins,
  History,
  X,
  CheckCircle2
} from 'lucide-react';

interface PortfolioItem {
  amount: number;
  avg_price: number;
}

interface Portfolio {
  [ticker: string]: PortfolioItem;
}

interface HistoryPoint {
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
}

export interface DividendData {
  lastUpdate: string;
  exchangeRate: number;
  summary: {
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
    trailingPortfolioYieldPct: number;
    trailingPortfolioNetYieldPct: number;
    eventsCount: number;
  };
  byTicker: {
    [ticker: string]: {
      ticker: string;
      shares: number;
      eventsCount: number;
      totalGrossUSD: number;
      totalGrossILS: number;
      totalNetUSD: number;
      totalNetILS: number;
      l12mGrossUSD: number;
      l12mGrossILS: number;
      l12mNetUSD: number;
      l12mNetILS: number;
      declaredRate: number;
      declaredYield: number;
      exDividendDate: string | null;
    };
  };
  events: DividendEvent[];
}

export interface CalendarMonthItem {
  monthIndex: number;
  monthKey: string;
  monthName: string;
  year: number;
  monthGainUSD: number;
  monthGainILS: number;
  monthNetGainUSD: number;
  monthNetGainILS: number;
  monthTaxUSD: number;
  monthTaxILS: number;
  cumulativeYTDUSD: number;
  cumulativeYTDILS: number;
  cumulativeNetYTDUSD: number;
  cumulativeNetYTDILS: number;
  runningMonthlyAvgUSD: number;
  runningMonthlyAvgILS: number;
  runningNetMonthlyAvgUSD: number;
  runningNetMonthlyAvgILS: number;
  endValueUSD: number;
  endValueILS: number;
  growthPct: number;
  isCurrentMonth: boolean;
  isPositive: boolean;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316', '#3b82f6'];

// Metadata for companies to provide deeper insights and collected dividend yield data
const ASSET_META: { [ticker: string]: { name: string; sector: string; type: 'Stock' | 'ETF'; note: string; dividendYield: number } } = {
  GOOGL: { name: 'Alphabet (Google)', sector: 'טכנולוגיה ותוכנה', type: 'Stock', note: 'ענקית חיפוש, פרסום ושירותי ענן (דיבידנד שנתי ~$0.80)', dividendYield: 0.45 },
  NVDA: { name: 'NVIDIA Corp', sector: 'מוליכים למחצה ושבבים', type: 'Stock', note: 'מובילת שבבים גרפיים, מעבדים ומרכזי נתונים', dividendYield: 0.03 },
  TSLA: { name: 'Tesla Inc', sector: 'רכב חשמלי / אנרגיה', type: 'Stock', note: 'רכבים חשמליים, אנרגיה ורובוטיקה (ללא חלוקה)', dividendYield: 0.00 },
  ASML: { name: 'ASML Holding', sector: 'ציוד מוליכים למחצה', type: 'Stock', note: 'מונופול עולמי במכונות ליתוגרפיה EUV', dividendYield: 1.15 },
  VOO: { name: 'Vanguard S&P 500', sector: 'מדד ארה"ב (S&P 500)', type: 'ETF', note: 'קרן סל עוקבת אחר 500 החברות הגדולות בארה"ב', dividendYield: 1.45 },
  XOM: { name: 'Exxon Mobil', sector: 'אנרגיה ונפט', type: 'Stock', note: 'ענקית אנרגיה מסורתית ותשואת דיבידנד גבוהה', dividendYield: 3.35 }
};

type SortKey = 'name' | 'amount' | 'avg_price' | 'current_price' | 'valueUSD' | 'pnlUSD' | 'pnlNetUSD' | 'taxUSD' | 'returnPct' | 'returnNetPct' | 'weight' | 'dividendYield' | 'annualDividendUSD';
type TimeRange = '7D' | '30D' | '90D' | 'ALL';
type ChartType = 'performance' | 'benchmark' | 'pnlContribution' | 'costVsValue' | 'monthly';
type MonthlyPeriod = 'YTD' | 'YEAR' | 'L12M' | 'ALL';
type TaxMode = 'NET' | 'GROSS' | 'BOTH';

function App() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [usdToIls, setUsdToIls] = useState<number>(3.006);
  const [loading, setLoading] = useState(true);
  
  // Controls
  const [activeChart, setActiveChart] = useState<ChartType>('performance');
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'ILS' | 'DUAL'>('DUAL');
  const [taxMode, setTaxMode] = useState<TaxMode>('BOTH'); // Default to BOTH (משולב) as requested
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PROFIT' | 'LOSS'>('ALL');
  const [darkMode, setDarkMode] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'valueUSD', direction: 'desc' });
  
  // Interactive Monthly Income Controls
  const [monthlyPeriod, setMonthlyPeriod] = useState<MonthlyPeriod>('YTD');
  const [selectedMonthlyYear, setSelectedMonthlyYear] = useState<number>(2026);

  // Dividend Tracking Controls & State
  const [dividendsData, setDividendsData] = useState<DividendData | null>(null);
  const [dividendPeriod, setDividendPeriod] = useState<'L12M' | 'YTD' | 'ALL'>('L12M');
  const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
  const [dividendTickerFilter, setDividendTickerFilter] = useState<string>('ALL');

  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  }, [darkMode]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [portfolioRes, historyRes, metaRes, dividendsRes] = await Promise.all([
          fetch('./data/portfolio.json'),
          fetch('./data/stock_history.json'),
          fetch('./data/meta.json').catch(() => null),
          fetch('./data/dividends.json').catch(() => null)
        ]);
        
        const portfolioData = await portfolioRes.json();
        const historyData = await historyRes.json();

        if (metaRes && metaRes.ok) {
          const metaData = await metaRes.json();
          if (metaData.usdIlsRate) {
            setUsdToIls(metaData.usdIlsRate);
          }
        }

        if (dividendsRes && dividendsRes.ok) {
          const divJson = await dividendsRes.json();
          setDividendsData(divJson);
        }

        setPortfolio(portfolioData);
        setHistory(historyData);
      } catch (err) {
        console.error('Failed to load portfolio data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // רענון אוטומטי של הנתונים כל שעה (3600000 מילישניות)
    // כך שאם המשתמש משאיר את החלונית פתוחה, היא תמשוך את העדכונים מה-GitHub Actions
    const intervalId = setInterval(loadData, 3600000);
    return () => clearInterval(intervalId);
  }, []);

  // Main Calculations Engine
  const analytics = useMemo(() => {
    if (!portfolio || history.length === 0) {
      return {
        portfolioTotalUSD: 0,
        portfolioTotalILS: 0,
        netPortfolioTotalUSD: 0,
        netPortfolioTotalILS: 0,
        totalCostUSD: 0,
        totalCostILS: 0,
        totalPnLUSD: 0,
        totalPnLILS: 0,
        totalTaxUSD: 0,
        totalTaxILS: 0,
        totalNetPnLUSD: 0,
        totalNetPnLILS: 0,
        totalReturnPct: 0,
        totalNetReturnPct: 0,
        dailyPnLUSD: 0,
        dailyPnLILS: 0,
        dailyTaxUSD: 0,
        dailyTaxILS: 0,
        dailyNetPnLUSD: 0,
        dailyNetPnLILS: 0,
        dailyChangePct: 0,
        ytdPnLUSD: 0,
        ytdPnLILS: 0,
        ytdTaxUSD: 0,
        ytdTaxILS: 0,
        ytdNetPnLUSD: 0,
        ytdNetPnLILS: 0,
        ytdReturnPct: 0,
        ytdNetReturnPct: 0,
        ytdMonthlyAvgUSD: 0,
        ytdMonthlyAvgILS: 0,
        ytdNetMonthlyAvgUSD: 0,
        ytdNetMonthlyAvgILS: 0,
        currentYear: new Date().getFullYear(),
        currentMonthNumber: new Date().getMonth() + 1,
        availableMonthlyYears: [new Date().getFullYear()] as number[],
        calendarMonthlyList: [] as CalendarMonthItem[],
        activePeriodTitle: 'מתחילת השנה (YTD)',
        activePeriodSubtitle: 'מתחילת השנה הנוכחית',
        activePeriodMonthsCount: 1,
        activePeriodTotalGainUSD: 0,
        activePeriodTotalGainILS: 0,
        activePeriodTaxUSD: 0,
        activePeriodTaxILS: 0,
        activePeriodNetTotalGainUSD: 0,
        activePeriodNetTotalGainILS: 0,
        activePeriodMonthlyAvgUSD: 0,
        activePeriodMonthlyAvgILS: 0,
        activePeriodNetMonthlyAvgUSD: 0,
        activePeriodNetMonthlyAvgILS: 0,
        bestMonthYTD: null as CalendarMonthItem | null,
        worstMonthYTD: null as CalendarMonthItem | null,
        positiveMonthsCount: 0,
        lifetimeMonthlyAvgILS: 0,
        lifetimeMonthlyAvgUSD: 0,
        annualDividendGrossUSD: 0,
        annualDividendGrossILS: 0,
        annualDividendTaxUSD: 0,
        annualDividendTaxILS: 0,
        annualDividendNetUSD: 0,
        annualDividendNetILS: 0,
        monthlyDividendGrossUSD: 0,
        monthlyDividendGrossILS: 0,
        monthlyDividendNetUSD: 0,
        monthlyDividendNetILS: 0,
        l12mDividendGrossUSD: 0,
        l12mDividendGrossILS: 0,
        l12mDividendNetUSD: 0,
        l12mDividendNetILS: 0,
        ytdDividendGrossUSD: 0,
        ytdDividendGrossILS: 0,
        ytdDividendNetUSD: 0,
        ytdDividendNetILS: 0,
        allTimeDividendGrossUSD: 0,
        allTimeDividendGrossILS: 0,
        allTimeDividendNetUSD: 0,
        allTimeDividendNetILS: 0,
        totalDividendEventsCount: 0,
        portfolioDividendYieldPct: 0,
        portfolioDividendNetYieldPct: 0,
        sortedHoldings: [],
        chartHistoryData: [],
        benchmarkComparisonData: [],
        pnlContributionData: [],
        costVsValueData: [],
        monthlyPnLData: [],
        sectorAllocation: [],
        topPerformer: null,
        worstPerformer: null,
        concentrationMetric: { topAsset: '', topWeight: 0, hhi: 0, riskLevel: 'מאוזן' as const },
        alphaVsBenchmark: 0
      };
    }

    const latestSnapshot = history[history.length - 1];
    const latestPrices = latestSnapshot.prices;

    // To calculate the true "Daily" change, we must find the last snapshot from a previous trading day.
    // If the system updates hourly, history[history.length - 2] is just the previous hour.
    const today = new Date(latestSnapshot.timestamp).toLocaleDateString('en-US');
    let previousSnapshot = history[0];
    for (let i = history.length - 1; i >= 0; i--) {
      const snapDate = new Date(history[i].timestamp).toLocaleDateString('en-US');
      if (snapDate !== today) {
        previousSnapshot = history[i];
        break;
      }
    }
    const previousPrices = previousSnapshot.prices;

    let currentTotalUSD = 0;
    let previousTotalUSD = 0;
    let costTotalUSD = 0;
    let totalAnnualDividendGrossUSD = 0;
    
    const holdingsList: any[] = [];
    const sectorMap: { [sector: string]: number } = {};

    Object.entries(portfolio).forEach(([ticker, data]) => {
      const currentPrice = latestPrices[ticker] || data.avg_price;
      const prevPrice = previousPrices[ticker] || currentPrice;
      
      const valueUSD = data.amount * currentPrice;
      const prevValueUSD = data.amount * prevPrice;
      const costBasisUSD = data.amount * data.avg_price;
      const pnlUSD = valueUSD - costBasisUSD;
      const pnlILS = pnlUSD * usdToIls;
      const taxUSD = pnlUSD > 0 ? pnlUSD * 0.25 : 0;
      const taxILS = pnlILS > 0 ? pnlILS * 0.25 : 0;
      const pnlNetUSD = pnlUSD > 0 ? pnlUSD * 0.75 : pnlUSD;
      const pnlNetILS = pnlILS > 0 ? pnlILS * 0.75 : pnlILS;
      const returnPct = ((currentPrice - data.avg_price) / data.avg_price) * 100;
      const returnNetPct = costBasisUSD > 0 ? (pnlNetUSD / costBasisUSD) * 100 : 0;
      const dailyAssetChangePct = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
      const dailyAssetPnLUSD = valueUSD - prevValueUSD;

      currentTotalUSD += valueUSD;
      previousTotalUSD += prevValueUSD;
      costTotalUSD += costBasisUSD;

      const divSummary = dividendsData?.byTicker?.[ticker];
      const meta = ASSET_META[ticker] || { name: ticker, sector: 'אחר', type: 'Stock', note: '', dividendYield: 0.8 };
      const dividendYield = divSummary?.declaredYield ?? meta.dividendYield ?? (meta.type === 'ETF' ? 1.45 : 0.8);
      const annualDividendUSD = divSummary ? divSummary.l12mGrossUSD : valueUSD * (dividendYield / 100);
      const annualDividendILS = annualDividendUSD * usdToIls;
      const annualDividendTaxUSD = annualDividendUSD * 0.25;
      const annualDividendTaxILS = annualDividendILS * 0.25;
      const annualDividendNetUSD = annualDividendUSD * 0.75;
      const annualDividendNetILS = annualDividendILS * 0.75;
      const totalDividendsUSD = divSummary ? divSummary.totalGrossUSD : 0;
      const totalDividendsILS = totalDividendsUSD * usdToIls;

      totalAnnualDividendGrossUSD += annualDividendUSD;
      sectorMap[meta.sector] = (sectorMap[meta.sector] || 0) + valueUSD;

      holdingsList.push({
        ticker,
        name: meta.name,
        sector: meta.sector,
        type: meta.type,
        note: meta.note,
        amount: data.amount,
        avg_price: data.avg_price,
        current_price: currentPrice,
        prev_price: prevPrice,
        valueUSD,
        valueILS: valueUSD * usdToIls,
        costUSD: costBasisUSD,
        costILS: costBasisUSD * usdToIls,
        pnlUSD,
        pnlILS,
        taxUSD,
        taxILS,
        pnlNetUSD,
        pnlNetILS,
        returnPct,
        returnNetPct,
        dailyChangePct: dailyAssetChangePct,
        dailyPnLUSD: dailyAssetPnLUSD,
        dailyPnLILS: dailyAssetPnLUSD * usdToIls,
        dividendYield,
        annualDividendUSD,
        annualDividendILS,
        annualDividendNetUSD,
        annualDividendNetILS,
        annualDividendTaxUSD,
        annualDividendTaxILS,
        totalDividendsUSD,
        totalDividendsILS,
        eventsCount: divSummary?.eventsCount || 0,
        weight: 0
      });
    });

    // Calculate weights & HHI concentration
    let hhiSum = 0;
    let topHolding = holdingsList[0];

    holdingsList.forEach(item => {
      item.weight = currentTotalUSD > 0 ? (item.valueUSD / currentTotalUSD) * 100 : 0;
      const weightFraction = item.weight;
      hhiSum += (weightFraction * weightFraction);
      if (!topHolding || item.weight > topHolding.weight) {
        topHolding = item;
      }
    });

    // Concentration Risk Level
    let riskLevel: 'נמוך ומפוזר' | 'מאוזן' | 'ריכוזי' | 'ריכוזי מאוד' = 'מאוזן';
    if (hhiSum > 2500 || (topHolding && topHolding.weight > 35)) {
      riskLevel = 'ריכוזי מאוד';
    } else if (hhiSum > 1800 || (topHolding && topHolding.weight > 25)) {
      riskLevel = 'ריכוזי';
    } else if (hhiSum < 1200) {
      riskLevel = 'נמוך ומפוזר';
    }

    // Sort Holdings
    const sortedHoldings = [...holdingsList].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    // Top and Worst Performers
    const sortedByReturn = [...holdingsList].sort((a, b) => b.returnPct - a.returnPct);
    const topPerformer = sortedByReturn[0] || null;
    const worstPerformer = sortedByReturn[sortedByReturn.length - 1] || null;

    // Daily Grouping of Full History
    const dailyMap = new Map();
    const allMonthEndMap = new Map<string, number>();

    history.forEach(point => {
      const d = new Date(point.timestamp);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const displayDate = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
      
      let pointTotal = 0;
      const assetValues: { [t: string]: number } = {};

      Object.entries(portfolio).forEach(([ticker, data]) => {
        const price = point.prices[ticker] || data.avg_price;
        const val = price * data.amount;
        pointTotal += val;
        assetValues[ticker] = val;
      });

      const historicalRate = point.exchangeRate || usdToIls;
      const vooPrice = point.prices['VOO'] || 527.38;

      dailyMap.set(dateKey, {
        dateKey,
        monthKey,
        timestamp: displayDate,
        rawDate: point.timestamp,
        totalUSD: pointTotal,
        totalILS: pointTotal * historicalRate,
        returnPct: costTotalUSD > 0 ? ((pointTotal - costTotalUSD) / costTotalUSD) * 100 : 0,
        vooPrice,
        rate: historicalRate,
        ...assetValues
      });

      allMonthEndMap.set(monthKey, pointTotal);
    });

    const fullUnfilteredDailyHistory = Array.from(dailyMap.values());
    let fullDailyHistory = [...fullUnfilteredDailyHistory];

    // Filter by TimeRange for charts
    if (timeRange === '7D') {
      fullDailyHistory = fullDailyHistory.slice(-7);
    } else if (timeRange === '30D') {
      fullDailyHistory = fullDailyHistory.slice(-30);
    } else if (timeRange === '90D') {
      fullDailyHistory = fullDailyHistory.slice(-90);
    }

    // Baseline calculation for relative benchmark comparison
    const basePoint = fullDailyHistory[0] || { totalUSD: currentTotalUSD, vooPrice: 600, returnPct: 0 };
    const benchmarkComparisonData = fullDailyHistory.map(point => {
      const portfolioRelativeChange = basePoint.totalUSD > 0 
        ? ((point.totalUSD - basePoint.totalUSD) / basePoint.totalUSD) * 100 
        : 0;
      const vooRelativeChange = basePoint.vooPrice > 0 
        ? ((point.vooPrice - basePoint.vooPrice) / basePoint.vooPrice) * 100 
        : 0;

      return {
        timestamp: point.timestamp,
        rawDate: point.rawDate,
        portfolioReturn: portfolioRelativeChange,
        benchmarkReturn: vooRelativeChange,
        alpha: portfolioRelativeChange - vooRelativeChange,
        totalUSD: point.totalUSD,
        totalILS: point.totalILS
      };
    });

    // P&L Contribution by Asset (Dollars & Shekels)
    const pnlContributionData = holdingsList
      .map(item => ({
        ticker: item.ticker,
        name: item.name,
        pnlUSD: item.pnlUSD,
        pnlILS: item.pnlILS,
        returnPct: item.returnPct,
        weight: item.weight,
        isPositive: item.pnlUSD >= 0
      }))
      .sort((a, b) => b.pnlUSD - a.pnlUSD);

    // Cost Basis vs Current Market Value Data
    const costVsValueData = holdingsList
      .map(item => ({
        ticker: item.ticker,
        name: item.name,
        costUSD: item.costUSD,
        valueUSD: item.valueUSD,
        costILS: item.costILS,
        valueILS: item.valueILS,
        growthMultiplier: (item.valueUSD / (item.costUSD || 1)).toFixed(2) + 'x'
      }))
      .sort((a, b) => b.valueUSD - a.valueUSD);

    // Monthly Grouping from full history
    const monthlyMap = new Map();
    fullUnfilteredDailyHistory.forEach(point => {
      const d = new Date(point.rawDate);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(monthKey, point);
    });

    const monthlyArray = Array.from(monthlyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const monthlyPnLData: any[] = [];
    let prevMonthTotal = costTotalUSD;

    monthlyArray.forEach(([monthKey, point]) => {
      const pnlUSD = point.totalUSD - prevMonthTotal;
      const pnlPct = prevMonthTotal > 0 ? (pnlUSD / prevMonthTotal) * 100 : 0;
      const d = new Date(point.rawDate);
      const monthLabel = d.toLocaleString('he-IL', { month: 'short', year: '2-digit' });

      monthlyPnLData.push({
        monthKey,
        monthLabel,
        pnlUSD,
        pnlILS: pnlUSD * (point.rate || usdToIls),
        pnlPct,
        totalUSD: point.totalUSD,
        isPositive: pnlUSD >= 0
      });
      prevMonthTotal = point.totalUSD;
    });

    // Sector Allocation Breakdown
    const sectorAllocation = Object.entries(sectorMap).map(([sector, val], idx) => ({
      name: sector,
      valueUSD: val,
      valueILS: val * usdToIls,
      percentage: currentTotalUSD > 0 ? (val / currentTotalUSD) * 100 : 0,
      color: COLORS[idx % COLORS.length]
    })).sort((a, b) => b.valueUSD - a.valueUSD);

    // Alpha vs S&P 500 (VOO)
    const vooHolding = holdingsList.find(h => h.ticker === 'VOO');
    const totalReturnPct = costTotalUSD > 0 ? ((currentTotalUSD - costTotalUSD) / costTotalUSD) * 100 : 0;
    const vooReturnPct = vooHolding ? vooHolding.returnPct : 0;
    const alphaVsBenchmark = totalReturnPct - vooReturnPct;

    // Dollar & Shekel Values
    const totalPnLUSD = currentTotalUSD - costTotalUSD;
    const totalPnLILS = currentTotalUSD * usdToIls - costTotalUSD * usdToIls;
    const dailyPnLUSD = currentTotalUSD - previousTotalUSD;
    const dailyPnLILS = dailyPnLUSD * usdToIls;
    const dailyChangePct = previousTotalUSD > 0 ? ((currentTotalUSD - previousTotalUSD) / previousTotalUSD) * 100 : 0;

    // ========================================================
    // CALENDAR MONTH & HOUSEHOLD INCOME MATH (INTERACTIVE ENGINE)
    // ========================================================
    const latestDate = new Date(latestSnapshot.timestamp);
    const currentYear = latestDate.getFullYear();
    const currentMonthNumber = latestDate.getMonth() + 1; // 1-12

    // Extract all available years from history (sorted descending)
    const availableMonthlyYears = Array.from(
      new Set(history.map(h => new Date(h.timestamp).getFullYear()))
    ).sort((a, b) => b - a);

    // 1. Standard YTD Baseline (for Top Executive KPI Card)
    const pointsPriorToCurrentYear = history.filter(h => new Date(h.timestamp).getFullYear() < currentYear);
    let startOfYearUSD = costTotalUSD;

    if (pointsPriorToCurrentYear.length > 0) {
      const lastPointPriorYear = pointsPriorToCurrentYear[pointsPriorToCurrentYear.length - 1];
      let val = 0;
      Object.entries(portfolio).forEach(([ticker, data]) => {
        val += (lastPointPriorYear.prices[ticker] || data.avg_price) * data.amount;
      });
      startOfYearUSD = val;
    } else {
      const firstPointCurrentYear = history.find(h => new Date(h.timestamp).getFullYear() === currentYear);
      if (firstPointCurrentYear) {
        let val = 0;
        Object.entries(portfolio).forEach(([ticker, data]) => {
          val += (firstPointCurrentYear.prices[ticker] || data.avg_price) * data.amount;
        });
        startOfYearUSD = val;
      }
    }

    const ytdPnLUSD = currentTotalUSD - startOfYearUSD;
    const ytdPnLILS = ytdPnLUSD * usdToIls;
    const ytdTaxUSD = ytdPnLUSD > 0 ? ytdPnLUSD * 0.25 : 0;
    const ytdTaxILS = ytdPnLILS > 0 ? ytdPnLILS * 0.25 : 0;
    const ytdNetPnLUSD = ytdPnLUSD > 0 ? ytdPnLUSD * 0.75 : ytdPnLUSD;
    const ytdNetPnLILS = ytdPnLILS > 0 ? ytdPnLILS * 0.75 : ytdPnLILS;
    const ytdReturnPct = startOfYearUSD > 0 ? (ytdPnLUSD / startOfYearUSD) * 100 : 0;
    const ytdNetReturnPct = startOfYearUSD > 0 ? (ytdNetPnLUSD / startOfYearUSD) * 100 : 0;
    const ytdMonthlyAvgUSD = ytdPnLUSD / (currentMonthNumber || 1);
    const ytdMonthlyAvgILS = ytdPnLILS / (currentMonthNumber || 1);
    const ytdNetMonthlyAvgUSD = ytdNetPnLUSD / (currentMonthNumber || 1);
    const ytdNetMonthlyAvgILS = ytdNetPnLILS / (currentMonthNumber || 1);

    const monthNamesHebrew = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];

    // 2. Interactive Monthly Breakdown (Dynamic by monthlyPeriod & selectedMonthlyYear)
    let targetMonthSlots: { year: number; monthIndex: number; monthKey: string; monthName: string }[] = [];
    let periodBaselineUSD = costTotalUSD;
    let periodTitle = `שנת ${currentYear} (מתחילת השנה - YTD)`;
    let periodSubtitle = `מתחילת שנת ${currentYear} (${currentMonthNumber} חודשים)`;

    if (monthlyPeriod === 'YTD') {
      periodBaselineUSD = startOfYearUSD;
      periodTitle = `שנת ${currentYear} (מתחילת השנה - YTD)`;
      periodSubtitle = `מתחילת שנת ${currentYear} (${currentMonthNumber} חודשים)`;
      for (let m = 1; m <= currentMonthNumber; m++) {
        const formattedKey = `${currentYear}-${String(m).padStart(2, '0')}`;
        targetMonthSlots.push({
          year: currentYear,
          monthIndex: m,
          monthKey: formattedKey,
          monthName: monthNamesHebrew[m - 1]
        });
      }
    } else if (monthlyPeriod === 'YEAR') {
      const yr = selectedMonthlyYear;
      const pointsPriorToSelectedYear = history.filter(h => new Date(h.timestamp).getFullYear() < yr);
      if (pointsPriorToSelectedYear.length > 0) {
        const lastPt = pointsPriorToSelectedYear[pointsPriorToSelectedYear.length - 1];
        let val = 0;
        Object.entries(portfolio).forEach(([ticker, data]) => {
          val += (lastPt.prices[ticker] || data.avg_price) * data.amount;
        });
        periodBaselineUSD = val;
      } else {
        periodBaselineUSD = costTotalUSD;
      }

      const monthsInThatYear = history
        .filter(h => new Date(h.timestamp).getFullYear() === yr)
        .map(h => new Date(h.timestamp).getMonth() + 1);
      const minM = monthsInThatYear.length > 0 ? Math.min(...monthsInThatYear) : 1;
      const maxM = (yr === currentYear) ? currentMonthNumber : 12;

      periodTitle = `שנת ${yr}`;
      periodSubtitle = `שנת ${yr} (${maxM - minM + 1} חודשים פעילים)`;

      for (let m = minM; m <= maxM; m++) {
        const formattedKey = `${yr}-${String(m).padStart(2, '0')}`;
        targetMonthSlots.push({
          year: yr,
          monthIndex: m,
          monthKey: formattedKey,
          monthName: monthNamesHebrew[m - 1]
        });
      }
    } else if (monthlyPeriod === 'L12M') {
      const allUniqueKeys = Array.from(allMonthEndMap.keys()).sort();
      const last12Keys = allUniqueKeys.slice(-12);
      const firstKey = last12Keys[0];
      const priorKeys = allUniqueKeys.filter(k => k < firstKey);
      if (priorKeys.length > 0) {
        periodBaselineUSD = allMonthEndMap.get(priorKeys[priorKeys.length - 1]) || costTotalUSD;
      } else {
        periodBaselineUSD = costTotalUSD;
      }

      periodTitle = '12 חודשים אחרונים (L12M)';
      periodSubtitle = '12 החודשים הקלנדריים האחרונים ברצף';

      last12Keys.forEach(k => {
        const [yStr, mStr] = k.split('-');
        const y = Number(yStr);
        const m = Number(mStr);
        targetMonthSlots.push({
          year: y,
          monthIndex: m,
          monthKey: k,
          monthName: monthNamesHebrew[m - 1]
        });
      });
    } else if (monthlyPeriod === 'ALL') {
      const allUniqueKeys = Array.from(allMonthEndMap.keys()).sort();
      periodBaselineUSD = costTotalUSD;
      periodTitle = 'כל הזמנים (מתחילת הפעילות)';
      periodSubtitle = `כל ${allUniqueKeys.length} החודשים הקלנדריים`;

      allUniqueKeys.forEach(k => {
        const [yStr, mStr] = k.split('-');
        const y = Number(yStr);
        const m = Number(mStr);
        targetMonthSlots.push({
          year: y,
          monthIndex: m,
          monthKey: k,
          monthName: monthNamesHebrew[m - 1]
        });
      });
    }

    let prevMonthValUSD = periodBaselineUSD;
    let cumulativeGainUSD = 0;
    const calendarMonthlyList: CalendarMonthItem[] = [];

    targetMonthSlots.forEach((slot, idx) => {
      const isCurrent = slot.year === currentYear && slot.monthIndex === currentMonthNumber;
      const endValUSD = isCurrent
        ? currentTotalUSD
        : (allMonthEndMap.get(slot.monthKey) ?? prevMonthValUSD);

      const monthGainUSD = endValUSD - prevMonthValUSD;
      const monthGainILS = monthGainUSD * usdToIls;
      const monthTaxUSD = Math.max(0, monthGainUSD) * 0.25;
      const monthTaxILS = Math.max(0, monthGainILS) * 0.25;
      const monthNetGainUSD = monthGainUSD > 0 ? monthGainUSD * 0.75 : monthGainUSD;
      const monthNetGainILS = monthGainILS > 0 ? monthGainILS * 0.75 : monthGainILS;

      cumulativeGainUSD += monthGainUSD;
      const cumulativeGainILS = cumulativeGainUSD * usdToIls;
      const cumulativeNetYTDUSD = cumulativeGainUSD > 0 ? cumulativeGainUSD * 0.75 : cumulativeGainUSD;
      const cumulativeNetYTDILS = cumulativeGainILS > 0 ? cumulativeGainILS * 0.75 : cumulativeGainILS;

      const runningMonthlyAvgUSD = cumulativeGainUSD / (idx + 1);
      const runningMonthlyAvgILS = cumulativeGainILS / (idx + 1);
      const runningNetMonthlyAvgUSD = cumulativeNetYTDUSD / (idx + 1);
      const runningNetMonthlyAvgILS = cumulativeNetYTDILS / (idx + 1);

      const growthPct = prevMonthValUSD > 0 ? (monthGainUSD / prevMonthValUSD) * 100 : 0;

      calendarMonthlyList.push({
        monthIndex: slot.monthIndex,
        monthKey: slot.monthKey,
        monthName: slot.monthName,
        year: slot.year,
        monthGainUSD,
        monthGainILS,
        monthNetGainUSD,
        monthNetGainILS,
        monthTaxUSD,
        monthTaxILS,
        cumulativeYTDUSD: cumulativeGainUSD,
        cumulativeYTDILS: cumulativeGainILS,
        cumulativeNetYTDUSD,
        cumulativeNetYTDILS,
        runningMonthlyAvgUSD,
        runningMonthlyAvgILS,
        runningNetMonthlyAvgUSD,
        runningNetMonthlyAvgILS,
        endValueUSD: endValUSD,
        endValueILS: endValUSD * usdToIls,
        growthPct,
        isCurrentMonth: isCurrent,
        isPositive: monthGainUSD >= 0
      });

      prevMonthValUSD = endValUSD;
    });

    const activePeriodMonthsCount = calendarMonthlyList.length || 1;
    const activePeriodTotalGainUSD = cumulativeGainUSD;
    const activePeriodTotalGainILS = cumulativeGainUSD * usdToIls;
    const activePeriodTaxUSD = Math.max(0, activePeriodTotalGainUSD) * 0.25;
    const activePeriodTaxILS = Math.max(0, activePeriodTotalGainILS) * 0.25;
    const activePeriodNetTotalGainUSD = activePeriodTotalGainUSD > 0 ? activePeriodTotalGainUSD * 0.75 : activePeriodTotalGainUSD;
    const activePeriodNetTotalGainILS = activePeriodTotalGainILS > 0 ? activePeriodTotalGainILS * 0.75 : activePeriodTotalGainILS;
    const activePeriodMonthlyAvgUSD = activePeriodTotalGainUSD / activePeriodMonthsCount;
    const activePeriodMonthlyAvgILS = activePeriodTotalGainILS / activePeriodMonthsCount;
    const activePeriodNetMonthlyAvgUSD = activePeriodNetTotalGainUSD / activePeriodMonthsCount;
    const activePeriodNetMonthlyAvgILS = activePeriodNetTotalGainILS / activePeriodMonthsCount;

    const positiveMonthsCount = calendarMonthlyList.filter(m => m.isPositive).length;
    const bestMonthPeriod = [...calendarMonthlyList].sort((a, b) => b.monthGainUSD - a.monthGainUSD)[0] || null;
    const worstMonthPeriod = [...calendarMonthlyList].sort((a, b) => a.monthGainUSD - b.monthGainUSD)[0] || null;

    const firstDate = new Date(history[0].timestamp);
    const totalDaysLifetime = Math.max(1, (latestDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalMonthsLifetime = Math.max(1, totalDaysLifetime / 30.4375);
    const lifetimeMonthlyAvgUSD = totalPnLUSD / totalMonthsLifetime;
    const lifetimeMonthlyAvgILS = totalPnLILS / totalMonthsLifetime;

    const totalTaxUSD = Math.max(0, totalPnLUSD) * 0.25;
    const totalTaxILS = Math.max(0, totalPnLILS) * 0.25;
    const totalNetPnLUSD = totalPnLUSD > 0 ? totalPnLUSD * 0.75 : totalPnLUSD;
    const totalNetPnLILS = totalPnLILS > 0 ? totalPnLILS * 0.75 : totalPnLILS;
    const netPortfolioTotalUSD = currentTotalUSD - totalTaxUSD;
    const netPortfolioTotalILS = (currentTotalUSD * usdToIls) - totalTaxILS;
    const totalNetReturnPct = costTotalUSD > 0 ? (totalNetPnLUSD / costTotalUSD) * 100 : 0;

    const dailyTaxUSD = Math.max(0, dailyPnLUSD) * 0.25;
    const dailyTaxILS = Math.max(0, dailyPnLILS) * 0.25;
    const dailyNetPnLUSD = dailyPnLUSD > 0 ? dailyPnLUSD * 0.75 : dailyPnLUSD;
    const dailyNetPnLILS = dailyPnLILS > 0 ? dailyPnLILS * 0.75 : dailyPnLILS;

    // Actual trailing & received dividends from collected data
    const l12mDividendGrossUSD = dividendsData?.summary?.l12mReceivedGrossUSD ?? totalAnnualDividendGrossUSD;
    const l12mDividendGrossILS = dividendsData?.summary?.l12mReceivedGrossILS ?? (totalAnnualDividendGrossUSD * usdToIls);
    const l12mDividendTaxUSD = dividendsData?.summary?.l12mReceivedTaxUSD ?? (totalAnnualDividendGrossUSD * 0.25);
    const l12mDividendTaxILS = dividendsData?.summary?.l12mReceivedTaxILS ?? ((totalAnnualDividendGrossUSD * usdToIls) * 0.25);
    const l12mDividendNetUSD = dividendsData?.summary?.l12mReceivedNetUSD ?? (totalAnnualDividendGrossUSD * 0.75);
    const l12mDividendNetILS = dividendsData?.summary?.l12mReceivedNetILS ?? ((totalAnnualDividendGrossUSD * usdToIls) * 0.75);

    const ytdDividendGrossUSD = dividendsData?.summary?.ytdReceivedGrossUSD ?? (totalAnnualDividendGrossUSD * (currentMonthNumber / 12));
    const ytdDividendGrossILS = dividendsData?.summary?.ytdReceivedGrossILS ?? (ytdDividendGrossUSD * usdToIls);
    const ytdDividendNetUSD = dividendsData?.summary?.ytdReceivedNetUSD ?? (ytdDividendGrossUSD * 0.75);
    const ytdDividendNetILS = dividendsData?.summary?.ytdReceivedNetILS ?? (ytdDividendGrossILS * 0.75);

    const allTimeDividendGrossUSD = dividendsData?.summary?.totalReceivedGrossUSD ?? totalAnnualDividendGrossUSD;
    const allTimeDividendGrossILS = dividendsData?.summary?.totalReceivedGrossILS ?? (totalAnnualDividendGrossUSD * usdToIls);
    const allTimeDividendNetUSD = dividendsData?.summary?.totalReceivedNetUSD ?? (allTimeDividendGrossUSD * 0.75);
    const allTimeDividendNetILS = dividendsData?.summary?.totalReceivedNetILS ?? (allTimeDividendGrossILS * 0.75);

    const monthlyDividendGrossUSD = l12mDividendGrossUSD / 12;
    const monthlyDividendGrossILS = l12mDividendGrossILS / 12;
    const monthlyDividendNetUSD = l12mDividendNetUSD / 12;
    const monthlyDividendNetILS = l12mDividendNetILS / 12;

    const portfolioDividendYieldPct = currentTotalUSD > 0 ? (l12mDividendGrossUSD / currentTotalUSD) * 100 : 0;
    const portfolioDividendNetYieldPct = currentTotalUSD > 0 ? (l12mDividendNetUSD / currentTotalUSD) * 100 : 0;

    return {
      portfolioTotalUSD: currentTotalUSD,
      portfolioTotalILS: currentTotalUSD * usdToIls,
      netPortfolioTotalUSD,
      netPortfolioTotalILS,
      totalCostUSD: costTotalUSD,
      totalCostILS: costTotalUSD * usdToIls,
      totalPnLUSD,
      totalPnLILS,
      totalTaxUSD,
      totalTaxILS,
      totalNetPnLUSD,
      totalNetPnLILS,
      totalReturnPct,
      totalNetReturnPct,
      dailyPnLUSD,
      dailyPnLILS,
      dailyTaxUSD,
      dailyTaxILS,
      dailyNetPnLUSD,
      dailyNetPnLILS,
      dailyChangePct,
      ytdPnLUSD,
      ytdPnLILS,
      ytdTaxUSD,
      ytdTaxILS,
      ytdNetPnLUSD,
      ytdNetPnLILS,
      ytdReturnPct,
      ytdNetReturnPct,
      ytdMonthlyAvgUSD,
      ytdMonthlyAvgILS,
      ytdNetMonthlyAvgUSD,
      ytdNetMonthlyAvgILS,
      annualDividendGrossUSD: l12mDividendGrossUSD,
      annualDividendGrossILS: l12mDividendGrossILS,
      annualDividendTaxUSD: l12mDividendTaxUSD,
      annualDividendTaxILS: l12mDividendTaxILS,
      annualDividendNetUSD: l12mDividendNetUSD,
      annualDividendNetILS: l12mDividendNetILS,
      monthlyDividendGrossUSD,
      monthlyDividendGrossILS,
      monthlyDividendNetUSD,
      monthlyDividendNetILS,
      l12mDividendGrossUSD,
      l12mDividendGrossILS,
      l12mDividendNetUSD,
      l12mDividendNetILS,
      ytdDividendGrossUSD,
      ytdDividendGrossILS,
      ytdDividendNetUSD,
      ytdDividendNetILS,
      allTimeDividendGrossUSD,
      allTimeDividendGrossILS,
      allTimeDividendNetUSD,
      allTimeDividendNetILS,
      totalDividendEventsCount: dividendsData?.summary?.eventsCount ?? 0,
      portfolioDividendYieldPct,
      portfolioDividendNetYieldPct,
      currentYear,
      currentMonthNumber,
      availableMonthlyYears,
      calendarMonthlyList,
      activePeriodTitle: periodTitle,
      activePeriodSubtitle: periodSubtitle,
      activePeriodMonthsCount,
      activePeriodTotalGainUSD,
      activePeriodTotalGainILS,
      activePeriodTaxUSD,
      activePeriodTaxILS,
      activePeriodNetTotalGainUSD,
      activePeriodNetTotalGainILS,
      activePeriodMonthlyAvgUSD,
      activePeriodMonthlyAvgILS,
      activePeriodNetMonthlyAvgUSD,
      activePeriodNetMonthlyAvgILS,
      bestMonthYTD: bestMonthPeriod,
      worstMonthYTD: worstMonthPeriod,
      positiveMonthsCount,
      lifetimeMonthlyAvgILS,
      lifetimeMonthlyAvgUSD,
      sortedHoldings,
      chartHistoryData: fullDailyHistory,
      benchmarkComparisonData,
      pnlContributionData,
      costVsValueData,
      monthlyPnLData,
      sectorAllocation,
      topPerformer,
      worstPerformer,
      concentrationMetric: {
        topAsset: topHolding?.ticker || '',
        topWeight: topHolding?.weight || 0,
        hhi: Math.round(hhiSum),
        riskLevel
      },
      alphaVsBenchmark
    };
  }, [portfolio, history, sortConfig, usdToIls, timeRange, monthlyPeriod, selectedMonthlyYear]);

  // Filtered Holdings
  const filteredHoldings = useMemo(() => {
    return analytics.sortedHoldings.filter(item => {
      const matchesSearch = item.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sector.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (filterType === 'PROFIT') return item.returnPct >= 0;
      if (filterType === 'LOSS') return item.returnPct < 0;
      return true;
    });
  }, [analytics.sortedHoldings, searchQuery, filterType]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp size={13} className="inline mr-1 text-indigo-500" /> : <ArrowDown size={13} className="inline mr-1 text-indigo-500" />;
  };

  const formatMoney = (valUSD: number, valILS?: number) => {
    const ils = valILS ?? (valUSD * usdToIls);
    if (currencyMode === 'USD') {
      return `$${valUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (currencyMode === 'ILS') {
      return `₪${ils.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return (
      <div className="flex flex-col items-start" dir="ltr">
        <span className="font-semibold text-slate-900 dark:text-slate-100">${valUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">₪{ils.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          <p className="text-sm font-medium tracking-wide text-slate-400">טוען מודל נתונים ואנליטיקות שוק...</p>
        </div>
      </div>
    );
  }

  const tooltipStyles = {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderColor: darkMode ? '#334155' : '#e2e8f0',
    color: darkMode ? '#f8fafc' : '#0f172a',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
    padding: '12px 16px',
    fontSize: '13px'
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors font-sans antialiased" dir="rtl">
      
      {/* Top Professional Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl text-white shadow-md shadow-indigo-500/20">
              <Briefcase size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">תיק השקעות PRO</h1>
                <span className="px-2 py-0.5 text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800/60">
                  LIVE ANALYTICS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">אנליזה כמותית, פיזור סיכונים והשוואת ביצועים</p>
            </div>
          </div>

          {/* Quick Controls Toolbar */}
          <div className="flex items-center gap-3">
            
            {/* Live FX Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 text-xs">
              <Globe size={14} className="text-indigo-500" />
              <span className="text-slate-500 dark:text-slate-400">שער ברוקר USD/ILS:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200" dir="ltr">₪{usdToIls.toFixed(3)}</span>
            </div>

            {/* Israeli Tax Calculation Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-inner">
              <button
                type="button"
                onClick={() => setTaxMode('BOTH')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  taxMode === 'BOTH'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="הצגת ברוטו ונטו (מס 25%) יחד בדיפולט"
              >
                <Landmark size={13} />
                <span>משולב (נטו+ברוטו)</span>
              </button>
              <button
                type="button"
                onClick={() => setTaxMode('NET')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  taxMode === 'NET'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="הצגת רווח נטו בלבד לאחר ניכוי 25% מס רווחי הון"
              >
                נטו בלבד
              </button>
              <button
                type="button"
                onClick={() => setTaxMode('GROSS')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  taxMode === 'GROSS'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="הצגת רווח ברוטו מלא לפני ניכוי מס"
              >
                ברוטו בלבד
              </button>
            </div>

            {/* Currency Mode Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setCurrencyMode('USD')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${currencyMode === 'USD' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                $ USD
              </button>
              <button
                onClick={() => setCurrencyMode('ILS')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${currencyMode === 'ILS' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                ₪ ILS
              </button>
              <button
                onClick={() => setCurrencyMode('DUAL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${currencyMode === 'DUAL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                משולב
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* ======================================================== */}
        {/* 1. TOP EXECUTIVE METRIC CARDS (KPI DASHBOARD) */}
        {/* ======================================================== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          
          {/* Card 1: Total Portfolio Value */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-500/30 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">שווי תיק שוק</span>
                <DollarSign size={18} className="text-indigo-500" />
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white" dir="ltr">
                  ${analytics.portfolioTotalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                  ₪{analytics.portfolioTotalILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">נטו למימוש (מס 25%):</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                ₪{analytics.netPortfolioTotalILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Card 2: Unrealized P&L & Total Return */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/30 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <span>
                    {taxMode === 'BOTH' ? 'רווח כולל (נטו וברוטו)' : taxMode === 'GROSS' ? 'רווח ברוטו (P&L)' : 'רווח נטו (מס 25%)'}
                  </span>
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  taxMode === 'BOTH' 
                    ? 'bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300' 
                    : taxMode === 'GROSS' 
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300' 
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {taxMode === 'BOTH' ? 'משולב' : taxMode === 'GROSS' ? 'ברוטו' : 'נטו'}
                </span>
              </div>
              <div className="space-y-0.5">
                {taxMode === 'BOTH' ? (
                  <>
                    <div className={`text-2xl font-bold tracking-tight ${analytics.totalNetPnLUSD >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                      {analytics.totalNetPnLUSD >= 0 ? '+' : ''}${analytics.totalNetPnLUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1.5">
                        ({analytics.totalNetPnLILS >= 0 ? '+' : ''}₪{analytics.totalNetPnLILS.toLocaleString(undefined, { maximumFractionDigits: 0 })} נטו)
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                      ברוטו: +${analytics.totalPnLUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+₪{analytics.totalPnLILS.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                    </div>
                  </>
                ) : taxMode === 'GROSS' ? (
                  <>
                    <div className={`text-2xl font-bold tracking-tight ${analytics.totalPnLUSD >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                      {analytics.totalPnLUSD >= 0 ? '+' : ''}${analytics.totalPnLUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-sm font-medium ${analytics.totalPnLUSD >= 0 ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-rose-600/80 dark:text-rose-400/80'}`} dir="ltr">
                      {analytics.totalPnLILS >= 0 ? '+' : ''}₪{analytics.totalPnLILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`text-2xl font-bold tracking-tight ${analytics.totalNetPnLUSD >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                      {analytics.totalNetPnLUSD >= 0 ? '+' : ''}${analytics.totalNetPnLUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-sm font-medium ${analytics.totalNetPnLUSD >= 0 ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-rose-600/80 dark:text-rose-400/80'}`} dir="ltr">
                      {analytics.totalNetPnLILS >= 0 ? '+' : ''}₪{analytics.totalNetPnLILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {taxMode === 'BOTH' ? 'מס רווחי הון (25%):' : taxMode === 'GROSS' ? 'מס צפוי (25%):' : 'ברוטו:'}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300" dir="ltr">
                {taxMode === 'BOTH' || taxMode === 'GROSS'
                  ? `-₪${analytics.totalTaxILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : `+₪${analytics.totalPnLILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                }
              </span>
            </div>
          </div>

          {/* Card 3: Actual Historical Dividends Received & Declared */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-b from-emerald-50/40 dark:from-emerald-950/20 to-transparent shadow-sm hover:border-emerald-500 transition-all flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-6 -left-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <HandCoins size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>דיבידנדים שהתקבלו</span>
                </span>
                
                {/* Period Selector Tabs */}
                <div className="flex items-center bg-emerald-100/80 dark:bg-emerald-950/80 p-0.5 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40 text-[10px] font-bold">
                  <button
                    onClick={() => setDividendPeriod('L12M')}
                    className={`px-1.5 py-0.5 rounded transition-all ${dividendPeriod === 'L12M' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-800 dark:text-emerald-300 hover:text-emerald-900'}`}
                    title="12 חודשים אחרונים"
                  >
                    12M
                  </button>
                  <button
                    onClick={() => setDividendPeriod('YTD')}
                    className={`px-1.5 py-0.5 rounded transition-all ${dividendPeriod === 'YTD' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-800 dark:text-emerald-300 hover:text-emerald-900'}`}
                    title="מתחילת השנה הנוכחית"
                  >
                    YTD
                  </button>
                  <button
                    onClick={() => setDividendPeriod('ALL')}
                    className={`px-1.5 py-0.5 rounded transition-all ${dividendPeriod === 'ALL' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-800 dark:text-emerald-300 hover:text-emerald-900'}`}
                    title="סך כל החלוקות בהיסטוריה"
                  >
                    הכל
                  </button>
                </div>
              </div>

              {/* Dynamic Values according to period */}
              {(() => {
                const activeGrossUSD = dividendPeriod === 'L12M' ? analytics.l12mDividendGrossUSD : dividendPeriod === 'YTD' ? analytics.ytdDividendGrossUSD : analytics.allTimeDividendGrossUSD;
                const activeGrossILS = dividendPeriod === 'L12M' ? analytics.l12mDividendGrossILS : dividendPeriod === 'YTD' ? analytics.ytdDividendGrossILS : analytics.allTimeDividendGrossILS;
                const activeNetUSD = dividendPeriod === 'L12M' ? analytics.l12mDividendNetUSD : dividendPeriod === 'YTD' ? analytics.ytdDividendNetUSD : analytics.allTimeDividendNetUSD;
                const activeNetILS = dividendPeriod === 'L12M' ? analytics.l12mDividendNetILS : dividendPeriod === 'YTD' ? analytics.ytdDividendNetILS : analytics.allTimeDividendNetILS;
                const periodLabel = dividendPeriod === 'L12M' ? '12 חודשים' : dividendPeriod === 'YTD' ? 'מתחילת השנה' : 'סך מצטבר';

                return (
                  <div className="space-y-0.5">
                    {taxMode === 'BOTH' ? (
                      <>
                        <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400" dir="ltr">
                          +${Math.round(activeNetUSD).toLocaleString()}
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1.5">
                            (+₪{Math.round(activeNetILS).toLocaleString()} נטו)
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                          ברוטו: +${Math.round(activeGrossUSD).toLocaleString()} (+₪{Math.round(activeGrossILS).toLocaleString()} {periodLabel})
                        </div>
                      </>
                    ) : taxMode === 'GROSS' ? (
                      <>
                        <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400" dir="ltr">
                          +${Math.round(activeGrossUSD).toLocaleString()}
                        </div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                          +₪{Math.round(activeGrossILS).toLocaleString()} ({periodLabel} ברוטו)
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400" dir="ltr">
                          +${Math.round(activeNetUSD).toLocaleString()}
                        </div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                          +₪{Math.round(activeNetILS).toLocaleString()} ({periodLabel} נטו)
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Bottom Action Footer with Modal Button */}
            <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {dividendPeriod === 'L12M' ? `${analytics.portfolioDividendYieldPct.toFixed(2)}% תשואה שנתית` : `${analytics.totalDividendEventsCount || 67} תשלומים`}
              </span>
              <button
                type="button"
                onClick={() => setIsDividendModalOpen(true)}
                className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 bg-emerald-100/70 dark:bg-emerald-900/60 hover:bg-emerald-200/80 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              >
                <History size={12} />
                <span>יומן חלוקות</span>
              </button>
            </div>
          </div>

          {/* Card 4: YTD Added Monthly Household Income */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/40 dark:from-indigo-950/20 to-transparent shadow-sm hover:border-indigo-500 transition-all flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-6 -left-6 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Coins size={14} className="text-indigo-600 dark:text-indigo-400" />
                  תוספת חודשית {taxMode === 'BOTH' ? '(משולב)' : taxMode === 'GROSS' ? '(ברוטו)' : '(נטו)'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300">
                  משק בית
                </span>
              </div>
              <div className="space-y-0.5">
                {taxMode === 'BOTH' ? (
                  <>
                    <div className={`text-2xl font-bold tracking-tight ${analytics.ytdNetMonthlyAvgILS >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                      {analytics.ytdNetMonthlyAvgILS >= 0 ? '+' : ''}₪{Math.round(analytics.ytdNetMonthlyAvgILS).toLocaleString()}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 mr-1">/חודש נטו</span>
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                      ברוטו: +₪{Math.round(analytics.ytdMonthlyAvgILS).toLocaleString()}/חודש (+${Math.round(analytics.ytdMonthlyAvgUSD).toLocaleString()}/mo)
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`text-2xl font-bold tracking-tight ${(taxMode === 'GROSS' ? analytics.ytdMonthlyAvgILS : analytics.ytdNetMonthlyAvgILS) >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                      {(taxMode === 'GROSS' ? analytics.ytdMonthlyAvgILS : analytics.ytdNetMonthlyAvgILS) >= 0 ? '+' : ''}₪{Math.round(taxMode === 'GROSS' ? analytics.ytdMonthlyAvgILS : analytics.ytdNetMonthlyAvgILS).toLocaleString()}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 mr-1">/חודש</span>
                    </div>
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                      {(taxMode === 'GROSS' ? analytics.ytdMonthlyAvgUSD : analytics.ytdNetMonthlyAvgUSD) >= 0 ? '+' : ''}${Math.round(taxMode === 'GROSS' ? analytics.ytdMonthlyAvgUSD : analytics.ytdNetMonthlyAvgUSD).toLocaleString()}/mo
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between text-xs">
              <span className="text-slate-500">רווח נטו השנה:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-300" dir="ltr">
                ₪{Math.round(analytics.ytdNetPnLILS).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Card 5: Total Cost Basis & Capital Gains Tax */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/30 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">סך השקעה מקורית</span>
                <Scale size={18} className="text-blue-500" />
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white" dir="ltr">
                  ${analytics.totalCostUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                  ₪{analytics.totalCostILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">מס רווחי הון (25%):</span>
              <span className="font-bold text-rose-500 dark:text-rose-400" dir="ltr">
                -₪{analytics.totalTaxILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Card 6: Alpha vs S&P 500 (VOO Benchmark) */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-violet-500/30 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">אלפא מול S&P 500</span>
                <Sparkles size={18} className="text-violet-500" />
              </div>
              <div className="space-y-0.5">
                <div className={`text-2xl font-bold tracking-tight ${analytics.alphaVsBenchmark >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-amber-500'}`} dir="ltr">
                  {analytics.alphaVsBenchmark >= 0 ? '+' : ''}{analytics.alphaVsBenchmark.toFixed(2)}%
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {analytics.alphaVsBenchmark >= 0 ? 'עודף על המדד' : 'תת ביצוע מול המדד'}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">תשואה נטו:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                {analytics.totalNetReturnPct >= 0 ? '+' : ''}{analytics.totalNetReturnPct.toFixed(2)}%
              </span>
            </div>
          </div>

        </section>

        {/* ======================================================== */}
        {/* ISRAEL TAX INSIGHTS & REALIZATION SUMMARY PANEL */}
        {/* ======================================================== */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-indigo-500/20 relative overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-5">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-300">
                  <Receipt size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      🇮🇱 חישוב מס רווחי הון בישראל (25% מס בעת מימוש)
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                      ניכוי במקור
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/70 mt-0.5">
                    ניתוח מדויק של שווי התיק, הרווח הנקי ביד לאחר תשלום מס של 25% והתוספת האמיתית לחשבון הבנק
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto bg-indigo-900/60 border border-indigo-700/50 px-3 py-1.5 rounded-xl text-xs text-indigo-200">
                <Landmark size={14} className="text-indigo-400" />
                <span>שיעור מס חוקי: <strong>25%</strong></span>
              </div>
            </div>

            {/* 4 Interactive Tax Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Gross Profit */}
              <div className="bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-2xl border border-white/10">
                <div className="text-xs text-slate-400 mb-1 font-medium">רווח הון ברוטו (לפני מס)</div>
                <div className={`text-xl font-bold ${analytics.totalPnLUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">
                  {analytics.totalPnLUSD >= 0 ? '+' : ''}${analytics.totalPnLUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-400 mt-0.5" dir="ltr">
                  ₪{analytics.totalPnLILS.toLocaleString(undefined, { maximumFractionDigits: 0 })} | תשואה: {analytics.totalReturnPct >= 0 ? '+' : ''}{analytics.totalReturnPct.toFixed(2)}%
                </div>
              </div>

              {/* Tax Deduction 25% */}
              <div className="bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-2xl border border-rose-500/20">
                <div className="text-xs text-rose-300/80 mb-1 font-medium">ניכוי מס רווחי הון (25%)</div>
                <div className="text-xl font-bold text-rose-400" dir="ltr">
                  -${analytics.totalTaxUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-rose-300/70 mt-0.5" dir="ltr">
                  -₪{analytics.totalTaxILS.toLocaleString(undefined, { maximumFractionDigits: 0 })} (הערכת מס למימוש)
                </div>
              </div>

              {/* Net Profit to Pocket */}
              <div className="bg-emerald-950/40 hover:bg-emerald-950/60 transition-colors p-4 rounded-2xl border border-emerald-500/30">
                <div className="text-xs text-emerald-300 mb-1 font-medium">רווח הון נקי ביד (נטו)</div>
                <div className="text-xl font-bold text-emerald-400" dir="ltr">
                  {analytics.totalNetPnLUSD >= 0 ? '+' : ''}${analytics.totalNetPnLUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-emerald-300/80 mt-0.5" dir="ltr">
                  +₪{analytics.totalNetPnLILS.toLocaleString(undefined, { maximumFractionDigits: 0 })} | תשואה נטו: +{analytics.totalNetReturnPct.toFixed(2)}%
                </div>
              </div>

              {/* Net Cashout Portfolio Value */}
              <div className="bg-indigo-900/40 hover:bg-indigo-900/60 transition-colors p-4 rounded-2xl border border-indigo-400/30">
                <div className="text-xs text-indigo-300 mb-1 font-medium">שווי משיכה נטו לבנק (Cash Out)</div>
                <div className="text-xl font-bold text-white" dir="ltr">
                  ${analytics.netPortfolioTotalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-indigo-300/80 mt-0.5" dir="ltr">
                  ₪{analytics.netPortfolioTotalILS.toLocaleString(undefined, { maximumFractionDigits: 0 })} (לאחר ניכוי מס מלא)
                </div>
              </div>

            </div>

            {/* Bottom Income Tip */}
            <div className="pt-2 text-xs text-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                💡 <strong>תוספת חודשית נטו למשק הבית:</strong> התיק מייצר בממוצע <span className="text-emerald-300 font-bold">₪{Math.round(analytics.ytdNetMonthlyAvgILS).toLocaleString()} נקי בכל חודש</span> שנכנס ישירות לתקציב המשפחה (לאחר תשלום ₪{Math.round(analytics.ytdMonthlyAvgILS - analytics.ytdNetMonthlyAvgILS).toLocaleString()} מס חודשי משוער).
              </div>
              <div className="text-[11px] text-indigo-300/70 whitespace-nowrap">
                * החישוב מבוסס על מס נומינלי בשיעור 25% לפי פקודת מס הכנסה בישראל
              </div>
            </div>

          </div>
        </section>

        {/* ======================================================== */}
        {/* 2. ADVANCED INTERACTIVE CHART SUITE (MULTI-CHART WORKBENCH) */}
        {/* ======================================================== */}
        <section className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          
          {/* Chart Header & Mode Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            
            {/* Chart Type Selector */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <button
                onClick={() => setActiveChart('performance')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeChart === 'performance'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Activity size={15} />
                <span>שווי ותשואה היסטורית</span>
              </button>

              <button
                onClick={() => setActiveChart('benchmark')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeChart === 'benchmark'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles size={15} />
                <span>השוואה למדד S&P 500</span>
              </button>

              <button
                onClick={() => setActiveChart('pnlContribution')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeChart === 'pnlContribution'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 size={15} />
                <span>תרומת רווח/הפסד לנכס</span>
              </button>

              <button
                onClick={() => setActiveChart('costVsValue')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeChart === 'costVsValue'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Scale size={15} />
                <span>עלות קנייה מול שווי שוק</span>
              </button>

              <button
                onClick={() => setActiveChart('monthly')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeChart === 'monthly'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Percent size={15} />
                <span>רווח חודשי (Monthly P&L)</span>
              </button>
            </div>

            {/* Timeframe Controls (for historical charts) */}
            {(activeChart === 'performance' || activeChart === 'benchmark') && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 self-start lg:self-auto">
                {(['7D', '30D', '90D', 'ALL'] as TimeRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      timeRange === r
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {r === 'ALL' ? 'הכל' : r}
                  </button>
                ))}
              </div>
            )}

          </div>

          {/* Chart Display Area */}
          <div className="h-[420px] w-full" style={{ touchAction: 'pan-y' }}>
            <ResponsiveContainer width="100%" height="100%">
              
              {/* 1. Performance Chart (Area with gradients) */}
              {activeChart === 'performance' && (
                <AreaChart data={analytics.chartHistoryData}>
                  <defs>
                    <linearGradient id="colorTotalUSD" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                  <XAxis
                    dataKey="timestamp"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}
                    minTickGap={25}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}
                    tickFormatter={(val) => currencyMode === 'ILS' ? `₪${(val * usdToIls).toLocaleString()}` : `$${val.toLocaleString()}`}
                    domain={['auto', 'auto']}
                    orientation="right"
                  />
                  <Tooltip
                    contentStyle={tooltipStyles}
                    formatter={(value: any, _name: any, props: any) => {
                      const num = Number(value) || 0;
                      const ilsVal = props?.payload?.totalILS || (num * usdToIls);
                      const returnPct = props?.payload?.returnPct || 0;
                      return [
                        <div key="val" className="space-y-1" dir="ltr">
                          <div className="font-bold text-base text-indigo-500">${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-xs text-slate-400">₪{ilsVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div className={`text-xs font-semibold ${returnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            תשואה כוללת: {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                          </div>
                        </div>,
                        'שווי תיק'
                      ];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalUSD"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorTotalUSD)"
                  />
                </AreaChart>
              )}

              {/* 2. Benchmark Comparison (Multi-Line Chart: Portfolio Return vs VOO Return) */}
              {activeChart === 'benchmark' && (
                <LineChart data={analytics.benchmarkComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                  <XAxis
                    dataKey="timestamp"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}
                    minTickGap={25}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}
                    tickFormatter={(val) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`}
                    orientation="right"
                  />
                  <Tooltip
                    contentStyle={tooltipStyles}
                    formatter={(value: any, name: any) => {
                      const num = Number(value) || 0;
                      const label = name === 'portfolioReturn' ? 'תשואת התיק שלך' : 'תשואת S&P 500 (VOO)';
                      return [`${num >= 0 ? '+' : ''}${num.toFixed(2)}%`, label];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '16px', fontSize: '13px' }}
                    formatter={(val) => val === 'portfolioReturn' ? 'התיק שלך' : 'מדד הייחוס (S&P 500 / VOO)'}
                  />
                  <ReferenceLine y={0} stroke={darkMode ? '#475569' : '#cbd5e1'} strokeDasharray="2 2" />
                  <Line
                    type="monotone"
                    dataKey="portfolioReturn"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmarkReturn"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              )}

              {/* 3. P&L Contribution by Asset (Horizontal / Vertical Bar Chart) */}
              {activeChart === 'pnlContribution' && (
                <BarChart data={analytics.pnlContributionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}
                    tickFormatter={(val) => `$${val.toLocaleString()}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="ticker"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#e2e8f0' : '#334155', fontWeight: 600, fontSize: 13 }}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={tooltipStyles}
                    formatter={(value: any, _name: any, props: any) => {
                      const num = Number(value) || 0;
                      return [
                        <div key="pnl" dir="ltr">
                          <div className={`font-bold ${num >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {num >= 0 ? '+' : ''}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-xs text-slate-400 ml-2">(₪{(num * usdToIls).toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">תשואת הפוזיציה: {props.payload.returnPct >= 0 ? '+' : ''}{props.payload.returnPct.toFixed(2)}%</div>
                        </div>,
                        props.payload.name
                      ];
                    }}
                  />
                  <ReferenceLine x={0} stroke={darkMode ? '#475569' : '#cbd5e1'} />
                  <Bar dataKey="pnlUSD" radius={[0, 6, 6, 0]}>
                    {analytics.pnlContributionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isPositive ? (darkMode ? '#10b981' : '#059669') : (darkMode ? '#f43f5e' : '#e11d48')}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}

              {/* 4. Cost Basis vs Market Value Grouped Bars */}
              {activeChart === 'costVsValue' && (
                <BarChart data={analytics.costVsValueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                  <XAxis
                    dataKey="ticker"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#e2e8f0' : '#334155', fontWeight: 600, fontSize: 13 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}
                    tickFormatter={(val) => `$${val.toLocaleString()}`}
                    orientation="right"
                  />
                  <Tooltip
                    contentStyle={tooltipStyles}
                    formatter={(value: any, name: any) => {
                      const num = Number(value) || 0;
                      const label = name === 'costUSD' ? 'עלות רכישה מקורית' : 'שווי שוק נוכחי';
                      return [
                        `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (₪${(num * usdToIls).toLocaleString(undefined, { maximumFractionDigits: 0 })})`,
                        label
                      ];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '16px', fontSize: '13px' }}
                    formatter={(val) => val === 'costUSD' ? 'עלות רכישה מקורית ($)' : 'שווי שוק נוכחי ($)'}
                  />
                  <Bar dataKey="costUSD" fill={darkMode ? '#475569' : '#94a3b8'} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="valueUSD" fill={darkMode ? '#6366f1' : '#4f46e5'} radius={[4, 4, 0, 0]} />
                </BarChart>
              )}

              {/* 5. Monthly P&L Bars */}
              {activeChart === 'monthly' && (
                <BarChart data={analytics.monthlyPnLData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                  <XAxis
                    dataKey="monthLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}
                    tickFormatter={(val) => `$${val.toLocaleString()}`}
                    orientation="right"
                  />
                  <Tooltip
                    contentStyle={tooltipStyles}
                    formatter={(value: any, _name: any, props: any) => {
                      const num = Number(value) || 0;
                      return [
                        <div key="m" dir="ltr">
                          <div className={`font-bold ${props.payload.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {props.payload.isPositive ? '+' : '-'}${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-xs text-slate-400 ml-2">(₪{Math.abs(props.payload.pnlILS).toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">שינוי חודשי: {props.payload.pnlPct >= 0 ? '+' : ''}{props.payload.pnlPct.toFixed(2)}%</div>
                        </div>,
                        'רווח/הפסד חודשי'
                      ];
                    }}
                  />
                  <ReferenceLine y={0} stroke={darkMode ? '#475569' : '#cbd5e1'} />
                  <Bar dataKey="pnlUSD" radius={[6, 6, 0, 0]}>
                    {analytics.monthlyPnLData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isPositive ? (darkMode ? '#10b981' : '#059669') : (darkMode ? '#f43f5e' : '#e11d48')}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}

            </ResponsiveContainer>
          </div>

        </section>

        {/* ======================================================== */}
        {/* 3. CALENDAR MONTHLY HOUSEHOLD INCOME BREAKDOWN (INTERACTIVE) */}
        {/* ======================================================== */}
        <section className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          
          {/* Section Header with Controls */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 pb-5 border-b border-slate-100 dark:border-slate-800">
            
            {/* Title & Description */}
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl text-white shadow-md shadow-indigo-500/20 shrink-0">
                <Wallet size={24} className="stroke-[2.2]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    תוספת להכנסת משק הבית – חלוקה לפי חודש קלנדרי
                  </h2>
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                    הכנסה פסיבית
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  בחר טווח זמן אינטראקטיבי לניתוח כמה הניב התיק בכל חודש ומה ממוצע התוספת לתקציב משק הבית ({analytics.activePeriodTitle})
                </p>
              </div>
            </div>

            {/* Interactive Period Toolbar & Quick Summary Pill */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start xl:self-auto w-full xl:w-auto">
              
              {/* Period Segmented Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setMonthlyPeriod('YTD')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    monthlyPeriod === 'YTD'
                      ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles size={13} className={monthlyPeriod === 'YTD' ? 'text-indigo-500 dark:text-indigo-200' : ''} />
                  מתחילת השנה (YTD)
                </button>

                {/* Specific Years Buttons */}
                {analytics.availableMonthlyYears.map(yr => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => {
                      setSelectedMonthlyYear(yr);
                      setMonthlyPeriod('YEAR');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      monthlyPeriod === 'YEAR' && selectedMonthlyYear === yr
                        ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    שנת {yr}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setMonthlyPeriod('L12M')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    monthlyPeriod === 'L12M'
                      ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  12 חודשים אחרונים
                </button>

                <button
                  type="button"
                  onClick={() => setMonthlyPeriod('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    monthlyPeriod === 'ALL'
                      ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  כל הזמנים
                </button>
              </div>

              {/* Quick Summary Pill Badge */}
              <div className="flex items-center justify-between sm:justify-end gap-3 bg-indigo-50/80 dark:bg-indigo-950/50 px-4 py-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-800/60 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {taxMode === 'GROSS' ? 'ממוצע ברוטו:' : 'ממוצע נטו לכיס:'}
                  </div>
                  <div className="text-base font-bold text-indigo-600 dark:text-indigo-400" dir="ltr">
                    +₪{Math.round(taxMode === 'GROSS' ? analytics.activePeriodMonthlyAvgILS : analytics.activePeriodNetMonthlyAvgILS).toLocaleString()} <span className="text-[10px] font-normal text-slate-400">/חודש</span>
                  </div>
                </div>
                <div className="h-7 w-px bg-indigo-200 dark:bg-indigo-800/60" />
                <div className="text-right">
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {taxMode === 'GROSS' ? 'סה"כ רווח ברוטו:' : 'סה"כ רווח נטו:'}
                  </div>
                  <div className={`text-base font-bold ${(taxMode === 'GROSS' ? analytics.activePeriodTotalGainILS : analytics.activePeriodNetTotalGainILS) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                    {(taxMode === 'GROSS' ? analytics.activePeriodTotalGainILS : analytics.activePeriodNetTotalGainILS) >= 0 ? '+' : ''}₪{Math.round(taxMode === 'GROSS' ? analytics.activePeriodTotalGainILS : analytics.activePeriodNetTotalGainILS).toLocaleString()}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 4 Summary Highlight KPI Badges for Active Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">תוספת חודשית נטו (מס 25%)</span>
                <span className={`text-xl font-bold ${analytics.activePeriodNetMonthlyAvgILS >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                  {analytics.activePeriodNetMonthlyAvgILS >= 0 ? '+' : ''}₪{Math.round(analytics.activePeriodNetMonthlyAvgILS).toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 block" dir="ltr">
                  (ברוטו: ₪{Math.round(analytics.activePeriodMonthlyAvgILS).toLocaleString()}/חודש)
                </span>
              </div>
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-xl text-indigo-600 dark:text-indigo-300">
                <Coins size={20} />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">רווח נקי שנצבר ({analytics.activePeriodMonthsCount} חודשים)</span>
                <span className={`text-xl font-bold ${analytics.activePeriodNetTotalGainILS >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                  {analytics.activePeriodNetTotalGainILS >= 0 ? '+' : ''}₪{Math.round(analytics.activePeriodNetTotalGainILS).toLocaleString()}
                </span>
                <span className="text-[11px] text-rose-500 dark:text-rose-400 block font-medium" dir="ltr">
                  (מס: -₪{Math.round(analytics.activePeriodTaxILS).toLocaleString()})
                </span>
              </div>
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/60 rounded-xl text-emerald-600 dark:text-emerald-300">
                <TrendingUp size={20} />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">חודש השיא בתקופה זו</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {analytics.bestMonthYTD ? `${analytics.bestMonthYTD.monthName} ${analytics.bestMonthYTD.year}` : '–'}
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-semibold" dir="ltr">
                  נטו: +₪{Math.round(analytics.bestMonthYTD?.monthNetGainILS || 0).toLocaleString()} (ברוטו: +₪{Math.round(analytics.bestMonthYTD?.monthGainILS || 0).toLocaleString()})
                </span>
              </div>
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-600 dark:text-amber-300">
                <Sparkles size={20} />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">חודשים חיוביים בתקופה</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {analytics.positiveMonthsCount} מתוך {analytics.activePeriodMonthsCount}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  {Math.round((analytics.positiveMonthsCount / (analytics.activePeriodMonthsCount || 1)) * 100)}% חודשים ברווח
                </span>
              </div>
              <div className="p-2.5 bg-violet-100 dark:bg-violet-900/60 rounded-xl text-violet-600 dark:text-violet-300">
                <CalendarDays size={20} />
              </div>
            </div>

          </div>

          {/* Calendar Months Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {analytics.calendarMonthlyList.map((month) => {
              const maxAbsGain = Math.max(...analytics.calendarMonthlyList.map(m => Math.abs(m.monthGainUSD)), 1);
              const barPercent = Math.min(100, Math.round((Math.abs(month.monthGainUSD) / maxAbsGain) * 100));

              return (
                <div
                  key={month.monthKey}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    month.isCurrentMonth
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 shadow-sm'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {/* Card Header: Month Name + Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={15} className={month.isCurrentMonth ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {month.monthName} {month.year}
                      </span>
                    </div>
                    {month.isCurrentMonth ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-full">
                        נוכחי
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                        חודש {month.monthIndex}
                      </span>
                    )}
                  </div>

                  {/* Monthly Added Gain / Loss */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>תוספת נטו (מס 25%):</span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {month.isPositive ? `מס: -₪${Math.round(month.monthTaxILS).toLocaleString()}` : 'ללא מס'}
                      </span>
                    </div>
                    <div className={`text-xl font-extrabold tracking-tight ${month.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                      {month.isPositive ? '+' : '-'}₪{Math.abs(Math.round(taxMode === 'GROSS' ? month.monthGainILS : month.monthNetGainILS)).toLocaleString()}
                      <span className="text-xs font-medium text-slate-400 ml-1.5">
                        ({month.isPositive ? '+' : '-'}${Math.abs(Math.round(taxMode === 'GROSS' ? month.monthGainUSD : month.monthNetGainUSD)).toLocaleString()})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between" dir="ltr">
                      <span>ברוטו: {month.isPositive ? '+' : '-'}₪{Math.abs(Math.round(month.monthGainILS)).toLocaleString()}</span>
                      <span>נטו: {month.isPositive ? '+' : '-'}₪{Math.abs(Math.round(month.monthNetGainILS)).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${month.isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${barPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Cumulative and Average Footnote in Card */}
                  <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700/60 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>מצטבר נטו לתקופה:</span>
                      <span className={`font-semibold ${month.cumulativeNetYTDILS >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                        {month.cumulativeNetYTDILS >= 0 ? '+' : ''}₪{Math.round(month.cumulativeNetYTDILS).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>ממוצע נטו עד חודש זה:</span>
                      <span className={`font-bold ${month.runningNetMonthlyAvgILS >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`} dir="ltr">
                        {month.runningNetMonthlyAvgILS >= 0 ? '+' : ''}₪{Math.round(month.runningNetMonthlyAvgILS).toLocaleString()}/חודש
                      </span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Practical Calculation Footnote */}
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-3">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/80 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
              <Coins size={16} />
            </div>
            <div className="leading-relaxed">
              <strong>הסבר חישוב תוספת להכנסה חודשית נטו למשק הבית:</strong> עבור <strong>{analytics.activePeriodSubtitle}</strong>, תיק ההשקעות ייצר רווח הון ברוטו של <span className={`font-bold ${analytics.activePeriodTotalGainILS >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{analytics.activePeriodTotalGainILS >= 0 ? '+' : ''}₪{Math.round(analytics.activePeriodTotalGainILS).toLocaleString()}</span>. לאחר ניכוי <strong>25% מס רווחי הון בישראל (₪{Math.round(analytics.activePeriodTaxILS).toLocaleString()})</strong>, נותר רווח נקי של <span className="font-bold text-emerald-600 dark:text-emerald-400">₪{Math.round(analytics.activePeriodNetTotalGainILS).toLocaleString()}</span>. בחלוקה ל-<strong>{analytics.activePeriodMonthsCount} חודשים</strong>, התיק מוסיף בממוצע <span className="font-bold text-indigo-600 dark:text-indigo-400">₪{Math.round(analytics.activePeriodNetMonthlyAvgILS).toLocaleString()} נטו בכל חודש</span> ישירות לחשבון הבנק.
            </div>
          </div>

        </section>

        {/* ======================================================== */}
        {/* 4. ALLOCATION & SECTOR DIVERSIFICATION GRID */}
        {/* ======================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Asset Allocation Donut */}
          <div className="bg-white dark:bg-[#111827] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <PieChartIcon size={18} className="text-indigo-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white">משקל והקצאת נכסים</h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {analytics.sortedHoldings.length} מניות
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">התפלגות שווי השוק היחסי של כל נכס בתיק</p>
            </div>

            <div className="h-[260px] w-full" style={{ touchAction: 'pan-y' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.sortedHoldings}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="valueUSD"
                    nameKey="ticker"
                    stroke={darkMode ? '#111827' : '#ffffff'}
                    strokeWidth={2}
                  >
                    {analytics.sortedHoldings.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyles}
                    formatter={(value: any, name: any, props: any) => {
                      const num = Number(value) || 0;
                      return [
                        `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${props.payload.weight.toFixed(1)}%)`,
                        name
                      ];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Quick allocation badges */}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              {analytics.sortedHoldings.slice(0, 4).map((h, idx) => (
                <div key={h.ticker} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                    <span>{h.ticker}</span>
                  </div>
                  <span className="text-slate-500 font-medium" dir="ltr">{h.weight.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sector Breakdown & Risk Exposure */}
          <div className="bg-white dark:bg-[#111827] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-indigo-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white">חשיפה סקטוריאלית</h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {analytics.sectorAllocation.length} סקטורים
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">פיזור לפי תחומי פעילות וענפי משק</p>
            </div>

            {/* Progress Bars by Sector */}
            <div className="space-y-3.5 my-auto py-2">
              {analytics.sectorAllocation.map((sec) => (
                <div key={sec.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{sec.name}</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400" dir="ltr">
                      {sec.percentage.toFixed(1)}% (${(sec.valueUSD / 1000).toFixed(1)}k)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${sec.percentage}%`, backgroundColor: sec.color }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
              💡 טיפ מקצועי: חשיפה של מעל 60% לסקטור הטכנולוגיה מגבירה את רמת התנודתיות (Beta) ביחס לשוק הרחב.
            </div>
          </div>

        </section>

        {/* ======================================================== */}
        {/* 5. ADVANCED HOLDINGS MATRIX (DATA TABLE) */}
        {/* ======================================================== */}
        <section className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          
          {/* Table Header & Search Filter Toolbar */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            <div>
              <div className="flex items-center gap-2">
                <Briefcase size={20} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">פירוט החזקות וניתוח מעמיק</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">מידע מפורט על מחירי רכישה, שווי שוק, תשואות ומשקולות</p>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Search Bar */}
              <div className="relative">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="חיפוש לפי סימול / שם..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9 pl-4 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white w-48 sm:w-56"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${filterType === 'ALL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  הכל
                </button>
                <button
                  onClick={() => setFilterType('PROFIT')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${filterType === 'PROFIT' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  רווחיים 🟢
                </button>
                <button
                  onClick={() => setFilterType('LOSS')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${filterType === 'LOSS' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  בהפסד 🔴
                </button>
              </div>

            </div>

          </div>

          {/* Table Element */}
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3.5 px-5 text-start cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('name')}>
                    נכס / חברה <SortIcon columnKey="name" />
                  </th>
                  <th className="py-3.5 px-4 text-start cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('weight')}>
                    משקל בתיק <SortIcon columnKey="weight" />
                  </th>
                  <th className="py-3.5 px-4 text-start cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('amount')}>
                    כמות מניות <SortIcon columnKey="amount" />
                  </th>
                  <th className="py-3.5 px-4 text-start cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('avg_price')}>
                    מחיר רכישה ממוצע <SortIcon columnKey="avg_price" />
                  </th>
                  <th className="py-3.5 px-4 text-start cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('current_price')}>
                    מחיר שוק נוכחי <SortIcon columnKey="current_price" />
                  </th>
                  <th className="py-3.5 px-4 text-start cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('valueUSD')}>
                    שווי שוק כולל <SortIcon columnKey="valueUSD" />
                  </th>
                  <th className="py-3.5 px-4 text-start cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('annualDividendUSD')}>
                    דיבידנד שנתי <SortIcon columnKey="annualDividendUSD" />
                  </th>
                  <th className="py-3.5 px-4 text-start cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('pnlUSD')}>
                    רווח/הפסד {taxMode === 'BOTH' ? '(נטו וברוטו)' : taxMode === 'GROSS' ? '(ברוטו)' : '(נטו מס 25%)'} <SortIcon columnKey="pnlUSD" />
                  </th>
                  <th className="py-3.5 px-5 text-end cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('returnPct')}>
                    תשואה כוללת <SortIcon columnKey="returnPct" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {filteredHoldings.map((asset, i) => {
                  const isPositive = asset.returnPct >= 0;
                  const displayPnLUSD = taxMode === 'GROSS' ? asset.pnlUSD : asset.pnlNetUSD;
                  const displayPnLILS = taxMode === 'GROSS' ? asset.pnlILS : asset.pnlNetILS;

                  return (
                    <tr key={asset.ticker} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                      
                      {/* Ticker & Name */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                            {asset.ticker.substring(0, 3)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{asset.ticker}</span>
                              <span className="text-[11px] font-normal px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {asset.sector}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{asset.name}</div>
                          </div>
                        </div>
                      </td>

                      {/* Weight % with mini progress bar */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-800 dark:text-slate-200" dir="ltr">{asset.weight.toFixed(1)}%</div>
                          <div className="w-16 bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, asset.weight * 2.5)}%` }}></div>
                          </div>
                        </div>
                      </td>

                      {/* Shares Amount */}
                      <td className="py-4 px-4 font-semibold text-slate-800 dark:text-slate-200" dir="ltr">
                        {asset.amount}
                      </td>

                      {/* Avg Cost */}
                      <td className="py-4 px-4">
                        {formatMoney(asset.avg_price, asset.avg_price * usdToIls)}
                      </td>

                      {/* Current Price & Daily Delta */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          {formatMoney(asset.current_price, asset.current_price * usdToIls)}
                          <div className={`text-[11px] font-semibold flex items-center gap-0.5 ${asset.dailyChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                            {asset.dailyChangePct >= 0 ? '+' : ''}{asset.dailyChangePct.toFixed(2)}% היום
                          </div>
                        </div>
                      </td>

                      {/* Market Value */}
                      <td className="py-4 px-4 font-bold">
                        {formatMoney(asset.valueUSD, asset.valueILS)}
                      </td>

                      {/* Annual Dividend & Yield */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5" dir="ltr">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">
                            ${Math.round(asset.annualDividendUSD).toLocaleString()}
                            <span className="text-[11px] font-semibold text-slate-400 ml-1">
                              (₪{Math.round(asset.annualDividendILS).toLocaleString()})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="font-semibold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              {asset.dividendYield.toFixed(2)}% תשואה
                            </span>
                            <span>•</span>
                            <span>נטו: ${Math.round(asset.annualDividendNetUSD).toLocaleString()}</span>
                          </div>
                        </div>
                      </td>

                      {/* P&L with Israeli Tax 25% breakdown */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5" dir="ltr">
                          <div className={`font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isPositive ? '+' : '-'}${Math.abs(displayPnLUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-[11px] font-semibold text-slate-400 ml-1.5">
                              ({isPositive ? '+' : '-'}₪{Math.abs(displayPnLILS).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            {isPositive ? (
                              <>
                                <span>מס: -${asset.taxUSD.toFixed(1)}</span>
                                <span>•</span>
                                <span>ברוטו: +${asset.pnlUSD.toFixed(1)}</span>
                              </>
                            ) : (
                              <span>הפסד ללא מס</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Return % Badge (Net and Gross) */}
                      <td className="py-4 px-5 text-end" dir="ltr">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isPositive
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                          }`}>
                            {taxMode === 'GROSS'
                              ? `${isPositive ? '+' : ''}${asset.returnPct.toFixed(2)}%`
                              : `נטו: ${isPositive ? '+' : ''}${asset.returnNetPct.toFixed(2)}%`
                            }
                          </span>
                          {taxMode !== 'GROSS' && (
                            <span className="text-[10px] text-slate-400">
                              ברוטו: {isPositive ? '+' : ''}{asset.returnPct.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredHoldings.length === 0 && (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
              לא נמצאו נכסים התואמים את החיפוש או הסינון שנבחרו.
            </div>
          )}

        </section>

      </main>

      {/* Professional Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] py-6 mt-12 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span>לוח מעקב והשקעות כמותי | מבוסס נתוני זמן אמת וחישוב שער ברוקר דינמי</span>
          </div>
          <div className="flex items-center gap-4">
            <span>מעודכן לשער דולר/שקל: ₪{usdToIls.toFixed(3)}</span>
            <span>•</span>
            <span>Auto-Updated via GitHub Actions</span>
          </div>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* DIVIDEND HISTORY LEDGER MODAL */}
      {/* ======================================================== */}
      {isDividendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <HandCoins size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>יומן חלוקות דיבידנדים בפועל</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      היסטוריה אמיתית ומדויקת
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    פירוט מלא של כל תשלומי הדיבידנד שהתקבלו או הוכרזו לחשבון, מחושבים לפי כמות המניות וניכוי מס 25%
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDividendModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="סגור חלון"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content / Filters & Summary */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
              
              {/* Ticker Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">סינון לפי נייר:</span>
                <button
                  onClick={() => setDividendTickerFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    dividendTickerFilter === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  כל הנכסים ({dividendsData?.events?.length || 0})
                </button>
                {portfolio && Object.keys(portfolio).map(ticker => {
                  const tickerEvents = (dividendsData?.events || []).filter(e => e.ticker === ticker);
                  if (tickerEvents.length === 0) return null;
                  return (
                    <button
                      key={ticker}
                      onClick={() => setDividendTickerFilter(ticker)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        dividendTickerFilter === ticker
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>{ticker}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${dividendTickerFilter === ticker ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        {tickerEvents.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Summary Cards */}
              {(() => {
                const eventsToDisplay = (dividendsData?.events || []).filter(e => dividendTickerFilter === 'ALL' || e.ticker === dividendTickerFilter);
                const sumGrossUSD = eventsToDisplay.reduce((acc, e) => acc + e.grossUSD, 0);
                const sumGrossILS = eventsToDisplay.reduce((acc, e) => acc + e.grossILS, 0);
                const sumTaxUSD = eventsToDisplay.reduce((acc, e) => acc + e.taxUSD, 0);
                const sumTaxILS = eventsToDisplay.reduce((acc, e) => acc + e.taxILS, 0);
                const sumNetUSD = eventsToDisplay.reduce((acc, e) => acc + e.netUSD, 0);
                const sumNetILS = eventsToDisplay.reduce((acc, e) => acc + e.netILS, 0);

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                      <div className="text-xs text-slate-500 dark:text-slate-400">סך נטו שהתקבל</div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5" dir="ltr">
                        ${sumNetUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                        ₪{sumNetILS.toLocaleString(undefined, { maximumFractionDigits: 0 })} נטו
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                      <div className="text-xs text-slate-500 dark:text-slate-400">סך ברוטו שהוכרז</div>
                      <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5" dir="ltr">
                        ${sumGrossUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                        ₪{sumGrossILS.toLocaleString(undefined, { maximumFractionDigits: 0 })} ברוטו
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                      <div className="text-xs text-rose-500 dark:text-rose-400 font-medium">ניכוי מס 25% במקור</div>
                      <div className="text-lg font-bold text-rose-500 dark:text-rose-400 mt-0.5" dir="ltr">
                        -${sumTaxUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-rose-400/80" dir="ltr">
                        -₪{sumTaxILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                      <div className="text-xs text-slate-500 dark:text-slate-400">אירועי חלוקה</div>
                      <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {eventsToDisplay.length} תשלומים
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {dividendTickerFilter === 'ALL' ? 'כלל התיק' : `במניית ${dividendTickerFilter}`}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Events Ledger Table */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const eventsToDisplay = (dividendsData?.events || []).filter(e => dividendTickerFilter === 'ALL' || e.ticker === dividendTickerFilter);
                if (eventsToDisplay.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                      לא נמצאו נתוני דיבידנד עבור הסינון שנבחר.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-start border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold border-b border-slate-200 dark:border-slate-800">
                          <th className="py-3 px-4 text-start">תאריך חלוקה</th>
                          <th className="py-3 px-4 text-start">נייר ערך</th>
                          <th className="py-3 px-4 text-start">כמות מניות</th>
                          <th className="py-3 px-4 text-start">דיבידנד למניה</th>
                          <th className="py-3 px-4 text-start">ברוטו (לפני מס)</th>
                          <th className="py-3 px-4 text-start">ניכוי מס 25%</th>
                          <th className="py-3 px-4 text-start">נטו לחשבון</th>
                          <th className="py-3 px-4 text-end">סטטוס</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        {eventsToDisplay.map((event) => {
                          const meta = ASSET_META[event.ticker] || { name: event.ticker };
                          const formattedDate = new Date(event.date).toLocaleDateString('he-IL', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          });

                          return (
                            <tr key={event.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                              
                              {/* Date */}
                              <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formattedDate}
                              </td>

                              {/* Asset Ticker */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-white">{event.ticker}</span>
                                  <span className="text-xs text-slate-400 hidden sm:inline">({meta.name})</span>
                                </div>
                              </td>

                              {/* Shares Count */}
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium" dir="ltr">
                                {event.shares} יח'
                              </td>

                              {/* Dividend Per Share */}
                              <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200" dir="ltr">
                                ${event.dividendPerShare.toFixed(4)}
                              </td>

                              {/* Gross Total */}
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900 dark:text-slate-100" dir="ltr">
                                  +${event.grossUSD.toFixed(2)}
                                </div>
                                <div className="text-[11px] text-slate-400" dir="ltr">
                                  +₪{event.grossILS.toFixed(1)}
                                </div>
                              </td>

                              {/* Tax Deduction 25% */}
                              <td className="py-3 px-4">
                                <div className="font-semibold text-rose-500 dark:text-rose-400" dir="ltr">
                                  -${event.taxUSD.toFixed(2)}
                                </div>
                                <div className="text-[11px] text-rose-400/80" dir="ltr">
                                  -₪{event.taxILS.toFixed(1)}
                                </div>
                              </td>

                              {/* Net Total */}
                              <td className="py-3 px-4">
                                <div className="font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                                  +${event.netUSD.toFixed(2)}
                                </div>
                                <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80" dir="ltr">
                                  +₪{event.netILS.toFixed(1)}
                                </div>
                              </td>

                              {/* Status Badge */}
                              <td className="py-3 px-4 text-end">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                  <CheckCircle2 size={11} />
                                  <span>שולם</span>
                                </span>
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div>
                <span>נתונים נאספו היסטורית באמצעות פיד הנתונים של שוק ההון ומעודכנים לפי שער הדולר</span>
              </div>
              <button
                onClick={() => setIsDividendModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors cursor-pointer"
              >
                סגור
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default App;
