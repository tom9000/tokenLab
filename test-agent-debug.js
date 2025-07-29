#!/usr/bin/env node

/**
 * Debug Agent Authentication Issues
 * Captures all errors and logs to understand authentication failure
 */

import { chromium } from 'playwright';

async function debugAgentAuthentication() {
  console.log('🔍 Debug Agent Authentication Issues\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture ALL console messages and errors
  const allLogs = [];
  page.on('console', msg => {
    const log = {
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toLocaleTimeString()
    };
    allLogs.push(log);
    
    // Print important messages
    if (msg.type() === 'error' || msg.text().includes('🤖') || 
        msg.text().includes('TOKEN_LAB_AGENT') || msg.text().includes('auth') ||
        msg.text().includes('fetch') || msg.text().includes('failed')) {
      console.log(`${msg.type().toUpperCase()}: ${msg.text()}`);
    }
  });
  
  // Capture page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error);
    console.log(`❌ PAGE ERROR: ${error.message}`);
  });
  
  // Capture network failures
  page.on('requestfailed', request => {
    console.log(`🌐 NETWORK FAILED: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  try {
    console.log('🌐 Loading Token Lab...');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('networkidle');
    console.log('✅ Token Lab loaded');
    
    // Set up pre-configured password
    console.log('🔧 Setting up pre-configured password...');
    await page.evaluate(() => {
      window.__SAFU_AGENT_PASSWORD__ = 'password123';
      console.log('Pre-configured password set for automation');
    });
    
    console.log('🔗 Clicking Connect Agent button...');
    const connectAgentButton = page.locator('button:has-text("Connect Agent")');
    await connectAgentButton.click();
    
    // Wait longer and monitor closely
    console.log('⏳ Monitoring authentication process for 10 seconds...');
    
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      
      // Check for agent mode or connection status every second
      const agentMode = await page.locator('text=/🤖.*AGENT/i').isVisible().catch(() => false);
      const walletAddress = await page.locator('text=/G[A-Z0-9]{50,}/').isVisible().catch(() => false);
      
      if (agentMode || walletAddress) {
        console.log(`✅ Connection established at ${i+1} seconds`);
        break;
      }
      
      if (i === 4) {
        console.log('⏰ 5 seconds elapsed - checking for specific errors...');
        
        // Look for error messages in the logs section
        const errorInLogs = await page.locator('text=/❌.*connect/i, text=/❌.*auth/i, text=/❌.*fail/i').isVisible().catch(() => false);
        if (errorInLogs) {
          const errorText = await page.locator('text=/❌.*connect/i, text=/❌.*auth/i, text=/❌.*fail/i').textContent();
          console.log(`🔍 Found error in UI: ${errorText}`);
        }
      }
    }
    
    // Final status check
    const finalAgentMode = await page.locator('text=/🤖.*AGENT/i').isVisible().catch(() => false);
    const finalWalletAddress = await page.locator('text=/G[A-Z0-9]{50,}/').isVisible().catch(() => false);
    
    console.log('\n=== Final Authentication Status ===');
    console.log(`🤖 Agent mode visible: ${finalAgentMode}`);
    console.log(`💼 Wallet address visible: ${finalWalletAddress}`);
    console.log(`📊 Total console logs: ${allLogs.length}`);
    console.log(`❌ Page errors: ${pageErrors.length}`);
    
    // Show recent error logs
    const errorLogs = allLogs.filter(log => 
      log.type === 'error' || log.text.includes('❌') || log.text.includes('failed') || log.text.includes('auth')
    );
    
    if (errorLogs.length > 0) {
      console.log('\n=== Error Logs ===');
      errorLogs.forEach(log => {
        console.log(`[${log.timestamp}] ${log.type}: ${log.text}`);
      });
    }
    
    // Show agent-specific logs
    const agentLogs = allLogs.filter(log => 
      log.text.includes('🤖') || log.text.includes('TOKEN_LAB_AGENT') || log.text.includes('SAFU')
    );
    
    if (agentLogs.length > 0) {
      console.log('\n=== Agent Logs ===');
      agentLogs.forEach(log => {
        console.log(`[${log.timestamp}] ${log.text}`);
      });
    }
    
    // Test direct API call from browser
    console.log('\n🧪 Testing direct API call from browser...');
    const apiTestResult = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:3003/api/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password: 'password123',
            appName: 'Token Lab',
            origin: window.location.origin,
            mode: 'agent'
          })
        });
        
        const result = await response.json();
        return { success: response.ok, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log(`🧪 Direct API test result: ${apiTestResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (apiTestResult.success) {
      console.log(`📊 API returned publicKey: ${apiTestResult.data.publicKey}`);
    } else {
      console.log(`❌ API error: ${apiTestResult.error}`);
    }
    
    // Take screenshot for visual inspection
    await page.screenshot({ path: 'screenshots/agent-debug-complete.png', fullPage: true });
    
    console.log('\n🎯 Debug session completed');
    console.log('📸 Screenshot saved as: screenshots/agent-debug-complete.png');
    
  } catch (error) {
    console.error('❌ Debug test error:', error.message);
  } finally {
    await browser.close();
  }
}

debugAgentAuthentication().catch(console.error);