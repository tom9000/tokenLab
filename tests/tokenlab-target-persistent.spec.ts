import { test, expect, chromium } from '@playwright/test';
import fs from 'fs';

test.describe('Target Persistent Browser', () => {
  test('should connect to existing browser and run tests', async () => {
    // Check if persistent browser is running
    if (!fs.existsSync('./browser-endpoint.txt')) {
      throw new Error('No persistent browser found. Run: npm run browser:create first');
    }
    
    const wsEndpoint = fs.readFileSync('./browser-endpoint.txt', 'utf8');
    console.log('🔗 Connecting to persistent browser...');
    
    // Connect to existing browser
    const browser = await chromium.connect(wsEndpoint);
    const contexts = browser.contexts();
    
    if (contexts.length === 0) {
      throw new Error('No browser contexts found');
    }
    
    const context = contexts[0];
    const pages = context.pages();
    
    console.log(`📄 Found ${pages.length} open pages`);
    
    // Find Token Lab page
    let tokenLabPage = null;
    let walletPage = null;
    
    for (const page of pages) {
      const url = page.url();
      if (url.includes('localhost:3005')) {
        tokenLabPage = page;
        console.log('✅ Found Token Lab page');
      } else if (url.includes('localhost:3003')) {
        walletPage = page;
        console.log('✅ Found Wallet page');
      }
    }
    
    if (!tokenLabPage) {
      throw new Error('Token Lab page not found in persistent browser');
    }
    
    console.log('🧪 Running tests on persistent browser...');
    
    // Test Token Lab functionality
    await expect(tokenLabPage).toHaveTitle(/Token Lab.*SEP-41/);
    console.log('✓ Token Lab title verified');
    
    // Check meta tags
    const pageType = await tokenLabPage.evaluate(() => 
      document.querySelector('meta[name="tokenlab-page"]')?.getAttribute('content')
    );
    expect(pageType).toBe('main');
    console.log('✓ Token Lab meta tags verified');
    
    // Test form interaction
    const nameInput = tokenLabPage.locator('input').first();
    await nameInput.fill('Persistent Test Token');
    const inputValue = await nameInput.inputValue();
    expect(inputValue).toBe('Persistent Test Token');
    console.log('✓ Form interaction works');
    
    // Clear the input
    await nameInput.fill('');
    
    // Test wallet page if available
    if (walletPage) {
      console.log('🔐 Testing wallet page...');
      
      const walletPageType = await walletPage.evaluate(() => 
        document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
      );
      console.log(`✓ Wallet page type: ${walletPageType}`);
      
      // Take screenshot of current wallet state
      await walletPage.screenshot({ 
        path: 'test-results/persistent-wallet-test.png',
        fullPage: true 
      });
      
      if (walletPageType === 'create') {
        console.log('📝 Wallet is on create page - could test wallet creation');
      } else if (walletPageType === 'unlock') {
        console.log('🔓 Wallet is on unlock page - could test unlock');
      }
    }
    
    // Take screenshot of Token Lab
    await tokenLabPage.screenshot({ 
      path: 'test-results/persistent-tokenlab-test.png',
      fullPage: true 
    });
    
    console.log('🎉 Tests completed successfully on persistent browser!');
    console.log('💡 Browser windows remain open for continued use');
    
    // Important: Don't close the browser - it's persistent!
    // The browser will stay open for further testing
  });

  test('should test wallet interactions on persistent browser', async () => {
    if (!fs.existsSync('./browser-endpoint.txt')) {
      throw new Error('No persistent browser found. Run: npm run browser:create first');
    }
    
    const wsEndpoint = fs.readFileSync('./browser-endpoint.txt', 'utf8');
    const browser = await chromium.connect(wsEndpoint);
    const context = browser.contexts()[0];
    const pages = context.pages();
    
    // Find wallet page
    const walletPage = pages.find(page => page.url().includes('localhost:3003'));
    
    if (!walletPage) {
      console.log('⚠️ No wallet page found - skipping wallet tests');
      return;
    }
    
    console.log('🔐 Testing wallet interactions...');
    
    const walletPageType = await walletPage.evaluate(() => 
      document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
    );
    const walletState = await walletPage.evaluate(() =>
      document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
    );
    
    console.log(`Wallet: ${walletPageType}/${walletState}`);
    
    if (walletPageType === 'unlock') {
      console.log('Testing unlock functionality...');
      
      // Check if password field is visible
      const passwordField = walletPage.locator('input[type="password"]');
      const isVisible = await passwordField.isVisible();
      expect(isVisible).toBe(true);
      console.log('✓ Password field is visible');
      
      // Check unlock button
      const unlockButton = walletPage.locator('button:has-text("Unlock")');
      const buttonVisible = await unlockButton.isVisible();
      expect(buttonVisible).toBe(true);
      console.log('✓ Unlock button is visible');
      
      // Check reset option
      const resetButton = walletPage.locator('button:has-text("Reset Wallet")');
      const resetVisible = await resetButton.isVisible();
      console.log(`✓ Reset option available: ${resetVisible}`);
      
    } else if (walletPageType === 'create') {
      console.log('Testing create wallet form...');
      
      const passwordField = walletPage.locator('#password');
      const confirmField = walletPage.locator('#confirmPassword');
      
      expect(await passwordField.isVisible()).toBe(true);
      expect(await confirmField.isVisible()).toBe(true);
      console.log('✓ Create wallet form fields are visible');
    }
    
    await walletPage.screenshot({ 
      path: 'test-results/wallet-interaction-test.png',
      fullPage: true 
    });
    
    console.log('✅ Wallet interaction tests completed');
  });
});