import { chromium } from 'playwright';
import fs from 'fs';

async function closePersistentBrowser() {
  console.log('👋 Closing persistent browser...');
  
  try {
    if (!fs.existsSync('./browser-endpoint.txt')) {
      console.log('ℹ️ No persistent browser endpoint found');
      return;
    }
    
    const wsEndpoint = fs.readFileSync('./browser-endpoint.txt', 'utf8');
    const browser = await chromium.connect(wsEndpoint);
    
    console.log('🔗 Connected to persistent browser');
    await browser.close();
    console.log('✅ Browser closed');
    
    // Clean up files
    if (fs.existsSync('./browser-endpoint.txt')) {
      fs.unlinkSync('./browser-endpoint.txt');
      console.log('🗑️ Endpoint file removed');
    }
    
    if (fs.existsSync('./browser-data')) {
      fs.rmSync('./browser-data', { recursive: true, force: true });
      console.log('🗑️ Browser data cleaned up');
    }
    
    console.log('🎉 Cleanup complete!');
    
  } catch (error) {
    console.log('⚠️ Browser was already closed or not accessible');
    
    // Clean up files anyway
    if (fs.existsSync('./browser-endpoint.txt')) {
      fs.unlinkSync('./browser-endpoint.txt');
    }
    if (fs.existsSync('./browser-data')) {
      fs.rmSync('./browser-data', { recursive: true, force: true });
    }
    
    console.log('🧹 Files cleaned up');
  }
}

closePersistentBrowser();