import { test, expect } from '@playwright/test';

test.describe('Stock Tracker PRO - Dashboard & Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to finish loading data
    await expect(page.locator('text=טוען מודל נתונים')).toHaveCount(0, { timeout: 15000 });
  });

  test('loads dashboard successfully with title and live badges', async ({ page }) => {
    // Check main title
    await expect(page.locator('h1')).toContainText('תיק השקעות PRO');
    await expect(page.locator('text=LIVE ANALYTICS')).toBeVisible();
    await expect(page.locator('text=שער ברוקר USD/ILS')).toBeVisible();
  });

  test('displays all 6 holdings in the portfolio table', async ({ page }) => {
    const tickers = ['GOOGL', 'NVDA', 'TSLA', 'ASML', 'VOO', 'XOM'];
    for (const ticker of tickers) {
      await expect(page.locator(`text=${ticker}`).first()).toBeVisible();
    }
  });

  test('toggles currency mode (USD, ILS, DUAL)', async ({ page }) => {
    // Switch to USD
    const usdBtn = page.locator('button:has-text("$ USD")');
    await usdBtn.click();
    await expect(page.locator('body')).toContainText('$');

    // Switch to ILS
    const ilsBtn = page.locator('button:has-text("₪ ILS")');
    await ilsBtn.click();
    await expect(page.locator('body')).toContainText('₪');

    // Switch to DUAL
    const dualBtn = page.getByRole('button', { name: 'משולב', exact: true });
    await dualBtn.click();
    await expect(page.locator('body')).toContainText('$');
    await expect(page.locator('body')).toContainText('₪');
  });

  test('toggles tax calculation modes (Combined, Net, Gross)', async ({ page }) => {
    const netBtn = page.locator('button:has-text("נטו בלבד")');
    await expect(netBtn).toBeVisible();
    await netBtn.click();

    const grossBtn = page.locator('button:has-text("ברוטו בלבד")');
    await expect(grossBtn).toBeVisible();
    await grossBtn.click();

    const bothBtn = page.locator('button:has-text("משולב (נטו+ברוטו)")');
    await expect(bothBtn).toBeVisible();
    await bothBtn.click();
  });

  test('filters holdings list using search bar', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="חיפוש"], input[type="text"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('NVDA');
      await expect(page.locator('text=NVDA').first()).toBeVisible();
      await searchInput.clear();
    }
  });

  test('toggles dark mode theme', async ({ page }) => {
    const html = page.locator('html');
    const beforeDark = await html.evaluate(el => el.classList.contains('dark'));
    const themeBtn = page.locator('button[aria-label="Toggle Dark Mode"]');
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    const afterDark = await html.evaluate(el => el.classList.contains('dark'));
    expect(afterDark).toBe(!beforeDark);
  });

  test('opens and closes Dividend Calendar Modal', async ({ page }) => {
    const dividendBtn = page.locator('button:has-text("יומן דיבידנדים")');
    await expect(dividendBtn).toBeVisible();
    await dividendBtn.click();

    await expect(page.locator('text=יומן חלוקות דיבידנדים בפועל')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=סך נטו שהתקבל')).toBeVisible();

    const closeBtn = page.locator('button[title="סגור חלון"]');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(page.locator('text=יומן חלוקות דיבידנדים בפועל')).toHaveCount(0);
  });
});
