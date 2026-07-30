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
  Legend
} from 'recharts';
import { TrendingUp, DollarSign, PieChart as PieChartIcon, Activity } from 'lucide-react';

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

function App() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

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

  const { portfolioTotal, portfolioData, chartData } = useMemo(() => {
    if (!portfolio || history.length === 0) {
      return { portfolioTotal: 0, portfolioData: [], chartData: [] };
    }

    const latestPrices = history[history.length - 1].prices;
    let total = 0;
    const pData: any[] = [];

    Object.entries(portfolio).forEach(([ticker, data]) => {
      const currentPrice = latestPrices[ticker] || data.avg_price;
      const value = data.amount * currentPrice;
      total += value;
      pData.push({
        name: ticker,
        value: value,
        amount: data.amount,
        avg_price: data.avg_price,
        current_price: currentPrice
      });
    });

    const cData = history.map(point => {
      const item: any = { timestamp: new Date(point.timestamp).toLocaleDateString() };
      let pointTotal = 0;
      Object.entries(portfolio).forEach(([ticker, data]) => {
        const price = point.prices[ticker] || data.avg_price;
        pointTotal += price * data.amount;
      });
      item.total = pointTotal;
      return item;
    });

    // Reduce data points for the chart if it's too dense
    const step = Math.max(1, Math.floor(cData.length / 100));
    const reducedChartData = cData.filter((_, i) => i % step === 0);

    return { portfolioTotal: total, portfolioData: pData, chartData: reducedChartData };
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
              <h2 className="text-2xl font-bold text-gray-900">
                ${portfolioTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
          </div>
        </header>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="text-indigo-600" size={20} />
              <h3 className="text-lg font-semibold">היסטוריית ביצועים</h3>
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
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => {
                      const num = Number(value) || 0;
                      return [`$${num.toFixed(2)}`, 'שווי כולל'];
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
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
                      return [`$${num.toFixed(2)}`, 'שווי'];
                    }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
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
                  <th className="py-4 px-6 font-medium">עלות ממוצעת</th>
                  <th className="py-4 px-6 font-medium">מחיר נוכחי</th>
                  <th className="py-4 px-6 font-medium">שווי כולל</th>
                  <th className="py-4 px-6 font-medium text-end">תשואה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {portfolioData.map((asset, i) => {
                  const returnPct = ((asset.current_price - asset.avg_price) / asset.avg_price) * 100;
                  const isPositive = returnPct >= 0;
                  return (
                    <tr key={asset.name} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6 font-medium text-gray-900 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        {asset.name}
                      </td>
                      <td className="py-4 px-6 text-gray-600" dir="ltr" style={{ textAlign: "right" }}>{asset.amount}</td>
                      <td className="py-4 px-6 text-gray-600" dir="ltr" style={{ textAlign: "right" }}>${asset.avg_price.toFixed(2)}</td>
                      <td className="py-4 px-6 text-gray-900 font-medium" dir="ltr" style={{ textAlign: "right" }}>${asset.current_price.toFixed(2)}</td>
                      <td className="py-4 px-6 text-gray-900 font-medium" dir="ltr" style={{ textAlign: "right" }}>${asset.value.toFixed(2)}</td>
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
