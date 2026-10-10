import { test, expect } from '@playwright/test';

test.describe('Stock Tracker PRO - Portfolio Intelligence & Analysis Report', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for data to load
    await expect(page.locator('text=טוען מודל נתונים')).toHaveCount(0, { timeout: 15000 });
  });

  test('loads report successfully with title, status badges and rate', async ({ page }) => {
    // Check main title & live badges
    await expect(page.locator('h1')).toContainText('מעקב תיק השקעות PRO');
    await expect(page.locator('text=LIVE QUANT & AI')).toBeVisible();
    await expect(page.locator('text=USD/ILS:').first()).toBeVisible();
    await expect(page.locator('text=יעד TimesFM 30d')).toBeVisible();
    await expect(page.locator('text=CBOE VIX:')).toBeVisible();
    await expect(page.locator('text=Sharpe:')).toBeVisible();
    await expect(page.locator('text=Beta:')).toBeVisible();
  });

  test('displays all 6 portfolio holdings in the performance table', async ({ page }) => {
    const tickers = ['GOOGL', 'NVDA', 'TSLA', 'ASML', 'VOO', 'XOM'];
    for (const ticker of tickers) {
      await expect(page.locator(`text=${ticker}`).first()).toBeVisible();
    }
  });

  test('displays executive snapshot KPI cards and summary table', async ({ page }) => {
    await expect(page.locator('text=שווי תיק נוכחי').first()).toBeVisible();
    await expect(page.locator('text=עלות קנייה (Cost Basis)').first()).toBeVisible();
    await expect(page.locator('text=רווח כולל ברוטו').first()).toBeVisible();
    await expect(page.locator('text=רווח נטו (לאחר מס 25%)').first()).toBeVisible();
  });

  test('navigates seamlessly across all 8 sections using jump bar', async ({ page }) => {
    const sectionButtons = [
      '📊 1. תמונת מצב מנהלים',
      '📋 2. ביצועי מניות',
      '🔮 3. השוואת תחזיות AI',
      '🌐 4. מדדי מאקרו ומפת שוק',
      '📐 5. מדדי סיכון וקורלציות',
      '💵 6. יומן דיבידנדים',
      '📈 7. גרפים חזותיים',
      '⚙️ 8. ארכיטקטורת מאגר'
    ];

    for (const label of sectionButtons) {
      const btn = page.locator(`button:has-text("${label}")`);
      await expect(btn).toBeVisible();
      await btn.click();
    }
  });
});
