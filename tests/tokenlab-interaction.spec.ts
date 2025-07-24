import { test, expect } from '@playwright/test';

test.describe('Token Lab Interactive Tests', () => {
  test('should take screenshot and verify page elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take full page screenshot
    await page.screenshot({ 
      path: 'test-results/tokenlab-full-page.png',
      fullPage: true 
    });
    
    // Get all visible text content for documentation
    const pageText = await page.textContent('body');
    console.log('=== TOKEN LAB PAGE CONTENT ===');
    console.log(pageText?.substring(0, 500) + '...');
    
    // Document all interactive elements
    console.log('\n=== INTERACTIVE ELEMENTS ===');
    
    // Find all buttons
    const buttons = await page.locator('button').all();
    console.log(`Found ${buttons.length} buttons:`);
    for (let i = 0; i < buttons.length; i++) {
      const buttonText = await buttons[i].textContent();
      const isVisible = await buttons[i].isVisible();
      console.log(`  Button ${i + 1}: "${buttonText}" (visible: ${isVisible})`);
    }
    
    // Find all input fields
    const inputs = await page.locator('input').all();
    console.log(`\nFound ${inputs.length} input fields:`);
    for (let i = 0; i < inputs.length; i++) {
      const inputType = await inputs[i].getAttribute('type');
      const inputPlaceholder = await inputs[i].getAttribute('placeholder');
      const isVisible = await inputs[i].isVisible();
      console.log(`  Input ${i + 1}: type="${inputType}", placeholder="${inputPlaceholder}" (visible: ${isVisible})`);
    }
    
    // Find all links
    const links = await page.locator('a').all();
    console.log(`\nFound ${links.length} links:`);
    for (let i = 0; i < links.length; i++) {
      const linkText = await links[i].textContent();
      const href = await links[i].getAttribute('href');
      const isVisible = await links[i].isVisible();
      console.log(`  Link ${i + 1}: "${linkText}" -> ${href} (visible: ${isVisible})`);
    }
  });

  test('should interact with clickable elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('=== TESTING CLICK INTERACTIONS ===');
    
    // Test clicking on development links (they open in new tabs)
    const walletLink = page.locator('a[href="http://localhost:3003"]').first();
    if (await walletLink.isVisible()) {
      console.log('✓ Wallet link is clickable');
      
      // Test the link without actually opening it (to avoid popup)
      const href = await walletLink.getAttribute('href');
      const target = await walletLink.getAttribute('target');
      console.log(`  Wallet link: ${href} (opens in: ${target})`);
    }
    
    const tokenLabLink = page.locator('a[href="http://localhost:3005"]').first();
    if (await tokenLabLink.isVisible()) {
      console.log('✓ Token Lab link is clickable');
      
      const href = await tokenLabLink.getAttribute('href');
      const target = await tokenLabLink.getAttribute('target');
      console.log(`  Token Lab link: ${href} (opens in: ${target})`);
    }
    
    // Check for any forms or interactive elements in the token deployer
    const allButtons = await page.locator('button').all();
    for (let i = 0; i < allButtons.length; i++) {
      const button = allButtons[i];
      if (await button.isVisible()) {
        const buttonText = await button.textContent();
        const isEnabled = await button.isEnabled();
        console.log(`✓ Button "${buttonText}" is ${isEnabled ? 'enabled' : 'disabled'}`);
      }
    }
    
    // Take screenshot after interaction test
    await page.screenshot({ 
      path: 'test-results/tokenlab-after-interaction.png' 
    });
  });

  test('should test form inputs if available', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('=== TESTING FORM INPUTS ===');
    
    // Look for any text inputs and test them
    const textInputs = await page.locator('input[type="text"], input:not([type])').all();
    
    for (let i = 0; i < textInputs.length; i++) {
      const input = textInputs[i];
      if (await input.isVisible() && await input.isEnabled()) {
        const placeholder = await input.getAttribute('placeholder') || `Input ${i + 1}`;
        
        console.log(`Testing input: ${placeholder}`);
        
        // Test typing in the input
        await input.fill('test-value-123');
        const value = await input.inputValue();
        console.log(`  ✓ Successfully entered text: "${value}"`);
        
        // Clear the input
        await input.fill('');
        console.log(`  ✓ Successfully cleared input`);
      }
    }
    
    // Look for number inputs
    const numberInputs = await page.locator('input[type="number"]').all();
    for (let i = 0; i < numberInputs.length; i++) {
      const input = numberInputs[i];
      if (await input.isVisible() && await input.isEnabled()) {
        console.log(`Testing number input ${i + 1}`);
        
        await input.fill('12345');
        const value = await input.inputValue();
        console.log(`  ✓ Successfully entered number: "${value}"`);
        
        await input.fill('');
      }
    }
    
    // Test any textareas
    const textareas = await page.locator('textarea').all();
    for (let i = 0; i < textareas.length; i++) {
      const textarea = textareas[i];
      if (await textarea.isVisible() && await textarea.isEnabled()) {
        console.log(`Testing textarea ${i + 1}`);
        
        await textarea.fill('This is a test message for the textarea');
        const value = await textarea.inputValue();
        console.log(`  ✓ Successfully entered text in textarea: "${value.substring(0, 50)}..."`);
        
        await textarea.fill('');
      }
    }
    
    if (textInputs.length === 0 && numberInputs.length === 0 && textareas.length === 0) {
      console.log('No form inputs found on this page');
    }
  });

  test('should document page structure for automation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('=== TOKEN LAB PAGE STRUCTURE FOR AUTOMATION ===');
    
    // Get page identification meta tags
    const pageType = await page.evaluate(() => 
      document.querySelector('meta[name="tokenlab-page"]')?.getAttribute('content')
    );
    const pageState = await page.evaluate(() =>
      document.querySelector('meta[name="tokenlab-state"]')?.getAttribute('content')
    );
    
    console.log(`Page Type: ${pageType}`);
    console.log(`Page State: ${pageState}`);
    
    // Document main sections
    console.log('\n=== MAIN SECTIONS ===');
    
    // Check for main headings
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const tagName = await heading.evaluate(el => el.tagName);
      const text = await heading.textContent();
      console.log(`${tagName}: "${text}"`);
    }
    
    // Document key selectors for automation
    console.log('\n=== KEY SELECTORS FOR AUTOMATION ===');
    console.log('Meta tags:');
    console.log('  - meta[name="tokenlab-page"]');
    console.log('  - meta[name="tokenlab-state"]');
    
    console.log('\nContent selectors:');
    console.log('  - h3:has-text("Development Links") - Main development section');
    console.log('  - a[href="http://localhost:3003"] - Safu-Dev Wallet link');
    console.log('  - a[href="http://localhost:3005"] - Token Lab link');
    console.log('  - text=Token Lab (this app) - Self-reference text');
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/tokenlab-structure-documented.png' 
    });
  });
});