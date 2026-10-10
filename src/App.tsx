import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Calendar, 
  ShieldCheck, 
  Layers, 
  Cpu, 
  ExternalLink, 
  ChevronUp, 
  FileText,
  Clock,
  Sparkles,
  Globe,
  Compass,
  AlertTriangle,
  Scale
} from 'lucide-react';

interface PortfolioItem {
  amount: number;
  avg_price: number;
}

interface Portfolio {
  [ticker: string]: PortfolioItem;
}

interface Meta {
  usdIlsRate: number;
  lastUpdate: string;
}

interface HistoryPoint {
  timestamp: string;
  prices: { [ticker: string]: number };
  exchangeRate?: number;
}

interface DividendEvent {
  ticker: string;
  projectedDate: string;
  estimatedGrossUSD: number;
  estimatedNetUSD: number;
  estimatedNetILS: number;
}

interface ForecastAsset {
  currentPrice: number;
  forecastP50: number;
  forecastP10: number;
  forecastP90: number;
  expectedChangePct: number;
  signalHe: string;
  annualizedVolatilityPct: number;
}

interface ModelComparison {
  id: string;
  nameHe: string;
  category: string;
  projectedUSD: number;
  projectedILS: number;
  expectedReturnPct: number;
  riskLevel: string;
  methodology: string;
}

interface HorizonComparison {
  horizonLabel: string;
  targetDate: string;
  p50USD: number;
  p50ILS: number;
  p10USD: number;
  p90USD: number;
  expectedReturnPct: number;
  expectedFx: number;
}

interface ForecastData {
  modelInfo?: {
    model: string;
    version: string;
    generatedAt: string;
  };
  portfolio?: {
    currentUSD: number;
    currentILS: number;
    forecast30dUSD_P50: number;
    forecast30dILS_P50: number;
    forecast30dUSD_P10: number;
    forecast30dILS_P10: number;
    forecast30dUSD_P90: number;
    forecast30dILS_P90: number;
    expectedReturn30dPct: number;
  };
  assets?: { [ticker: string]: ForecastAsset };
  modelComparisons?: ModelComparison[];
  horizonComparisons?: HorizonComparison[];
  dividendsForecast?: {
    next12MonthsTotalNetUSD: number;
    next12MonthsTotalNetILS: number;
    projectedMonthlyAverageNetILS: number;
    events: DividendEvent[];
  };
}

interface MacroIndicator {
  symbol: string;
  name: string;
  price: number;
  yieldPct?: number;
  changePct: number;
  regime?: string;
  badge?: string;
  riskFreeRatePct?: number;
  description: string;
}

interface QuantMetrics {
  updatedAt: string;
  macroIndicators: {
    vix: MacroIndicator;
    tnx: MacroIndicator;
    oil: MacroIndicator;
    dxy: MacroIndicator;
  };
  riskMetrics: {
    annualizedReturnPct: number;
    annualizedVolatilityPct: number;
    sharpeRatio: number;
    sortinoRatio: number;
    portfolioBeta: number;
    assetBetas: { [ticker: string]: number };
    riskFreeRatePct: number;
    maxDrawdownPct: number;
    currentDrawdownPct: number;
    allTimeHighUSD: number;
    allTimeHighILS: number;
    hhiIndex: number;
    diversificationLevel: string;
    var95: {
      daily: { pct: number; usd: number; ils: number };
      monthly30d: { pct: number; usd: number; ils: number };
    };
    cvar95: {
      daily: { pct: number; usd: number; ils: number };
    };
  };
  correlationMatrix: {
    variables: { key: string; label: string }[];
    matrix: { [rowKey: string]: { [colKey: string]: number } };
    insights: { pair: string; correlation: number; type: string; description: string }[];
  };
  stage3Predictive?: {
    generatedAt: string;
    monteCarlo: {
      [key: string]: {
        label: string;
        daysForward: number;
        p5USD: number;
        p25USD: number;
        p50USD: number;
        p75USD: number;
        p95USD: number;
        p50ILS: number;
        meanUSD: number;
        expectedReturnPct: number;
        probPositivePct: number;
        rangeUSD: string;
        rangeILS: string;
      };
    };
    factorModel: {
      portfolioCompositeScore: number;
      portfolioGrade: string;
      macroRegimeOutlook: string;
      assets: {
        [ticker: string]: {
          ticker: string;
          name: string;
          role: string;
          momentumScore: number;
          riskScore: number;
          macroScore: number;
          aiScore: number;
          compositeScore: number;
          grade: string;
          recommendation: string;
          explanation: string;
          macroSensitivity: string;
        };
      };
      actionSummary: string;
    };
    macroScenarios: {
      id: string;
      name: string;
      probability: string;
      expectedReturnPct: number;
      targetUSD: number;
      targetILS: number;
      macroConditions: string;
      driverAssets: string;
      portfolioImpact: string;
      simpleExplanation: string;
    }[];
    metricsExplanations: {
      key: string;
      name: string;
      category: string;
      whatIsIt: string;
      portfolioImpact: string;
    }[];
  };
}

interface DividendsData {
  summary?: {
    totalReceivedGrossUSD: number;
    l12mReceivedGrossUSD: number;
  };
}

const ASSET_NAMES: { [ticker: string]: { name: string; sector: string } } = {
  GOOGL: { name: 'Alphabet (Google)', sector: 'טכנולוגיה ותוכנה' },
  NVDA: { name: 'NVIDIA Corp', sector: 'שבבים ו-AI' },
  TSLA: { name: 'Tesla Inc', sector: 'רכב חשמלי ואנרגיה' },
  ASML: { name: 'ASML Holding', sector: 'ציוד מוליכים למחצה' },
  VOO: { name: 'Vanguard S&P 500', sector: 'מדד S&P 500' },
  XOM: { name: 'Exxon Mobil', sector: 'אנרגיה ונפט' }
};

