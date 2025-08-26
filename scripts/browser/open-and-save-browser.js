import { chromium } from 'playwright';
import fs from 'fs';

async function openAndSaveBrowser() {
  console.log('🚀 Opening browser and saving reference...');
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--remote-debugging-port=9222']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to Token Lab
  await page.goto('http://localhost:3005');
  await page.waitForLoadState('networkidle');
  console.log('✅ Token Lab opened');
  
  // Open wallet popup
  const walletPagePromise = context.waitForEvent('page');
  await page.click('button:has-text("Connect Wallet")');
  const walletPage = await walletPagePromise;
  await walletPage.waitForLoadState('networkidle');
  console.log('✅ Wallet popup opened');
  
  // Save browser connection info
  const browserInfo = {
    wsEndpoint: browser.wsEndpoint(),
    tokenLabUrl: page.url(),
    walletUrl: walletPage.url(),
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync('./browser-connection.json', JSON.stringify(browserInfo, null, 2));
  console.log('📄 Browser connection info saved to browser-connection.json');
  
  console.log('\n🎉 Browser is open and reference saved!');
  console.log('🧪 Now run: npm run test:target-saved');
  console.log('\n⚠️  Keep this terminal open or browser will close');
  
  // Keep alive
  process.on('SIGINT', async () => {
    console.log('\n👋 Closing browser...');
    if (fs.existsSync('./browser-connection.json')) {
      fs.unlinkSync('./browser-connection.json');
    }
    await browser.close();
    process.exit(0);
  });
  
  // Prevent script from ending
  setInterval(() => {
    console.log('🔄 Browser session maintained...');
  }, 30000);
}

openAndSaveBrowser().catch(console.error);