import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Layers, 
  Sliders, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Cpu,
  BarChart2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { ForecastData } from '../types/forecast';
import { HistoryPoint, Portfolio, PortfolioItem } from '../types';

interface TimesFMForecastHubProps {
  forecastData: ForecastData | null;
  history: HistoryPoint[];
  portfolio: Portfolio | null;
  usdToIls: number;
  darkMode: boolean;
  currencyMode?: 'USD' | 'ILS' | 'DUAL';
}

export const TimesFMForecastHub: React.FC<TimesFMForecastHubProps> = ({
  forecastData,
  history,
  portfolio,
  usdToIls,
  darkMode
}) => {
  const [forecastCurrency, setForecastCurrency] = useState<'ILS' | 'USD'>('ILS');
  const [activeQuantileView, setActiveQuantileView] = useState<'ALL' | 'P50' | 'P90' | 'P10'>('ALL');
  const [scenarioBias, setScenarioBias] = useState<number>(0); // -1 (P10), 0 (P50), +1 (P90)

  // Stitched Historical + TimesFM Projection Dataset
  const combinedChartData = useMemo(() => {
    if (!history.length || !forecastData?.portfolio?.timeline) return [];

    // Take last 20 historical days
    const dailyMap = new Map<string, { date: string; displayDate: string; valueUSD: number }>();
    
    // Sort history
    const sorted = [...history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    sorted.forEach(entry => {
      const d = new Date(entry.timestamp);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const displayDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      let valUSD = 0;
      if (portfolio) {
        Object.entries(portfolio).forEach(([ticker, pInfo]: [string, PortfolioItem]) => {
          const p = entry.prices[ticker];
          if (p) valUSD += pInfo.amount * p;
        });
      }
      dailyMap.set(dateKey, { date: dateKey, displayDate, valueUSD: valUSD });
    });

    const histArray = Array.from(dailyMap.values()).slice(-20);
    const timeline = forecastData.portfolio.timeline;

    const result: any[] = [];

    // Add historical items
    histArray.forEach((h, idx) => {
      const isLast = idx === histArray.length - 1;
      result.push({
        date: h.date,
        displayDate: h.displayDate,
        isForecast: false,
        historicalUSD: h.valueUSD,
        historicalILS: h.valueUSD * usdToIls,
        // Bridge point for continuous line
        p50USD: isLast ? h.valueUSD : null,
        p50ILS: isLast ? h.valueUSD * usdToIls : null,
        p10USD: isLast ? h.valueUSD : null,
        p10ILS: isLast ? h.valueUSD * usdToIls : null,
        p90USD: isLast ? h.valueUSD : null,
        p90ILS: isLast ? h.valueUSD * usdToIls : null,
      });
    });

    // Add forecast timeline
    timeline.forEach(t => {
      result.push({
        date: t.date,
        displayDate: t.displayDate,
        isForecast: true,
        historicalUSD: null,
        historicalILS: null,
        p50USD: t.p50USD,
        p50ILS: t.p50ILS,
        p10USD: t.p10USD,
        p10ILS: t.p10ILS,
        p90USD: t.p90USD,
        p90ILS: t.p90ILS,
      });
    });

    return result;
  }, [history, forecastData, portfolio, usdToIls]);

  if (!forecastData) {
    return (
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Sparkles size={32} className="animate-spin" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">טוען תחזיות מודל Google Research TimesFM...</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          המודל מחשב את מנעד התחזיות ההסתברותיות ואותות המגמה על בסיס נתוני העבר.
        </p>
      </div>
    );
  }

  const { modelInfo, portfolio: pForecast, exchangeRate: fxForecast, assets: assetForecasts, anomalies, dividendsForecast } = forecastData;

  const currentVal = forecastCurrency === 'ILS' ? pForecast.currentILS : pForecast.currentUSD;
  const targetP50 = forecastCurrency === 'ILS' ? pForecast.forecast30dILS_P50 : pForecast.forecast30dUSD_P50;
  const targetP10 = forecastCurrency === 'ILS' ? pForecast.forecast30dILS_P10 : pForecast.forecast30dUSD_P10;
  const targetP90 = forecastCurrency === 'ILS' ? pForecast.forecast30dILS_P90 : pForecast.forecast30dUSD_P90;

  const currencySymbol = forecastCurrency === 'ILS' ? '₪' : '$';

  // Scenario simulated value
  const simulatedValue = scenarioBias === 0 
    ? targetP50 
    : scenarioBias > 0 
      ? targetP50 + (targetP90 - targetP50) * scenarioBias 
      : targetP50 + (targetP50 - targetP10) * scenarioBias;

  const simulatedProfit = simulatedValue - currentVal;
  const simulatedReturnPct = currentVal > 0 ? (simulatedProfit / currentVal) * 100 : 0;

  const tooltipStyles = {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderColor: darkMode ? '#334155' : '#e2e8f0',
    color: darkMode ? '#f8fafc' : '#0f172a',
    borderRadius: '16px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    padding: '12px 16px',
    fontSize: '13px'
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-indigo-700/50">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-indigo-200 text-xs font-semibold border border-white/10">
              <Cpu size={14} className="text-indigo-300" />
              <span>Google Research TimesFM • Foundation Model (Zero-Shot)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              חיזוי סדרות עתיות וזיהוי אנומליות בתיק
            </h2>
            <p className="text-indigo-200/90 text-sm max-w-2xl leading-relaxed">
              מודל בסיס לאינטליגנציה פיננסית שפותח ע"י Google Research. מנתח {modelInfo.contextLength} נקודות זמן היסטוריות, 
              מחשב מנעד הסתברותי ל-30 הימים הבאים ומאתר סטיות תנודתיות קיצוניות בזמן אמת.
            </p>
          </div>

          {/* Model Status Badge */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-indigo-200 font-medium">אופק חיזוי:</span>
              <span className="font-bold text-white">{modelInfo.forecastHorizonDays} ימים קדימה</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-indigo-200 font-medium">כיסוי הסתברותי:</span>
              <span className="font-bold text-emerald-300">P10 - P50 - P90 (80% CI)</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-indigo-200 font-medium">עדכון אחרון:</span>
              <span className="font-bold text-indigo-300">
                {new Date(modelInfo.generatedAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: 30-Day Target */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">יעד שווי תיק 30 יום (P50)</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {currencySymbol}{Math.round(targetP50).toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {pForecast.expectedReturn30dPct >= 0 ? (
              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight size={14} /> +{pForecast.expectedReturn30dPct.toFixed(2)}% תשואה צפויה
              </span>
            ) : (
              <span className="inline-flex items-center text-rose-600 dark:text-rose-400">
                <ArrowDownRight size={14} /> {pForecast.expectedReturn30dPct.toFixed(2)}% תשואה צפויה
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: Confidence Interval Bounds */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">מנעד ביטחון (P10 - P90)</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Layers size={18} />
            </div>
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white truncate">
            {currencySymbol}{Math.round(targetP10).toLocaleString()} - {currencySymbol}{Math.round(targetP90).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            הסתברות של 80% ששווי התיק ינוע בתוך טווח זה
          </div>
        </div>

        {/* Metric 3: Annualized Volatility */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">סטיית תקן ותנודתיות שנתית</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <BarChart2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {pForecast.volatilityAnnualizedPct.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            רמת תנודתיות מתונה התואמת תיק צמיחה טכנולוגי
          </div>
        </div>

        {/* Metric 4: USD/ILS FX Forecast */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">תחזית שער דולר (30 יום)</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ₪{fxForecast.forecast30dRate_P50.toFixed(3)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            טווח צפוי: ₪{fxForecast.forecast30dRate_P10.toFixed(3)} - ₪{fxForecast.forecast30dRate_P90.toFixed(3)}
          </div>
        </div>

      </div>

      {/* Main Interactive Forecast Chart Section */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
              <span>גרף חיזוי רציף וקונוסי הסתברות (30 הימים הבאים)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              חיבור רציף בין ביצועי העבר לתחזית העתידית הממודלת של TimesFM
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            
            {/* Currency Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setForecastCurrency('ILS')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  forecastCurrency === 'ILS'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ₪ שקלים
              </button>
              <button
                onClick={() => setForecastCurrency('USD')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  forecastCurrency === 'USD'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                $ דולר
              </button>
            </div>

            {/* Quantile Mode */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveQuantileView('ALL')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeQuantileView === 'ALL'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                כל הטווחים (P10-P90)
              </button>
              <button
                onClick={() => setActiveQuantileView('P50')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeQuantileView === 'P50'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                תרחיש בסיס (P50)
              </button>
            </div>

          </div>
        </div>

        {/* Forecast Rechart Area */}
        <div className="h-[420px] w-full" style={{ touchAction: 'pan-y' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
              <XAxis
                dataKey="displayDate"
                axisLine={false}
                tickLine={false}
                tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}
                minTickGap={20}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}
                tickFormatter={(val) => `${currencySymbol}${Math.round(val).toLocaleString()}`}
                domain={['auto', 'auto']}
                orientation="right"
              />
              <Tooltip
                contentStyle={tooltipStyles}
                formatter={(value: any, name: any, props: any) => {
                  if (value === null || value === undefined) return [null, null];
                  const num = Number(value) || 0;
                  const isFc = props?.payload?.isForecast;
                  
                  let labelName = 'שווי היסטורי';
                  if (name.includes('p50')) labelName = '🎯 יעד בסיס (P50)';
                  else if (name.includes('p90')) labelName = '🟢 תרחיש אופטימי (P90)';
                  else if (name.includes('p10')) labelName = '🔴 תרחיש פסימי (P10)';

                  return [
                    <div key="item" className="font-bold text-sm">
                      {currencySymbol}{num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {isFc && <span className="text-[10px] mr-1.5 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-normal">תחזית</span>}
                    </div>,
                    labelName
                  ];
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '16px', fontSize: '12px' }}
                formatter={(val) => {
                  if (val.includes('historical')) return 'ביצועי עבר (Historical)';
                  if (val.includes('p50')) return 'יעד TimesFM (P50)';
                  if (val.includes('p90')) return 'גבול עליון אופטימי (P90)';
                  if (val.includes('p10')) return 'גבול תמיכה תחתון (P10)';
                  return val;
                }}
              />

              {/* Historical Line */}
              <Line
                type="monotone"
                dataKey={forecastCurrency === 'ILS' ? 'historicalILS' : 'historicalUSD'}
                name="historical"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
              />

              {/* P50 Expected Target */}
              <Line
                type="monotone"
                dataKey={forecastCurrency === 'ILS' ? 'p50ILS' : 'p50USD'}
                name="p50"
                stroke="#8b5cf6"
                strokeWidth={3}
                strokeDasharray="6 6"
                dot={{ r: 3, fill: '#8b5cf6' }}
              />

              {/* P90 Optimistic Cone */}
              {(activeQuantileView === 'ALL' || activeQuantileView === 'P90') && (
                <Line
                  type="monotone"
                  dataKey={forecastCurrency === 'ILS' ? 'p90ILS' : 'p90USD'}
                  name="p90"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                />
              )}

              {/* P10 Pessimistic Cone */}
              {(activeQuantileView === 'ALL' || activeQuantileView === 'P10') && (
                <Line
                  type="monotone"
                  dataKey={forecastCurrency === 'ILS' ? 'p10ILS' : 'p10USD'}
                  name="p10"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Live Anomaly Detection Alerts Section */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                מערך זיהוי אנומליות ואירועי שוק (Anomaly Detection Radar)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ניטור בזמן אמת של סטיות מחיר חריגות מעבר לטווח המודל הסטטיסטי
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <ShieldCheck size={14} /> פעיל בריצה שעתית
          </span>
        </div>

        {anomalies && anomalies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {anomalies.map((anom, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3">
                <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                    <span>{anom.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold">
                      סטייה {anom.deviationPct > 0 ? `+${anom.deviationPct}%` : `${anom.deviationPct}%`}
                    </span>
                  </div>
                  <p className="text-rose-700 dark:text-rose-300 leading-relaxed">
                    {anom.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
            <p className="text-xs text-slate-600 dark:text-slate-300">
              כל נכסי התיק נסחרים בתוך רצועת התנודתיות הנורמטיבית של המודל. לא זוהו אנומליות או שוקי לחץ קיצוניים.
            </p>
          </div>
        )}
      </div>

      {/* Stock Forecast Matrix & Actionable Signals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu size={20} className="text-indigo-600 dark:text-indigo-400" />
            <span>מטריצת תחזיות מפורטת לכל מניה (30-Day Asset Projections)</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            כולל מחיר יעד, תנודתיות חזויה ואות מודל
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(assetForecasts).map(([ticker, info]) => {
            const isBullish = info.expectedChangePct >= 0;
            const signalColor = isBullish ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
            const signalBg = isBullish ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40';

            return (
              <div 
                key={ticker}
                className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-lg text-slate-900 dark:text-white">{ticker}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">מחיר נוכחי: ${info.currentPrice.toFixed(2)}</div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${signalBg} ${signalColor}`}>
                    {info.signalHe}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">יעד TimesFM ל-30 יום:</span>
                    <span className="font-bold text-slate-900 dark:text-white">${info.forecastP50.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">תשואה צפויה:</span>
                    <span className={`font-bold ${signalColor}`}>
                      {info.expectedChangePct >= 0 ? `+${info.expectedChangePct.toFixed(2)}%` : `${info.expectedChangePct.toFixed(2)}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">טווח ביטחון (P10 - P90):</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      ${info.forecastP10.toFixed(2)} - ${info.forecastP90.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">תנודתיות שנתית חזויה:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{info.annualizedVolatilityPct.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Progress Visualizer of Target in Cone */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>תמיכה ${info.forecastP10.toFixed(0)}</span>
                    <span>יעד ${info.forecastP50.toFixed(0)}</span>
                    <span>אופטימי ${info.forecastP90.toFixed(0)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-rose-400" style={{ width: '33%' }}></div>
                    <div className="h-full bg-indigo-500" style={{ width: '34%' }}></div>
                    <div className="h-full bg-emerald-400" style={{ width: '33%' }}></div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Scenario Simulator & Dividend Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Scenario Simulator */}
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Sliders size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                סימולטור תרחישי שוק (Scenario Stress Test)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                בדוק כיצד יתנהג שווי התיק בתרחיש שורי מול תרחיש משברי
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>תרחיש משברי (P10)</span>
              <span>תרחיש בסיס (P50)</span>
              <span>תרחיש שורי (P90)</span>
            </div>
            <input 
              type="range" 
              min="-1" 
              max="1" 
              step="0.1" 
              value={scenarioBias}
              onChange={(e) => setScenarioBias(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">שווי תיק מדומה בעוד 30 יום:</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {currencySymbol}{Math.round(simulatedValue).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className={simulatedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {simulatedProfit >= 0 ? `+${currencySymbol}${Math.round(simulatedProfit).toLocaleString()}` : `${currencySymbol}${Math.round(simulatedProfit).toLocaleString()}`} 
                ({simulatedReturnPct >= 0 ? `+${simulatedReturnPct.toFixed(2)}%` : `${simulatedReturnPct.toFixed(2)}%`})
              </span>
              <span className="text-slate-400">לעומת השווי כיום</span>
            </div>
          </div>
        </div>

        {/* 12-Month Projected Dividend Cashflow */}
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Calendar size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                תחזית תזרים דיבידנדים לשנה הקרובה (12M Ahead)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                צפי הכנסות פאסיביות מבוסס עונתיות חלוקות עבר
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">הכנסה שנתית צפויה נטו:</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                ₪{Math.round(dividendsForecast.next12MonthsTotalNetILS).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                (${Math.round(dividendsForecast.next12MonthsTotalNetUSD).toLocaleString()})
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">ממוצע חודשי נטו:</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                +₪{Math.round(dividendsForecast.projectedMonthlyAverageNetILS).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                לחודש נטו לחשבון
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>כולל ניכוי מס 25% במקור ושקלול חלוקות רבעוניות צפויות מ-VOO, XOM, ASML ו-GOOGL.</span>
          </div>

        </div>

      </div>

    </div>
  );
};
