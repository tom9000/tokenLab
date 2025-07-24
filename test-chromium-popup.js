import { chromium } from 'playwright';

async function testChromiumPopup() {
  console.log('🚀 Starting Chromium browser...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen to console messages from Token Lab
  page.on('console', msg => {
    if (msg.text().includes('FreighterCrossOriginClient') || 
        msg.text().includes('SAFU') || 
        msg.text().includes('discovery') ||
        msg.text().includes('communication') ||
        msg.text().includes('connection')) {
      console.log(`🌐 Token Lab: ${msg.text()}`);
    }
  });
  
  console.log('📍 Navigating to Token Lab...');
  await page.goto('http://localhost:3005');
  
  // Wait for page to load and discovery to start
  await page.waitForTimeout(3000);
  
  console.log('🖱️  Clicking Connect Local button...');
  await page.click('button:has-text("Connect Local")');
  
  // Wait for popup to open
  await page.waitForTimeout(2000);
  
  // Check pages/tabs
  const pages = context.pages();
  console.log(`📊 Total pages/tabs open: ${pages.length}`);
  
  let tokenLabPage = null;
  let safuWalletPage = null;
  
  pages.forEach((p, index) => {
    console.log(`  ${index}: ${p.url()}`);
    if (p.url().includes('localhost:3005')) {
      tokenLabPage = p;
    } else if (p.url().includes('localhost:3003')) {
      safuWalletPage = p;
    }
  });
  
  if (safuWalletPage) {
    console.log('🎯 Found SAFU wallet page, setting up console listener...');
    
    // Listen to console messages from SAFU wallet
    safuWalletPage.on('console', msg => {
      if (msg.text().includes('postMessage') || 
          msg.text().includes('discovery') ||
          msg.text().includes('API') ||
          msg.text().includes('Received') ||
          msg.text().includes('Token Lab')) {
        console.log(`🔐 SAFU Wallet: ${msg.text()}`);
      }
    });
    
    console.log('⏱️  Waiting to observe cross-origin communication...');
    await page.waitForTimeout(10000);
    
    // Check if SAFU wallet shows any connection UI
    try {
      const pageContent = await safuWalletPage.textContent('body');
      if (pageContent.includes('Token Lab') || pageContent.includes('Connect') || pageContent.includes('Allow')) {
        console.log('✅ SAFU wallet shows connection request UI');
      } else {
        console.log('❌ SAFU wallet does not show connection request UI');
        console.log('📄 SAFU wallet page content preview:', pageContent.substring(0, 200) + '...');
      }
      
      // Try to inject a test message from SAFU wallet to Token Lab
      console.log('🧪 Testing reverse communication: SAFU wallet → Token Lab');
      await safuWalletPage.evaluate(() => {
        console.log('🧪 SAFU Wallet: Attempting to send test message to Token Lab');
        window.opener?.postMessage({
          type: 'SAFU_TEST_MESSAGE',
          message: 'Hello from SAFU wallet',
          timestamp: Date.now()
        }, 'http://localhost:3005');
        
        // Also try parent if opener doesn't work
        window.parent?.postMessage({
          type: 'SAFU_TEST_MESSAGE_PARENT',
          message: 'Hello from SAFU wallet (parent)',
          timestamp: Date.now()
        }, 'http://localhost:3005');
        
        console.log('🧪 SAFU Wallet: Test messages sent to Token Lab');
      });
      
    } catch (error) {
      console.log('⚠️  Could not read SAFU wallet page content:', error.message);
    }
  } else {
    console.log('❌ SAFU wallet page not found');
  }
  
  console.log('🔍 Observation complete. Browser will stay open for manual inspection...');
  console.log('📋 Check both console outputs above for communication issues');
  
  // Keep browser open for manual inspection
  await new Promise(resolve => {
    setTimeout(() => {
      console.log('⏰ Auto-closing browser after 30 seconds...');
      resolve();
    }, 30000);
  });
  
  await browser.close();
}

testChromiumPopup().catch(console.error);