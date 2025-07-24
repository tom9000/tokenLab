import { test, expect } from '@playwright/test';

test.describe('Token Lab Meta Tags', () => {
  test('should have Token Lab specific meta tags', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for Token Lab page identification meta tag
    const pageTag = await page.evaluate(() => 
      document.querySelector('meta[name="tokenlab-page"]')?.getAttribute('content')
    );
    expect(pageTag).toBe('main');
    
    // Check for Token Lab state meta tag  
    const stateTag = await page.evaluate(() =>
      document.querySelector('meta[name="tokenlab-state"]')?.getAttribute('content')
    );
    expect(stateTag).toBe('ready');
    
    // Check for description meta tag
    const description = await page.evaluate(() =>
      document.querySelector('meta[name="description"]')?.getAttribute('content')
    );
    expect(description).toContain('Token Lab');
    expect(description).toContain('SEP-41');
    
    console.log('Token Lab Meta Tags:');
    console.log(`Page: ${pageTag}`);
    console.log(`State: ${stateTag}`);
    console.log(`Description: ${description}`);
  });

  test('should be able to identify page state programmatically', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test the same pattern that would be used in automation
    const currentPage = await page.evaluate(() => 
      document.querySelector('meta[name="tokenlab-page"]')?.getAttribute('content')
    );
    const currentState = await page.evaluate(() =>
      document.querySelector('meta[name="tokenlab-state"]')?.getAttribute('content')
    );
    
    // Verify we can identify the Token Lab main page
    expect(currentPage).toBe('main');
    expect(currentState).toBe('ready');
    
    // This would be useful for future automated testing workflows
    console.log(`Detected Token Lab page: ${currentPage}, state: ${currentState}`);
  });

  test('should have proper page title and basic content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check page title
    await expect(page).toHaveTitle(/Token Lab.*SEP-41/);
    
    // Check for key content that indicates Token Lab is working
    await expect(page.locator('h3:has-text("Development Links")')).toBeVisible();
    await expect(page.locator('text=Token Lab (this app)')).toBeVisible();
    
    // Check for wallet links
    await expect(page.locator('a[href="http://localhost:3003"]')).toBeVisible();
    await expect(page.locator('a[href="http://localhost:3005"]')).toBeVisible();
  });
});