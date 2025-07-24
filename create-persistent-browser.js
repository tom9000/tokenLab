import { chromium } from 'playwright';
import fs from 'fs';

async function createPersistentBrowser() {
  console.log('🚀 Creating persistent browser session...');
  
  // Launch browser with a user data directory for persistence
  const browser = await chromium.launchPersistentContext('./browser-data', {
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security'
    ]
  });
  
  console.log('✅ Persistent browser launched');
  
  // Open Token Lab
  const page = await browser.newPage();
  await page.goto('http://localhost:3005');
  await page.waitForLoadState('networkidle');
  console.log('✅ Token Lab opened');
  
  // This approach doesn't work as expected because scripts close windows
  console.log('⚠️  Script-based browsers tend to close when scripts end');
  console.log('💡 Better approach: Use individual commands as documented');
  
  await browser.close();
}

createPersistentBrowser().catch(console.error);