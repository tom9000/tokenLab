#!/usr/bin/env node

/**
 * Manual Agent Connection Test
 * Direct browser automation to test Connect Agent functionality
 */

import { chromium } from 'playwright';

async function testAgentConnection() {
  console.log('🤖 Manual Agent Connection Test\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Monitor console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('🤖') || text.includes('[AGENT]') || text.includes('SAFU') || text.includes('Connect')) {
      console.log(`📊 Console: ${text}`);
    }
  });
  
  try {
    // Navigate to Token Lab
    console.log('🌐 Loading Token Lab...');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('networkidle');
    
    const title = await page.title();
    console.log(`✅ Page loaded: ${title}`);
    
    // Take screenshot to see current interface
    await page.screenshot({ path: 'screenshots/tokenlab-current-interface.png', fullPage: true });
    console.log('📸 Screenshot saved: tokenlab-current-interface.png');
    
    // Look for any connection buttons
    const buttons = await page.locator('button').all();
    console.log(`🔘 Found ${buttons.length} buttons on page:`);
    
    for (let i = 0; i < buttons.length; i++) {
      try {
        const text = await buttons[i].textContent();
        const isVisible = await buttons[i].isVisible();
        console.log(`   ${i + 1}. "${text}" (visible: ${isVisible})`);
      } catch (e) {
        console.log(`   ${i + 1}. [Could not read button text]`);
      }
    }
    
    // Look specifically for Connect Agent or similar buttons
    const connectButtons = [
      'button:has-text("Connect Agent")',
      'button:has-text("Connect")',  
      'button:has-text("Agent")',
      'button:has-text("Wallet")',
      'button:has-text("SAFU")',
      'button:has-text("Local")'
    ];
    
    let foundConnectButton = null;
    for (const selector of connectButtons) {
      const button = page.locator(selector);
      if (await button.isVisible().catch(() => false)) {
        const text = await button.textContent();
        console.log(`✅ Found connection button: "${text}"`);
        foundConnectButton = button;
        break;
      }
    }
    
    if (foundConnectButton) {
      console.log('🔗 Testing button click...');
      await foundConnectButton.click();
      await page.waitForTimeout(3000);
      
      // Check for password dialog or authentication
      const passwordInput = page.locator('input[type="password"]');
      const authDialog = page.locator('dialog, .modal, .popup');
      
      if (await passwordInput.isVisible({ timeout: 5000 })) {
        console.log('🔑 Password input found, entering mock password...');
        await passwordInput.fill('password123');
        
        // Look for submit button or press Enter
        const submitButton = page.locator('button:has-text(/ok|submit|connect|authenticate/i)');
        if (await submitButton.isVisible({ timeout: 2000 })) {
          await submitButton.click();
        } else {
          await passwordInput.press('Enter');
        }
        
        console.log('✅ Authentication submitted');
        await page.waitForTimeout(3000);
      } else if (await authDialog.isVisible({ timeout: 3000 })) {
        console.log('📋 Dialog appeared, checking contents...');
        const dialogText = await authDialog.textContent();
        console.log(`📋 Dialog content: ${dialogText?.substring(0, 200)}...`);
      } else {
        console.log('ℹ️ No authentication dialog appeared');
      }
      
      // Check for agent connection success
      await page.waitForTimeout(5000);
      const agentIndicators = [
        'text=/🤖|AGENT/i',
        'text=/connected/i',
        'text=/G[A-Z0-9]{55}/',
        'text=/success/i'
      ];
      
      for (const selector of agentIndicators) {
        const element = page.locator(selector);
        if (await element.isVisible().catch(() => false)) {
          const text = await element.textContent();
          console.log(`✅ Success indicator found: "${text?.substring(0, 50)}..."`);
        }
      }
      
    } else {
      console.log('⚠️ No connection buttons found');
    }
    
    // Final screenshot after interaction
    await page.screenshot({ path: 'screenshots/tokenlab-after-agent-test.png', fullPage: true });
    console.log('📸 Final screenshot saved: tokenlab-after-agent-test.png');
    
    console.log(`\n📊 Total console messages: ${logs.length}`);
    console.log('✅ Manual agent connection test completed');
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will remain open for manual inspection...');
    console.log('Press any key to close...');
    
    // Wait for user input before closing
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
}

testAgentConnection().catch(console.error);