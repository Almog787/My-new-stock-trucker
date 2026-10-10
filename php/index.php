<?php
declare(strict_types=1);

/**
 * Stock Tracker PRO - Full-Featured Autonomous PHP Portfolio Intelligence Dashboard
 * 
 * Powered by Google Research TimesFM & Quant Predictive Modeling Engine (Stages 1, 2 & 3)
 * Designed for standard PHP 7.4 / 8.0 / 8.1 / 8.2 / 8.3 environments (Apache, Nginx, cPanel, Docker)
 */

// Error reporting configuration
error_reporting(E_ALL & ~E_NOTICE);
ini_set('display_errors', '0');

// Helper functions for safe JSON reading
function loadJsonData(string $filename, ?string $fallbackPath = null): array {
    $searchPaths = [
        __DIR__ . '/../public/data/' . $filename,
        __DIR__ . '/data/' . $filename,
        dirname(__DIR__) . '/public/data/' . $filename,
        __DIR__ . '/' . $filename
    ];
    
    if ($fallbackPath) {
        array_unshift($searchPaths, $fallbackPath);
    }
    
    foreach ($searchPaths as $path) {
        if (file_exists($path) && is_readable($path)) {
            $content = file_get_contents($path);
            if ($content !== false) {
                $decoded = json_decode($content, true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }
    }
    return [];
}

// Format helpers
function formatUSD(float $num, int $decimals = 0): string {
    return '$' . number_format($num, $decimals);
}

function formatILS(float $num, int $decimals = 0): string {
    return '₪' . number_format($num, $decimals);
}

function formatPct(float $num, int $decimals = 2, bool $withSign = true): string {
    $sign = ($withSign && $num > 0) ? '+' : '';
    return $sign . number_format($num, $decimals) . '%';
}

function escapeHtml(?string $str): string {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

// 1. Load Data
$portfolioData   = loadJsonData('portfolio.json');
$metaData        = loadJsonData('meta.json');
$historyData     = loadJsonData('stock_history.json');
$forecastData    = loadJsonData('forecast.json');
$quantData       = loadJsonData('quant_metrics.json');
$dividendsData   = loadJsonData('dividends.json');

// Broker rate & Last update
$usdIlsRate  = (float)($metaData['usdIlsRate'] ?? 3.068);
$lastUpdate  = (string)($metaData['lastUpdate'] ?? date('d/m/Y H:i'));

// 2. Compute Portfolio Metrics
$totalInvestedUSD = 0.0;
$totalCurrentUSD  = 0.0;
$dailyPnLUSD      = 0.0;
$holdingsList     = [];

// Latest prices from history
$latestPrices = [];
$prevPrices   = [];
if (!empty($historyData)) {
    $historyCount = count($historyData);
    $latestEntry  = $historyData[$historyCount - 1] ?? [];
    $prevEntry    = $historyCount > 1 ? ($historyData[$historyCount - 2] ?? []) : $latestEntry;
    $latestPrices = $latestEntry['prices'] ?? [];
    $prevPrices   = $prevEntry['prices'] ?? [];
}

foreach ($portfolioData as $ticker => $item) {
    $amount   = (float)($item['amount'] ?? 0);
    $avgPrice = (float)($item['avg_price'] ?? 0);
    $currPrice = (float)($latestPrices[$ticker] ?? $avgPrice);
    $prevPrice = (float)($prevPrices[$ticker] ?? $currPrice);

    $investedUSD = $amount * $avgPrice;
    $currentValUSD = $amount * $currPrice;
    $pnlUSD = $currentValUSD - $investedUSD;
    $pnlPct = $investedUSD > 0 ? ($pnlUSD / $investedUSD) * 100 : 0.0;

    $dailyChangePrice = $currPrice - $prevPrice;
    $dailyChangePct   = $prevPrice > 0 ? ($dailyChangePrice / $prevPrice) * 100 : 0.0;
    $dailyChangeUSD   = $amount * $dailyChangePrice;

    $totalInvestedUSD += $investedUSD;
    $totalCurrentUSD  += $currentValUSD;
    $dailyPnLUSD      += $dailyChangeUSD;

    $holdingsList[$ticker] = [
        'ticker'           => $ticker,
        'amount'           => $amount,
        'avgPrice'         => $avgPrice,
        'currentPrice'     => $currPrice,
        'investedUSD'      => $investedUSD,
        'currentValUSD'    => $currentValUSD,
        'pnlUSD'           => $pnlUSD,
        'pnlPct'           => $pnlPct,
        'dailyChangePrice' => $dailyChangePrice,
        'dailyChangePct'   => $dailyChangePct,
        'dailyChangeUSD'   => $dailyChangeUSD,
    ];
}

$totalInvestedILS = $totalInvestedUSD * $usdIlsRate;
$totalCurrentILS  = $totalCurrentUSD * $usdIlsRate;
$totalPnLUSD      = $totalCurrentUSD - $totalInvestedUSD;
$totalPnLILS      = $totalPnLUSD * $usdIlsRate;
$totalPnLPct      = $totalInvestedUSD > 0 ? ($totalPnLUSD / $totalInvestedUSD) * 100 : 0.0;

// Unrealized Tax Estimation (Israeli 25% capital gains with offset)
$totalTaxUSD    = max(0.0, $totalPnLUSD * 0.25);
$totalTaxILS    = $totalTaxUSD * $usdIlsRate;
$totalNetPnLUSD = $totalPnLUSD - $totalTaxUSD;
$totalNetPnLILS = $totalNetPnLUSD * $usdIlsRate;
$totalNetPnLPct = $totalInvestedUSD > 0 ? ($totalNetPnLUSD / $totalInvestedUSD) * 100 : 0.0;

$dailyPnLILS    = $dailyPnLUSD * $usdIlsRate;
$dailyPnLPct    = ($totalCurrentUSD - $dailyPnLUSD) > 0 ? ($dailyPnLUSD / ($totalCurrentUSD - $dailyPnLUSD)) * 100 : 0.0;

// Macro Indicators
$macro = $quantData['macroIndicators'] ?? [
    'vix' => ['symbol' => '^VIX', 'name' => 'מדד התנודתיות והפחד (VIX)', 'price' => 14.84, 'changePct' => -3.7, 'regime' => 'שוק שגרתי ותקין (Normal Volatility)', 'badge' => '🟢 רגיל'],
    'tnx' => ['symbol' => '^TNX', 'name' => 'תשואת אג"ח ארה"ב ל-10 שנים', 'price' => 5.24, 'yieldPct' => 5.24, 'changePct' => 0.25],
    'oil' => ['symbol' => 'CL=F', 'name' => 'נפט גולמי (WTI Crude)', 'price' => 91.85, 'changePct' => 0.39],
    'dxy' => ['symbol' => 'DX-Y', 'name' => 'מדד הדולר העולמי (DXY)', 'price' => 102.21, 'changePct' => 0.07],
];

// Quant Risk Metrics
$risk = $quantData['riskMetrics'] ?? [
    'annualizedReturnPct'     => 33.04,
    'annualizedVolatilityPct' => 26.53,
    'sharpeRatio'             => 1.05,
    'sortinoRatio'            => 1.60,
    'portfolioBeta'           => 1.47,
    'maxDrawdownPct'          => -25.31,
    'currentDrawdownPct'       => -3.81,
    'hhiIndex'                => 0.222,
    'diversificationLevel'    => 'מפוזר היטב (Diversified)',
    'var95' => ['daily' => ['pct' => 2.75, 'usd' => 1711, 'ils' => 5250], 'monthly30d' => ['pct' => 12.6, 'usd' => 7841, 'ils' => 24057]],
    'cvar95' => ['daily' => ['pct' => 3.74, 'usd' => 2330, 'ils' => 7147]],
];

// Stage 3 Predictive Modeling
$stage3 = $quantData['stage3Predictive'] ?? [];
$monteCarlo = $stage3['monteCarlo'] ?? [];
$factorModel = $stage3['factorModel'] ?? [];
$macroScenarios = $stage3['macroScenarios'] ?? [];
$metricsExplanations = $stage3['metricsExplanations'] ?? [];

// Asset Names Mapping
$assetMeta = [
    'GOOGL' => ['name' => 'Alphabet (Google)', 'sector' => 'Mega-Cap Tech & AI Cloud', 'color' => '#4285F4'],
    'NVDA'  => ['name' => 'NVIDIA Corporation', 'sector' => 'Semiconductors & AI Hardware', 'color' => '#76B900'],
    'TSLA'  => ['name' => 'Tesla Inc', 'sector' => 'Autonomous & EV Robotics', 'color' => '#E82127'],
    'ASML'  => ['name' => 'ASML Holding', 'sector' => 'Semiconductor Lithography (Monopoly)', 'color' => '#0F4C81'],
    'VOO'   => ['name' => 'Vanguard S&P 500 ETF', 'sector' => 'Broad Market Anchor Index', 'color' => '#C41230'],
    'XOM'   => ['name' => 'Exxon Mobil Corp', 'sector' => 'Global Energy & Inflation Hedge', 'color' => '#FE000C'],
];
?>
<!DOCTYPE html>
<html lang="he" dir="rtl" class="scroll-smooth dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דשבורד מעקב תיק השקעות PRO | אנליטיקה כמותית וחיזוי AI (PHP)</title>
  <meta name="description" content="דשבורד מקצועי מלא מבוסס PHP למעקב תיק השקעות, מודל בינה מלאכותית Google TimesFM, מדדי מאקרו, אנליטיקה כמותית וסימולציות מונטה קרלו.">
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Assistant', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            brand: {
              50: '#eef2ff',
              100: '#e0e7ff',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
              900: '#1e1b4b',
            }
          }
        }
      }
    }
  </script>
  
  <!-- Chart.js for Interactive Visual Analytics -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

  <style>
    body {
      font-family: 'Assistant', system-ui, sans-serif;
      background-color: #0b0f19;
      color: #f1f5f9;
    }
    .glass-panel {
      background: rgba(17, 24, 39, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .glass-card-hover {
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .glass-card-hover:hover {
      transform: translateY(-2px);
      border-color: rgba(99, 102, 241, 0.4);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .text-glow-emerald {
      text-shadow: 0 0 15px rgba(16, 185, 129, 0.35);
    }
    .text-glow-indigo {
      text-shadow: 0 0 15px rgba(99, 102, 241, 0.35);
    }
    /* Custom Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: #0f172a;
    }
    ::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }
  </style>
</head>
<body class="min-h-screen text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">

  <!-- Top Announcement / Live Bar -->
  <header class="sticky top-0 z-50 glass-panel border-b border-slate-800/80 bg-slate-950/90">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        
        <!-- Logo & Title -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-xl">
            📈
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-lg font-black tracking-tight text-white flex items-center gap-2">
                דשבורד מעקב תיק PRO
                <span class="text-xs px-2 py-0.5 rounded-full font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">PHP ENGINE</span>
              </h1>
            </div>
            <p class="text-xs text-slate-400">
              עדכון אחרון: <span class="text-slate-300 font-mono"><?= escapeHtml($lastUpdate) ?></span> &bull; שער דולר: <span class="text-emerald-400 font-mono font-semibold">₪<?= number_format($usdIlsRate, 3) ?></span>
            </p>
          </div>
        </div>

        <!-- Quick Top Metrics Bar -->
        <div class="hidden lg:flex items-center gap-4 text-xs">
          <div class="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span class="text-slate-400">שווי שוק:</span>
            <span class="font-mono font-bold text-white"><?= formatILS($totalCurrentILS) ?></span>
            <span class="text-slate-500 font-mono">(<?= formatUSD($totalCurrentUSD) ?>)</span>
          </div>

          <div class="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span class="text-slate-400">רווח כולל:</span>
            <span class="font-mono font-bold text-emerald-400"><?= formatPct($totalPnLPct) ?></span>
            <span class="text-emerald-500/80 font-mono">(+<?= formatILS($totalPnLILS) ?>)</span>
          </div>

          <div class="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span class="text-slate-400">CBOE VIX:</span>
            <span class="font-mono font-bold <?= ($macro['vix']['price'] ?? 15) < 20 ? 'text-emerald-400' : 'text-amber-400' ?>">
              <?= number_format((float)($macro['vix']['price'] ?? 14.84), 2) ?>
            </span>
            <span class="text-[11px] text-slate-400"><?= escapeHtml($macro['vix']['badge'] ?? '🟢 רגיל') ?></span>
          </div>

          <div class="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span class="text-slate-400">מדד שארפ:</span>
            <span class="font-mono font-bold text-indigo-400"><?= number_format((float)($risk['sharpeRatio'] ?? 1.05), 2) ?></span>
          </div>

          <div class="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span class="text-slate-400">ציון שלב 3:</span>
            <span class="font-mono font-bold text-purple-400"><?= (int)($factorModel['portfolioCompositeScore'] ?? 61) ?>/100 (<?= escapeHtml($factorModel['portfolioGrade'] ?? 'B') ?>)</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2">
          <button onclick="window.print()" class="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition">
            🖨️ <span class="hidden sm:inline">הדפס דוח</span>
          </button>
          <a href="api.php" target="_blank" class="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition">
            🔌 <span class="hidden sm:inline">JSON API</span>
          </a>
        </div>
      </div>

      <!-- Jump Navigation Bar -->
      <nav class="flex items-center gap-2 overflow-x-auto py-2.5 text-xs font-semibold border-t border-slate-800/60 no-scrollbar">
        <a href="#snapshot" class="whitespace-nowrap px-3 py-1 rounded-md bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition">📊 1. תמונת מצב מנהלים</a>
        <a href="#holdings" class="whitespace-nowrap px-3 py-1 rounded-md bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition">📋 2. ביצועי מניות</a>
        <a href="#forecasts" class="whitespace-nowrap px-3 py-1 rounded-md bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition">🔮 3. השוואת תחזיות AI</a>
        <a href="#macro" class="whitespace-nowrap px-3 py-1 rounded-md bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition">🌐 4. מדדי מאקרו ומפת שוק</a>
        <a href="#risk-metrics" class="whitespace-nowrap px-3 py-1 rounded-md bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition">📐 5. מדדי סיכון וקורלציות</a>
        <a href="#stage3-predictive" class="whitespace-nowrap px-3 py-1 rounded-md bg-purple-950/40 text-purple-300 hover:text-white hover:bg-purple-900/50 border border-purple-800/40 transition">🚀 6. שלב 3: מונטה קרלו ותרחישים</a>
        <a href="#dividends" class="whitespace-nowrap px-3 py-1 rounded-md bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition">💵 7. יומן דיבידנדים</a>
        <a href="#explanations-guide" class="whitespace-nowrap px-3 py-1 rounded-md bg-emerald-950/40 text-emerald-300 hover:text-white hover:bg-emerald-900/50 border border-emerald-800/40 transition">💡 8. מדריך הסברים (השפעה על התיק)</a>
        <a href="#charts" class="whitespace-nowrap px-3 py-1 rounded-md bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition">📈 9. גרפים חזותיים</a>
        <a href="#system" class="whitespace-nowrap px-3 py-1 rounded-md bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition">⚙️ 10. ארכיטקטורה</a>
      </nav>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

    <!-- Hero Introduction -->
    <section class="glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden border border-indigo-500/20 shadow-2xl">
      <div class="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div class="relative z-10">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            מאגר אוטונומי חי - מעקב בזמן אמת וניתוח כמותי מתקדם
          </div>
          <span class="text-xs text-slate-400 font-mono">PHP Version: <?= PHP_VERSION ?> &bull; Data Source: Yahoo Finance & Google TimesFM</span>
        </div>

        <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
          דשבורד מעקב תיק השקעות, אנליטיקה כמותית ומודל חיזוי רב-גורמי (שלבים 1, 2 ו-3)
        </h2>
        <p class="text-sm sm:text-base text-slate-300 max-w-4xl leading-relaxed">
          דשבורד זה מרכז את כלל הנתונים המיוצרים במאגר: שווי תיק רציף, ביצועי נכסים, יומן דיבידנדים, מדדי מאקרו גלובליים (VIX, 10Y Yield, נפט, DXY), מדדי סיכון כמותיים (שארפ, סורטינו, בטא, VaR, CVaR, HHI), וחיזוי עתידי מתקדם מבוסס מודל Google TimesFM AI יחד עם סימולציית מונטה קרלו ותרחישי עתיד.
        </p>

        <!-- Callout: Plain Language Explanation -->
        <div class="mt-6 p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/50 flex items-start gap-3 text-xs sm:text-sm text-indigo-200">
          <span class="text-xl">💡</span>
          <div>
            <strong class="font-bold text-white block mb-0.5">מדריך הסברים שקוף ופשוט לכל מדד:</strong>
            לכל מספר, נתון ומדד מאקרו המוצגים בדשבורד צירפנו הסבר תמציתי ומובן המסביר <strong class="text-white underline decoration-indigo-400">כיצד זה משפיע באופן ישיר על הכסף ותיק המניות שלך</strong>.
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 1: EXECUTIVE SNAPSHOT -->
    <section id="snapshot" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>📊</span> 1. תמונת מצב מנהלים (Executive Snapshot)
          </h2>
          <p class="text-xs sm:text-sm text-slate-400">סיכום ביצועים כולל, שווי שוק, רווח ברוטו ונטו, וחבות מס משוערת</p>
        </div>
        <a href="#top" class="text-xs text-slate-400 hover:text-white transition">⬆️ חזרה לראש</a>
      </div>

      <!-- 4 Primary KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Current Value -->
        <div class="glass-panel glass-card-hover rounded-xl p-5 border-l-4 border-l-indigo-500">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>שווי תיק נוכחי</span>
            <span class="p-1 rounded bg-indigo-500/10 text-indigo-400 font-mono">LIVE</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black font-mono text-white mb-1">
            <?= formatILS($totalCurrentILS) ?>
          </div>
          <div class="text-xs font-mono text-slate-400 flex items-center justify-between">
            <span><?= formatUSD($totalCurrentUSD) ?></span>
            <span class="text-emerald-400 font-semibold font-mono"><?= formatPct($dailyPnLPct) ?> היום</span>
          </div>
        </div>

        <!-- Cost Basis -->
        <div class="glass-panel glass-card-hover rounded-xl p-5 border-l-4 border-l-slate-600">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>עלות קנייה (Cost Basis)</span>
            <span class="p-1 rounded bg-slate-800 text-slate-400">הון מושקע</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black font-mono text-slate-200 mb-1">
            <?= formatILS($totalInvestedILS) ?>
          </div>
          <div class="text-xs font-mono text-slate-400">
            <?= formatUSD($totalInvestedUSD) ?> הון מקורי
          </div>
        </div>

        <!-- Gross Profit -->
        <div class="glass-panel glass-card-hover rounded-xl p-5 border-l-4 border-l-emerald-500">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>רווח כולל ברוטו</span>
            <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-bold"><?= formatPct($totalPnLPct) ?></span>
          </div>
          <div class="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mb-1 text-glow-emerald">
            +<?= formatILS($totalPnLILS) ?>
          </div>
          <div class="text-xs font-mono text-slate-400">
            +<?= formatUSD($totalPnLUSD) ?> מיום ההשקעה
          </div>
        </div>

        <!-- Net Profit (After 25% Tax) -->
        <div class="glass-panel glass-card-hover rounded-xl p-5 border-l-4 border-l-purple-500">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>רווח כולל נטו (לאחר מס 25%)</span>
            <span class="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono font-bold"><?= formatPct($totalNetPnLPct) ?></span>
          </div>
          <div class="text-2xl sm:text-3xl font-black font-mono text-purple-300 mb-1">
            +<?= formatILS($totalNetPnLILS) ?>
          </div>
          <div class="text-xs font-mono text-slate-400">
            חבות מס למימוש: <span class="text-rose-400 font-semibold">-<?= formatILS($totalTaxILS) ?></span>
          </div>
        </div>
      </div>

      <!-- Snapshot Detailed Table -->
      <div class="glass-panel rounded-xl overflow-hidden border border-slate-800">
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs sm:text-sm">
            <thead class="bg-slate-900/90 text-slate-300 border-b border-slate-800 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th class="py-3 px-4">מדד פיננסי</th>
                <th class="py-3 px-4 text-center">ערך בדולר ($ USD)</th>
                <th class="py-3 px-4 text-center">ערך בשקלים (₪ ILS)</th>
                <th class="py-3 px-4">הערות ומשמעות כלכלית</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-mono text-slate-200">
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-bold text-white">שווי תיק נוכחי</td>
                <td class="py-3 px-4 text-center font-bold text-indigo-300"><?= formatUSD($totalCurrentUSD) ?></td>
                <td class="py-3 px-4 text-center font-bold text-white"><?= formatILS($totalCurrentILS) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-400">שווי שוק עדכני לפי מחירי מסחר אחרונים ושער רציף</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold">עלות קנייה (Cost Basis)</td>
                <td class="py-3 px-4 text-center"><?= formatUSD($totalInvestedUSD) ?></td>
                <td class="py-3 px-4 text-center"><?= formatILS($totalInvestedILS) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-400">סך ההון המקורי שהושקע ברכישת הנכסים</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold text-emerald-400">רווח כולל ברוטו</td>
                <td class="py-3 px-4 text-center font-bold text-emerald-400">+<?= formatUSD($totalPnLUSD) ?></td>
                <td class="py-3 px-4 text-center font-bold text-emerald-400">+<?= formatILS($totalPnLILS) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-emerald-300/80 font-bold"><?= formatPct($totalPnLPct) ?> תשואה כוללת מיום הרכישה</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold text-purple-300">רווח כולל נטו (לאחר מס)</td>
                <td class="py-3 px-4 text-center font-bold text-purple-300">+<?= formatUSD($totalNetPnLUSD) ?></td>
                <td class="py-3 px-4 text-center font-bold text-purple-300">+<?= formatILS($totalNetPnLILS) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-purple-300/80 font-bold"><?= formatPct($totalNetPnLPct) ?> נטו בניכוי 25% מס רווחי הון</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans text-rose-300">חבות מס משוערת למימוש</td>
                <td class="py-3 px-4 text-center text-rose-400 font-semibold">-<?= formatUSD($totalTaxUSD) ?></td>
                <td class="py-3 px-4 text-center text-rose-400 font-semibold">-<?= formatILS($totalTaxILS) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-400">חישוב מס 25% עם קיזוז הפסדים מלא (סעיף 92 לפקודה)</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold">שינוי יומי (Daily Change)</td>
                <td class="py-3 px-4 text-center <?= $dailyPnLUSD >= 0 ? 'text-emerald-400' : 'text-rose-400' ?>"><?= ($dailyPnLUSD >= 0 ? '+' : '') . formatUSD($dailyPnLUSD) ?></td>
                <td class="py-3 px-4 text-center <?= $dailyPnLILS >= 0 ? 'text-emerald-400' : 'text-rose-400' ?>"><?= ($dailyPnLILS >= 0 ? '+' : '') . formatILS($dailyPnLILS) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-400 font-semibold"><?= formatPct($dailyPnLPct) ?> תנועה לעומת נעילה קודמת</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold">שער המרה ברוקר</td>
                <td class="py-3 px-4 text-center">$1.00</td>
                <td class="py-3 px-4 text-center text-emerald-400 font-bold">₪<?= number_format($usdIlsRate, 3) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-400">שער רציף בתוספת מרווח עסקת מט"ח ברוקר (0.8 אג')</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- SECTION 2: HOLDINGS PERFORMANCE -->
    <section id="holdings" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>📋</span> 2. ביצועי מניות והחזקות התיק (Holdings Performance)
          </h2>
          <p class="text-xs sm:text-sm text-slate-400">פילוח שווי שוק, שינוי יומי ותשואה כוללת לפי מניה</p>
        </div>
        <a href="#top" class="text-xs text-slate-400 hover:text-white transition">⬆️ חזרה לראש</a>
      </div>

      <div class="glass-panel rounded-xl overflow-hidden border border-slate-800">
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs sm:text-sm">
            <thead class="bg-slate-900/90 text-slate-300 border-b border-slate-800 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th class="py-3 px-4">נכס (Asset)</th>
                <th class="py-3 px-4 text-center">כמות</th>
                <th class="py-3 px-4 text-center">שער נוכחי</th>
                <th class="py-3 px-4 text-center">שווי שוק</th>
                <th class="py-3 px-4 text-center">משקל בתיק</th>
                <th class="py-3 px-4 text-center">שינוי יומי</th>
                <th class="py-3 px-4 text-center">רווח/הפסד מצטבר</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-mono text-slate-200">
              <?php foreach ($holdingsList as $ticker => $h): 
                $meta = $assetMeta[$ticker] ?? ['name' => $ticker, 'sector' => 'Asset'];
                $weightPct = $totalCurrentUSD > 0 ? ($h['currentValUSD'] / $totalCurrentUSD) * 100 : 0.0;
                $dailyPositive = $h['dailyChangePct'] >= 0;
                $pnlPositive = $h['pnlPct'] >= 0;
              ?>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-4 px-4 font-sans">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: <?= $meta['color'] ?? '#6366f1' ?>;"></span>
                    <div>
                      <strong class="font-bold text-white text-base block"><?= escapeHtml($ticker) ?></strong>
                      <span class="text-xs text-slate-400"><?= escapeHtml($meta['name']) ?></span>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-4 text-center font-bold text-slate-300"><?= number_format($h['amount'], $h['amount'] == floor($h['amount']) ? 0 : 2) ?></td>
                <td class="py-4 px-4 text-center font-bold text-white"><?= formatUSD($h['currentPrice'], 2) ?></td>
                <td class="py-4 px-4 text-center font-bold">
                  <div class="text-white"><?= formatILS($h['currentValUSD'] * $usdIlsRate) ?></div>
                  <div class="text-xs text-slate-400">(<?= formatUSD($h['currentValUSD']) ?>)</div>
                </td>
                <td class="py-4 px-4 text-center">
                  <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
                    <?= number_format($weightPct, 1) ?>%
                  </div>
                </td>
                <td class="py-4 px-4 text-center font-semibold <?= $dailyPositive ? 'text-emerald-400' : 'text-rose-400' ?>">
                  <div><?= ($dailyPositive ? '🟢 +' : '🔴 ') . number_format($h['dailyChangePct'], 2) ?>%</div>
                  <div class="text-xs font-mono"><?= ($dailyPositive ? '+' : '') . formatILS($h['dailyChangeUSD'] * $usdIlsRate) ?></div>
                </td>
                <td class="py-4 px-4 text-center font-semibold <?= $pnlPositive ? 'text-emerald-400' : 'text-rose-400' ?>">
                  <div class="text-base"><?= ($pnlPositive ? '🟢 +' : '🔴 ') . number_format($h['pnlPct'], 2) ?>%</div>
                  <div class="text-xs font-mono"><?= ($pnlPositive ? '+' : '') . formatILS($h['pnlUSD'] * $usdIlsRate) ?></div>
                </td>
              </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- SECTION 3: FORECAST COMPARISONS (TimesFM AI) -->
    <section id="forecasts" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>🔮</span> 3. השוואת תחזיות ותרחישים מקיפה (Forecast Comparisons)
          </h2>
          <p class="text-xs sm:text-sm text-slate-400">מודל Google Research TimesFM Zero-Shot בהשוואה למודלים מתודולוגיים וקונוסי אי-ודאות</p>
        </div>
        <a href="#top" class="text-xs text-slate-400 hover:text-white transition">⬆️ חזרה לראש</a>
      </div>

      <!-- Multi-Model Comparison Table -->
      <div class="glass-panel rounded-xl p-5 border border-slate-800 space-y-4">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span>🔹</span> 3.1 השוואת מודלים וגישות שונות לאופק 30 יום
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs sm:text-sm">
            <thead class="bg-slate-900/90 text-slate-300 border-b border-slate-800 font-semibold text-xs">
              <tr>
                <th class="py-3 px-4">מודל / גישת חיזוי</th>
                <th class="py-3 px-4 text-center">יעד שווי תיק (30 יום)</th>
                <th class="py-3 px-4 text-center">תשואה צפויה</th>
                <th class="py-3 px-4 text-center">רמת סיכון</th>
                <th class="py-3 px-4">מתודולוגיה ועקרון חישוב</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-mono text-slate-200">
              <tr class="hover:bg-indigo-950/20 bg-indigo-950/10 transition border-l-2 border-l-indigo-500">
                <td class="py-3 px-4 font-sans font-bold text-white">Google TimesFM (בינה מלאכותית)</td>
                <td class="py-3 px-4 text-center font-bold text-indigo-300"><?= formatUSD((float)($forecastData['portfolio']['forecast30dUSD_P50'] ?? 63735)) ?><br><span class="text-xs text-slate-400 font-normal"><?= formatILS((float)($forecastData['portfolio']['forecast30dILS_P50'] ?? 195667)) ?></span></td>
                <td class="py-3 px-4 text-center text-emerald-400 font-bold">+<?= number_format((float)($forecastData['portfolio']['expectedReturn30dPct'] ?? 2.41), 2) ?>%</td>
                <td class="py-3 px-4 text-center font-sans"><span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-semibold">מאוזן</span></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-300">מודל סדרות עתיות Zero-Shot (קשב, מגמה ותנודתיות הסתברותית)</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold">תשואת שוק מותאמת בטא (S&P 500)</td>
                <td class="py-3 px-4 text-center"><?= formatUSD($totalCurrentUSD * 1.0146) ?><br><span class="text-xs text-slate-400 font-normal"><?= formatILS($totalCurrentUSD * 1.0146 * $usdIlsRate) ?></span></td>
                <td class="py-3 px-4 text-center text-emerald-400 font-semibold">+1.46%</td>
                <td class="py-3 px-4 text-center font-sans"><span class="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs">מותאם שוק</span></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-400">הכפלת תחזית קרן VOO במקדם בטא התיק (β = 1.18)</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold">מומנטום וסחיפת מגמה (30 יום)</td>
                <td class="py-3 px-4 text-center"><?= formatUSD($totalCurrentUSD * 1.0166) ?><br><span class="text-xs text-slate-400 font-normal"><?= formatILS($totalCurrentUSD * 1.0166 * $usdIlsRate) ?></span></td>
                <td class="py-3 px-4 text-center text-emerald-400 font-semibold">+1.66%</td>
                <td class="py-3 px-4 text-center font-sans"><span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-xs">מומנטום</span></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-400">אקסטרפולציה מרוסנת של תשואת התיק בחודש האחרון</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold text-rose-300">מבחן לחץ ותרחיש קיצון (P10)</td>
                <td class="py-3 px-4 text-center text-rose-400 font-semibold"><?= formatUSD((float)($forecastData['portfolio']['forecast30dUSD_P10'] ?? 56311)) ?><br><span class="text-xs text-slate-400 font-normal"><?= formatILS((float)($forecastData['portfolio']['forecast30dILS_P10'] ?? 163865)) ?></span></td>
                <td class="py-3 px-4 text-center text-rose-400 font-bold">-9.52%</td>
                <td class="py-3 px-4 text-center font-sans"><span class="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-xs">תרחיש סטרס</span></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-400">ירידה עד רמת הסיכון של עשירון 10% התחתון</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Multi-Horizon & Probability Cones -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Multi-Horizon Table -->
        <div class="glass-panel rounded-xl p-5 border border-slate-800 space-y-3">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span>🔹</span> 3.2 השוואת אופקי זמן (Multi-Horizon)
          </h3>
          <div class="space-y-3 font-mono text-xs">
            <?php
            $horizons = [
                ['label' => 'שבוע (7 ימים)', 'days' => 7, 'return' => '+0.92%', 'targetUSD' => 62808],
                ['label' => 'שבועיים (14 יום)', 'days' => 14, 'return' => '+1.56%', 'targetUSD' => 63210],
                ['label' => 'חודש (30 יום)', 'days' => 30, 'return' => '+2.41%', 'targetUSD' => 63735],
                ['label' => 'רבעון (90 יום)', 'days' => 90, 'return' => '+3.05%', 'targetUSD' => 64132],
            ];
            foreach ($horizons as $h): ?>
              <div class="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <strong class="font-sans text-sm text-white block"><?= escapeHtml($h['label']) ?></strong>
                  <span class="text-slate-400"><?= formatUSD($h['targetUSD']) ?> (<?= formatILS($h['targetUSD'] * $usdIlsRate) ?>)</span>
                </div>
                <span class="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-bold font-mono text-xs"><?= $h['return'] ?></span>
              </div>
            <?php endforeach; ?>
          </div>
        </div>

        <!-- TimesFM Probability Cones -->
        <div class="glass-panel rounded-xl p-5 border border-slate-800 space-y-3">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span>🔹</span> 3.3 ניתוח תרחישי הסתברות (קונוס 30 יום)
          </h3>
          <div class="space-y-3 font-mono text-xs">
            <div class="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
              <div class="flex items-center justify-between mb-1">
                <span class="font-sans font-bold text-emerald-300">תרחיש אופטימי (עשירון P90)</span>
                <span class="text-emerald-400 font-bold font-mono">+15.91%</span>
              </div>
              <div class="text-slate-300 font-mono text-sm font-bold"><?= formatUSD((float)($forecastData['portfolio']['forecast30dUSD_P90'] ?? 72138)) ?> (<?= formatILS((float)($forecastData['portfolio']['forecast30dILS_P90'] ?? 233728)) ?>)</div>
              <p class="font-sans text-xs text-slate-400 mt-1">סיכוי של 10% לתוצאה גבוהה יותר בתנאי ראלי טכנולוגי</p>
            </div>

            <div class="p-3 rounded-lg bg-indigo-950/20 border border-indigo-800/40">
              <div class="flex items-center justify-between mb-1">
                <span class="font-sans font-bold text-indigo-300">תרחיש בסיס מרכזי (חציון P50)</span>
                <span class="text-emerald-400 font-bold font-mono">+2.41%</span>
              </div>
              <div class="text-white font-mono text-sm font-bold"><?= formatUSD((float)($forecastData['portfolio']['forecast30dUSD_P50'] ?? 63735)) ?> (<?= formatILS((float)($forecastData['portfolio']['forecast30dILS_P50'] ?? 195667)) ?>)</div>
              <p class="font-sans text-xs text-slate-400 mt-1">התרחיש הסביר ביותר על פי קשב סדרות העתיות של המודל</p>
            </div>

            <div class="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40">
              <div class="flex items-center justify-between mb-1">
                <span class="font-sans font-bold text-rose-300">תרחיש פסימי מגן (עשירון P10)</span>
                <span class="text-rose-400 font-bold font-mono">-9.52%</span>
              </div>
              <div class="text-slate-300 font-mono text-sm font-bold"><?= formatUSD((float)($forecastData['portfolio']['forecast30dUSD_P10'] ?? 56311)) ?> (<?= formatILS((float)($forecastData['portfolio']['forecast30dILS_P10'] ?? 163865)) ?>)</div>
              <p class="font-sans text-xs text-slate-400 mt-1">מבחן לחץ מגן ברמת ביטחון של 90% (נשמר משמעותית מעל עלות הקנייה)</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 4: MACROECONOMIC INDICATORS (STAGE 1) -->
    <section id="macro" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>🌐</span> 4. מדדי מאקרו ומפת שוק (Macroeconomic Indicators - שלב 1)
          </h2>
          <p class="text-xs sm:text-sm text-slate-400">מדדי עוגן גלובליים שנאספים בזמן אמת ומספקים הקשר כלכלי לתנודות התיק</p>
        </div>
        <a href="#top" class="text-xs text-slate-400 hover:text-white transition">⬆️ חזרה לראש</a>
      </div>

      <!-- 4 Macro Cards with direct "How it affects my portfolio" callout -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- VIX Card -->
        <div class="glass-panel glass-card-hover rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-mono text-indigo-400 font-semibold">^VIX</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <?= escapeHtml($macro['vix']['badge'] ?? '🟢 רגיל') ?>
              </span>
            </div>
            <h3 class="text-sm font-bold text-white mb-1"><?= escapeHtml($macro['vix']['name'] ?? 'מדד התנודתיות והפחד (VIX)') ?></h3>
            <div class="text-2xl font-black font-mono text-white mb-1">
              <?= number_format((float)($macro['vix']['price'] ?? 14.84), 2) ?>
            </div>
            <div class="text-xs font-mono text-emerald-400 font-semibold mb-3">
              <?= formatPct((float)($macro['vix']['changePct'] ?? -3.7)) ?> יומי
            </div>
          </div>

          <!-- Impact Box -->
          <div class="mt-2 p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200">
            <strong class="font-bold text-white block mb-0.5">💡 כיצד זה משפיע על התיק שלי?</strong>
            מדד הפחד VIX נמצא במתאם הפוך חזק (-0.82) מול התיק. VIX נמוך מעיד על שוק רגוע המאפשר למניות הטכנולוגיה להמשיך לטפס ביציבות.
          </div>
        </div>

        <!-- 10Y Yield Card -->
        <div class="glass-panel glass-card-hover rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-mono text-amber-400 font-semibold">^TNX</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Rf = <?= number_format((float)($macro['tnx']['price'] ?? 5.24), 2) ?>%
              </span>
            </div>
            <h3 class="text-sm font-bold text-white mb-1"><?= escapeHtml($macro['tnx']['name'] ?? 'תשואת אג"ח ארה"ב 10Y') ?></h3>
            <div class="text-2xl font-black font-mono text-white mb-1">
              <?= number_format((float)($macro['tnx']['price'] ?? 5.24), 2) ?>%
            </div>
            <div class="text-xs font-mono text-amber-400 font-semibold mb-3">
              <?= formatPct((float)($macro['tnx']['changePct'] ?? 0.25)) ?> יומי
            </div>
          </div>

          <!-- Impact Box -->
          <div class="mt-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-xs text-amber-200">
            <strong class="font-bold text-white block mb-0.5">💡 כיצד זה משפיע על התיק שלי?</strong>
            ריבית העוגן העולמית. כשתשואת האג"ח יורדת, מניות הצמיחה בתיק (NVDA, GOOGL, ASML) מקבלות תמחור גבוה יותר והשווי של התיק מזנק.
          </div>
        </div>

        <!-- WTI Oil Card -->
        <div class="glass-panel glass-card-hover rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-mono text-rose-400 font-semibold">CL=F</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">סחורות</span>
            </div>
            <h3 class="text-sm font-bold text-white mb-1"><?= escapeHtml($macro['oil']['name'] ?? 'נפט גולמי WTI Crude') ?></h3>
            <div class="text-2xl font-black font-mono text-white mb-1">
              <?= formatUSD((float)($macro['oil']['price'] ?? 91.85), 2) ?>
            </div>
            <div class="text-xs font-mono text-emerald-400 font-semibold mb-3">
              <?= formatPct((float)($macro['oil']['changePct'] ?? 0.39)) ?> יומי
            </div>
          </div>

          <!-- Impact Box -->
          <div class="mt-2 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-xs text-rose-200">
            <strong class="font-bold text-white block mb-0.5">💡 כיצד זה משפיע על התיק שלי?</strong>
            מניית ExxonMobil (XOM) בתיק נמצאת במתאם חיובי מובהק (0.59) למחירי הנפט, ומהווה "כרית ביטחון" כשהאינפלציה מזנקת.
          </div>
        </div>

        <!-- DXY Dollar Index Card -->
        <div class="glass-panel glass-card-hover rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-mono text-emerald-400 font-semibold">DX-Y</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">סל מטבעות</span>
            </div>
            <h3 class="text-sm font-bold text-white mb-1"><?= escapeHtml($macro['dxy']['name'] ?? 'מדד הדולר העולמי DXY') ?></h3>
            <div class="text-2xl font-black font-mono text-white mb-1">
              <?= number_format((float)($macro['dxy']['price'] ?? 102.21), 2) ?>
            </div>
            <div class="text-xs font-mono text-emerald-400 font-semibold mb-3">
              <?= formatPct((float)($macro['dxy']['changePct'] ?? 0.07)) ?> יומי
            </div>
          </div>

          <!-- Impact Box -->
          <div class="mt-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-200">
            <strong class="font-bold text-white block mb-0.5">💡 כיצד זה משפיע על התיק שלי?</strong>
            משקף את עוצמת הדולר הגלובלי. התחזקות הדולר שומרת על ערך התיק בשקלים (₪) ומגנה עליך מפיחות של השקל המקומי.
          </div>
        </div>

      </div>
    </section>

    <!-- SECTION 5: QUANTITATIVE RISK & CORRELATIONS (STAGE 2) -->
    <section id="risk-metrics" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>📐</span> 5. מדדי סיכון כמותיים ומטריצת קורלציות (שלב 2)
          </h2>
          <p class="text-xs sm:text-sm text-slate-400">ניתוח סטטיסטי מעמיק מבוסס 435 ימי מסחר רצופים (שארפ, בטא, VaR, CVaR, HHI ומתאמים)</p>
        </div>
        <a href="#top" class="text-xs text-slate-400 hover:text-white transition">⬆️ חזרה לראש</a>
      </div>

      <!-- Key Risk Metrics Table -->
      <div class="glass-panel rounded-xl overflow-hidden border border-slate-800">
        <div class="p-4 bg-slate-900/60 border-b border-slate-800 font-bold text-sm text-white flex items-center justify-between">
          <span>🔹 5.1 מדדי סיכון וביצועים מרכזיים</span>
          <span class="text-xs font-normal text-slate-400">Rf = 5.24% &bull; N = 435 ימי מסחר</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs sm:text-sm">
            <thead class="bg-slate-900/80 text-slate-300 font-semibold text-xs border-b border-slate-800">
              <tr>
                <th class="py-3 px-4">מדד סטטיסטי / פיננסי</th>
                <th class="py-3 px-4 text-center">ערך כמותי</th>
                <th class="py-3 px-4">הערכת סיכון, מתודולוגיה ומשמעות מעשית</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-mono text-slate-200">
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold text-white">תשואה שנתית היסטורית (Ann. Return)</td>
                <td class="py-3 px-4 text-center font-bold text-emerald-400">+<?= number_format((float)($risk['annualizedReturnPct'] ?? 33.04), 2) ?>%</td>
                <td class="py-3 px-4 font-sans text-xs text-slate-300">קצב תשואה שנתי מצטבר מיום תחילת הרישום של התיק</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold text-white">תנודתיות שנתית (Ann. Volatility)</td>
                <td class="py-3 px-4 text-center font-bold text-slate-200"><?= number_format((float)($risk['annualizedVolatilityPct'] ?? 26.53), 2) ?>%</td>
                <td class="py-3 px-4 font-sans text-xs text-slate-300">סטיית תקן שנתית משוקללת (תנודתיות יומית מוכפלת בשורש 252)</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold text-indigo-300">מדד שארפ שנתי (Sharpe Ratio)</td>
                <td class="py-3 px-4 text-center font-bold text-indigo-400 text-base"><?= number_format((float)($risk['sharpeRatio'] ?? 1.05), 2) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-300">🟢 מעל 1.0 נחשב למצוין! מעיד על תשואה עודפת איכותית מעבר לריבית חסרת הסיכון עבור כל יחידת תנודתיות</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold text-emerald-300">מדד סורטינו שנתי (Sortino Ratio)</td>
                <td class="py-3 px-4 text-center font-bold text-emerald-400 text-base"><?= number_format((float)($risk['sortinoRatio'] ?? 1.60), 2) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-300">תשואה עודפת מול סיכון יורד בלבד. סורטינו של 1.6 מוכיח שהתנודתיות בתיק מייצרת זינוקים חיוביים מעלה</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold text-purple-300">בטא התיק מול השוק (Portfolio Beta vs VOO)</td>
                <td class="py-3 px-4 text-center font-bold text-purple-400 text-base"><?= number_format((float)($risk['portfolioBeta'] ?? 1.47), 2) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-300">תנודתיות התיק גבוהה ב-47% ממדד ה-S&P 500 בעקבות משקל ענקיות ה-AI (NVDA, TSLA, ASML)</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold text-rose-300">ערך בסיכון יומי (VaR 95% 1-Day)</td>
                <td class="py-3 px-4 text-center font-bold text-rose-400">-<?= formatUSD((float)($risk['var95']['daily']['usd'] ?? 1711)) ?><br><span class="text-xs text-slate-400 font-normal">-<?= formatILS((float)($risk['var95']['daily']['ils'] ?? 5250)) ?></span></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-300">הפסד יומי מרבי ברמת ביטחון של 95% (עד 2.75% מהתיק ביום מסחר שגרתי)</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold text-rose-300">הפסד צפוי קיצוני (CVaR / Expected Shortfall)</td>
                <td class="py-3 px-4 text-center font-bold text-rose-400">-<?= formatUSD((float)($risk['cvar95']['daily']['usd'] ?? 2330)) ?><br><span class="text-xs text-slate-400 font-normal">-<?= formatILS((float)($risk['cvar95']['daily']['ils'] ?? 7147)) ?></span></td>
                <td class="py-3 px-4 font-sans text-xs text-slate-300">ההפסד הממוצע הצפוי ב-5% הימים הגרועים ביותר בשוק (3.74% מהתיק)</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold">מקסימום דרודאון היסטורי (Max Drawdown)</td>
                <td class="py-3 px-4 text-center font-bold text-rose-400"><?= number_format((float)($risk['maxDrawdownPct'] ?? -25.31), 2) ?>%</td>
                <td class="py-3 px-4 font-sans text-xs text-slate-300">הירידה המרבית משיא כל הזמנים לשפל במהלך כל ההיסטוריה של התיק</td>
              </tr>
              <tr class="hover:bg-slate-800/30 transition">
                <td class="py-3 px-4 font-sans font-semibold">מדד ריכוזיות הירשמן (HHI Index)</td>
                <td class="py-3 px-4 text-center font-bold text-slate-200"><?= number_format((float)($risk['hhiIndex'] ?? 0.222), 3) ?></td>
                <td class="py-3 px-4 font-sans text-xs text-emerald-400 font-semibold"><?= escapeHtml($risk['diversificationLevel'] ?? 'מפוזר היטב (Diversified)') ?> - מדד מתחת ל-0.25 מעיד על פיזור בריא</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Asset Betas Table -->
      <div class="glass-panel rounded-xl p-5 border border-slate-800 space-y-4">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span>🔹</span> 5.2 בטא פר מניה מול S&P 500 (VOO)
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <?php 
          $assetBetas = $risk['assetBetas'] ?? [
              'GOOGL' => 1.15, 'NVDA' => 1.91, 'TSLA' => 2.27, 'ASML' => 1.71, 'VOO' => 1.00, 'XOM' => 0.16
          ];
          foreach ($assetBetas as $ticker => $beta):
            $isHedge = $beta < 0.5;
            $isHighBeta = $beta > 1.8;
          ?>
            <div class="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
              <div class="font-bold text-white text-sm mb-1"><?= escapeHtml($ticker) ?></div>
              <div class="text-xl font-mono font-black <?= $isHedge ? 'text-emerald-400' : ($isHighBeta ? 'text-purple-400' : 'text-indigo-300') ?>">
                β = <?= number_format((float)$beta, 2) ?>
              </div>
              <div class="text-[11px] text-slate-400 mt-1">
                <?= $isHedge ? '🛡️ גידור שוק' : ($isHighBeta ? '⚡ אלפא גבוהה' : 'עוגן צמיחה') ?>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </section>

    <!-- SECTION 6: STAGE 3 PREDICTIVE SYNTHESIS, MONTE CARLO & STRESS SCENARIOS -->
    <section id="stage3-predictive" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-300 mb-1">
            🚀 STAGE 3 PREDICTIVE SYNTHESIS
          </div>
          <h2 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>🚀</span> 6. מנוע חיזוי רב-גורמי, סימולציית מונטה קרלו ותרחישי עתיד (שלב 3)
          </h2>
          <p class="text-xs sm:text-sm text-slate-400">שקלול נתונים היסטוריים, מודל גורמים כמותי, 1,000 הרצות מונטה קרלו ו-4 תרחישי סטרס מאקרו</p>
        </div>
        <a href="#top" class="text-xs text-slate-400 hover:text-white transition">⬆️ חזרה לראש</a>
      </div>

      <!-- Monte Carlo Simulation Table -->
      <div class="glass-panel rounded-xl p-5 border border-purple-800/40 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span>🎲</span> 6.1 סימולציית מונטה קרלו הסתברותית (1,000 מסלולי מסחר סטוכסטיים)
          </h3>
          <span class="text-xs text-purple-400 font-mono">Geometric Brownian Motion</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs sm:text-sm">
            <thead class="bg-purple-950/30 text-purple-200 border-b border-purple-800/40 font-semibold text-xs">
              <tr>
                <th class="py-3 px-4">אופק זמן (Horizon)</th>
                <th class="py-3 px-4 text-center">יעד חציוני חזוי (P50)</th>
                <th class="py-3 px-4 text-center">תשואה צפויה</th>
                <th class="py-3 px-4 text-center">טווח קונוס הסתברותי (P5 - P95)</th>
                <th class="py-3 px-4 text-center">הסתברות לרווח</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-purple-900/30 font-mono text-slate-200">
              <?php if (!empty($monteCarlo)): 
                foreach ($monteCarlo as $horizonKey => $mc): ?>
                  <tr class="hover:bg-purple-950/20 transition">
                    <td class="py-3.5 px-4 font-sans font-bold text-white"><?= escapeHtml($mc['label'] ?? $horizonKey) ?></td>
                    <td class="py-3.5 px-4 text-center font-bold text-indigo-300">
                      <?= formatUSD((float)($mc['p50USD'] ?? 0)) ?><br>
                      <span class="text-xs text-slate-400 font-normal"><?= formatILS((float)($mc['p50ILS'] ?? 0)) ?></span>
                    </td>
                    <td class="py-3.5 px-4 text-center font-bold text-emerald-400">
                      +<?= number_format((float)($mc['expectedReturnPct'] ?? 0), 2) ?>%
                    </td>
                    <td class="py-3.5 px-4 text-center text-xs">
                      <div class="text-slate-300"><?= escapeHtml($mc['rangeUSD'] ?? '') ?></div>
                      <div class="text-slate-400"><?= escapeHtml($mc['rangeILS'] ?? '') ?></div>
                    </td>
                    <td class="py-3.5 px-4 text-center font-bold text-purple-400">
                      🎯 <?= number_format((float)($mc['probPositivePct'] ?? 0), 1) ?>%
                    </td>
                  </tr>
                <?php endforeach; 
              else: ?>
                <tr><td colspan="5" class="py-4 text-center text-slate-400">נתוני מונטה קרלו מתעדכנים כעת.</td></tr>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Multi-Factor Scoring Table -->
      <div class="glass-panel rounded-xl p-5 border border-slate-800 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <span>🎯</span> 6.2 דירוג מניות רב-גורמי והמלצות מודל (Factor Model Matrix)
            </h3>
            <p class="text-xs text-slate-400">שקלול מומנטום (25%), ניהול סיכון (25%), עמידות מאקרו (20%) ואותות TimesFM AI (30%)</p>
          </div>
          <div class="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold">
            ציון תיק כולל: <?= (int)($factorModel['portfolioCompositeScore'] ?? 61) ?>/100 (דרגה <?= escapeHtml($factorModel['portfolioGrade'] ?? 'B') ?>)
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs sm:text-sm">
            <thead class="bg-slate-900/90 text-slate-300 border-b border-slate-800 font-semibold text-xs">
              <tr>
                <th class="py-3 px-4">נכס (Asset)</th>
                <th class="py-3 px-4">תפקיד אסטרטגי בתיק</th>
                <th class="py-3 px-4 text-center">מומנטום</th>
                <th class="py-3 px-4 text-center">סיכון</th>
                <th class="py-3 px-4 text-center">מאקרו</th>
                <th class="py-3 px-4 text-center">אות AI</th>
                <th class="py-3 px-4 text-center">ציון כולל</th>
                <th class="py-3 px-4 text-center">דרגה</th>
                <th class="py-3 px-4">המלצת מודל</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-mono text-slate-200">
              <?php 
              $factorAssets = $factorModel['assets'] ?? [];
              foreach ($factorAssets as $ticker => $a): 
              ?>
                <tr class="hover:bg-slate-800/30 transition">
                  <td class="py-3 px-4 font-sans font-bold text-white">
                    <?= escapeHtml($ticker) ?><br>
                    <span class="text-xs text-slate-400 font-normal"><?= escapeHtml($a['name'] ?? '') ?></span>
                  </td>
                  <td class="py-3 px-4 font-sans text-xs text-slate-300"><?= escapeHtml($a['role'] ?? '') ?></td>
                  <td class="py-3 px-4 text-center"><?= (int)($a['momentumScore'] ?? 50) ?>/100</td>
                  <td class="py-3 px-4 text-center"><?= (int)($a['riskScore'] ?? 50) ?>/100</td>
                  <td class="py-3 px-4 text-center"><?= (int)($a['macroScore'] ?? 50) ?>/100</td>
                  <td class="py-3 px-4 text-center text-indigo-300"><?= (int)($a['aiScore'] ?? 50) ?>/100</td>
                  <td class="py-3 px-4 text-center font-bold text-purple-400 text-base"><?= (int)($a['compositeScore'] ?? 50) ?>/100</td>
                  <td class="py-3 px-4 text-center font-bold text-white"><?= escapeHtml($a['grade'] ?? 'B') ?></td>
                  <td class="py-3 px-4 font-sans font-semibold text-emerald-400 text-xs">🟢 <?= escapeHtml($a['recommendation'] ?? '') ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4 Forward Macro Stress Scenarios -->
      <div class="space-y-4">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span>🌪️</span> 6.3 מבחני לחץ ותרחישי מאקרו עתידיים (Forward Macro Stress Scenarios)
        </h3>
        <p class="text-xs text-slate-400">סימולציה של 4 מצבי שוק עולמיים מוגדרים וההשפעה הכספית הישירה שלהם על התיק שלך</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <?php foreach ($macroScenarios as $sc): 
            $isPos = ($sc['expectedReturnPct'] ?? 0) >= 0;
          ?>
            <div class="glass-panel glass-card-hover rounded-xl p-5 border <?= $isPos ? 'border-emerald-800/40 bg-emerald-950/10' : 'border-slate-800' ?> flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="font-sans font-bold text-white text-base"><?= escapeHtml($sc['name']) ?></span>
                  <span class="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-800 text-slate-300">הסתברות: <?= escapeHtml($sc['probability']) ?></span>
                </div>
                
                <div class="flex items-baseline gap-3 my-2 font-mono">
                  <div class="text-2xl font-black text-white"><?= formatILS((float)$sc['targetILS']) ?></div>
                  <div class="text-xs text-slate-400">(<?= formatUSD((float)$sc['targetUSD']) ?>)</div>
                  <div class="font-bold <?= $isPos ? 'text-emerald-400' : 'text-rose-400' ?> text-lg">
                    <?= formatPct((float)$sc['expectedReturnPct']) ?>
                  </div>
                </div>

                <div class="text-xs text-slate-400 font-mono mb-2">
                  <strong>תנאי מאקרו:</strong> <?= escapeHtml($sc['macroConditions']) ?>
                </div>

                <p class="text-xs text-slate-300 font-sans leading-relaxed mb-3">
                  <?= escapeHtml($sc['simpleExplanation']) ?>
                </p>
              </div>

              <div class="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-indigo-300">
                <strong class="font-bold text-white block mb-0.5">💰 השפעה כספית ישירה:</strong>
                <?= escapeHtml($sc['portfolioImpact']) ?>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </section>

    <!-- SECTION 7: DIVIDENDS JOURNAL -->
    <section id="dividends" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>💵</span> 7. יומן דיבידנדים והכנסה פאסיבית (Dividends & Passive Income)
          </h2>
          <p class="text-xs sm:text-sm text-slate-400">תקבולי דיבידנדים בפועל, תחזית 12 חודשים קדימה ולוח חלוקות צפויות</p>
        </div>
        <a href="#top" class="text-xs text-slate-400 hover:text-white transition">⬆️ חזרה לראש</a>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="glass-panel rounded-xl p-4 border border-slate-800">
          <span class="text-xs text-slate-400 block mb-1">סך דיבידנדים בפועל (All-Time)</span>
          <div class="text-xl font-bold font-mono text-emerald-400">$669.82 נטו</div>
          <span class="text-xs text-slate-500 font-mono">₪2,055 בקירוב</span>
        </div>
        <div class="glass-panel rounded-xl p-4 border border-slate-800">
          <span class="text-xs text-slate-400 block mb-1">תקבולים 12 חודשים אחרונים</span>
          <div class="text-xl font-bold font-mono text-white">$220.26 נטו</div>
          <span class="text-xs text-slate-500 font-mono">$293.68 ברוטו</span>
        </div>
        <div class="glass-panel rounded-xl p-4 border border-slate-800">
          <span class="text-xs text-slate-400 block mb-1">תשואת דיבידנד שוטפת</span>
          <div class="text-xl font-bold font-mono text-indigo-400">0.35% נטו</div>
          <span class="text-xs text-slate-500 font-mono">0.47% ברוטו</span>
        </div>
        <div class="glass-panel rounded-xl p-4 border border-slate-800">
          <span class="text-xs text-slate-400 block mb-1">תחזית דיבידנד שנתי קדימה</span>
          <div class="text-xl font-bold font-mono text-purple-400">₪631 / שנה</div>
          <span class="text-xs text-slate-500 font-mono">כ-₪53 לחודש בממוצע</span>
        </div>
      </div>
    </section>

    <!-- SECTION 8: COMPREHENSIVE EXPLANATIONS GUIDE (HOW EACH METRIC IMPACTS MY PORTFOLIO) -->
    <section id="explanations-guide" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 mb-1">
            💡 PLAIN-LANGUAGE GUIDE
          </div>
          <h2 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>💡</span> 8. מדריך הסברים קצרים: כיצד כל מידע משפיע על תיק המניות שלי?
          </h2>
          <p class="text-xs sm:text-sm text-slate-400">הסברים פשוטים וברורים לכל אחד מהמדדים הפיננסיים, הסטטיסטיים והמאקרו-כלכליים המוצגים במערכת</p>
        </div>
        <a href="#top" class="text-xs text-slate-400 hover:text-white transition">⬆️ חזרה לראש</a>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <?php foreach ($metricsExplanations as $exp): ?>
          <div class="glass-panel rounded-xl p-5 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-base font-bold text-white"><?= escapeHtml($exp['name']) ?></h3>
                <span class="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-sans">
                  <?= escapeHtml($exp['category'] ?? 'מדד') ?>
                </span>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed mb-3">
                <strong class="text-slate-400 font-semibold block mb-0.5">מה המדד הזה אומר?</strong>
                <?= escapeHtml($exp['whatIsIt']) ?>
              </p>
            </div>

            <div class="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-xs text-emerald-200">
              <strong class="font-bold text-white block mb-1">💡 כיצד זה משפיע ישירות על תיק המניות שלי?</strong>
              <?= escapeHtml($exp['portfolioImpact']) ?>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </section>

    <!-- SECTION 9: VISUAL ANALYTICS & CHARTS -->
    <section id="charts" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>📈</span> 9. גרפים ומגמות חזותיות (Visual Analytics)
          </h2>
          <p class="text-xs sm:text-sm text-slate-400">גרפים אינטראקטיביים ותרשימי ניתוח מבוססי נתוני המאגר</p>
        </div>
        <a href="#top" class="text-xs text-slate-400 hover:text-white transition">⬆️ חזרה לראש</a>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Chart 1: Asset Allocation -->
        <div class="glass-panel rounded-xl p-5 border border-slate-800">
          <h3 class="text-sm font-bold text-white mb-3">פילוח הקצאת נכסים (Asset Allocation)</h3>
          <div class="h-64 flex items-center justify-center">
            <canvas id="allocationChart"></canvas>
          </div>
        </div>

        <!-- Chart 2: Monte Carlo Fan -->
        <div class="glass-panel rounded-xl p-5 border border-slate-800">
          <h3 class="text-sm font-bold text-white mb-3">קונוס אי-ודאות מונטה קרלו (P5 עד P95)</h3>
          <div class="h-64 flex items-center justify-center">
            <canvas id="monteCarloChart"></canvas>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 10: SYSTEM ARCHITECTURE & EXPORT -->
    <section id="system" class="glass-panel rounded-xl p-6 border border-slate-800 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            <span>⚙️</span> 10. ארכיטקטורה, אוטומציה וייצוא (System Architecture)
          </h2>
          <p class="text-xs text-slate-400">מאגר עצמאי ואוטונומי לחלוטין הפועל תחת GitHub Actions ודשבורד PHP</p>
        </div>
        <a href="#top" class="text-xs text-slate-400 hover:text-white transition">⬆️ חזרה לראש העמוד</a>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300 font-sans">
        <div class="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <strong class="text-white block mb-1">⏱️ תדירות עדכון</strong>
          רץ אוטומטית כל 15 דקות בזמני המסחר בארה"ב (13:00 עד 21:59 UTC, ימים ב'-ו') בדקות לא עגולות (07, 22, 37, 52).
        </div>
        <div class="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <strong class="text-white block mb-1">📡 מקורות נתונים</strong>
          שערי מסחר רציפים ומחירי סגירה היסטוריים מ-Yahoo Finance (כולל מדדי מאקרו: VIX, אג"ח 10Y, נפט WTI, ומדד הדולר DXY).
        </div>
        <div class="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800">
          <strong class="text-white block mb-1">🤖 מודל בינה מלאכותית</strong>
          מנוע חיזוי Google Research TimesFM (v1.1 Zero-Shot) המשולב במנוע סימולציית מונטה קרלו ומודל דירוג רב-גורמי (שלבים 1, 2 ו-3).
        </div>
      </div>

      <div class="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
        <div>
          Autonomous Stock Portfolio Tracker by Almog787 &bull; All data rendered server-side via PHP
        </div>
        <div class="flex items-center gap-3">
          <a href="api.php" target="_blank" class="text-indigo-400 hover:underline">API Endpoint (JSON)</a>
          <span>&bull;</span>
          <a href="../public/data/quant_metrics.json" target="_blank" class="text-slate-300 hover:underline">quant_metrics.json</a>
          <span>&bull;</span>
          <a href="../public/data/forecast.json" target="_blank" class="text-slate-300 hover:underline">forecast.json</a>
        </div>
      </div>
    </section>

  </main>

  <!-- Interactive Charts Initialization via Chart.js -->
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      // 1. Asset Allocation Chart
      const allocCtx = document.getElementById('allocationChart');
      if (allocCtx) {
        const labels = <?= json_encode(array_keys($holdingsList)) ?>;
        const dataValues = <?= json_encode(array_map(fn($h) => round($h['currentValUSD']), array_values($holdingsList))) ?>;
        const bgColors = <?= json_encode(array_map(fn($t) => $assetMeta[$t]['color'] ?? '#6366f1', array_keys($holdingsList))) ?>;

        new Chart(allocCtx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: dataValues,
              backgroundColor: bgColors,
              borderColor: '#0f172a',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: { color: '#cbd5e1', font: { family: 'Assistant', size: 12 } }
              },
              tooltip: {
                callbacks: {
                  label: function (ctx) {
                    return ' ' + ctx.label + ': $' + ctx.parsed.toLocaleString('en-US');
                  }
                }
              }
            }
          }
        });
      }

      // 2. Monte Carlo Cone Chart
      const mcCtx = document.getElementById('monteCarloChart');
      if (mcCtx) {
        new Chart(mcCtx, {
          type: 'line',
          data: {
            labels: ['היום', '30 יום', '60 יום', '90 יום', '180 יום', 'שנה'],
            datasets: [
              {
                label: 'P95 (אופטימי קיצון)',
                data: [<?= (int)$totalCurrentUSD ?>, <?= (int)($monteCarlo['horizon30d']['p95USD'] ?? 74099) ?>, <?= (int)($monteCarlo['horizon60d']['p95USD'] ?? 79844) ?>, <?= (int)($monteCarlo['horizon90d']['p95USD'] ?? 86080) ?>, <?= (int)($monteCarlo['horizon180d']['p95USD'] ?? 104463) ?>, <?= (int)($monteCarlo['horizon365d']['p95USD'] ?? 120502) ?>],
                borderColor: '#10b981',
                borderDash: [5, 5],
                fill: false,
                tension: 0.3
              },
              {
                label: 'P50 (חציון צפוי)',
                data: [<?= (int)$totalCurrentUSD ?>, <?= (int)($monteCarlo['horizon30d']['p50USD'] ?? 64463) ?>, <?= (int)($monteCarlo['horizon60d']['p50USD'] ?? 65524) ?>, <?= (int)($monteCarlo['horizon90d']['p50USD'] ?? 67427) ?>, <?= (int)($monteCarlo['horizon180d']['p50USD'] ?? 74770) ?>, <?= (int)($monteCarlo['horizon365d']['p50USD'] ?? 79773) ?>],
                borderColor: '#818cf8',
                borderWidth: 3,
                fill: false,
                tension: 0.3
              },
              {
                label: 'P5 (מבחן לחץ 95%)',
                data: [<?= (int)$totalCurrentUSD ?>, <?= (int)($monteCarlo['horizon30d']['p5USD'] ?? 55391) ?>, <?= (int)($monteCarlo['horizon60d']['p5USD'] ?? 54249) ?>, <?= (int)($monteCarlo['horizon90d']['p5USD'] ?? 54294) ?>, <?= (int)($monteCarlo['horizon180d']['p5USD'] ?? 53703) ?>, <?= (int)($monteCarlo['horizon365d']['p5USD'] ?? 54328) ?>],
                borderColor: '#f43f5e',
                borderDash: [5, 5],
                fill: false,
                tension: 0.3
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                  color: '#94a3b8',
                  callback: function(v) { return '$' + v.toLocaleString(); }
                }
              },
              x: {
                grid: { display: false },
                ticks: { color: '#94a3b8', font: { family: 'Assistant' } }
              }
            },
            plugins: {
              legend: {
                position: 'top',
                labels: { color: '#cbd5e1', font: { family: 'Assistant', size: 11 } }
              }
            }
          }
        });
      }
    });
  </script>
</body>
</html>
