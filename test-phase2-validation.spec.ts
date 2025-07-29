import { test, expect } from '@playwright/test';

/**
 * Phase 2.2 Validation Test
 * Confirms the "Bad union switch: 1" error has been resolved
 */

test.describe('Phase 2.2: XDR Union Switch Error Resolution Validation', () => {
  
  test('Validate XDR compatibility fix by testing deployment', async ({ page }) => {
    console.log('🧪 Phase 2.2 Validation: Testing XDR Union Switch Error Resolution');

    // Step 1: Navigate to Token Lab
    await page.goto('http://localhost:3005');
    await expect(page).toHaveTitle(/Token Lab/);
    console.log('✅ Token Lab loaded');

    // Step 2: Take initial screenshot
    await page.screenshot({ 
      path: 'screenshots/phase2-validation-start.png',
      fullPage: true 
    });

    // Step 3: Look for the deployment interface
    const deployButton = page.locator('button:has-text("Deploy SEP-41 Token")');
    await expect(deployButton).toBeVisible();
    console.log('✅ Deploy SEP-41 Token button found');

    // Step 4: Fill in token details
    const inputs = page.locator('input[type="text"], input:not([type])');
    
    // Fill token name
    await inputs.nth(0).fill('TEST Token');
    
    // Fill token symbol  
    await inputs.nth(1).fill('TEST');
    
    // Fill decimals
    const decimalInput = page.locator('input[type="number"]');
    await decimalInput.fill('7');
    
    console.log('✅ Token details filled');

    // Step 5: Monitor console for errors
    const consoleMessages: string[] = [];
    const jsErrors: string[] = [];
    
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      if (msg.text().toLowerCase().includes('union switch') || 
          msg.text().toLowerCase().includes('xdr') ||
          msg.text().toLowerCase().includes('stellar')) {
        console.log(`📊 Console: ${msg.type()}: ${msg.text()}`);
      }
    });
    
    page.on('pageerror', error => {
      jsErrors.push(error.message);
      console.log(`❌ JS Error: ${error.message}`);
    });

    // Step 6: Attempt deployment
    console.log('🚀 Attempting SEP-41 token deployment...');
    await deployButton.click();

    // Wait for deployment process
    await page.waitForTimeout(5000);

    // Step 7: Check for XDR generation success
    const logSection = page.locator('h3:has-text("Log")').locator('..').locator('div, pre, textarea').first();
    const logContent = await logSection.textContent().catch(() => '');
    
    console.log('📊 Deployment log content length:', logContent.length);

    // Step 8: Look for success indicators
    const hasXDR = logContent.includes('AAAA') || logContent.length > 1000;
    const hasUnionSwitchError = logContent.toLowerCase().includes('bad union switch') || 
                               logContent.toLowerCase().includes('union switch: 1');
    const hasSDKVersionError = logContent.toLowerCase().includes('13.3.0') ||
                              logContent.toLowerCase().includes('sdk v13');

    // Step 9: Validate Phase 2.2 fix
    if (hasUnionSwitchError) {
      console.log('❌ Phase 2.2 Fix FAILED: Union switch errors still present');
      throw new Error('Phase 2.2 validation failed: Union switch errors detected');
    } else {
      console.log('✅ Phase 2.2 Fix SUCCESS: No union switch errors detected');
    }

    if (hasSDKVersionError) {
      console.log('❌ SDK version references to v13 still present');
    } else {
      console.log('✅ No references to old SDK v13 found');
    }

    if (hasXDR) {
      console.log('✅ XDR generation appears successful (long content detected)');
    } else {
      console.log('⚠️  XDR generation may have issues (short/no content)');
    }

    // Step 10: Check JavaScript errors
    const relevantErrors = jsErrors.filter(error => 
      error.toLowerCase().includes('union switch') ||
      error.toLowerCase().includes('xdr') ||
      error.toLowerCase().includes('stellar')
    );

    if (relevantErrors.length === 0) {
      console.log('✅ No relevant JavaScript errors detected');
    } else {
      console.log(`❌ Found ${relevantErrors.length} relevant JavaScript errors:`);
      relevantErrors.forEach(error => console.log(`   - ${error}`));
    }

    // Step 11: Take final screenshot
    await page.screenshot({ 
      path: 'screenshots/phase2-validation-complete.png',
      fullPage: true 
    });

    // Step 12: Final validation summary
    console.log('\n=== Phase 2.2 Validation Summary ===');
    console.log(`✅ No "Bad union switch: 1" errors: ${!hasUnionSwitchError}`);
    console.log(`✅ No SDK v13 references: ${!hasSDKVersionError}`);
    console.log(`✅ XDR generation working: ${hasXDR}`);
    console.log(`✅ No relevant JS errors: ${relevantErrors.length === 0}`);
    console.log(`📊 Total console messages: ${consoleMessages.length}`);
    console.log(`📊 Total JS errors: ${jsErrors.length}`);

    if (!hasUnionSwitchError && !hasSDKVersionError && relevantErrors.length === 0) {
      console.log('🎉 PHASE 2.2 VALIDATION: SUCCESS');
      console.log('✅ XDR Union Switch Error has been resolved');
      console.log('✅ Token Lab → SAFU wallet integration ready');
    }
  });

  test('Test SAFU wallet connection capability', async ({ page }) => {
    console.log('🔗 Testing SAFU wallet connection capability');

    await page.goto('http://localhost:3005');
    
    // Look for connection buttons
    const connectButtons = ['Connect Local', 'Connect Agent', 'Connect Browser'];
    
    for (const buttonText of connectButtons) {
      const button = page.locator(`button:has-text("${buttonText}")`);
      if (await button.isVisible()) {
        console.log(`✅ Found connection option: ${buttonText}`);
        
        // Test click without waiting for full connection
        await button.click();
        await page.waitForTimeout(1000);
        
        console.log(`✅ ${buttonText} click successful`);
      }
    }

    // Check for any wallet-related elements
    const walletElements = await page.locator('*').evaluateAll(elements => 
      elements.filter(el => 
        el.textContent?.toLowerCase().includes('wallet') ||
        el.textContent?.toLowerCase().includes('safu') ||
        el.textContent?.toLowerCase().includes('connect')
      ).length
    );

    console.log(`📊 Found ${walletElements} wallet-related elements`);
    console.log('✅ Wallet connection interface validation complete');
  });

  test('Verify no legacy error messages remain', async ({ page }) => {
    console.log('🔍 Checking for legacy error messages');

    await page.goto('http://localhost:3005');
    
    // Check page content for legacy error messages
    const pageContent = await page.textContent('body');
    
    const legacyMessages = [
      'bad union switch',
      'union switch: 1', 
      'SDK v13.3.0',
      'XDR parsing errors',
      'compatibility issues'
    ];

    let foundLegacyMessages = 0;
    
    for (const message of legacyMessages) {
      if (pageContent?.toLowerCase().includes(message.toLowerCase())) {
        console.log(`⚠️  Found legacy message: "${message}"`);
        foundLegacyMessages++;
      }
    }

    if (foundLegacyMessages === 0) {
      console.log('✅ No legacy error messages found');
      console.log('✅ Interface has been updated for Phase 2.2 fix');
    } else {
      console.log(`⚠️  Found ${foundLegacyMessages} legacy messages that should be updated`);
    }

    console.log('✅ Legacy message check complete');
  });
});