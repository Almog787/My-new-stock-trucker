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
  TrendingDown,
  DollarSign,
  PieChart as PieChartIcon,
  Activity,
  BarChart3,
  Moon,
  Sun,
  ArrowUp,
  ArrowDown,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Percent,
  Briefcase,
  Scale,
  Search,
  Zap,
  Globe
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

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316', '#3b82f6'];

// Metadata for companies to provide deeper insights
const ASSET_META: { [ticker: string]: { name: string; sector: string; type: 'Stock' | 'ETF'; note: string } } = {
  GOOGL: { name: 'Alphabet (Google)', sector: 'טכנולוגיה ותוכנה', type: 'Stock', note: 'ענקית חיפוש, פרסום דיגיטלי ושירותי ענן' },
  NVDA: { name: 'NVIDIA Corp', sector: 'מוליכים למחצה ושבבים', type: 'Stock', note: 'מובילת שבבים גרפיים, מעבדים ומרכזי נתונים' },
  TSLA: { name: 'Tesla Inc', sector: 'רכב חשמלי / אנרגיה', type: 'Stock', note: 'רכבים חשמליים, אנרגיה ורובוטיקה' },
  ASML: { name: 'ASML Holding', sector: 'ציוד מוליכים למחצה', type: 'Stock', note: 'מונופול עולמי במכונות ליתוגרפיה EUV' },
  VOO: { name: 'Vanguard S&P 500', sector: 'מדד ארה"ב (S&P 500)', type: 'ETF', note: 'קרן סל עוקבת אחר 500 החברות הגדולות' },
  XOM: { name: 'Exxon Mobil', sector: 'אנרגיה ונפט', type: 'Stock', note: 'ענקית אנרגיה מסורתית ותשואת דיבידנד' }
};

type SortKey = 'name' | 'amount' | 'avg_price' | 'current_price' | 'valueUSD' | 'pnlUSD' | 'returnPct' | 'weight';
type TimeRange = '7D' | '30D' | '90D' | 'ALL';
type ChartType = 'performance' | 'benchmark' | 'pnlContribution' | 'costVsValue' | 'monthly';

