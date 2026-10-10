import { test, expect } from '@playwright/test';

test.describe('TimesFM AI Forecast Comparisons, Macro & Quant Risk Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=טוען מודל נתונים')).toHaveCount(0, { timeout: 15000 });
  });

  test('validates multi-model forecast comparisons and methodology', async ({ page }) => {
    // Scroll to forecasts section
    const forecastNavBtn = page.locator('button:has-text("🔮 3. השוואת תחזיות AI")');
    await expect(forecastNavBtn).toBeVisible();
    await forecastNavBtn.click();

    // Verify section title and model rows
    await expect(page.getByRole('heading', { name: /3\. השוואת תחזיות ותרחישים מקיפה/ })).toBeVisible();
    await expect(page.locator('text=3.1 השוואת מודלים וגישות שונות')).toBeVisible();
    await expect(page.locator('text=Google TimesFM').first()).toBeVisible();
    await expect(page.locator('text=תשואת שוק מותאמת בטא').first()).toBeVisible();
    await expect(page.locator('text=מומנטום וסחיפת מגמה').first()).toBeVisible();
  });

  test('validates multi-horizon projections and probability cones', async ({ page }) => {
    // Verify Multi-Horizon rows
    await expect(page.locator('text=3.2 השוואת אופקי זמן שונים')).toBeVisible();
    await expect(page.locator('text=שבוע (7 ימים)').first()).toBeVisible();
    await expect(page.locator('text=חודש (30 יום)').first()).toBeVisible();
    await expect(page.locator('text=רבעון (90 יום)').first()).toBeVisible();

    // Verify Probability Cones
    await expect(page.locator('text=3.3 ניתוח תרחישי הסתברות וקונוסי TimesFM')).toBeVisible();
    await expect(page.locator('text=תרחיש אופטימי (P90)')).toBeVisible();
    await expect(page.locator('text=תרחיש בסיס מרכזי (P50)')).toBeVisible();
    await expect(page.locator('text=תרחיש פסימי מגן (P10)')).toBeVisible();

    // Verify Cross-Asset Signals
    await expect(page.locator('text=3.4 מטריצת אותות וסיכונים פר מניה')).toBeVisible();
  });

  test('validates macro indicators section (Stage 1)', async ({ page }) => {
    // Jump to Macro section
    const macroBtn = page.locator('button:has-text("🌐 4. מדדי מאקרו ומפת שוק")');
    await expect(macroBtn).toBeVisible();
    await macroBtn.click();

    await expect(page.getByRole('heading', { name: /4\. מדדי מאקרו ומפת שוק/ })).toBeVisible();
    await expect(page.locator('text=מדד הפחד והתנודתיות (VIX)').first()).toBeVisible();
    await expect(page.locator('text=תשואת אג"ח ארה"ב 10Y').first()).toBeVisible();
    await expect(page.locator('text=נפט גולמי (WTI Crude)').first()).toBeVisible();
    await expect(page.locator('text=מדד הדולר העולמי (DXY)').first()).toBeVisible();
  });

  test('validates quant risk metrics & correlation matrix (Stage 2)', async ({ page }) => {
    // Jump to Risk Metrics section
    const riskBtn = page.locator('button:has-text("📐 5. מדדי סיכון וקורלציות")');
    await expect(riskBtn).toBeVisible();
    await riskBtn.click();

    await expect(page.getByRole('heading', { name: /5\. מדדי סיכון כמותיים ומטריצת קורלציות/ })).toBeVisible();
    await expect(page.locator('text=5.1 מדדי סיכון וביצועים מרכזיים')).toBeVisible();
    await expect(page.locator('text=מדד שארפ שנתי (Sharpe Ratio)')).toBeVisible();
    await expect(page.locator('text=מדד סורטינו שנתי (Sortino Ratio)')).toBeVisible();
    await expect(page.locator('text=Value at Risk יומי (VaR 95% 1-Day)')).toBeVisible();
    await expect(page.locator('text=5.2 בטא פר מניה מול S&P 500 (VOO)')).toBeVisible();
    await expect(page.locator('text=5.3 מטריצת מתאמים צולבת')).toBeVisible();
    await expect(page.locator('text=5.4 תובנות פיזור וניהול סיכונים')).toBeVisible();
  });

  test('validates dividend projections and visual analytics charts', async ({ page }) => {
    // Jump to Dividends section
    const divBtn = page.locator('button:has-text("💵 6. יומן דיבידנדים")');
    await expect(divBtn).toBeVisible();
    await divBtn.click();

    await expect(page.getByRole('heading', { name: /6\. יומן דיבידנדים והכנסה פאסיבית/ })).toBeVisible();
    await expect(page.locator('text=לוח תשלומי דיבידנד צפויים')).toBeVisible();

    // Jump to Charts section
    const chartBtn = page.locator('button:has-text("📈 7. גרפים חזותיים")');
    await expect(chartBtn).toBeVisible();
    await chartBtn.click();

    await expect(page.getByRole('heading', { name: /7\. גרפים ומגמות חזותיות/ })).toBeVisible();
    await expect(page.locator('img[alt="Google TimesFM Portfolio Forecast"]')).toBeVisible();
  });

  test('validates Stage 3 predictive synthesis, monte carlo, stress scenarios and PHP dashboard', async ({ page }) => {
    const stage3Btn = page.locator('button:has-text("🚀 שלב 3: מונטה קרלו ותרחישים")');
    await expect(stage3Btn).toBeVisible();
    await stage3Btn.click();

    await expect(page.getByRole('heading', { name: /מנוע חיזוי רב-גורמי, סימולציית מונטה קרלו ותרחישי עתיד \(שלב 3\)/ })).toBeVisible();
    await expect(page.locator('text=6.1 סימולציית מונטה קרלו הסתברותית')).toBeVisible();
    await expect(page.locator('text=6.2 דירוג מניות רב-גורמי והמלצות מודל')).toBeVisible();
    await expect(page.locator('text=6.3 מבחני לחץ ותרחישי מאקרו עתידיים')).toBeVisible();
    await expect(page.locator('text=6.4 מדריך הסברים: כיצד כל מידע משפיע על תיק המניות שלי?')).toBeVisible();
    await expect(page.locator('text=דשבורד מלא בטכנולוגיית PHP זמין כעת במאגר!')).toBeVisible();
  });
});