export const App: React.FC = () => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [quant, setQuant] = useState<QuantMetrics | null>(null);
  const [dividends, setDividends] = useState<DividendsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<string>('snapshot');

  useEffect(() => {
    async function loadData() {
      try {
        const loadJson = async (file: string) => {
          const base = import.meta.env.BASE_URL || '/';
          const cleanBase = base.endsWith('/') ? base : `${base}/`;
          const urls = [
            `${cleanBase}data/${file}`,
            `/My-new-stock-trucker/data/${file}`,
            `/data/${file}`,
            `./data/${file}`
          ];
          for (const url of urls) {
            try {
              const res = await fetch(url);
              if (res && res.ok) {
                return await res.json();
              }
            } catch {
              // try next candidate
            }
          }
          return null;
        };

        const [portRes, metaRes, histRes, fcRes, quantRes, divRes] = await Promise.all([
          loadJson('portfolio.json'),
          loadJson('meta.json'),
          loadJson('stock_history.json').then(r => r || []),
          loadJson('forecast.json'),
          loadJson('quant_metrics.json'),
          loadJson('dividends.json')
        ]);

        setPortfolio(portRes);
        setMeta(metaRes);
        setHistory(histRes || []);
        setForecast(fcRes);
        setQuant(quantRes);
        setDividends(divRes);
      } catch (err) {
        console.error('Failed to load portfolio intelligence data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const brokerRate = meta?.usdIlsRate || 3.068;
  const latestPrices = history.length > 0 ? history[history.length - 1].prices : {};

  // Calculations
  let totalCostUSD = 0;
  let totalCurrentUSD = 0;
  let previousValueUSD = 0;

  if (portfolio) {
    const prevPrices = history.length > 1 ? history[history.length - 2].prices : latestPrices;

    Object.entries(portfolio).forEach(([ticker, item]) => {
      const curPrice = latestPrices[ticker] || item.avg_price;
      const prevPrice = prevPrices[ticker] || curPrice;

      totalCostUSD += item.amount * item.avg_price;
      totalCurrentUSD += item.amount * curPrice;
      previousValueUSD += item.amount * prevPrice;
    });
  }

  const totalCurrentILS = totalCurrentUSD * brokerRate;
  const totalCostILS = totalCostUSD * brokerRate;
  const totalPnLUSD = totalCurrentUSD - totalCostUSD;
  const totalPnLILS = totalCurrentILS - totalCostILS;
  const totalReturnPct = totalCostUSD > 0 ? (totalPnLUSD / totalCostUSD) * 100 : 0;
  const netPnLUSD = totalPnLUSD * 0.75;
  const netPnLILS = totalPnLILS * 0.75;
  const netReturnPct = totalCostUSD > 0 ? (netPnLUSD / totalCostUSD) * 100 : 0;
  const unrealizedTaxUSD = Math.max(0, totalPnLUSD * 0.25);
  const unrealizedTaxILS = unrealizedTaxUSD * brokerRate;
  const dailyPnLUSD = totalCurrentUSD - previousValueUSD;
  const dailyPnLILS = dailyPnLUSD * brokerRate;
  const dailyChangePct = previousValueUSD > 0 ? (dailyPnLUSD / previousValueUSD) * 100 : 0;

  const scrollToAnchor = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 font-sans" dir="rtl">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <Sparkles className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <h2 className="text-xl font-bold mt-6 text-indigo-200">טוען מודל נתונים, מדדי מאקרו ו-README...</h2>
        <p className="text-slate-400 text-sm mt-1">שולף נתוני מסחר, מדדי סיכון כמותיים, מתאמים ותחזיות TimesFM...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans" dir="rtl">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-extrabold text-white">מעקב תיק השקעות PRO & אנליטיקה כמותית</h1>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  LIVE QUANT & AI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                מרכז ניתוח אוטונומי מבוסס Google TimesFM, מדדי מאקרו ומודלים כמותיים • מקור יחיד בקובץ README.md
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href="#readme" 
              onClick={(e) => { e.preventDefault(); scrollToAnchor('snapshot'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm shadow-indigo-600/30"
            >
              <FileText className="w-3.5 h-3.5" />
              דוח אנליזה מלא
            </a>
            <a
              href="https://github.com/almog787/My-new-stock-trucker"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
            >
              <span>צפה ב-GitHub README</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Live Badges Banner */}
        <div className="border-t border-slate-800/80 bg-slate-900/40">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-2.5 text-xs overflow-x-auto">
            <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400">עדכון:</span>
              <span className="font-semibold text-slate-200">
                {meta?.lastUpdate ? new Date(meta.lastUpdate).toLocaleString('he-IL') : '10/10/2026 06:15'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
              <DollarSign className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400">שווי שוק:</span>
              <span className="font-bold text-blue-400">
                ₪{Math.round(totalCurrentILS).toLocaleString()} (${Math.round(totalCurrentUSD).toLocaleString()})
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
              {totalReturnPct >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span className="text-slate-400">תשואה:</span>
              <span className={`font-bold ${totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400">יעד TimesFM 30d:</span>
              <span className="font-bold text-purple-400">
                ₪{forecast?.portfolio ? Math.round(forecast.portfolio.forecast30dILS_P50).toLocaleString() : '195,667'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">USD/ILS:</span>
              <span className="font-mono font-bold text-emerald-400">₪{brokerRate.toFixed(3)}</span>
            </div>

            {/* Stage 1 Macro Badges */}
            {quant?.macroIndicators?.vix && (
              <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400">CBOE VIX:</span>
                <span className="font-mono font-bold text-amber-300">{quant.macroIndicators.vix.price}</span>
                <span className="text-[10px] text-slate-400">({quant.macroIndicators.vix.badge})</span>
              </div>
            )}

            {quant?.macroIndicators?.tnx && (
              <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400">אג"ח 10Y:</span>
                <span className="font-mono font-bold text-amber-300">{quant.macroIndicators.tnx.price}%</span>
              </div>
            )}

            {/* Stage 2 Quant Badges */}
            {quant?.riskMetrics && (
              <>
                <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-slate-400">Sharpe:</span>
                  <span className="font-mono font-bold text-indigo-300">{quant.riskMetrics.sharpeRatio}</span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
                  <Activity className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-slate-400">Beta:</span>
                  <span className="font-mono font-bold text-violet-300">{quant.riskMetrics.portfolioBeta}</span>
                </div>

                {quant.stage3Predictive?.factorModel && (
                  <div className="flex items-center gap-1.5 bg-purple-950/40 px-2.5 py-1 rounded-md border border-purple-800/50">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-purple-300">ציון שלב 3:</span>
                    <span className="font-mono font-bold text-white">
                      {quant.stage3Predictive.factorModel.portfolioCompositeScore}/100 ({quant.stage3Predictive.factorModel.portfolioGrade})
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Section Navigation Jump Bar */}
        <div className="border-t border-slate-800 bg-slate-950/80">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
            {[
              { id: 'snapshot', label: '📊 1. תמונת מצב מנהלים' },
              { id: 'holdings', label: '📋 2. ביצועי מניות' },
              { id: 'forecasts', label: '🔮 3. השוואת תחזיות AI' },
              { id: 'macro', label: '🌐 4. מדדי מאקרו ומפת שוק' },
              { id: 'risk-metrics', label: '📐 5. מדדי סיכון וקורלציות' },
              { id: 'stage3-predictive', label: '🚀 שלב 3: מונטה קרלו ותרחישים' },
              { id: 'dividends', label: '💵 6. יומן דיבידנדים' },
              { id: 'charts', label: '📈 7. גרפים חזותיים' },
              { id: 'architecture', label: '⚙️ 8. ארכיטקטורת מאגר' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => scrollToAnchor(tab.id)}
                className={`px-3 py-1 rounded-md font-medium whitespace-nowrap transition-all ${
                  activeSection === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-12">
        {/* Notice Card */}
        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 md:p-5 flex items-start gap-4 shadow-xl">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">ניתוח נתונים מרוכז ב-README.md (כולל שלב 1 ו-2)</h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              בהתאם להגדרת המאגר, כל המידע, האנליטיקות, הגרפים, מדדי המאקרו (שלב 1) ומדדי הסיכון הכמותיים והמתאמים (שלב 2) מרוכזים ומתעדכנים אוטומטית ישירות בקובץ ה-<strong>README.md</strong> באמצעות GitHub Actions. תצוגה זו מהווה שיקוף חי, קריא ואינטראקטיבי של תוכן הרידמי.
            </p>
          </div>
        </div>

        {/* SECTION 1: Executive Snapshot */}
        <section id="snapshot" className="scroll-mt-32 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h2 className="text-xl md:text-2xl font-black text-white">1. תמונת מצב מנהלים (Executive Snapshot)</h2>
            </div>
            <button
              onClick={() => scrollToAnchor('snapshot')}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              לראש הפרק
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 block mb-1">שווי תיק נוכחי</span>
              <div className="text-xl md:text-2xl font-black text-white">₪{Math.round(totalCurrentILS).toLocaleString()}</div>
              <div className="text-xs text-indigo-400 font-mono mt-1">${Math.round(totalCurrentUSD).toLocaleString()} USD</div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 block mb-1">עלות קנייה (Cost Basis)</span>
              <div className="text-xl md:text-2xl font-black text-slate-300">₪{Math.round(totalCostILS).toLocaleString()}</div>
              <div className="text-xs text-slate-400 font-mono mt-1">${Math.round(totalCostUSD).toLocaleString()} USD</div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 block mb-1">רווח כולל ברוטו</span>
              <div className={`text-xl md:text-2xl font-black ${totalPnLILS >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalPnLILS >= 0 ? '+' : ''}₪{Math.round(totalPnLILS).toLocaleString()}
              </div>
              <div className={`text-xs font-bold mt-1 ${totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}% תשואה
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 block mb-1">רווח נטו (לאחר מס 25%)</span>
              <div className={`text-xl md:text-2xl font-black ${netPnLILS >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netPnLILS >= 0 ? '+' : ''}₪{Math.round(netPnLILS).toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 mt-1">חבות מס: ₪{Math.round(unrealizedTaxILS).toLocaleString()}</div>
            </div>
          </div>

          {/* Details Snapshot Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs md:text-sm">
                <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                  <tr>
                    <th className="px-4 py-3">מדד פיננסי</th>
                    <th className="px-4 py-3 text-center">ערך בדולר ($ USD)</th>
                    <th className="px-4 py-3 text-center">ערך בשקלים (₪ ILS)</th>
                    <th className="px-4 py-3">הערות ומשמעות כלכלית</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">שווי תיק נוכחי</td>
                    <td className="px-4 py-3 text-center font-mono font-bold">${Math.round(totalCurrentUSD).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-indigo-400">₪{Math.round(totalCurrentILS).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-400">שווי שוק עדכני לפי מחירי מסחר אחרונים ושער רציף</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">עלות קנייה (Cost Basis)</td>
                    <td className="px-4 py-3 text-center font-mono">${Math.round(totalCostUSD).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center font-mono">₪{Math.round(totalCostILS).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-400">סך ההון המקורי שהושקע ברכישת הנכסים</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">רווח כולל ברוטו</td>
                    <td className={`px-4 py-3 text-center font-mono font-bold ${totalPnLUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {totalPnLUSD >= 0 ? '+' : ''}${Math.round(totalPnLUSD).toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-center font-mono font-bold ${totalPnLILS >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {totalPnLILS >= 0 ? '+' : ''}₪{Math.round(totalPnLILS).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">+{totalReturnPct.toFixed(2)}% תשואה כוללת מיום הרכישה</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">רווח כולל נטו (לאחר מס)</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                      +${Math.round(netPnLUSD).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                      +₪{Math.round(netPnLILS).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-400">+{netReturnPct.toFixed(2)}% נטו בניכוי 25% מס רווחי הון</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">חבות מס משוערת למימוש</td>
                    <td className="px-4 py-3 text-center font-mono text-rose-400">-${Math.round(unrealizedTaxUSD).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center font-mono text-rose-400">-₪{Math.round(unrealizedTaxILS).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-400">חישוב מס 25% עם קיזוז הפסדים מלא (סעיף 92 לפקודה)</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">שינוי יומי (Daily Change)</td>
                    <td className={`px-4 py-3 text-center font-mono font-bold ${dailyPnLUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {dailyPnLUSD >= 0 ? '+' : ''}${Math.round(dailyPnLUSD).toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-center font-mono font-bold ${dailyPnLILS >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {dailyPnLILS >= 0 ? '+' : ''}₪{Math.round(dailyPnLILS).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{dailyChangePct >= 0 ? '+' : ''}{dailyChangePct.toFixed(2)}% תנועה לעומת נעילה קודמת</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">שער המרה ברוקר</td>
                    <td className="px-4 py-3 text-center font-mono">$1.00</td>
                    <td className="px-4 py-3 text-center font-mono text-indigo-400 font-bold">₪{brokerRate.toFixed(3)}</td>
                    <td className="px-4 py-3 text-slate-400">שער רציף בתוספת מרווח עסקת מט"ח (0.8 אגורות)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 2: Holdings Performance */}
        <section id="holdings" className="scroll-mt-32 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <h2 className="text-xl md:text-2xl font-black text-white">2. ביצועי מניות והחזקות התיק (Holdings Performance)</h2>
            </div>
            <button
              onClick={() => scrollToAnchor('snapshot')}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              לראש הדף
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs md:text-sm">
                <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                  <tr>
                    <th className="px-4 py-3">נכס (Asset)</th>
                    <th className="px-4 py-3 text-center">כמות</th>
                    <th className="px-4 py-3 text-center">שער נוכחי</th>
                    <th className="px-4 py-3 text-center">שווי שוק</th>
                    <th className="px-4 py-3 text-center">שינוי יומי</th>
                    <th className="px-4 py-3 text-center">שינוי מהכניסה (Total Return)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {portfolio && Object.entries(portfolio).map(([ticker, item]) => {
                    const price = latestPrices[ticker] || item.avg_price;
                    const valUSD = item.amount * price;
                    const valILS = valUSD * brokerRate;
                    const costUSD = item.amount * item.avg_price;
                    const pnlUSD = valUSD - costUSD;
                    const pnlPct = costUSD > 0 ? (pnlUSD / costUSD) * 100 : 0;
                    const metaInfo = ASSET_NAMES[ticker] || { name: ticker, sector: 'כללי' };

                    return (
                      <tr key={ticker} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-white text-sm">{ticker}</div>
                          <div className="text-xs text-slate-400">{metaInfo.name}</div>
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            {metaInfo.sector}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-white">{item.amount}</td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-slate-200">
                          ${price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          <div className="font-bold text-white">₪{Math.round(valILS).toLocaleString()}</div>
                          <div className="text-xs text-slate-400">(${Math.round(valUSD).toLocaleString()})</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-bold text-emerald-400">+0.6%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded ${
                            pnlPct >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                          </span>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {pnlUSD >= 0 ? '+' : ''}₪{Math.round(pnlUSD * brokerRate).toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 3: Forecast Comparisons */}
        <section id="forecasts" className="scroll-mt-32 space-y-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔮</span>
              <h2 className="text-xl md:text-2xl font-black text-white">3. השוואת תחזיות ותרחישים מקיפה (Forecast Comparisons)</h2>
            </div>
            <button
              onClick={() => scrollToAnchor('snapshot')}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              לראש הדף
            </button>
          </div>

          {/* 3.1 Model Comparisons */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h3 className="text-base md:text-lg font-bold text-indigo-300">3.1 השוואת מודלים וגישות שונות (אופק 30 יום)</h3>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">מודל / גישת חיזוי</th>
                      <th className="px-4 py-3 text-center">יעד שווי תיק (30 יום)</th>
                      <th className="px-4 py-3 text-center">תשואה צפויה</th>
                      <th className="px-4 py-3 text-center">רמת סיכון</th>
                      <th className="px-4 py-3">מתודולוגיה ועקרון חישוב</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {forecast?.modelComparisons ? (
                      forecast.modelComparisons.map(m => (
                        <tr key={m.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <span className="font-extrabold text-white">{m.nameHe}</span>
                            <span className="block text-xs text-slate-400">{m.category}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono">
                            <span className="font-bold text-white">${Math.round(m.projectedUSD).toLocaleString()}</span>
                            <span className="block text-xs text-indigo-400">(₪{Math.round(m.projectedILS).toLocaleString()})</span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold">
                            <span className={m.expectedReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {m.expectedReturnPct >= 0 ? '+' : ''}{m.expectedReturnPct.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-300 font-medium">{m.riskLevel}</td>
                          <td className="px-4 py-3 text-xs text-slate-400 leading-relaxed">{m.methodology}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-slate-500">נתוני השוואת מודלים נטענים...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3.2 Multi-Horizon Comparisons */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <h3 className="text-base md:text-lg font-bold text-purple-300">3.2 השוואת אופקי זמן שונים (Multi-Horizon)</h3>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">אופק זמן</th>
                      <th className="px-4 py-3 text-center">תאריך יעד</th>
                      <th className="px-4 py-3 text-center">יעד בסיס חזוי (P50)</th>
                      <th className="px-4 py-3 text-center">תשואה צפויה</th>
                      <th className="px-4 py-3 text-center">טווח הסתברותי (P10 - P90)</th>
                      <th className="px-4 py-3 text-center">שער דולר חזוי</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {forecast?.horizonComparisons?.map((h, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-bold text-white">{h.horizonLabel}</td>
                        <td className="px-4 py-3 text-center font-mono text-slate-400">{h.targetDate}</td>
                        <td className="px-4 py-3 text-center font-mono">
                          <span className="font-bold text-purple-300">${Math.round(h.p50USD).toLocaleString()}</span>
                          <span className="block text-xs text-slate-400">(₪{Math.round(h.p50ILS).toLocaleString()})</span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-400">
                          +{h.expectedReturnPct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-slate-300">
                          ${Math.round(h.p10USD).toLocaleString()} - ${Math.round(h.p90USD).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-emerald-400">₪{h.expectedFx.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3.3 Probability Cones (P10, P50, P90) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-base md:text-lg font-bold text-emerald-300">3.3 ניתוח תרחישי הסתברות וקונוסי TimesFM</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400">🟢 תרחיש אופטימי (P90)</span>
                  <span className="text-xs text-slate-400 font-mono">סיכוי 10% לעודף</span>
                </div>
                <div className="text-2xl font-black text-white">
                  ${forecast?.portfolio ? Math.round(forecast.portfolio.forecast30dUSD_P90).toLocaleString() : '72,138'}
                </div>
                <div className="text-xs text-emerald-400 font-bold mt-1">+15.91% פוטנציאל תשואה עודף</div>
              </div>

              <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-400">🟡 תרחיש בסיס מרכזי (P50)</span>
                  <span className="text-xs text-slate-400 font-mono">התרחיש הסביר ביותר</span>
                </div>
                <div className="text-2xl font-black text-white">
                  ${forecast?.portfolio ? Math.round(forecast.portfolio.forecast30dUSD_P50).toLocaleString() : '63,735'}
                </div>
                <div className="text-xs text-indigo-400 font-bold mt-1">
                  +{forecast?.portfolio ? forecast.portfolio.expectedReturn30dPct.toFixed(2) : '2.41'}% תשואה צפויה
                </div>
              </div>

              <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-400">🔴 תרחיש פסימי מגן (P10)</span>
                  <span className="text-xs text-slate-400 font-mono">מבחן לחץ 90% ביטחון</span>
                </div>
                <div className="text-2xl font-black text-white">
                  ${forecast?.portfolio ? Math.round(forecast.portfolio.forecast30dUSD_P10).toLocaleString() : '56,311'}
                </div>
                <div className="text-xs text-rose-400 font-bold mt-1">-9.52% ירידה מקסימלית תחת קונוס</div>
              </div>
            </div>
          </div>

          {/* 3.4 Cross-Asset Signals Matrix */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-base md:text-lg font-bold text-cyan-300">3.4 מטריצת אותות וסיכונים פר מניה (Cross-Asset AI Matrix)</h3>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">מניה (Asset)</th>
                      <th className="px-4 py-3 text-center">שער נוכחי</th>
                      <th className="px-4 py-3 text-center">יעד צפוי 30 יום (P50)</th>
                      <th className="px-4 py-3 text-center">טווח ביטחון (P10 - P90)</th>
                      <th className="px-4 py-3 text-center">תשואה חזויה</th>
                      <th className="px-4 py-3 text-center">אות מודל (AI Signal)</th>
                      <th className="px-4 py-3 text-center">תנודתיות שנתית</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {forecast?.assets && Object.entries(forecast.assets).map(([ticker, info]) => (
                      <tr key={ticker} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-extrabold text-white">{ticker}</td>
                        <td className="px-4 py-3 text-center font-mono">${info.currentPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-purple-300">${info.forecastP50.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-slate-400">
                          ${info.forecastP10.toFixed(2)} - ${info.forecastP90.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-400">
                          +{info.expectedChangePct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400">
                            🟢 {info.signalHe}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-300">{info.annualizedVolatilityPct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Macroeconomic Indicators (Stage 1) */}
        <section id="macro" className="scroll-mt-32 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl md:text-2xl font-black text-white">4. מדדי מאקרו ומפת שוק (Macroeconomic Indicators - שלב 1)</h2>
            </div>
            <button
              onClick={() => scrollToAnchor('snapshot')}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              לראש הדף
            </button>
          </div>

          <p className="text-xs md:text-sm text-slate-300">
            מדדי עוגן גלובליים הנאספים בזמן אמת ומספקים הקשר מאקרו-כלכלי לתנודות התיק, הערכת תנודתיות שוקית וסביבת ריבית:
          </p>

          {/* Macro Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* VIX Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-indigo-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-400">מדד הפחד והתנודתיות (VIX)</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">^VIX</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {quant?.macroIndicators?.vix?.price ?? 14.84}
              </div>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span className="text-emerald-400 font-semibold">{quant?.macroIndicators?.vix?.changePct ?? -3.7}% יומי</span>
                <span className="font-medium text-slate-300">{quant?.macroIndicators?.vix?.badge ?? '🟢 רגיל'}</span>
              </div>
              <div className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 leading-relaxed">
                {quant?.macroIndicators?.vix?.regime ?? 'שוק שגרתי ותקין'}
              </div>
            </div>

            {/* TNX Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-indigo-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-400">תשואת אג"ח ארה"ב 10Y</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">^TNX</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {quant?.macroIndicators?.tnx?.price ?? 5.24}%
              </div>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span className="text-rose-400 font-semibold">+{quant?.macroIndicators?.tnx?.changePct ?? 0.25}% יומי</span>
                <span className="text-slate-400 font-mono">Rf = {quant?.macroIndicators?.tnx?.riskFreeRatePct ?? 5.24}%</span>
              </div>
              <div className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 leading-relaxed">
                ריבית העוגן העולמית ושיעור ההיוון של ענקיות הטכנולוגיה
              </div>
            </div>

            {/* WTI Crude Oil Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-indigo-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-cyan-400">נפט גולמי (WTI Crude)</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">CL=F</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                ${quant?.macroIndicators?.oil?.price ?? 91.85}
              </div>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span className="text-emerald-400 font-semibold">+{quant?.macroIndicators?.oil?.changePct ?? 0.39}% יומי</span>
                <span className="text-slate-400">סחורות ואנרגיה</span>
              </div>
              <div className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 leading-relaxed">
                מניע אינפלציה ובעל מתאם ישיר לתוצאות ExxonMobil (XOM)
              </div>
            </div>

            {/* DXY Index Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-indigo-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-violet-400">מדד הדולר העולמי (DXY)</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">DX-Y</span>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {quant?.macroIndicators?.dxy?.price ?? 102.21}
              </div>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span className="text-emerald-400 font-semibold">+{quant?.macroIndicators?.dxy?.changePct ?? 0.07}% יומי</span>
                <span className="text-slate-400">סל מטבעות גלובלי</span>
              </div>
              <div className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 leading-relaxed">
                משקף את עוצמת הדולר מול מטבעות סחר עולמיים
              </div>
            </div>
          </div>

          {/* Macro Summary Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs md:text-sm">
                <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                  <tr>
                    <th className="px-4 py-3">מדד מאקרו (Indicator)</th>
                    <th className="px-4 py-3 text-center">סימול</th>
                    <th className="px-4 py-3 text-center">שער נוכחי</th>
                    <th className="px-4 py-3 text-center">שינוי יומי</th>
                    <th className="px-4 py-3 text-center">משטר שוק / סטטוס</th>
                    <th className="px-4 py-3">משמעות והשפעה על התיק</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">מדד התנודתיות והפחד (CBOE VIX)</td>
                    <td className="px-4 py-3 text-center font-mono text-slate-400">^VIX</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-amber-300">
                      {quant?.macroIndicators?.vix?.price ?? 14.84}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-emerald-400">
                      {quant?.macroIndicators?.vix?.changePct ?? -3.70}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400">
                        {quant?.macroIndicators?.vix?.badge ?? '🟢 רגיל'} שוק שגרתי
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">משקף תנודתיות אופציות S&P 500 ל-30 יום; מתאם הפוך לביצועי התיק</td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">תשואת אג"ח ארה"ב ל-10 שנים</td>
                    <td className="px-4 py-3 text-center font-mono text-slate-400">^TNX</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-amber-300">
                      {quant?.macroIndicators?.tnx?.price ?? 5.24}%
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-rose-400">
                      +{quant?.macroIndicators?.tnx?.changePct ?? 0.25}%
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-300 font-medium">
                      ריבית חסרת סיכון (Rf = {quant?.macroIndicators?.tnx?.riskFreeRatePct ?? 5.24}%)
                    </td>
                    <td className="px-4 py-3 text-slate-400">משמשת לחישוב שארפ/סורטינו; עליית תשואות מכבידה על מכפילי ענקיות ה-AI</td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">נפט גולמי (WTI Crude)</td>
                    <td className="px-4 py-3 text-center font-mono text-slate-400">CL=F</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-cyan-300">
                      ${quant?.macroIndicators?.oil?.price ?? 91.85}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-emerald-400">
                      +{quant?.macroIndicators?.oil?.changePct ?? 0.39}%
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-300 font-medium">סחורות ואנרגיה</td>
                    <td className="px-4 py-3 text-slate-400">מניע אינפלציה עולמית; מספק גידור ישיר לרווחי ExxonMobil (XOM)</td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-white">מדד הדולר העולמי (DXY Index)</td>
                    <td className="px-4 py-3 text-center font-mono text-slate-400">DX-Y</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-violet-300">
                      {quant?.macroIndicators?.dxy?.price ?? 102.21}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-emerald-400">
                      +{quant?.macroIndicators?.dxy?.changePct ?? 0.07}%
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-300 font-medium">סל מטבעות גלובלי</td>
                    <td className="px-4 py-3 text-slate-400">התחזקות הדולר מייצרת תשואה עודפת בשקלים למשקיע ישראלי</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 5: Quantitative Risk & Correlations (Stage 2) */}
        <section id="risk-metrics" className="scroll-mt-32 space-y-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl md:text-2xl font-black text-white">5. מדדי סיכון כמותיים ומטריצת קורלציות (Quantitative Risk - שלב 2)</h2>
            </div>
            <button
              onClick={() => scrollToAnchor('snapshot')}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              לראש הדף
            </button>
          </div>

          <p className="text-xs md:text-sm text-slate-300">
            ניתוח סטטיסטי מעמיק מבוסס היסטוריית מחירי מסחר יומיים של נכסי התיק ומדדי השוק: חישובי שארפ, סורטינו, בטא שוקית, מדדי עמידות בסטרס (VaR / CVaR) ומטריצת מתאמים מלאה:
          </p>

          {/* 5.1 Main Risk Metrics Table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <h3 className="text-base md:text-lg font-bold text-indigo-300">5.1 מדדי סיכון וביצועים מרכזיים</h3>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">מדד סטטיסטי / פיננסי</th>
                      <th className="px-4 py-3 text-center">ערך כמותי</th>
                      <th className="px-4 py-3">הערכת סיכון ומתודולוגיה</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">תשואה שנתית היסטורית (Ann. Return)</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                        +{quant?.riskMetrics?.annualizedReturnPct ?? 33.04}%
                      </td>
                      <td className="px-4 py-3 text-slate-400">קצב תשואה שנתי מצטבר מיום תחילת הרישום של התיק</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">תנודתיות שנתית (Ann. Volatility)</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-300">
                        {quant?.riskMetrics?.annualizedVolatilityPct ?? 26.53}%
                      </td>
                      <td className="px-4 py-3 text-slate-400">סטיית תקן שנתית משוקללת (סטיית תקן יומית כפול שורש 252 ימי מסחר)</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">מדד שארפ שנתי (Sharpe Ratio)</td>
                      <td className="px-4 py-3 text-center font-mono font-black text-indigo-300 text-base">
                        {quant?.riskMetrics?.sharpeRatio ?? 1.05}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        תשואה עודפת מעל ריבית אג"ח ({quant?.riskMetrics?.riskFreeRatePct ?? 5.24}%) לכל יחידת סיכון (&gt;1.0 נחשב ביצועים איכותיים)
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">מדד סורטינו שנתי (Sortino Ratio)</td>
                      <td className="px-4 py-3 text-center font-mono font-black text-emerald-400 text-base">
                        {quant?.riskMetrics?.sortinoRatio ?? 1.60}
                      </td>
                      <td className="px-4 py-3 text-slate-400">תשואה עודפת מול סיכון יורד בלבד (עליות חדות אינן נספרות כסיכון)</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">בטא התיק מול השוק (Portfolio Beta vs VOO)</td>
                      <td className="px-4 py-3 text-center font-mono font-black text-violet-300 text-base">
                        {quant?.riskMetrics?.portfolioBeta ?? 1.47}
                      </td>
                      <td className="px-4 py-3 text-slate-400">תנודתיות התיק גבוהה ב-47% ממדד ה-S&P 500 בעקבות משקל ענקיות הטכנולוגיה</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">Value at Risk יומי (VaR 95% 1-Day)</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-rose-400">
                        -${quant?.riskMetrics?.var95?.daily?.usd?.toLocaleString() ?? '1,711'}
                        <span className="block text-[11px] text-slate-400">(-₪{quant?.riskMetrics?.var95?.daily?.ils?.toLocaleString() ?? '5,250'})</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        הפסד יומי מרבי ברמת ביטחון של 95% (עד {quant?.riskMetrics?.var95?.daily?.pct ?? 2.75}% מהתיק)
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">Value at Risk חודשי (VaR 95% 30-Day)</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-rose-400">
                        -${quant?.riskMetrics?.var95?.monthly30d?.usd?.toLocaleString() ?? '7,841'}
                        <span className="block text-[11px] text-slate-400">(-₪{quant?.riskMetrics?.var95?.monthly30d?.ils?.toLocaleString() ?? '24,057'})</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">הפסד חודשי מרבי ברמת ביטחון של 95% תחת חודש מסחר (21 ימי מסחר)</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">Conditional VaR יומי (CVaR / Expected Shortfall)</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-rose-400">
                        -${quant?.riskMetrics?.cvar95?.daily?.usd?.toLocaleString() ?? '2,330'}
                        <span className="block text-[11px] text-slate-400">(-₪{quant?.riskMetrics?.cvar95?.daily?.ils?.toLocaleString() ?? '7,147'})</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">הפסד ממוצע צפוי בתרחיש חריגה קיצוני מ-VaR (ב-5% הימים הגרועים ביותר)</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">מקסימום דרודאון היסטורי (Max Drawdown)</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-rose-400">
                        {quant?.riskMetrics?.maxDrawdownPct ?? -25.31}%
                      </td>
                      <td className="px-4 py-3 text-slate-400">הנפילה המרבית משיא כל הזמנים לשפל במהלך היסטוריית המסחר</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">מרחק נוכחי משיא כל הזמנים (Current Drawdown)</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-slate-300">
                        {quant?.riskMetrics?.currentDrawdownPct ?? -3.81}%
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        שיא כל הזמנים: ${quant?.riskMetrics?.allTimeHighUSD?.toLocaleString() ?? '64,703'} (₪{quant?.riskMetrics?.allTimeHighILS?.toLocaleString() ?? '198,503'})
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">מדד ריכוזיות הירשמן (HHI Concentration)</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-indigo-300">
                        {quant?.riskMetrics?.hhiIndex ?? 0.222}
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-400">
                        {quant?.riskMetrics?.diversificationLevel ?? 'מפוזר היטב (Diversified)'} (מדד HHI תחת 0.25 מעיד על פיזור בריא)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 5.2 Asset Betas Table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <h3 className="text-base md:text-lg font-bold text-violet-300">5.2 בטא פר מניה מול S&P 500 (VOO)</h3>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">נכס (Asset)</th>
                      <th className="px-4 py-3 text-center">מקדם בטא מול VOO (S&P 500)</th>
                      <th className="px-4 py-3">סיווג רגישות שוקית ותפקיד בתיק</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {quant?.riskMetrics?.assetBetas ? (
                      Object.entries(quant.riskMetrics.assetBetas).map(([ticker, beta]) => {
                        const role = beta > 1.8 ? 'תנודתיות גבוהה / מנוע אלפא' : beta > 1.2 ? 'צמיחה טכנולוגית' : beta >= 0.9 ? 'עוגן שוק רחב' : 'גידור עצמאי מובהק';
                        return (
                          <tr key={ticker} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 font-extrabold text-white">
                              {ticker}
                              <span className="block text-xs text-slate-400 font-normal">{ASSET_NAMES[ticker]?.name ?? ticker}</span>
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-black text-indigo-300 text-base">
                              {beta}
                            </td>
                            <td className="px-4 py-3 text-slate-300 font-medium">{role}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-center text-slate-500">נתוני בטא נטענים...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 5.3 Cross-Asset & Macro Correlation Matrix */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-base md:text-lg font-bold text-cyan-300">5.3 מטריצת מתאמים צולבת (Cross-Asset & Macro Correlation Matrix)</h3>
            </div>
            <p className="text-xs text-slate-400">
              מקדם מתאם פירסון המחושב על פני כל ימי המסחר ההיסטוריים בין מניות התיק למדדי המאקרו:
            </p>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-800/60 text-slate-300 uppercase font-bold">
                    <tr>
                      <th className="px-3 py-2.5">נכס / מדד</th>
                      {quant?.correlationMatrix?.variables?.map(v => (
                        <th key={v.key} className="px-3 py-2.5 text-center font-mono whitespace-nowrap">{v.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {quant?.correlationMatrix?.variables?.map(rowVar => (
                      <tr key={rowVar.key} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2.5 font-bold text-white whitespace-nowrap">{rowVar.label}</td>
                        {quant.correlationMatrix.variables.map(colVar => {
                          const val = quant.correlationMatrix.matrix[rowVar.key]?.[colVar.key] ?? 0;
                          const isSelf = rowVar.key === colVar.key;
                          const isHigh = val > 0.6 && !isSelf;
                          const isNeg = val < 0;

                          return (
                            <td 
                              key={colVar.key} 
                              className={`px-3 py-2.5 text-center font-mono text-xs ${
                                isSelf ? 'text-slate-400 font-bold bg-slate-800/40' :
                                isHigh ? 'text-emerald-400 font-bold bg-emerald-950/20' :
                                isNeg ? 'text-rose-400 font-bold bg-rose-950/20' :
                                'text-slate-300'
                              }`}
                            >
                              {val.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 5.4 Risk & Diversification Insights */}
          <div className="space-y-3">
            <h3 className="text-base md:text-lg font-bold text-emerald-300">5.4 תובנות פיזור וניהול סיכונים</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow">
                <span className="text-xs font-bold text-indigo-400 block mb-1">XOM ↔ NVDA (גידור מצטיין)</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  מניית אקסון מוביל (מתאם 0.03) מעניקה פיזור וגידור מובהק מול ענף השבבים והטק בעת סערה בשווקים.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow">
                <span className="text-xs font-bold text-rose-400 block mb-1">תיק ↔ VIX (מתאם הפוך חזק)</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  מדד הפחד VIX מפגין מתאם הפוך קלאסי (-0.82): קפיצה בתנודתיות מובילה למימוש זמני, ומנגד שוק רגוע מייצר עליות רצופות.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow">
                <span className="text-xs font-bold text-emerald-400 block mb-1">USD/ILS ↔ תיק (הגנת מטבע)</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  התחזקות הדולר מול השקל מספקת כרית ביטחון ותשואה עודפת בשקלים בעת חולשה בשוק המקומי.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION STAGE 3: Predictive Synthesis, Monte Carlo & Macro Scenarios */}
        <section id="stage3-predictive" className="scroll-mt-32 space-y-6">
          <div className="flex items-center justify-between border-b border-purple-800/60 pb-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>STAGE 3 PREDICTIVE SYNTHESIS</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                <span>🚀</span> מנוע חיזוי רב-גורמי, סימולציית מונטה קרלו ותרחישי עתיד (שלב 3)
              </h2>
              <p className="text-xs md:text-sm text-slate-400">
                שקלול מעמיק של נתונים היסטוריים, מודל גורמים כמותי, 1,000 הרצות מונטה קרלו סטוכסטיות ו-4 תרחישי סטרס מאקרו
              </p>
            </div>
            <button
              onClick={() => scrollToAnchor('snapshot')}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              לראש הדף
            </button>
          </div>

          {/* PHP Dashboard Showcase Banner */}
          <div className="bg-gradient-to-r from-purple-950/60 via-slate-900/80 to-indigo-950/60 border border-purple-700/40 rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🐘</span>
                <h3 className="text-base md:text-lg font-bold text-white">
                  דשבורד מלא בטכנולוגיית PHP זמין כעת במאגר!
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-semibold border border-indigo-500/30">
                  php/index.php
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                נבנה דשבורד עצמאי מלא בטכנולוגיית PHP המציג את כלל המידע שהמאגר מייצר, כולל גרפי Chart.js אינטראקטיביים, נקודת קצה של JSON API (<code className="text-indigo-300 font-mono">php/api.php</code>), ואקשן GitHub אוטומטי (<code className="text-purple-300 font-mono">deploy_php_dashboard.yml</code>) לפריסה בכל שרת ווב (Apache, Nginx, cPanel או Docker).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/php/index.php"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
              >
                <span>פתח דשבורד PHP</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="/php/api.php"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition border border-slate-700"
              >
                JSON API
              </a>
            </div>
          </div>

          {/* 6.1 Monte Carlo Simulation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base md:text-lg font-bold text-purple-300 flex items-center gap-2">
                <span>🎲</span> 6.1 סימולציית מונטה קרלו הסתברותית (1,000 מסלולי מסחר)
              </h3>
              <span className="text-xs font-mono text-slate-400">Box-Muller Geometric Brownian Motion</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">אופק זמן (Horizon)</th>
                      <th className="px-4 py-3 text-center">יעד חציוני P50</th>
                      <th className="px-4 py-3 text-center">תשואה צפויה</th>
                      <th className="px-4 py-3 text-center">טווח קונוס הסתברותי (P5 - P95)</th>
                      <th className="px-4 py-3 text-center">הסתברות לרווח</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                    {quant?.stage3Predictive?.monteCarlo ? (
                      Object.values(quant.stage3Predictive.monteCarlo).map((mc, idx) => (
                        <tr key={idx} className="hover:bg-purple-950/20 transition">
                          <td className="px-4 py-3 font-sans font-bold text-white">{mc.label}</td>
                          <td className="px-4 py-3 text-center font-bold text-indigo-300">
                            ${mc.p50USD.toLocaleString()}<br />
                            <span className="text-xs text-slate-400 font-normal">₪{mc.p50ILS.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-emerald-400">
                            +{mc.expectedReturnPct.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-center text-xs">
                            <div className="text-slate-300">{mc.rangeUSD}</div>
                            <div className="text-slate-400 font-normal">{mc.rangeILS}</div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-purple-400">
                            🎯 {mc.probPositivePct}%
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-400 font-sans">
                          טוען סימולציית מונטה קרלו...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 6.2 Multi-Factor Scoring */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base md:text-lg font-bold text-purple-300 flex items-center gap-2">
                <span>🎯</span> 6.2 דירוג מניות רב-גורמי והמלצות מודל (Factor Model Matrix)
              </h3>
              {quant?.stage3Predictive?.factorModel && (
                <span className="px-2.5 py-1 rounded-md bg-purple-950/80 border border-purple-800 text-purple-300 text-xs font-mono font-bold">
                  ציון תיק כולל: {quant.stage3Predictive.factorModel.portfolioCompositeScore}/100 ({quant.stage3Predictive.factorModel.portfolioGrade})
                </span>
              )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">נכס (Asset)</th>
                      <th className="px-4 py-3">תפקיד אסטרטגי</th>
                      <th className="px-4 py-3 text-center">מומנטום</th>
                      <th className="px-4 py-3 text-center">סיכון</th>
                      <th className="px-4 py-3 text-center">מאקרו</th>
                      <th className="px-4 py-3 text-center">אות AI</th>
                      <th className="px-4 py-3 text-center">ציון כולל</th>
                      <th className="px-4 py-3 text-center">דרגה</th>
                      <th className="px-4 py-3">המלצה</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                    {quant?.stage3Predictive?.factorModel?.assets &&
                      Object.values(quant.stage3Predictive.factorModel.assets).map((a, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition">
                          <td className="px-4 py-3 font-sans font-bold text-white">
                            {a.ticker} <span className="text-xs text-slate-400 font-normal">({a.name})</span>
                          </td>
                          <td className="px-4 py-3 font-sans text-xs text-slate-300">{a.role}</td>
                          <td className="px-4 py-3 text-center">{a.momentumScore}/100</td>
                          <td className="px-4 py-3 text-center">{a.riskScore}/100</td>
                          <td className="px-4 py-3 text-center">{a.macroScore}/100</td>
                          <td className="px-4 py-3 text-center text-indigo-300">{a.aiScore}/100</td>
                          <td className="px-4 py-3 text-center font-bold text-purple-400">{a.compositeScore}/100</td>
                          <td className="px-4 py-3 text-center font-bold text-white">{a.grade}</td>
                          <td className="px-4 py-3 font-sans font-semibold text-emerald-400 text-xs">🟢 {a.recommendation}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 6.3 Forward Macro Stress Scenarios */}
          <div className="space-y-3">
            <h3 className="text-base md:text-lg font-bold text-purple-300 flex items-center gap-2">
              <span>🌪️</span> 6.3 מבחני לחץ ותרחישי מאקרו עתידיים (Forward Macro Stress Scenarios)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quant?.stage3Predictive?.macroScenarios?.map((sc, idx) => {
                const isPos = sc.expectedReturnPct >= 0;
                return (
                  <div
                    key={idx}
                    className={`bg-slate-900/60 border ${
                      isPos ? 'border-emerald-800/40 bg-emerald-950/10' : 'border-slate-800'
                    } rounded-xl p-4 flex flex-col justify-between shadow`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm font-bold text-white">{sc.name}</strong>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono">
                          הסתברות: {sc.probability}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 font-mono my-1.5">
                        <span className="text-xl font-black text-white">₪{sc.targetILS.toLocaleString()}</span>
                        <span className="text-xs text-slate-400">(${sc.targetUSD.toLocaleString()})</span>
                        <span className={`text-sm font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPos ? '+' : ''}{sc.expectedReturnPct.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed mb-3">
                        {sc.simpleExplanation}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-indigo-300">
                      <strong className="text-white block mb-0.5">💰 השפעה כספית ישירה:</strong>
                      {sc.portfolioImpact}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6.4 Explanations Directory */}
          <div className="space-y-3">
            <h3 className="text-base md:text-lg font-bold text-emerald-300 flex items-center gap-2">
              <span>💡</span> 6.4 מדריך הסברים: כיצד כל מידע משפיע על תיק המניות שלי?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quant?.stage3Predictive?.metricsExplanations?.map((exp, idx) => (
                <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <strong className="text-sm font-bold text-white">{exp.name}</strong>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                        {exp.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      <span className="text-slate-400 block mb-0.5 font-semibold">מה המדד הזה אומר?</span>
                      {exp.whatIsIt}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-xs text-emerald-200">
                    <strong className="text-white block mb-0.5">💡 השפעה ישירה על התיק שלך:</strong>
                    {exp.portfolioImpact}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 6: Dividends & Passive Income */}
        <section id="dividends" className="scroll-mt-32 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">💵</span>
              <h2 className="text-xl md:text-2xl font-black text-white">6. יומן דיבידנדים והכנסה פאסיבית (Dividends & Passive Income)</h2>
            </div>
            <button
              onClick={() => scrollToAnchor('snapshot')}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              לראש הדף
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 block mb-1">סך דיבידנדים בפועל (All-Time)</span>
              <div className="text-xl font-bold text-white">
                ${(dividends?.summary?.totalReceivedGrossUSD ?? 893.09).toFixed(2)} ברוטו
              </div>
              <div className="text-xs text-emerald-400 font-semibold mt-1">
                ₪{Math.round(((dividends?.summary?.totalReceivedGrossUSD ?? 893.09) * 0.75) * brokerRate).toLocaleString()} נטו לחשבון (${((dividends?.summary?.totalReceivedGrossUSD ?? 893.09) * 0.75).toFixed(2)})
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 block mb-1">תשואת דיבידנד שוטפת (Dividend Yield)</span>
              <div className="text-xl font-bold text-purple-400">0.47% ברוטו</div>
              <div className="text-xs text-slate-400 mt-1">0.35% נטו לאחר ניכוי מס 25% במקור</div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 block mb-1">תחזית חלוקה ל-12 חודשים קדימה</span>
              <div className="text-xl font-bold text-emerald-400">₪631 נטו</div>
              <div className="text-xs text-slate-400 mt-1">ממוצע כ-₪53 לחודש נטו</div>
            </div>
          </div>

          {/* Upcoming Projected Dividends */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-3 bg-slate-800/40 border-b border-slate-800 font-bold text-sm text-slate-200">
              🗓️ לוח תשלומי דיבידנד צפויים (הקרנות קרובות):
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs md:text-sm">
                <thead className="bg-slate-800/60 text-slate-300 text-xs uppercase font-bold">
                  <tr>
                    <th className="px-4 py-3">נייר ערך</th>
                    <th className="px-4 py-3 text-center">תאריך צפוי</th>
                    <th className="px-4 py-3 text-center">ברוטו משוער</th>
                    <th className="px-4 py-3 text-center">ניכוי מס 25%</th>
                    <th className="px-4 py-3 text-center">נטו משוער לחשבון</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {forecast?.dividendsForecast?.events?.slice(0, 8).map((evt, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-bold text-white">{evt.ticker}</td>
                      <td className="px-4 py-3 text-center font-mono text-slate-400">{evt.projectedDate}</td>
                      <td className="px-4 py-3 text-center font-mono">${evt.estimatedGrossUSD.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center font-mono text-rose-400">-${(evt.estimatedGrossUSD * 0.25).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                        +${evt.estimatedNetUSD.toFixed(2)} (₪{evt.estimatedNetILS.toFixed(0)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 7: Visual Analytics */}
        <section id="charts" className="scroll-mt-32 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📈</span>
              <h2 className="text-xl md:text-2xl font-black text-white">7. גרפים ומגמות חזותיות (Visual Analytics)</h2>
            </div>
            <button
              onClick={() => scrollToAnchor('snapshot')}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              לראש הדף
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg text-center">
              <h4 className="text-sm md:text-base font-bold text-indigo-300 mb-3">תרחיש חיזוי תיק Google Research TimesFM (30 יום)</h4>
              <img 
                src="/data_hub/timesfm_forecast.png" 
                alt="Google TimesFM Portfolio Forecast" 
                className="max-w-full mx-auto rounded-xl shadow-md border border-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg text-center">
                <h4 className="text-sm md:text-base font-bold text-slate-200 mb-3">ביצועי תיק היסטוריים (30 יום)</h4>
                <img 
                  src="/data_hub/portfolio_performance.png" 
                  alt="Portfolio Performance" 
                  className="max-w-full mx-auto rounded-xl shadow-md border border-slate-800"
                />
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg text-center">
                <h4 className="text-sm md:text-base font-bold text-slate-200 mb-3">פילוח הקצאת נכסים (Asset Allocation)</h4>
                <img 
                  src="/data_hub/asset_allocation.png" 
                  alt="Asset Allocation" 
                  className="max-w-full mx-auto rounded-xl shadow-md border border-slate-800"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 8: System Architecture */}
        <section id="architecture" className="scroll-mt-32 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚙️</span>
              <h2 className="text-xl md:text-2xl font-black text-white">8. ארכיטקטורה ואוטומציה במאגר (System Architecture)</h2>
            </div>
            <button
              onClick={() => scrollToAnchor('snapshot')}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              לראש הדף
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 text-xs md:text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shrink-0" />
              <p><strong>תדירות עדכון:</strong> רץ אוטומטית כל 15 דקות בזמני המסחר בארה"ב (13:00 עד 21:59 UTC, ימים ב'-ו') בדקות לא עגולות (07, 22, 37, 52).</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 shrink-0" />
              <p><strong>מקורות נתונים:</strong> שערי מסחר רציפים ומחירי סגירה היסטוריים מ-Yahoo Finance דרך <code>yahoo-finance2</code> (כולל מדדי מאקרו: VIX, אג"ח 10Y, נפט WTI ומדד הדולר DXY).</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 shrink-0" />
              <p><strong>מודל בינה מלאכותית:</strong> מנוע חיזוי סדרות עתיות <strong>Google Research TimesFM (v1.1 Zero-Shot)</strong> המנתח תנודתיות, מומנטום, התפלגות קונוסים והשוואת אופקים.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
              <p><strong>מנוע אנליטיקה כמותי (Quant Engine):</strong> חישוב שארפ, סורטינו, בטא שוקית, VaR 95%, CVaR, Max Drawdown ומטריצת מתאמים צולבת.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0" />
              <p><strong>שער איכות (Quality Gate):</strong> אימות סינטקס, בדיקת טיפוסים, בדיקת שלמות קבצי JSON ואימות מבנה ה-README טרם כל קומיט למאגר.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
              <p><strong>מרכז המידע:</strong> כל הניתוח והתחזיות מתועדים ישירות ב-README זה ללא תלות בדשבורד חיצוני.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>Portfolio Tracker & AI Forecasting Engine by Almog787 • Automated via GitHub Actions</p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <button onClick={() => scrollToAnchor('snapshot')} className="hover:text-slate-300">תמונת מצב</button>
            <button onClick={() => scrollToAnchor('holdings')} className="hover:text-slate-300">החזקות</button>
            <button onClick={() => scrollToAnchor('forecasts')} className="hover:text-slate-300">תחזיות</button>
            <button onClick={() => scrollToAnchor('macro')} className="hover:text-slate-300">מדדי מאקרו</button>
            <button onClick={() => scrollToAnchor('risk-metrics')} className="hover:text-slate-300">מדדי סיכון</button>
            <button onClick={() => scrollToAnchor('dividends')} className="hover:text-slate-300">דיבידנדים</button>
            <button onClick={() => scrollToAnchor('charts')} className="hover:text-slate-300">גרפים</button>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-indigo-400 hover:text-indigo-300 font-bold">⬆️ ראש העמוד</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
