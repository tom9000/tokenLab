#!/usr/bin/env node

/**
 * Step-by-step agent authentication debugging
 * Tests each step of the authentication process individually
 */

import { chromium } from 'playwright';

async function testStepByStep() {
  console.log('🔍 Step-by-Step Agent Authentication Debug\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture ALL console messages
  const logs = [];
  page.on('console', msg => {
    const log = {
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toLocaleTimeString()
    };
    logs.push(log);
    console.log(`[${log.timestamp}] ${log.type.toUpperCase()}: ${log.text}`);
  });
  
  try {
    console.log('🌐 Loading Token Lab...');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('networkidle');
    
    // Step 1: Set up password and log it
    console.log('\n=== Step 1: Set up authentication ===');
    await page.evaluate(() => {
      window.__SAFU_AGENT_PASSWORD__ = 'password123';
      console.log('✅ Password configured for automation');
      console.log('🔍 Testing if password is accessible:', !!window.__SAFU_AGENT_PASSWORD__);
    });
    
    // Step 2: Test API access directly from browser
    console.log('\n=== Step 2: Test direct API access ===');
    const apiTest = await page.evaluate(async () => {
      console.log('🧪 Testing direct /api/auth call...');
      try {
        const response = await fetch('http://localhost:3003/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: 'password123',
            appName: 'Token Lab',
            origin: 'http://localhost:3005',
            mode: 'agent'
          })
        });
        
        const result = await response.json();
        console.log('✅ Direct API call successful');
        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Success: ${result.success}`);
        console.log(`📊 Public key: ${result.publicKey}`);
        
        return { success: true, data: result };
      } catch (error) {
        console.log(`❌ Direct API call failed: ${error.message}`);
        return { success: false, error: error.message };
      }
    });
    
    if (!apiTest.success) {
      console.log('❌ Direct API test failed - stopping here');
      return;
    }
    
    // Step 3: Click Connect Agent and monitor
    console.log('\n=== Step 3: Click Connect Agent ===');
    
    // Add more detailed logging to the page
    await page.evaluate(() => {
      // Override console.log to make sure we see everything
      const originalLog = console.log;
      console.log = function(...args) {
        originalLog.apply(console, ['[PAGE_DEBUG]', ...args]);
      };
      
      // Override fetch to see all network calls
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        console.log('🌐 FETCH CALL:', args[0], args[1]?.method || 'GET');
        return originalFetch.apply(this, args).then(response => {
          console.log('📡 FETCH RESPONSE:', args[0], response.status, response.statusText);
          return response;
        }).catch(error => {
          console.log('❌ FETCH ERROR:', args[0], error.message);
          throw error;
        });
      };
    });
    
    const connectButton = page.locator('button:has-text("Connect Agent")');
    await connectButton.click();
    console.log('🔗 Connect Agent button clicked');
    
    // Step 4: Monitor for 15 seconds with detailed progress
    console.log('\n=== Step 4: Monitor authentication process ===');
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      
      // Check wallet state
      const walletState = await page.evaluate(() => {
        // Try to access React component state if possible
        const buttons = document.querySelectorAll('button');
        const agentButton = Array.from(buttons).find(b => b.textContent?.includes('Connect Agent'));
        const disconnectButton = Array.from(buttons).find(b => b.textContent?.includes('Disconnect'));
        
        return {
          hasDisconnectButton: !!disconnectButton,
          agentButtonText: agentButton?.textContent || 'not found',
          agentModeVisible: !!document.querySelector('*[text*="AGENT"]'),
          walletAddressVisible: !!document.querySelector('*[text*="G"]')
        };
      });
      
      console.log(`[${i+1}s] Disconnect button: ${walletState.hasDisconnectButton}, Agent mode: ${walletState.agentModeVisible}`);
      
      if (walletState.hasDisconnectButton) {
        console.log('✅ Connection successful - Disconnect button found!');
        break;
      }
      
      if (i === 7) {
        console.log('🔍 Halfway point - checking for error messages...');
        const errorVisible = await page.locator('text=/❌.*auth/i, text=/❌.*fail/i, text=/❌.*connect/i').isVisible().catch(() => false);
        if (errorVisible) {
          const errorText = await page.locator('text=/❌.*auth/i, text=/❌.*fail/i, text=/❌.*connect/i').textContent();
          console.log(`🔍 Found error message: ${errorText}`);
        }
      }
    }
    
    // Final state check
    console.log('\n=== Final State Check ===');
    const finalCheck = await page.evaluate(() => {
      const disconnectBtn = document.querySelector('button:contains("Disconnect")') || 
                           Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Disconnect'));
      const agentMode = document.querySelector('*:contains("AGENT")') ||
                       Array.from(document.querySelectorAll('*')).find(el => el.textContent?.includes('AGENT'));
      
      return {
        disconnectButtonExists: !!disconnectBtn,
        agentModeExists: !!agentMode,
        disconnectButtonText: disconnectBtn?.textContent || 'none',
        agentModeText: agentMode?.textContent || 'none'
      };
    });
    
    console.log('📊 Final wallet state:', finalCheck);
    
    // Show authentication-related logs
    const authLogs = logs.filter(log => 
      log.text.includes('auth') || log.text.includes('🤖') || log.text.includes('TOKEN_LAB_AGENT') ||
      log.text.includes('FETCH') || log.text.includes('connect') || log.text.includes('Session')
    );
    
    if (authLogs.length > 0) {
      console.log('\n=== Authentication Logs ===');
      authLogs.forEach(log => {
        console.log(`[${log.timestamp}] ${log.text}`);
      });
    }
    
    await page.screenshot({ path: 'screenshots/agent-step-by-step.png', fullPage: true });
    console.log('\n✅ Step-by-step test completed');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
}

testStepByStep().catch(console.error);