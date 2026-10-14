import { test, expect } from '@playwright/test';

test.describe('TimesFM AI Forecast & Dividend Hub', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=טוען מודל נתונים')).toHaveCount(0, { timeout: 15000 });
  });

  test('switches to TimesFM AI Forecast Hub and validates predictions', async ({ page }) => {
    // Click on the TimesFM navigation tab
    const timesFmTab = page.locator('button:has-text("Google Research TimesFM")');
    await expect(timesFmTab).toBeVisible();
    await timesFmTab.click();

    // Verify TimesFM Hub elements are loaded
    await expect(page.locator('text=Google Research TimesFM').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Zero-Shot').first()).toBeVisible();

    // Return to dashboard
    const dashboardTab = page.locator('button:has-text("סקירת תיק ואנליזה")');
    await expect(dashboardTab).toBeVisible();
    await dashboardTab.click();
    await expect(page.locator('h1')).toContainText('תיק השקעות PRO');
  });

  test('opens and closes Dividend Calendar Modal', async ({ page }) => {
    // Click dividend modal button
    const dividendBtn = page.locator('button:has-text("יומן דיבידנדים")');
    await expect(dividendBtn).toBeVisible();
    await dividendBtn.click();

    // Check modal visibility
    await expect(page.locator('text=יומן חלוקות דיבידנדים בפועל')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=סך נטו שהתקבל')).toBeVisible();

    // Close modal via close button
    const closeBtn = page.locator('button[title="סגור חלון"]');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Modal should be closed
    await expect(page.locator('text=יומן חלוקות דיבידנדים בפועל')).toHaveCount(0);
  });
});
