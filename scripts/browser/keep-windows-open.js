import { chromium } from '@playwright/test';

async function keepWindowsOpen() {
  console.log('🚀 Starting Playwright with persistent windows...');
  
  // Launch browser with GUI
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000, // Slow down actions for visibility
  });
  
  const context = await browser.newContext();
  
  // Open Token Lab
  const tokenLabPage = await context.newPage();
  await tokenLabPage.goto('http://localhost:3005');
  await tokenLabPage.waitForLoadState('networkidle');
  console.log('✅ Token Lab opened');
  
  // Click Connect Wallet to open Safu-Dev wallet
  const walletPagePromise = context.waitForEvent('page');
  await tokenLabPage.click('button:has-text("Connect Wallet")');
  
  const walletPage = await walletPagePromise;
  await walletPage.waitForLoadState('networkidle');
  console.log('✅ Wallet popup opened');
  
  // Check if we need to create or unlock wallet
  const walletPageType = await walletPage.evaluate(() => 
    document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
  );
  
  console.log(`Wallet page type: ${walletPageType}`);
  
  if (walletPageType === 'create') {
    console.log('Creating new wallet...');
    
    await walletPage.fill('#password', 'TestPass123!');
    await walletPage.fill('#confirmPassword', 'TestPass123!');
    await walletPage.click('button:has-text("Create Wallet & New Address")');
    
    await walletPage.waitForLoadState('networkidle');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check for seed phrase
    const pageContent = await walletPage.textContent('body');
    const seedMatch = pageContent?.match(/([a-z]+ ){11}[a-z]+/g);
    if (seedMatch) {
      console.log(`🔍 Seed phrase: ${seedMatch[0]}`);
      
      if (seedMatch[0].startsWith('legal winner thank year')) {
        console.log('⚠️  Same seed phrase pattern detected - this is the bug!');
      } else {
        console.log('✅ Unique seed phrase generated');
      }
    }
    
    // Continue through wallet creation
    const savedButton = walletPage.locator('button:has-text("I\'ve Saved"), button:has-text("Continue")');
    if (await savedButton.first().isVisible()) {
      await savedButton.first().click();
      await walletPage.waitForLoadState('networkidle');
    }
    
  } else if (walletPageType === 'unlock') {
    console.log('Unlocking existing wallet...');
    
    await walletPage.fill('input[type="password"]', 'TestPass123!');
    await walletPage.click('button:has-text("Unlock")');
    await walletPage.waitForLoadState('networkidle');
  }
  
  console.log('\n🎉 Setup complete!');
  console.log('📖 Both windows are now open and ready for manual inspection:');
  console.log('   • Token Lab: http://localhost:3005');
  console.log('   • Safu-Dev Wallet: http://localhost:3003');
  console.log('\n⏱️  Windows will stay open indefinitely...');
  console.log('   Press Ctrl+C to close everything');
  
  // Keep the script running indefinitely
  process.on('SIGINT', async () => {
    console.log('\n👋 Closing browsers...');
    await browser.close();
    process.exit(0);
  });
  
  // Infinite loop to keep script alive
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}

keepWindowsOpen().catch(console.error);