import { useState, useEffect, useMemo } from 'react';
import {
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
  Bar
} from 'recharts';
import { TrendingUp, DollarSign, PieChart as PieChartIcon, Activity, BarChart3, ArrowLeftRight, Moon, Sun, ArrowUp, ArrowDown, Smile, Info } from 'lucide-react';

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
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

type SortKey = 'name' | 'amount' | 'avg_price' | 'current_price' | 'value' | 'pnl' | 'returnPct';

function App() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [usdToIls, setUsdToIls] = useState<number>(3.006); // Default fallback, dynamically updated
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'value' | 'return'>('value');
  const [mobileTab, setMobileTab] = useState<'charts' | 'holdings'>('charts');
  const [dashboardTab, setDashboardTab] = useState<'simple' | 'pro'>('simple');
  const [darkMode, setDarkMode] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'value', direction: 'desc' });

  useEffect(() => {
    // Check local storage for dark mode preference
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
          fetch('./data/meta.json').catch(() => null) // Optional fetch, fallback if missing
        ]);
        
        const portfolioData = await portfolioRes.json();
        const historyData = await historyRes.json();

        if (metaRes && metaRes.ok) {
          const metaData = await metaRes.json();
          if (metaData.usdIlsRate) {
            setUsdToIls(metaData.usdIlsRate);
          }
        }

        setPortfolio(portfolioData);
        setHistory(historyData);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const { portfolioTotal, sortedPortfolioData, chartData, monthlyPnLData } = useMemo(() => {
    if (!portfolio || history.length === 0) {
      return { portfolioTotal: 0, sortedPortfolioData: [], chartData: [], monthlyPnLData: [] };
    }

    const latestPrices = history[history.length - 1].prices;
    let total = 0;
    let costBase = 0;
    const pData: any[] = [];

    Object.entries(portfolio).forEach(([ticker, data]) => {
      const currentPrice = latestPrices[ticker] || data.avg_price;
      const value = data.amount * currentPrice;
      const pnl = (currentPrice - data.avg_price) * data.amount;
      const returnPct = ((currentPrice - data.avg_price) / data.avg_price) * 100;
      
      total += value;
      costBase += data.amount * data.avg_price;
      
      pData.push({
        name: ticker,
        value: value,
        amount: data.amount,
        avg_price: data.avg_price,
        current_price: currentPrice,
        pnl,
        returnPct
      });
    });

    const sortedData = [...pData].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    const cData = history.map(point => {
      const item: any = { timestamp: new Date(point.timestamp).toLocaleDateString(), rawDate: point.timestamp };
      let pointTotal = 0;
      Object.entries(portfolio).forEach(([ticker, data]) => {
        const price = point.prices[ticker] || data.avg_price;
        pointTotal += price * data.amount;
      });
      item.total = pointTotal;
      item.returnPct = ((pointTotal - costBase) / costBase) * 100;
      return item;
    });

    const step = Math.max(1, Math.floor(cData.length / 100));
    const reducedChartData = cData.filter((_, i) => i % step === 0);

    const monthlyDataMap = new Map();
    cData.forEach(point => {
       const d = new Date(point.rawDate);
       const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
       monthlyDataMap.set(monthKey, point);
    });
    
    const monthlyDataArray = Array.from(monthlyDataMap.entries()).sort((a,b) => a[0].localeCompare(b[0]));
    
    const mPnL: any[] = [];
    let prevTotal = costBase;
    
    monthlyDataArray.forEach(([monthKey, point]) => {
        const pnl = point.total - prevTotal;
        const pnlPct = (pnl / prevTotal) * 100;
        const d = new Date(point.rawDate);
        const monthLabel = d.toLocaleString('he-IL', { month: 'short', year: '2-digit' });
        
        mPnL.push({
           monthKey,
           monthLabel,
           pnl,
           pnlPct,
           total: point.total,
           isPositive: pnl >= 0
        });
        prevTotal = point.total;
    });

    return { portfolioTotal: total, sortedPortfolioData: sortedData, chartData: reducedChartData, monthlyPnLData: mPnL };
  }, [portfolio, history, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 inline" /> : <ArrowDown size={14} className="ml-1 inline" />;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  const tooltipStyles = {
    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
    borderColor: darkMode ? '#374151' : '#f3f4f6',
    color: darkMode ? '#f9fafb' : '#111827',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors p-6 md:p-12 pb-24 md:pb-12 font-sans text-gray-900 dark:text-gray-100" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">לוח בקרה לתיק השקעות</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">מעקב אחר הקצאת נכסים וביצועים בזמן אמת</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">שווי כולל</p>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span dir="ltr">${portfolioTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-lg text-gray-500 dark:text-gray-400 font-normal" dir="ltr">
                    (₪{(portfolioTotal * usdToIls).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </h2>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl w-fit shadow-inner mx-auto md:mx-0">
          <button 
            onClick={() => setDashboardTab('simple')}
            className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${dashboardTab === 'simple' ? 'bg-white dark:bg-gray-600 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            תצוגה פשוטה (למתחילים)
          </button>
          <button 
            onClick={() => setDashboardTab('pro')}
            className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${dashboardTab === 'pro' ? 'bg-white dark:bg-gray-600 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            תצוגה מקצועית (Pro)
          </button>
        </div>

        {dashboardTab === 'simple' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 md:p-8 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Smile size={100} />
              </div>
              <h2 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mb-4 flex items-center gap-2 relative z-10">
                <Smile className="text-indigo-500" size={28} />
                שלום! בואו נבין יחד את הכסף שלכם
              </h2>
              <p className="text-indigo-800 dark:text-indigo-200 text-lg leading-relaxed max-w-3xl relative z-10">
                הכסף שהשקעתם בבורסה נמצא כרגע בשווי של <strong className="font-bold text-indigo-900 dark:text-white">₪{(portfolioTotal * usdToIls).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>. 
                זה אומר שאם הייתם מוכרים עכשיו הכל, זה הסכום שהייתם מקבלים. 
                {monthlyPnLData.length > 0 && monthlyPnLData[monthlyPnLData.length - 1].isPositive ? ' החדשות הטובות הן שהכסף שלכם צמח לאחרונה! 🎉' : ' שוק ההון זז למעלה ולמטה, וזה בסדר גמור לאורך זמן.'}
              </p>
            </div>
            
            {/* Simple Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">כמה כסף הרווחתם?</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">זהו הסכום שנוסף להשקעה המקורית שלכם בזכות העליות בבורסה.</p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-500">
                    <TrendingUp size={24} />
                  </div>
                </div>
                {chartData.length > 0 && (
                  <div className="text-4xl font-bold text-emerald-500 flex items-center gap-2 mt-2" dir="ltr">
                    +₪{((portfolioTotal - chartData[0]?.total) * usdToIls).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                )}
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">במה הכסף מושקע?</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">קניתם חלקים (מניות) של חברות. החלק הגדול ביותר שלכם נמצא ב:</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-500">
                    <PieChartIcon size={24} />
                  </div>
                </div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                  {sortedPortfolioData.length > 0 ? sortedPortfolioData[0].name : ''}
                </div>
              </div>
            </div>

            {/* Simple Explanation List */}
            <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Info className="text-indigo-500" />
                  פירוט החברות שיש לכם
                </h3>
                <div className="space-y-4">
                  {sortedPortfolioData.map((asset, i) => {
                    const isPositive = asset.returnPct >= 0;
                    return (
                      <div key={asset.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gray-50 dark:bg-gray-700/30 rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50">
                        <div className="flex items-center gap-4 mb-3 sm:mb-0">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm text-lg" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                            {asset.name.substring(0, 2)}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white text-lg">{asset.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">יש לכם כרגע מניות בשווי של ₪{(asset.value * usdToIls).toLocaleString(undefined, { maximumFractionDigits: 0 })} בחברה זו</p>
                          </div>
                        </div>
                        <div className={`text-sm font-semibold px-4 py-2 rounded-full w-fit flex items-center gap-1.5 ${isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'}`}>
                          {isPositive ? 'החברה צומחת 🎉' : 'החברה בירידה קלה 📉'}
                        </div>
                      </div>
                    );
                  })}
                </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className={`space-y-8 ${dashboardTab !== 'pro' ? 'hidden' : ''} ${mobileTab !== 'charts' ? 'hidden md:block' : ''}`}>
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Activity className="text-indigo-600 dark:text-indigo-400" size={20} />
                <h3 className="text-lg font-semibold dark:text-white">היסטוריית ביצועים</h3>
              </div>
              <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                <button 
                  onClick={() => setChartView('value')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${chartView === 'value' ? 'bg-white dark:bg-gray-600 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  שווי כספי
                </button>
                <button 
                  onClick={() => setChartView('return')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${chartView === 'return' ? 'bg-white dark:bg-gray-600 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  תשואה מצטברת
                </button>
              </div>
            </div>
            <div className="h-[400px] w-full" style={{ touchAction: 'pan-y' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#374151" : "#f3f4f6"} />
                  <XAxis 
                    dataKey="timestamp" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                    minTickGap={30}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) => chartView === 'value' ? `$${value.toLocaleString()}` : `${value.toFixed(1)}%`}
                    domain={['auto', 'auto']}
                    orientation="right"
                  />
                  <Tooltip 
                    contentStyle={tooltipStyles}
                    itemStyle={{ color: darkMode ? '#e5e7eb' : '#374151' }}
                    formatter={(value: any) => {
                      const num = Number(value) || 0;
                      if (chartView === 'value') {
                        return [`$${num.toFixed(2)} (₪${(num * usdToIls).toFixed(2)})`, 'שווי כולל'];
                      }
                      return [`${num.toFixed(2)}%`, 'תשואה מצטברת'];
                    }}
                    labelStyle={{ color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={chartView === 'value' ? "total" : "returnPct"} 
                    stroke={darkMode ? "#818cf8" : "#4f46e5"} 
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: darkMode ? "#818cf8" : "#4f46e5", stroke: darkMode ? '#1f2937' : '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Allocation Pie */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-6">
              <PieChartIcon className="text-indigo-600 dark:text-indigo-400" size={20} />
              <h3 className="text-lg font-semibold dark:text-white">הקצאת נכסים</h3>
            </div>
            <div className="h-[300px] w-full" style={{ touchAction: 'pan-y' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sortedPortfolioData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke={darkMode ? '#1f2937' : '#ffffff'}
                    strokeWidth={2}
                  >
                    {sortedPortfolioData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={tooltipStyles}
                    itemStyle={{ color: darkMode ? '#e5e7eb' : '#374151' }}
                    formatter={(value: any) => {
                      const num = Number(value) || 0;
                      return [`$${num.toFixed(2)} (₪${(num * usdToIls).toFixed(2)})`, 'שווי'];
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ color: darkMode ? '#e5e7eb' : '#374151' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Monthly P&L Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h3 className="text-lg font-semibold dark:text-white">רווח והפסד חודשי (P&L)</h3>
          </div>
          <div className="h-[300px] w-full" style={{ touchAction: 'pan-y' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyPnLData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#374151" : "#f3f4f6"} />
                <XAxis 
                  dataKey="monthLabel" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  orientation="right"
                />
                <Tooltip 
                  cursor={{ fill: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                  contentStyle={tooltipStyles}
                  formatter={(value: any, _name: any, props: any) => {
                    const num = Number(value) || 0;
                    return [
                      <div dir="ltr" className="flex items-center gap-2">
                        <span className={props.payload.isPositive ? 'text-emerald-500' : 'text-rose-500'}>
                          {props.payload.isPositive ? '+' : '-'}${Math.abs(num).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          (₪{(num * usdToIls).toFixed(2)})
                        </span>
                      </div>, 
                      'רווח/הפסד'
                    ];
                  }}
                  labelStyle={{ color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}
                />
                <Bar 
                  dataKey="pnl" 
                  radius={[4, 4, 0, 0]}
                >
                  {
                    monthlyPnLData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isPositive ? (darkMode ? '#34d399' : '#10b981') : (darkMode ? '#f87171' : '#ef4444')} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        </div>

        {/* Holdings Table */}
        <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden relative ${dashboardTab !== 'pro' ? 'hidden' : ''} ${mobileTab !== 'holdings' ? 'hidden md:block' : ''}`}>
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-indigo-600 dark:text-indigo-400" size={20} />
              <h3 className="text-lg font-semibold dark:text-white">החזקות נוכחיות</h3>
            </div>
            <div className="md:hidden flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full">
              <ArrowLeftRight size={14} />
              <span>החלק לפרטים</span>
            </div>
          </div>
          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-sm">
                  <th className="py-4 px-6 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => handleSort('name')}>
                    נכס <SortIcon columnKey="name" />
                  </th>
                  <th className="py-4 px-6 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => handleSort('amount')}>
                    מניות <SortIcon columnKey="amount" />
                  </th>
                  <th className="py-4 px-6 font-medium text-start cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => handleSort('avg_price')}>
                    עלות ממוצעת <SortIcon columnKey="avg_price" />
                  </th>
                  <th className="py-4 px-6 font-medium text-start cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => handleSort('current_price')}>
                    מחיר נוכחי <SortIcon columnKey="current_price" />
                  </th>
                  <th className="py-4 px-6 font-medium text-start cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => handleSort('value')}>
                    שווי כולל <SortIcon columnKey="value" />
                  </th>
                  <th className="py-4 px-6 font-medium text-start cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => handleSort('pnl')}>
                    רווח/הפסד <SortIcon columnKey="pnl" />
                  </th>
                  <th className="py-4 px-6 font-medium text-end cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => handleSort('returnPct')}>
                    תשואה <SortIcon columnKey="returnPct" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {sortedPortfolioData.map((asset, i) => {
                  const isPositive = asset.returnPct >= 0;
                  return (
                    <tr key={asset.name} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="py-4 px-6 font-medium text-gray-900 dark:text-gray-100 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        {asset.name}
                      </td>
                      <td className="py-4 px-6 text-gray-600 dark:text-gray-300" dir="ltr" style={{ textAlign: "right" }}>{asset.amount}</td>
                      <td className="py-4 px-6 text-gray-600 dark:text-gray-300" dir="ltr" style={{ textAlign: "right" }}>
                        <div>${asset.avg_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">₪{(asset.avg_price * usdToIls).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                      <td className="py-4 px-6 text-gray-900 dark:text-gray-100 font-medium" dir="ltr" style={{ textAlign: "right" }}>
                        <div>${asset.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">₪{(asset.current_price * usdToIls).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                      <td className="py-4 px-6 text-gray-900 dark:text-gray-100 font-medium" dir="ltr" style={{ textAlign: "right" }}>
                        <div>${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">₪{(asset.value * usdToIls).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                      <td className="py-4 px-6 text-gray-900 dark:text-gray-100 font-medium" dir="ltr" style={{ textAlign: "right" }}>
                        <div className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {isPositive ? '+' : '-'}${Math.abs(asset.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {isPositive ? '+' : '-'}₪{Math.abs(asset.pnl * usdToIls).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-end" dir="ltr" style={{ textAlign: "left" }}>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          isPositive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
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
        </div>

        {/* Bottom Navigation for Mobile */}
        <div className={`md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around p-3 z-50 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)] ${dashboardTab !== 'pro' ? 'hidden' : ''}`}>
          <button
            onClick={() => setMobileTab('charts')}
            className={`flex flex-col items-center gap-1 flex-1 py-1 transition-colors ${mobileTab === 'charts' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <Activity size={24} />
            <span className="text-xs font-medium">גרפים</span>
          </button>
          <button
            onClick={() => setMobileTab('holdings')}
            className={`flex flex-col items-center gap-1 flex-1 py-1 transition-colors ${mobileTab === 'holdings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <TrendingUp size={24} />
            <span className="text-xs font-medium">החזקות</span>
          </button>
        </div>

      </div>
    </div>
  );
}

export default App;
