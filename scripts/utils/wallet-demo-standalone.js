import { chromium } from 'playwright';

async function openPersistentWindows() {
  console.log('🚀 Opening persistent browser windows...');
  console.log('📝 Note: These windows will stay open until you manually close them or press Ctrl+C here');
  
  // Launch browser without test framework - this gives us full control
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security'
    ]
  });
  
  // Create context
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  console.log('✅ Browser launched');
  
  try {
    // Open Token Lab
    const tokenLabPage = await context.newPage();
    await tokenLabPage.goto('http://localhost:3005');
    await tokenLabPage.waitForLoadState('networkidle');
    console.log('✅ Token Lab opened at http://localhost:3005');
    
    // Wait a bit then connect wallet
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Click Connect Wallet - this should open popup
    console.log('🔗 Clicking Connect Wallet...');
    
    // Listen for new page (wallet popup) 
    const walletPagePromise = context.waitForEvent('page');
    await tokenLabPage.click('button:has-text("Connect Wallet")');
    
    // Wait for wallet popup
    const walletPage = await walletPagePromise;
    await walletPage.waitForLoadState('networkidle');
    console.log('✅ Wallet popup opened at http://localhost:3003');
    
    // Check wallet state
    const walletPageType = await walletPage.evaluate(() => 
      document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
    );
    
    console.log(`📋 Wallet page type: ${walletPageType}`);
    
    if (walletPageType === 'create') {
      console.log('🔐 Creating new wallet...');
      
      await walletPage.fill('#password', 'TestPass123!');
      await walletPage.fill('#confirmPassword', 'TestPass123!');
      console.log('   ✓ Password fields filled');
      
      await walletPage.click('button:has-text("Create Wallet & New Address")');
      console.log('   ✓ Create button clicked');
      
      // Wait for wallet creation
      await walletPage.waitForLoadState('networkidle');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check for seed phrase
      const pageContent = await walletPage.textContent('body');
      const seedMatch = pageContent?.match(/([a-z]+ ){11}[a-z]+/g);
      if (seedMatch) {
        console.log(`   🌱 Seed phrase: ${seedMatch[0]}`);
        
        if (seedMatch[0].startsWith('legal winner thank year')) {
          console.log('   ⚠️  Same seed phrase bug detected!');
        }
      }
      
      // Continue through seed phrase confirmation
      const savedButton = walletPage.locator('button:has-text("I\'ve Saved"), button:has-text("Continue")');
      if (await savedButton.first().isVisible()) {
        await savedButton.first().click();
        console.log('   ✓ Seed phrase confirmed');
        await walletPage.waitForLoadState('networkidle');
      }
      
      // Refresh to show unlock page
      console.log('🔄 Refreshing to show unlock page...');
      await walletPage.reload();
      await walletPage.waitForLoadState('networkidle');
      
      const unlockPageType = await walletPage.evaluate(() => 
        document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
      );
      
      if (unlockPageType === 'unlock') {
        console.log('🔓 Now on unlock page - testing unlock...');
        
        await walletPage.fill('input[type="password"]', 'TestPass123!');
        await walletPage.click('button:has-text("Unlock")');
        await walletPage.waitForLoadState('networkidle');
        console.log('   ✓ Wallet unlocked');
      }
      
    } else if (walletPageType === 'unlock') {
      console.log('🔓 Unlocking existing wallet...');
      
      await walletPage.fill('input[type="password"]', 'TestPass123!');
      await walletPage.click('button:has-text("Unlock")');
      await walletPage.waitForLoadState('networkidle');
      console.log('   ✓ Wallet unlocked');
    }
    
    console.log('\n🎉 Setup complete!');
    console.log('📖 Both windows are now open and fully functional:');
    console.log('   • Token Lab: http://localhost:3005');
    console.log('   • Safu-Dev Wallet: http://localhost:3003');
    console.log('\n💡 You can now:');
    console.log('   • Test wallet connections manually');
    console.log('   • Inspect both applications');
    console.log('   • Take screenshots');
    console.log('   • Test token deployment workflows');
    console.log('\n⚠️  To close: Press Ctrl+C in this terminal or close browser windows manually');
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n👋 Shutting down gracefully...');
      try {
        await browser.close();
        console.log('✅ Browser closed');
      } catch (error) {
        console.log('Browser was already closed');
      }
      process.exit(0);
    });
    
    // Keep script alive indefinitely - windows will stay open
    console.log('\n⏳ Keeping windows open... (Press Ctrl+C to close)');
    
    // Instead of infinite loop, use setInterval to keep process alive
    const keepAlive = setInterval(() => {
      // Do nothing, just keep the process alive
    }, 60000); // Check every minute
    
    // If browser is closed manually, exit gracefully
    browser.on('disconnected', () => {
      console.log('\n🔌 Browser was closed manually');
      clearInterval(keepAlive);
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error occurred:', error);
    await browser.close();
    process.exit(1);
  }
}

// Start the demo
openPersistentWindows().catch(error => {
  console.error('Failed to start:', error);
  process.exit(1);
});