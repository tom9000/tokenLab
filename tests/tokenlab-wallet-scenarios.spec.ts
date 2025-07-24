import { test, expect } from '@playwright/test';

test.describe('Token Lab Wallet Connection Scenarios', () => {
  test('should handle both wallet creation and unlock scenarios', async ({ page }) => {
    test.setTimeout(60000);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('=== COMPREHENSIVE WALLET TEST ===');
    
    // Click Connect Wallet
    const connectButton = page.locator('button:has-text("Connect Wallet")');
    const pagePromise = page.context().waitForEvent('page');
    await connectButton.click();
    
    const walletPage = await pagePromise;
    await walletPage.waitForLoadState('networkidle');
    
    // Check what wallet page we're on
    const walletPageType = await walletPage.evaluate(() => 
      document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
    );
    const walletState = await walletPage.evaluate(() =>
      document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
    );
    
    console.log(`=== WALLET PAGE DETECTED ===`);
    console.log(`Page Type: ${walletPageType}`);
    console.log(`Wallet State: ${walletState}`);
    console.log(`URL: ${walletPage.url()}`);
    
    // Take screenshot of initial wallet state
    await walletPage.screenshot({ 
      path: 'test-results/wallet-initial-state.png',
      fullPage: true 
    });
    
    if (walletPageType === 'unlock' && walletState === 'locked') {
      console.log('\n=== UNLOCK SCENARIO ===');
      
      // Document unlock page structure
      const unlockContent = await walletPage.textContent('body');
      console.log('Unlock page content preview:', unlockContent?.substring(0, 300));
      
      // Try to unlock with the test password
      const passwordField = walletPage.locator('input[type="password"]');
      if (await passwordField.isVisible()) {
        await passwordField.fill('TestPass123!');
        console.log('✓ Entered unlock password');
        
        // Look for unlock button
        const unlockButton = walletPage.locator('button:has-text("Unlock")');
        if (await unlockButton.isVisible()) {
          await unlockButton.click();
          console.log('✓ Clicked Unlock button');
          
          // Wait for unlock completion
          await walletPage.waitForLoadState('networkidle');
          await walletPage.waitForTimeout(2000);
          
          const finalWalletState = await walletPage.evaluate(() =>
            document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
          );
          console.log(`Final wallet state after unlock: ${finalWalletState}`);
          
          await walletPage.screenshot({ 
            path: 'test-results/wallet-after-unlock.png',
            fullPage: true 
          });
        }
      }
      
      // Check if there's a Reset Wallet option
      const resetButton = walletPage.locator('button:has-text("Reset Wallet"), :text("Reset Wallet")');
      if (await resetButton.first().isVisible()) {
        console.log('✓ Reset Wallet option available');
      }
      
    } else if (walletPageType === 'create' && walletState === 'no-wallet') {
      console.log('\n=== CREATE WALLET SCENARIO ===');
      
      // Document create page structure
      const createContent = await walletPage.textContent('body');
      console.log('Create page content preview:', createContent?.substring(0, 300));
      
      // Fill password fields
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
      
      // Check seed phrase length toggle
      const seedToggle = walletPage.locator('text=12, text=24');
      const currentToggle = await walletPage.textContent('.toggle, [class*="toggle"]');
      console.log(`Seed phrase length: ${currentToggle?.includes('24') ? '24 words' : '12 words'}`);
      
      // Create wallet
      const createButton = walletPage.locator('button:has-text("Create Wallet & New Address")');
      if (await createButton.isVisible()) {
        await createButton.click();
        console.log('✓ Clicked Create Wallet button');
        
        // Wait for wallet creation
        await walletPage.waitForLoadState('networkidle');
        await walletPage.waitForTimeout(3000); // Give time for generation
        
        // Check if we're now on seed phrase page
        const seedPhraseContent = await walletPage.textContent('body');
        if (seedPhraseContent?.includes('Seed Phrase') || seedPhraseContent?.includes('seed phrase')) {
          console.log('\n=== SEED PHRASE DOCUMENTATION ===');
          
          // Try to extract the seed phrase
          const seedPhraseElement = walletPage.locator('.seed-phrase, [class*="seed"], .mnemonic, [class*="mnemonic"]');
          const seedPhrase = await seedPhraseElement.textContent().catch(() => '');
          
          if (seedPhrase) {
            console.log(`Seed Phrase: ${seedPhrase}`);
          } else {
            // Try to find it in the page text
            const pageContent = await walletPage.textContent('body');
            const seedMatch = pageContent?.match(/([a-z]+ ){11}[a-z]+/g);
            if (seedMatch) {
              console.log(`Extracted Seed Phrase: ${seedMatch[0]}`);
            } else {
              console.log('Could not extract seed phrase from page');
            }
          }
          
          // Take screenshot of seed phrase page
          await walletPage.screenshot({ 
            path: 'test-results/wallet-seed-phrase.png',
            fullPage: true 
          });
          
          // Look for confirmation button
          const savedButton = walletPage.locator('button:has-text("I\'ve Saved"), button:has-text("Continue"), button:has-text("Next")');
          if (await savedButton.first().isVisible()) {
            await savedButton.first().click();
            console.log('✓ Confirmed seed phrase saved');
            await walletPage.waitForLoadState('networkidle');
          }
        }
        
        const finalWalletState = await walletPage.evaluate(() =>
          document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
        );
        console.log(`Final wallet state after creation: ${finalWalletState}`);
        
        await walletPage.screenshot({ 
          path: 'test-results/wallet-after-creation.png',
          fullPage: true 
        });
      }
    }
    
    // Document final wallet page structure
    console.log('\n=== FINAL WALLET PAGE STRUCTURE ===');
    
    // Check for main wallet elements
    const walletElements = {
      'Addresses button': 'button:has-text("Addresses"), :text("Addresses")',
      'Back button': 'button:has-text("Back"), :text("Back")',
      'Network selector': '.network, [class*="network"]',
      'Balance display': '.balance, [class*="balance"]',
      'Address display': '.address, [class*="address"]'
    };
    
    for (const [elementName, selector] of Object.entries(walletElements)) {
      const element = walletPage.locator(selector);
      const isVisible = await element.first().isVisible().catch(() => false);
      console.log(`${elementName}: ${isVisible ? 'visible' : 'not found'}`);
    }
    
    // Check current page after all operations
    const finalPageType = await walletPage.evaluate(() => 
      document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
    );
    console.log(`Final page type: ${finalPageType}`);
    
    // Take final comprehensive screenshot
    await walletPage.screenshot({ 
      path: 'test-results/wallet-final-comprehensive.png',
      fullPage: true 
    });
    
    // Check Token Lab page status
    await page.screenshot({ 
      path: 'test-results/tokenlab-final-state.png',
      fullPage: true 
    });
    
    console.log('\n=== TEST COMPLETED ===');
    console.log('All windows left open for inspection');
  });

  test('should test wallet reset functionality if available', async ({ page }) => {
    test.setTimeout(30000);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const pagePromise = page.context().waitForEvent('page');
    await page.locator('button:has-text("Connect Wallet")').click();
    
    const walletPage = await pagePromise;
    await walletPage.waitForLoadState('networkidle');
    
    console.log('=== TESTING WALLET RESET FUNCTIONALITY ===');
    
    // Check if we're on an unlock page with reset option
    const resetButton = walletPage.locator('button:has-text("Reset Wallet"), :text("Reset Wallet")');
    const hasReset = await resetButton.first().isVisible().catch(() => false);
    
    if (hasReset) {
      console.log('✓ Reset Wallet option found');
      
      // This would reset the wallet - commenting out for safety
      // await resetButton.first().click();
      // const confirmReset = walletPage.locator('button:has-text("Yes, Reset"), button:has-text("Confirm")');
      // if (await confirmReset.first().isVisible()) {
      //   await confirmReset.first().click();
      //   console.log('✓ Wallet reset confirmed');
      // }
      
      console.log('Reset functionality available but not executed (commented out for safety)');
    } else {
      console.log('No reset functionality found on current page');
    }
    
    await walletPage.screenshot({ 
      path: 'test-results/wallet-reset-check.png',
      fullPage: true 
    });
  });
});