import { test, expect } from '@playwright/test';

test.describe('Token Lab Basic Tests', () => {
  test('should load the Token Lab homepage', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the title contains "Token Lab"
    await expect(page).toHaveTitle(/Token Lab/);
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/tokenlab-homepage.png' });
    
    // Check for basic page content - look for any visible text that indicates it's working
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    
    // Log the current page content for debugging
    console.log('Page title:', await page.title());
    console.log('Page URL:', page.url());
  });

  test('should not have console errors', async ({ page }) => {
    const errors: string[] = [];
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that there are no console errors
    expect(errors).toEqual([]);
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    
    // Check for charset
    const charset = await page.locator('meta[charset]').getAttribute('charset');
    expect(charset).toBe('UTF-8');
  });
});