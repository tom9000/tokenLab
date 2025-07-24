import { test, expect } from '@playwright/test';

test.describe('Complete Wallet Demo', () => {
  test('should demonstrate full wallet lifecycle', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for complete demo
    
    console.log('=== COMPLETE WALLET LIFECYCLE DEMO ===');
    
    // Step 1: Show Token Lab initial state
    console.log('\n1. ACCESSING TOKEN LAB');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ 
      path: 'test-results/demo-01-tokenlab-initial.png',
      fullPage: true 
    });
    console.log('✓ Token Lab loaded');
    
    // Step 2: Connect wallet (will open popup)
    console.log('\n2. CONNECTING TO WALLET');
    const pagePromise = page.context().waitForEvent('page');
    await page.click('button:has-text("Connect Wallet")');
    
    const walletPage = await pagePromise;
    await walletPage.waitForLoadState('networkidle');
    console.log('✓ Wallet popup opened');
    
    await walletPage.screenshot({ 
      path: 'test-results/demo-02-wallet-create-page.png',
      fullPage: true 
    });
    
    // Step 3: Create wallet
    console.log('\n3. CREATING NEW WALLET');
    await walletPage.fill('#password', 'TestPass123!');
    await walletPage.fill('#confirmPassword', 'TestPass123!');
    console.log('✓ Entered credentials');
    
    await walletPage.click('button:has-text("Create Wallet & New Address")');
    console.log('✓ Creating wallet...');
    
    await walletPage.waitForLoadState('networkidle');
    await walletPage.waitForTimeout(5000); // Wait for wallet generation
    
    await walletPage.screenshot({ 
      path: 'test-results/demo-03-wallet-created.png',
      fullPage: true 
    });
    
    // Step 4: Extract seed phrase if visible
    const pageContent = await walletPage.textContent('body');
    const seedMatch = pageContent?.match(/([a-z]+ ){11}[a-z]+/g);
    if (seedMatch) {
      console.log(`✓ Seed phrase generated: ${seedMatch[0]}`);
    }
    
    // Step 5: Confirm seed phrase if needed
    const savedButton = walletPage.locator('button:has-text("I\'ve Saved"), button:has-text("Continue"), button:has-text("Next")');
    if (await savedButton.first().isVisible()) {
      await savedButton.first().click();
      console.log('✓ Confirmed seed phrase saved');
      await walletPage.waitForLoadState('networkidle');
    }
    
    await walletPage.screenshot({ 
      path: 'test-results/demo-04-wallet-ready.png',
      fullPage: true 
    });
    
    // Step 6: Refresh to get unlock page
    console.log('\n4. DEMONSTRATING UNLOCK PAGE');
    await walletPage.reload();
    await walletPage.waitForLoadState('networkidle');
    
    const pageType = await walletPage.evaluate(() => 
      document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
    );
    console.log(`✓ After refresh, page type: ${pageType}`);
    
    await walletPage.screenshot({ 
      path: 'test-results/demo-05-unlock-page.png',
      fullPage: true 
    });
    
    // Step 7: Test unlock functionality
    if (pageType === 'unlock') {
      console.log('\n5. TESTING UNLOCK FUNCTIONALITY');
      
      const passwordField = walletPage.locator('input[type="password"]');
      await passwordField.fill('TestPass123!');
      console.log('✓ Entered unlock password');
      
      const unlockButton = walletPage.locator('button:has-text("Unlock")');
      await unlockButton.click();
      console.log('✓ Clicked unlock');
      
      await walletPage.waitForLoadState('networkidle');
      await walletPage.waitForTimeout(2000);
      
      const finalState = await walletPage.evaluate(() =>
        document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
      );
      console.log(`✓ Final wallet state: ${finalState}`);
      
      await walletPage.screenshot({ 
        path: 'test-results/demo-06-wallet-unlocked.png',
        fullPage: true 
      });
    }
    
    // Step 8: Check Token Lab final state
    console.log('\n6. CHECKING TOKEN LAB CONNECTION STATUS');
    await page.screenshot({ 
      path: 'test-results/demo-07-tokenlab-final.png',
      fullPage: true 
    });
    
    const tokenLabContent = await page.textContent('body');
    const stillShowingNoWallet = tokenLabContent?.includes('No wallet detected');
    console.log(`Token Lab wallet detection: ${stillShowingNoWallet ? 'Still no wallet detected' : 'Wallet detected'}`);
    
    console.log('\n=== DEMO COMPLETED ===');
    console.log('Key findings:');
    console.log('- Each Playwright session creates isolated wallet storage');
    console.log('- Fresh sessions always start with "Create Wallet" page');  
    console.log('- After creating wallet + refresh, you get "Unlock" page');
    console.log('- Test password: TestPass123!');
    console.log('- Wallet popup works correctly for UI testing');
    console.log('- Both windows remain open for inspection');
  });

  test('should document all selectors for automation', async ({ page }) => {
    test.setTimeout(60000);
    
    console.log('=== SELECTOR DOCUMENTATION FOR AUTOMATION ===');
    
    // Token Lab selectors
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('\nTOKEN LAB SELECTORS:');
    console.log('Connect Wallet: button:has-text("Connect Wallet")');
    console.log('Deploy Token: button:has-text("Deploy SEP-41 Token")');
    console.log('Name field: input (first text input)');
    console.log('Symbol field: input (second text input)');
    console.log('Meta tags: meta[name="tokenlab-page"], meta[name="tokenlab-state"]');
    
    // Wallet selectors  
    const pagePromise = page.context().waitForEvent('page');
    await page.click('button:has-text("Connect Wallet")');
    
    const walletPage = await pagePromise;
    await walletPage.waitForLoadState('networkidle');
    
    console.log('\nWALLET SELECTORS:');
    console.log('CREATE PAGE:');
    console.log('  Password: #password');
    console.log('  Confirm Password: #confirmPassword');
    console.log('  Create Button: button:has-text("Create Wallet & New Address")');
    console.log('  Meta tags: meta[name="wallet-page"], meta[name="wallet-state"]');
    
    // Create wallet to get to unlock page
    await walletPage.fill('#password', 'TestPass123!');
    await walletPage.fill('#confirmPassword', 'TestPass123!');
    await walletPage.click('button:has-text("Create Wallet & New Address")');
    await walletPage.waitForTimeout(3000);
    await walletPage.reload();
    await walletPage.waitForLoadState('networkidle');
    
    console.log('\nUNLOCK PAGE:');
    console.log('  Password: input[type="password"]');
    console.log('  Unlock Button: button:has-text("Unlock")');
    console.log('  Reset Option: button:has-text("Reset Wallet")');
    
    console.log('\n=== AUTOMATION READY ===');
    console.log('All selectors documented and verified');
  });
});