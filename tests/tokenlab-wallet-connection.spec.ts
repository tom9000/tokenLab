import { test, expect } from '@playwright/test';

test.describe('Token Lab Wallet Connection', () => {
  test('should connect to Safu-Dev wallet and login', async ({ page }) => {
    // Set longer timeout for wallet interactions
    test.setTimeout(60000);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('=== TESTING WALLET CONNECTION ===');
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'test-results/tokenlab-before-wallet-connect.png',
      fullPage: true 
    });
    
    // Look for the Connect Wallet button
    const connectButton = page.locator('button:has-text("Connect Wallet")');
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
    
    console.log('✓ Connect Wallet button found and enabled');
    
    // Listen for new pages/popups (the wallet window)
    const pagePromise = page.context().waitForEvent('page');
    
    // Click the Connect Wallet button
    await connectButton.click();
    console.log('✓ Clicked Connect Wallet button');
    
    // Wait for the wallet popup to open
    const walletPage = await pagePromise;
    await walletPage.waitForLoadState('networkidle');
    
    console.log('✓ Wallet popup opened');
    console.log(`Wallet URL: ${walletPage.url()}`);
    
    // Take screenshot of the wallet popup
    await walletPage.screenshot({ 
      path: 'test-results/safu-wallet-popup.png',
      fullPage: true 
    });
    
    // Check what page we're on in the wallet
    const walletPageType = await walletPage.evaluate(() => 
      document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
    );
    const walletState = await walletPage.evaluate(() =>
      document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
    );
    
    console.log(`Wallet page type: ${walletPageType}`);
    console.log(`Wallet state: ${walletState}`);
    
    // Get the wallet page content to understand what we're dealing with
    const walletContent = await walletPage.textContent('body');
    console.log('Wallet page content preview:', walletContent?.substring(0, 200) + '...');
    
    // Check if we need to create a wallet or unlock an existing one
    if (walletPageType === 'create' || walletContent?.includes('Create Wallet')) {
      console.log('Creating new wallet...');
      
      // Fill password fields for wallet creation
      const passwordField = walletPage.locator('#password');
      const confirmPasswordField = walletPage.locator('#confirmPassword');
      
      if (await passwordField.isVisible()) {
        await passwordField.fill('TestPass123!');
        console.log('✓ Entered password');
      }
      
      if (await confirmPasswordField.isVisible()) {
        await confirmPasswordField.fill('TestPass123!');
        console.log('✓ Confirmed password');
      }
      
      // Click create wallet button
      const createButton = walletPage.locator('button:has-text("Create Wallet & New Address")');
      if (await createButton.isVisible()) {
        await createButton.click();
        console.log('✓ Clicked Create Wallet button');
        
        // Wait for wallet creation to complete
        await walletPage.waitForLoadState('networkidle');
        await walletPage.screenshot({ 
          path: 'test-results/safu-wallet-created.png',
          fullPage: true 
        });
      }
      
    } else if (walletPageType === 'unlock' || walletContent?.includes('Unlock')) {
      console.log('Unlocking existing wallet...');
      
      // Fill password field for unlocking
      const passwordField = walletPage.locator('input[type="password"]');
      if (await passwordField.isVisible()) {
        await passwordField.fill('TestPass123!');
        console.log('✓ Entered unlock password');
        
        // Click unlock button
        const unlockButton = walletPage.locator('button:has-text("Unlock")');
        if (await unlockButton.isVisible()) {
          await unlockButton.click();
          console.log('✓ Clicked Unlock button');
          
          // Wait for unlock to complete
          await walletPage.waitForLoadState('networkidle');
          await walletPage.screenshot({ 
            path: 'test-results/safu-wallet-unlocked.png',
            fullPage: true 
          });
        }
      }
    }
    
    // Wait a moment for any wallet operations to complete
    await walletPage.waitForTimeout(2000);
    
    // Check if we're now in the main wallet view
    const finalWalletState = await walletPage.evaluate(() =>
      document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
    );
    
    console.log(`Final wallet state: ${finalWalletState}`);
    
    // Take final screenshot of wallet
    await walletPage.screenshot({ 
      path: 'test-results/safu-wallet-final.png',
      fullPage: true 
    });
    
    // Check if there are any connection approval prompts
    const approveButton = walletPage.locator('button:has-text("Approve"), button:has-text("Connect"), button:has-text("Allow")');
    if (await approveButton.first().isVisible()) {
      await approveButton.first().click();
      console.log('✓ Approved wallet connection');
      await walletPage.waitForTimeout(1000);
    }
    
    // Take screenshot of Token Lab page after wallet connection attempt
    await page.screenshot({ 
      path: 'test-results/tokenlab-after-wallet-connect.png',
      fullPage: true 
    });
    
    // Check if Token Lab now shows wallet connected
    const tokenLabContent = await page.textContent('body');
    console.log('Token Lab content after wallet connection:', tokenLabContent?.substring(0, 300) + '...');
    
    console.log('=== WALLET CONNECTION TEST COMPLETED ===');
    console.log('Windows left open for inspection');
    
    // Don't close the pages - leave them open as requested
    // Both walletPage and page will remain open
  });
  
  test('should handle wallet connection states', async ({ page }) => {
    test.setTimeout(30000);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('=== CHECKING WALLET CONNECTION STATES ===');
    
    // Check initial state before wallet connection
    const initialContent = await page.textContent('body');
    const hasNoWalletMessage = initialContent?.includes('No wallet detected') || 
                               initialContent?.includes('Install Freighter') ||
                               initialContent?.includes('wallet detected');
    
    console.log(`Initial wallet detection: ${hasNoWalletMessage ? 'No wallet detected' : 'Wallet may be available'}`);
    
    // Check console logs for wallet-related messages
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('wallet') || text.includes('Freighter') || text.includes('Connect')) {
        logs.push(text);
      }
    });
    
    // Wait for any initial wallet detection
    await page.waitForTimeout(3000);
    
    console.log('Wallet-related console logs:');
    logs.forEach(log => console.log(`  ${log}`));
    
    // Take screenshot of current state
    await page.screenshot({ 
      path: 'test-results/tokenlab-wallet-state-check.png',
      fullPage: true 
    });
  });
});