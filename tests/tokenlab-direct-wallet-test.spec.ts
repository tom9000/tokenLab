import { test, expect } from '@playwright/test';

test.describe('Direct Wallet Access Test', () => {
  test('should access wallet directly and check state', async ({ page }) => {
    test.setTimeout(60000);
    
    console.log('=== DIRECT WALLET ACCESS TEST ===');
    
    // Go directly to the wallet URL first
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');
    
    // Check what page we land on
    const walletPageType = await page.evaluate(() => 
      document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
    );
    const walletState = await page.evaluate(() =>
      document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
    );
    
    console.log(`Direct access - Page Type: ${walletPageType}, Wallet State: ${walletState}`);
    
    await page.screenshot({ 
      path: 'test-results/wallet-direct-access.png',
      fullPage: true 
    });
    
    // Document the current page content
    const pageContent = await page.textContent('body');
    console.log('Direct wallet page content:', pageContent?.substring(0, 400));
    
    if (walletPageType === 'unlock' && walletState === 'locked') {
      console.log('\n=== FOUND UNLOCK PAGE! ===');
      
      // Document unlock page structure
      console.log('Unlock page detected - documenting structure...');
      
      // Check for password field
      const passwordField = page.locator('input[type="password"]');
      const hasPasswordField = await passwordField.isVisible();
      console.log(`Password field visible: ${hasPasswordField}`);
      
      if (hasPasswordField) {
        // Try to unlock
        await passwordField.fill('TestPass123!');
        console.log('✓ Entered unlock password');
        
        const unlockButton = page.locator('button:has-text("Unlock")');
        if (await unlockButton.isVisible()) {
          await unlockButton.click();
          console.log('✓ Clicked Unlock button');
          
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          
          const postUnlockState = await page.evaluate(() =>
            document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
          );
          console.log(`Post-unlock wallet state: ${postUnlockState}`);
          
          await page.screenshot({ 
            path: 'test-results/wallet-post-unlock.png',
            fullPage: true 
          });
        }
      }
      
      // Check for reset option
      const resetButton = page.locator('button:has-text("Reset Wallet"), :text("Reset Wallet")');
      const hasReset = await resetButton.first().isVisible().catch(() => false);
      console.log(`Reset Wallet option available: ${hasReset}`);
      
    } else if (walletPageType === 'create' && walletState === 'no-wallet') {
      console.log('\n=== CREATE WALLET PAGE ===');
      console.log('Still on create page - wallet storage is isolated per browser session');
      
      // Let's create a wallet and then try to access it again
      const passwordField = page.locator('#password');
      const confirmPasswordField = page.locator('#confirmPassword');
      
      if (await passwordField.isVisible()) {
        await passwordField.fill('TestPass123!');
        await confirmPasswordField.fill('TestPass123!');
        console.log('✓ Filled password fields');
        
        const createButton = page.locator('button:has-text("Create Wallet & New Address")');
        if (await createButton.isVisible()) {
          await createButton.click();
          console.log('✓ Creating wallet...');
          
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(5000); // Wait for wallet creation
          
          // Take screenshot of the result
          await page.screenshot({ 
            path: 'test-results/wallet-created-direct.png',
            fullPage: true 
          });
          
          // Now try refreshing to see if we get unlock page
          console.log('\n=== TESTING REFRESH AFTER WALLET CREATION ===');
          await page.reload();
          await page.waitForLoadState('networkidle');
          
          const refreshPageType = await page.evaluate(() => 
            document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
          );
          const refreshWalletState = await page.evaluate(() =>
            document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
          );
          
          console.log(`After refresh - Page Type: ${refreshPageType}, Wallet State: ${refreshWalletState}`);
          
          await page.screenshot({ 
            path: 'test-results/wallet-after-refresh.png',
            fullPage: true 
          });
          
          if (refreshPageType === 'unlock' && refreshWalletState === 'locked') {
            console.log('🎉 SUCCESS! Now we have the unlock page!');
            
            // Test unlocking
            const unlockPasswordField = page.locator('input[type="password"]');
            if (await unlockPasswordField.isVisible()) {
              await unlockPasswordField.fill('TestPass123!');
              console.log('✓ Entered unlock password');
              
              const unlockButton = page.locator('button:has-text("Unlock")');
              if (await unlockButton.isVisible()) {
                await unlockButton.click();
                console.log('✓ Clicked Unlock button');
                
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(2000);
                
                const finalState = await page.evaluate(() =>
                  document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
                );
                console.log(`Final wallet state: ${finalState}`);
                
                await page.screenshot({ 
                  path: 'test-results/wallet-unlocked-final.png',
                  fullPage: true 
                });
              }
            }
          }
        }
      }
    }
    
    console.log('\n=== TEST COMPLETED ===');
    console.log('Window left open for inspection');
  });

  test('should document wallet page structures', async ({ page }) => {
    test.setTimeout(30000);
    
    console.log('=== WALLET PAGE STRUCTURE DOCUMENTATION ===');
    
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');
    
    // Document all visible elements
    const buttons = await page.locator('button').all();
    console.log(`\nButtons found (${buttons.length}):`);
    for (let i = 0; i < buttons.length; i++) {
      const buttonText = await buttons[i].textContent();
      const isVisible = await buttons[i].isVisible();
      if (isVisible) {
        console.log(`  - "${buttonText}"`);
      }
    }
    
    const inputs = await page.locator('input').all();
    console.log(`\nInput fields found (${inputs.length}):`);
    for (let i = 0; i < inputs.length; i++) {
      const inputType = await inputs[i].getAttribute('type');
      const inputId = await inputs[i].getAttribute('id');
      const placeholder = await inputs[i].getAttribute('placeholder');
      const isVisible = await inputs[i].isVisible();
      if (isVisible) {
        console.log(`  - type="${inputType}", id="${inputId}", placeholder="${placeholder}"`);
      }
    }
    
    const links = await page.locator('a').all();
    console.log(`\nLinks found (${links.length}):`);
    for (let i = 0; i < links.length; i++) {
      const linkText = await links[i].textContent();
      const href = await links[i].getAttribute('href');
      const isVisible = await links[i].isVisible();
      if (isVisible && linkText?.trim()) {
        console.log(`  - "${linkText}" -> ${href}`);
      }
    }
    
    await page.screenshot({ 
      path: 'test-results/wallet-structure-doc.png',
      fullPage: true 
    });
  });
});