function App() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [usdToIls, setUsdToIls] = useState<number>(3.006);
  const [metaInfo, setMetaInfo] = useState<{ usdIlsRate?: number; lastUpdate?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Controls
  const [activeChart, setActiveChart] = useState<ChartType>('performance');
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'ILS' | 'DUAL'>('DUAL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PROFIT' | 'LOSS'>('ALL');
  const [darkMode, setDarkMode] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'valueUSD', direction: 'desc' });

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
        const [portfolioRes, historyRes, metaRes] = await Promise.all([
          fetch('./data/portfolio.json'),
          fetch('./data/stock_history.json'),
          fetch('./data/meta.json').catch(() => null)
        ]);
        
        const portfolioData = await portfolioRes.json();
        const historyData = await historyRes.json();

        if (metaRes && metaRes.ok) {
          const metaData = await metaRes.json();
          setMetaInfo(metaData);
          if (metaData.usdIlsRate) {
            setUsdToIls(metaData.usdIlsRate);
          }
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
  }, []);

  // Main Calculations Engine
  const analytics = useMemo(() => {
    if (!portfolio || history.length === 0) {
      return {
        portfolioTotalUSD: 0,
        portfolioTotalILS: 0,
        totalCostUSD: 0,
        totalCostILS: 0,
        totalPnLUSD: 0,
        totalPnLILS: 0,
        totalReturnPct: 0,
        dailyPnLUSD: 0,
        dailyPnLILS: 0,
        dailyChangePct: 0,
        sortedHoldings: [],
        chartHistoryData: [],
        benchmarkComparisonData: [],
        pnlContributionData: [],
        costVsValueData: [],
        monthlyPnLData: [],
        sectorAllocation: [],
        topPerformer: null,
        worstPerformer: null,
        concentrationMetric: { topAsset: '', topWeight: 0, hhi: 0, riskLevel: 'מאוזן' },
        alphaVsBenchmark: 0
      };
    }

    const latestSnapshot = history[history.length - 1];
    const previousSnapshot = history.length > 1 ? history[history.length - 2] : history[0];
    const latestPrices = latestSnapshot.prices;
    const previousPrices = previousSnapshot.prices;

    let currentTotalUSD = 0;
    let previousTotalUSD = 0;
    let costTotalUSD = 0;
    
    const holdingsList: any[] = [];
    const sectorMap: { [sector: string]: number } = {};

    Object.entries(portfolio).forEach(([ticker, data]) => {
      const currentPrice = latestPrices[ticker] || data.avg_price;
      const prevPrice = previousPrices[ticker] || currentPrice;
      
      const valueUSD = data.amount * currentPrice;
      const prevValueUSD = data.amount * prevPrice;
      const costBasisUSD = data.amount * data.avg_price;
      const pnlUSD = valueUSD - costBasisUSD;
      const returnPct = ((currentPrice - data.avg_price) / data.avg_price) * 100;
      const dailyAssetChangePct = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
      const dailyAssetPnLUSD = valueUSD - prevValueUSD;

      currentTotalUSD += valueUSD;
      previousTotalUSD += prevValueUSD;
      costTotalUSD += costBasisUSD;

      const meta = ASSET_META[ticker] || { name: ticker, sector: 'אחר', type: 'Stock', note: '' };
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
        pnlILS: pnlUSD * usdToIls,
        returnPct,
        dailyChangePct: dailyAssetChangePct,
        dailyPnLUSD: dailyAssetPnLUSD,
        dailyPnLILS: dailyAssetPnLUSD * usdToIls,
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

    // Daily Grouping of History
    const dailyMap = new Map();
    history.forEach(point => {
      const d = new Date(point.timestamp);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
        timestamp: displayDate,
        rawDate: point.timestamp,
        totalUSD: pointTotal,
        totalILS: pointTotal * historicalRate,
        returnPct: costTotalUSD > 0 ? ((pointTotal - costTotalUSD) / costTotalUSD) * 100 : 0,
        vooPrice,
        rate: historicalRate,
        ...assetValues
      });
    });

    let fullDailyHistory = Array.from(dailyMap.values());

    // Filter by TimeRange
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

    // Monthly Grouping
    const monthlyMap = new Map();
    fullDailyHistory.forEach(point => {
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

    return {
      portfolioTotalUSD: currentTotalUSD,
      portfolioTotalILS: currentTotalUSD * usdToIls,
      totalCostUSD: costTotalUSD,
      totalCostILS: costTotalUSD * usdToIls,
      totalPnLUSD,
      totalPnLILS,
      totalReturnPct,
      dailyPnLUSD,
      dailyPnLILS,
      dailyChangePct,
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
  }, [portfolio, history, sortConfig, usdToIls, timeRange]);

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
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Total Portfolio Value */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">שווי תיק כולל</span>
              <DollarSign size={18} className="text-indigo-500" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white" dir="ltr">
                ${analytics.portfolioTotalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                ₪{analytics.portfolioTotalILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">שינוי יומי:</span>
              <span className={`font-semibold flex items-center gap-0.5 ${analytics.dailyChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                {analytics.dailyChangePct >= 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                {analytics.dailyChangePct >= 0 ? '+' : ''}{analytics.dailyChangePct.toFixed(2)}%
                <span className="text-[11px] opacity-80">(${Math.abs(analytics.dailyPnLUSD).toFixed(0)})</span>
              </span>
            </div>
          </div>

          {/* Card 2: Unrealized P&L & Total Return */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">רווח כולל (P&L)</span>
              <TrendingUp size={18} className="text-emerald-500" />
            </div>
            <div className="space-y-1">
              <div className={`text-2xl font-bold tracking-tight ${analytics.totalPnLUSD >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                {analytics.totalPnLUSD >= 0 ? '+' : ''}${analytics.totalPnLUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-sm font-medium ${analytics.totalPnLUSD >= 0 ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-rose-600/80 dark:text-rose-400/80'}`} dir="ltr">
                {analytics.totalPnLILS >= 0 ? '+' : ''}₪{analytics.totalPnLILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">תשואה כוללת:</span>
              <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${analytics.totalReturnPct >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'}`} dir="ltr">
                {analytics.totalReturnPct >= 0 ? '+' : ''}{analytics.totalReturnPct.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Card 3: Total Cost Basis & Multiplier */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">סך השקעה מקורית</span>
              <Scale size={18} className="text-blue-500" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white" dir="ltr">
                ${analytics.totalCostUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                ₪{analytics.totalCostILS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">מכפיל הון (MOIC):</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {(analytics.portfolioTotalUSD / (analytics.totalCostUSD || 1)).toFixed(2)}x
              </span>
            </div>
          </div>

          {/* Card 4: Alpha vs S&P 500 (VOO Benchmark) */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-violet-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">אלפא מול S&P 500</span>
              <Sparkles size={18} className="text-violet-500" />
            </div>
            <div className="space-y-1">
              <div className={`text-2xl font-bold tracking-tight ${analytics.alphaVsBenchmark >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-amber-500'}`} dir="ltr">
                {analytics.alphaVsBenchmark >= 0 ? '+' : ''}{analytics.alphaVsBenchmark.toFixed(2)}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                התיק הניב {analytics.totalReturnPct.toFixed(1)}% מול {(analytics.totalReturnPct - analytics.alphaVsBenchmark).toFixed(1)}% של ה-S&P 500
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">סטטוס ביצועים:</span>
              <span className="font-bold text-violet-600 dark:text-violet-400">
                {analytics.alphaVsBenchmark >= 0 ? '🏆 מכה את המדד' : 'מפגר אחרי המדד'}
              </span>
            </div>
          </div>

          {/* Card 5: Concentration & Diversification */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">מדד ריכוזיות סיכון</span>
              <ShieldCheck size={18} className="text-amber-500" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>{analytics.concentrationMetric.riskLevel}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                נכס מוביל: <strong className="text-slate-700 dark:text-slate-300">{analytics.concentrationMetric.topAsset}</strong> ({analytics.concentrationMetric.topWeight.toFixed(1)}%)
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">נכסים פעילים:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {analytics.sortedHoldings.length} פוזיציות
              </span>
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
        {/* 3. ALLOCATION & SECTOR DIVERSIFICATION GRID */}
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

          {/* Actionable Executive Insights Panel */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-3xl border border-indigo-700/40 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Zap size={140} />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={20} className="text-amber-400" />
                <h3 className="font-bold text-lg text-white">מסקנות ותובנות ניהוליות</h3>
              </div>
              <p className="text-xs text-indigo-200 mb-4">תקציר ניתוח כמותי לקבלת החלטות השקעה</p>
            </div>

            <div className="space-y-3 relative z-10 text-xs">
              
              {/* Insight 1: Alpha */}
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                  <TrendingUp size={14} />
                  <span>עודף תשואה (Alpha) חיובי: +{analytics.alphaVsBenchmark.toFixed(1)}%</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  התיק מייצר תשואה עודפת מעל ה-S&P 500 הודות לפוזיציות צמיחה חזקות ב-{analytics.topPerformer?.ticker}.
                </p>
              </div>

              {/* Insight 2: Concentration */}
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                <div className="font-bold text-indigo-300 flex items-center gap-1.5 mb-1">
                  <AlertTriangle size={14} />
                  <span>ריכוזיות נכסים: {analytics.concentrationMetric.riskLevel}</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  נכס המוביל ({analytics.concentrationMetric.topAsset}) מהווה כ-{analytics.concentrationMetric.topWeight.toFixed(1)}% מהתיק. שקול איזון תקופתי (Rebalancing).
                </p>
              </div>

              {/* Insight 3: Worst performer check */}
              {analytics.worstPerformer && (
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                  <div className="font-bold text-rose-300 flex items-center gap-1.5 mb-1">
                    <TrendingDown size={14} />
                    <span>הפוזיציה החלשה: {analytics.worstPerformer.ticker} ({analytics.worstPerformer.returnPct.toFixed(1)}%)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    ירידה של ${(Math.abs(analytics.worstPerformer.pnlUSD)).toFixed(0)} - ניתן לבחון מגן מס (Tax-Loss Harvesting) בעת מימוש.
                  </p>
                </div>
              )}

            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-300">
              <span>עדכון אחרון: {metaInfo?.lastUpdate ? new Date(metaInfo.lastUpdate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : 'היום'}</span>
              <span className="font-bold text-white">מודל איסוף אוטומטי</span>
            </div>
          </div>

        </section>

        {/* ======================================================== */}
        {/* 4. ADVANCED HOLDINGS MATRIX (DATA TABLE) */}
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
                  <th className="py-3.5 px-4 text-start cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('pnlUSD')}>
                    רווח/הפסד (P&L) <SortIcon columnKey="pnlUSD" />
                  </th>
                  <th className="py-3.5 px-5 text-end cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('returnPct')}>
                    תשואה כוללת <SortIcon columnKey="returnPct" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {filteredHoldings.map((asset, i) => {
                  const isPositive = asset.returnPct >= 0;
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

                      {/* P&L */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5" dir="ltr">
                          <div className={`font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isPositive ? '+' : '-'}${Math.abs(asset.pnlUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {isPositive ? '+' : '-'}₪{Math.abs(asset.pnlILS).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </td>

                      {/* Return % Badge */}
                      <td className="py-4 px-5 text-end" dir="ltr">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                          isPositive
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                        }`}>
                          {isPositive ? '+' : ''}{asset.returnPct.toFixed(2)}%
                        </span>
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

    </div>
  );
}

export default App;
