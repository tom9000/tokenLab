import { chromium } from 'playwright';

async function targetExistingBrowser() {
  console.log('🔍 Looking for existing browser on debugging port 9222...');
  
  try {
    // Connect to browser opened from Claude Code
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ Connected to existing browser');
    
    // Get all contexts and pages
    const contexts = browser.contexts();
    console.log(`📄 Found ${contexts.length} browser contexts`);
    
    for (let i = 0; i < contexts.length; i++) {
      const context = contexts[i];
      const pages = context.pages();
      console.log(`Context ${i}: ${pages.length} pages`);
      
      for (const page of pages) {
        const url = page.url();
        console.log(`  - ${url}`);
        
        if (url.includes('localhost:3005')) {
          console.log('🎯 Found Token Lab page - running tests...');
          
          // Run tests on the existing page
          await testTokenLab(page);
          
        } else if (url.includes('localhost:3003')) {
          console.log('🔐 Found Wallet page - running wallet tests...');
          
          // Run wallet tests on existing page
          await testWallet(page);
        }
      }
    }
    
    console.log('🎉 All tests completed on existing browser windows');
    console.log('💡 Browser windows remain open for continued use');
    
    // Don't close the browser - it was opened from Claude Code
    
  } catch (error) {
    console.error('❌ Could not connect to existing browser:', error.message);
    console.log('💡 Make sure to launch browser from Claude Code with:');
    console.log('   const browser = await chromium.launch({ headless: false, args: ["--remote-debugging-port=9222"] });');
  }
}

async function testTokenLab(page) {
  console.log('🧪 Testing Token Lab functionality...');
  
  // Verify page title
  const title = await page.title();
  console.log(`✓ Title: ${title}`);
  
  // Check meta tags
  const pageType = await page.evaluate(() => 
    document.querySelector('meta[name="tokenlab-page"]')?.getAttribute('content')
  );
  console.log(`✓ Page type: ${pageType}`);
  
  // Test form interaction
  const nameInput = page.locator('input').first();
  await nameInput.fill('Script Test Token');
  const value = await nameInput.inputValue();
  console.log(`✓ Form input works: "${value}"`);
  
  // Clear the input
  await nameInput.fill('');
  
  // Check connect wallet button
  const connectButton = page.locator('button:has-text("Connect Wallet")');
  const isEnabled = await connectButton.isEnabled();
  console.log(`✓ Connect Wallet button enabled: ${isEnabled}`);
  
  // Take screenshot
  await page.screenshot({ 
    path: 'test-results/targeted-tokenlab.png',
    fullPage: true 
  });
  console.log('✓ Screenshot saved');
}

async function testWallet(page) {
  console.log('🔐 Testing Wallet functionality...');
  
  // Check wallet page type
  const walletPageType = await page.evaluate(() => 
    document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
  );
  const walletState = await page.evaluate(() =>
    document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
  );
  
  console.log(`✓ Wallet page: ${walletPageType}/${walletState}`);
  
  if (walletPageType === 'create') {
    console.log('📝 Testing create wallet form...');
    
    const passwordField = page.locator('#password');
    const confirmField = page.locator('#confirmPassword');
    
    const passwordVisible = await passwordField.isVisible();
    const confirmVisible = await confirmField.isVisible();
    
    console.log(`✓ Password field visible: ${passwordVisible}`);
    console.log(`✓ Confirm field visible: ${confirmVisible}`);
    
    // Test filling (but not submitting)
    await passwordField.fill('TestPass123!');
    await confirmField.fill('TestPass123!');
    console.log('✓ Password fields can be filled');
    
    // Clear fields
    await passwordField.fill('');
    await confirmField.fill('');
    
  } else if (walletPageType === 'unlock') {
    console.log('🔓 Testing unlock form...');
    
    const passwordField = page.locator('input[type="password"]');
    const unlockButton = page.locator('button:has-text("Unlock")');
    const resetButton = page.locator('button:has-text("Reset Wallet")');
    
    console.log(`✓ Password field visible: ${await passwordField.isVisible()}`);
    console.log(`✓ Unlock button visible: ${await unlockButton.isVisible()}`);
    console.log(`✓ Reset option available: ${await resetButton.isVisible()}`);
  }
  
  // Take screenshot
  await page.screenshot({ 
    path: 'test-results/targeted-wallet.png',
    fullPage: true 
  });
  console.log('✓ Wallet screenshot saved');
}

targetExistingBrowser().catch(console.error);