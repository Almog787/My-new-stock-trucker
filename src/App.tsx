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
import { TrendingUp, DollarSign, PieChart as PieChartIcon, Activity, BarChart3 } from 'lucide-react';

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
const USD_TO_ILS = 3.079;

function App() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'value' | 'return'>('value');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [portfolioRes, historyRes] = await Promise.all([
          fetch('/data/portfolio.json'),
          fetch('/data/stock_history.json')
        ]);
        
        const portfolioData = await portfolioRes.json();
        const historyData = await historyRes.json();

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

  const { portfolioTotal, portfolioData, chartData, monthlyPnLData } = useMemo(() => {
    if (!portfolio || history.length === 0) {
      return { portfolioTotal: 0, portfolioData: [], chartData: [], monthlyPnLData: [] };
    }

    const latestPrices = history[history.length - 1].prices;
    let total = 0;
    let costBase = 0;
    const pData: any[] = [];

    Object.entries(portfolio).forEach(([ticker, data]) => {
      const currentPrice = latestPrices[ticker] || data.avg_price;
      const value = data.amount * currentPrice;
      total += value;
      costBase += data.amount * data.avg_price;
      pData.push({
        name: ticker,
        value: value,
        amount: data.amount,
        avg_price: data.avg_price,
        current_price: currentPrice
      });
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

    // Reduce data points for the chart if it's too dense
    const step = Math.max(1, Math.floor(cData.length / 100));
    const reducedChartData = cData.filter((_, i) => i % step === 0);

    // Calculate Monthly P&L
    const monthlyDataMap = new Map();
    cData.forEach(point => {
       const d = new Date(point.rawDate);
       const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
       // store the latest point of each month
       monthlyDataMap.set(monthKey, point);
    });
    
    const monthlyDataArray = Array.from(monthlyDataMap.entries()).sort((a,b) => a[0].localeCompare(b[0]));
    
    const mPnL: { monthKey: string, monthLabel: string, pnl: number, pnlPct: number, total: number, isPositive: boolean }[] = [];
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

    return { portfolioTotal: total, portfolioData: pData, chartData: reducedChartData, monthlyPnLData: mPnL };
  }, [portfolio, history]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">לוח בקרה לתיק השקעות</h1>
            <p className="text-gray-500 mt-1">מעקב אחר הקצאת נכסים וביצועים בזמן אמת</p>
          </div>
          <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">שווי כולל</p>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span dir="ltr">${portfolioTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-lg text-gray-500 font-normal" dir="ltr">
                  (₪{(portfolioTotal * USD_TO_ILS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              </h2>
            </div>
          </div>
        </header>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Activity className="text-indigo-600" size={20} />
                <h3 className="text-lg font-semibold">היסטוריית ביצועים</h3>
              </div>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setChartView('value')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${chartView === 'value' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  שווי כספי
                </button>
                <button 
                  onClick={() => setChartView('return')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${chartView === 'return' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  תשואה מצטברת
                </button>
              </div>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="timestamp" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    minTickGap={30}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) => chartView === 'value' ? `$${value.toLocaleString()}` : `${value.toFixed(1)}%`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => {
                      const num = Number(value) || 0;
                      if (chartView === 'value') {
                        return [`$${num.toFixed(2)} (₪${(num * USD_TO_ILS).toFixed(2)})`, 'שווי כולל'];
                      }
                      return [`${num.toFixed(2)}%`, 'תשואה מצטברת'];
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={chartView === 'value' ? "total" : "returnPct"} 
                    stroke="#4f46e5" 
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Allocation Pie */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <PieChartIcon className="text-indigo-600" size={20} />
              <h3 className="text-lg font-semibold">הקצאת נכסים</h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={portfolioData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {portfolioData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => {
                      const num = Number(value) || 0;
                      return [`$${num.toFixed(2)} (₪${(num * USD_TO_ILS).toFixed(2)})`, 'שווי'];
                    }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Monthly P&L Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="text-indigo-600" size={20} />
            <h3 className="text-lg font-semibold">רווח והפסד חודשי (P&L)</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyPnLData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="monthLabel" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, _name: any, props: any) => {
                    const num = Number(value) || 0;
                    return [
                      <div dir="ltr" className="flex items-center gap-2">
                        <span className={props.payload.isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                          {props.payload.isPositive ? '+' : '-'}${Math.abs(num).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">
                          (₪{(num * USD_TO_ILS).toFixed(2)})
                        </span>
                      </div>, 
                      'רווח/הפסד'
                    ];
                  }}
                />
                <Bar 
                  dataKey="pnl" 
                  radius={[4, 4, 0, 0]}
                >
                  {
                    monthlyPnLData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isPositive ? '#10b981' : '#ef4444'} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp className="text-indigo-600" size={20} />
            <h3 className="text-lg font-semibold">החזקות נוכחיות</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-gray-500 text-sm">
                  <th className="py-4 px-6 font-medium">נכס</th>
                  <th className="py-4 px-6 font-medium">מניות</th>
                  <th className="py-4 px-6 font-medium text-start">עלות ממוצעת</th>
                  <th className="py-4 px-6 font-medium text-start">מחיר נוכחי</th>
                  <th className="py-4 px-6 font-medium text-start">שווי כולל</th>
                  <th className="py-4 px-6 font-medium text-start">רווח/הפסד</th>
                  <th className="py-4 px-6 font-medium text-end">תשואה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {portfolioData.map((asset, i) => {
                  const returnPct = ((asset.current_price - asset.avg_price) / asset.avg_price) * 100;
                  const pnl = (asset.current_price - asset.avg_price) * asset.amount;
                  const isPositive = returnPct >= 0;
                  return (
                    <tr key={asset.name} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6 font-medium text-gray-900 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        {asset.name}
                      </td>
                      <td className="py-4 px-6 text-gray-600" dir="ltr" style={{ textAlign: "right" }}>{asset.amount}</td>
                      <td className="py-4 px-6 text-gray-600" dir="ltr" style={{ textAlign: "right" }}>
                        <div>${asset.avg_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-xs text-gray-400">₪{(asset.avg_price * USD_TO_ILS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                      <td className="py-4 px-6 text-gray-900 font-medium" dir="ltr" style={{ textAlign: "right" }}>
                        <div>${asset.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-xs text-gray-500">₪{(asset.current_price * USD_TO_ILS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                      <td className="py-4 px-6 text-gray-900 font-medium" dir="ltr" style={{ textAlign: "right" }}>
                        <div>${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-xs text-gray-500">₪{(asset.value * USD_TO_ILS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                      <td className="py-4 px-6 text-gray-900 font-medium" dir="ltr" style={{ textAlign: "right" }}>
                        <div className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                          {isPositive ? '+' : '-'}${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {isPositive ? '+' : '-'}₪{Math.abs(pnl * USD_TO_ILS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-end" dir="ltr" style={{ textAlign: "left" }}>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {isPositive ? '+' : ''}{returnPct.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
