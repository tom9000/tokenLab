import { chromium } from 'playwright';

console.log('🚀 Launching persistent browser from script...');

// Launch browser with remote debugging
const browser = await chromium.launch({ 
  headless: false,
  args: ['--remote-debugging-port=9222'],
  slowMo: 1000
});

const context = await browser.newContext();
const page = await context.newPage();

// Navigate to Token Lab
await page.goto('http://localhost:3005');
await page.waitForLoadState('networkidle');

console.log('✅ Token Lab opened at:', page.url());

// Open wallet popup
console.log('🔗 Opening wallet popup...');
const walletPagePromise = context.waitForEvent('page');
await page.click('button:has-text("Connect Wallet")');

const walletPage = await walletPagePromise;
await walletPage.waitForLoadState('networkidle');

console.log('✅ Wallet popup opened at:', walletPage.url());

console.log('\n🎉 Browser launched successfully!');
console.log('📱 Both windows are now open');
console.log('🔍 Remote debugging enabled on port 9222');
console.log('🧪 Now run: npm run test:existing');
console.log('\n⚠️  Keep this terminal open to maintain the browser session');
console.log('   Press Ctrl+C to close browser when done');

// Keep the script running to maintain browser session
process.on('SIGINT', async () => {
  console.log('\n👋 Closing browser...');
  await browser.close();
  process.exit(0);
});

// Keep alive
setInterval(() => {
  console.log('🔄 Browser session active...');
}, 30000);