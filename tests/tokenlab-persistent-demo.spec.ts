import { test, expect } from '@playwright/test';

test.describe('Persistent Window Demo', () => {
  test('should keep windows open after test completion', async ({ page, context }) => {
    test.setTimeout(120000);
    
    console.log('=== PERSISTENT WINDOW DEMO ===');
    console.log('This test will keep windows open for manual inspection');
    
    // Go to Token Lab
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('✓ Token Lab loaded');
    
    // Connect to wallet (popup)
    const pagePromise = context.waitForEvent('page');
    await page.click('button:has-text("Connect Wallet")');
    
    const walletPage = await pagePromise;
    await walletPage.waitForLoadState('networkidle');
    console.log('✓ Wallet popup opened');
    
    // Check what seed phrase we get this time
    const walletPageType = await walletPage.evaluate(() => 
      document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
    );
    
    if (walletPageType === 'create') {
      console.log('✓ On create page - will create new wallet');
      
      await walletPage.fill('#password', 'TestPass123!');
      await walletPage.fill('#confirmPassword', 'TestPass123!');
      await walletPage.click('button:has-text("Create Wallet & New Address")');
      
      await walletPage.waitForLoadState('networkidle');
      await walletPage.waitForTimeout(5000);
      
      // Extract seed phrase to check if it's the same
      const pageContent = await walletPage.textContent('body');
      const seedMatch = pageContent?.match(/([a-z]+ ){11}[a-z]+/g);
      if (seedMatch) {
        console.log(`\n🔍 SEED PHRASE GENERATED: ${seedMatch[0]}`);
        
        // Check if it's the repeated "legal winner..." phrase
        if (seedMatch[0].startsWith('legal winner thank year')) {
          console.log('⚠️  WARNING: Same seed phrase detected again! This is a bug.');
          console.log('   Each wallet creation should generate a unique seed phrase.');
        } else {
          console.log('✅ Good: Different seed phrase generated');
        }
      }
      
      // Continue with seed phrase confirmation
      const savedButton = walletPage.locator('button:has-text("I\'ve Saved"), button:has-text("Continue")');
      if (await savedButton.first().isVisible()) {
        await savedButton.first().click();
        await walletPage.waitForLoadState('networkidle');
      }
      
      // Refresh to get unlock page
      await walletPage.reload();
      await walletPage.waitForLoadState('networkidle');
      
      const unlockPageType = await walletPage.evaluate(() => 
        document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
      );
      
      if (unlockPageType === 'unlock') {
        console.log('✓ Now on unlock page');
        
        // Test unlock
        await walletPage.fill('input[type="password"]', 'TestPass123!');
        await walletPage.click('button:has-text("Unlock")');
        await walletPage.waitForLoadState('networkidle');
        console.log('✓ Wallet unlocked');
      }
    }
    
    // Take final screenshots
    await page.screenshot({ 
      path: 'test-results/persistent-tokenlab.png',
      fullPage: true 
    });
    
    await walletPage.screenshot({ 
      path: 'test-results/persistent-wallet.png',
      fullPage: true 
    });
    
    console.log('\n=== KEEPING WINDOWS OPEN ===');
    console.log('Both Token Lab and Wallet windows should remain open');
    console.log('Press Ctrl+C to close the test and windows');
    
    // Keep the test running to prevent window closure
    // This creates an infinite wait that keeps the browser windows open
    await new Promise(() => {}); // This will never resolve, keeping windows open
  });

  test('should create wallet and check for seed phrase uniqueness', async ({ page, context }) => {
    test.setTimeout(60000);
    
    console.log('=== SEED PHRASE UNIQUENESS TEST ===');
    
    // Go directly to wallet
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');
    
    const walletPageType = await page.evaluate(() => 
      document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
    );
    
    if (walletPageType === 'create') {
      console.log('Creating wallet to test seed phrase generation...');
      
      await page.fill('#password', 'TestPass123!');
      await page.fill('#confirmPassword', 'TestPass123!');
      await page.click('button:has-text("Create Wallet & New Address")');
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
      
      const pageContent = await page.textContent('body');
      const seedMatch = pageContent?.match(/([a-z]+ ){11}[a-z]+/g);
      
      if (seedMatch) {
        const seedPhrase = seedMatch[0];
        console.log(`\nGenerated seed phrase: ${seedPhrase}`);
        
        // Known repeated phrase from previous tests
        const knownRepeatedPhrase = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
        
        if (seedPhrase === knownRepeatedPhrase) {
          console.log('❌ BUG CONFIRMED: Same seed phrase generated again');
          console.log('   This indicates the wallet is not using proper randomness');
          console.log('   Each wallet should have a unique seed phrase');
        } else {
          console.log('✅ Good: Unique seed phrase generated');
        }
        
        // Extract first few words for pattern analysis
        const firstThreeWords = seedPhrase.split(' ').slice(0, 3).join(' ');
        console.log(`First three words: "${firstThreeWords}"`);
        
        if (firstThreeWords === 'legal winner thank') {
          console.log('⚠️  Same pattern detected in first words');
        }
      } else {
        console.log('Could not extract seed phrase from page');
      }
    }
    
    await page.screenshot({ 
      path: 'test-results/seed-phrase-test.png',
      fullPage: true 
    });
    
    console.log('\n✅ Seed phrase test completed');
    console.log('Check the bug report findings above');
  });
});