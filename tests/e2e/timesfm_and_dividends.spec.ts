import { test, expect } from '@playwright/test';

test.describe('TimesFM AI Forecast & Dividend Hub', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=טוען מודל נתונים')).toHaveCount(0, { timeout: 15000 });
  });

  test('switches to TimesFM AI Forecast Hub and validates predictions', async ({ page }) => {
    // Click on the TimesFM tab
    const timesFmTab = page.locator('button:has-text("TimesFM")');
    await expect(timesFmTab).toBeVisible();
    await timesFmTab.click();

    // Verify TimesFM Hub elements are loaded
    await expect(page.locator('text=Google Research TimesFM').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Zero-Shot').first()).toBeVisible();

    // Return to dashboard
    const dashboardTab = page.locator('button:has-text("סקירת תיק")');
    await dashboardTab.click();
    await expect(page.locator('text=תיק השקעות PRO')).toBeVisible();
  });

  test('opens and closes Dividend Calendar Modal', async ({ page }) => {
    // Click dividend modal button
    const dividendBtn = page.locator('button:has-text("יומן דיבידנדים")');
    await expect(dividendBtn).toBeVisible();
    await dividendBtn.click();

    // Check modal visibility
    await expect(page.locator('text=יומן דיבידנדים והכנסה פאסיבית').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=דיבידנדים שהתקבלו בפועל').first()).toBeVisible();

    // Close modal via close button or Escape
    const closeBtn = page.locator('button[aria-label="Close"], button:has-text("✕"), button:has-text("סגור")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });
});
