#!/usr/bin/env node

/**
 * Authenticated Agent Connection Test
 * Tests the complete Connect Agent 2.0 flow with password authentication
 */

import { chromium } from 'playwright';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAuthenticatedAgentFlow() {
  console.log('🤖 Authenticated Agent Connection Test\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down for better observation
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Monitor all console messages, especially agent-related ones
  const agentLogs = [];
  const allLogs = [];
  
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    allLogs.push({ type, text, timestamp: new Date().toLocaleTimeString() });
    
    if (text.includes('🤖') || text.includes('[AGENT]') || text.includes('TOKEN_LAB_AGENT') || 
        text.includes('SAFU') || text.includes('agent') || text.includes('auth') ||
        text.includes('session') || text.includes('connect')) {
      agentLogs.push({ type, text, timestamp: new Date().toLocaleTimeString() });
      console.log(`🤖 ${msg.type().toUpperCase()}: ${text}`);
    }
  });
  
  // Monitor page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.log(`❌ Page Error: ${error.message}`);
  });
  
  try {
    // Step 1: Navigate to Token Lab
    console.log('🌐 Loading Token Lab...');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('networkidle');
    console.log('✅ Token Lab loaded');
    
    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/agent-auth-step1-loaded.png', fullPage: true });
    
    // Step 2: Wait for page to fully initialize
    await sleep(2000);
    
    // Step 3: Look for Connect Agent button
    console.log('🔍 Looking for Connect Agent button...');
    const connectAgentButton = page.locator('button:has-text("Connect Agent")');
    
    const isButtonVisible = await connectAgentButton.isVisible();
    console.log(`📊 Connect Agent button visible: ${isButtonVisible}`);
    
    if (!isButtonVisible) {
      console.log('❌ Connect Agent button not found');
      const allButtons = await page.locator('button').all();
      console.log(`🔘 Found ${allButtons.length} buttons on page:`);
      
      for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
        try {
          const text = await allButtons[i].textContent();
          console.log(`   ${i + 1}. "${text}"`);
        } catch (e) {
          console.log(`   ${i + 1}. [Could not read button text]`);
        }
      }
      return;
    }
    
    // Step 4: Click Connect Agent button
    console.log('🔗 Clicking Connect Agent button...');
    await connectAgentButton.click();
    console.log('✅ Connect Agent button clicked');
    
    // Take screenshot after clicking
    await page.screenshot({ path: 'screenshots/agent-auth-step2-clicked.png', fullPage: true });
    
    // Step 5: Wait for password prompt or authentication dialog
    console.log('⏳ Waiting for password prompt...');
    await sleep(3000);
    
    // Check for password input dialog
    let authenticationHandled = false;
    
    // Method 1: Look for native prompt (this might not be detectable in Playwright)
    // Method 2: Look for password input field in DOM
    const passwordInput = page.locator('input[type="password"]');
    const isPasswordInputVisible = await passwordInput.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isPasswordInputVisible) {
      console.log('🔑 Password input field found in DOM');
      await passwordInput.fill('password123');
      
      // Look for submit button
      const submitButton = page.locator('button:has-text(/submit|ok|connect|authenticate/i)');
      if (await submitButton.isVisible({ timeout: 2000 })) {
        await submitButton.click();
        console.log('✅ Password submitted via button');
      } else {
        await passwordInput.press('Enter');
        console.log('✅ Password submitted via Enter key');
      }
      
      authenticationHandled = true;
    } else {
      console.log('ℹ️ No DOM password input found');
      console.log('💡 The authentication might be handled via JavaScript prompt() or API call');
      
      // Handle JavaScript prompt programmatically if it appears
      page.on('dialog', async dialog => {
        console.log(`🔔 Dialog appeared: "${dialog.message()}"`);
        if (dialog.message().toLowerCase().includes('password') || 
            dialog.message().toLowerCase().includes('agent') ||
            dialog.message().toLowerCase().includes('auth')) {
          console.log('🔑 Entering password in dialog: password123');
          await dialog.accept('password123');
          authenticationHandled = true;
        } else {
          await dialog.dismiss();
        }
      });
      
      // Wait a bit more for potential dialog
      await sleep(2000);
    }
    
    // Step 6: Wait for connection to complete
    console.log('⏳ Waiting for agent connection to complete...');
    await sleep(5000);
    
    // Step 7: Check for agent connection success indicators
    console.log('🔍 Checking for agent connection success...');
    
    // Look for agent mode indicator in UI
    const agentModeIndicators = [
      'text=/🤖.*AGENT/i',
      'text=/AGENT MODE/i',
      'text=/Programmatic control/i',
      'text=/agent/i'
    ];
    
    let agentModeFound = false;
    for (const selector of agentModeIndicators) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`✅ Agent mode indicator found: ${selector}`);
        agentModeFound = true;
        break;
      }
    }
    
    // Look for wallet address
    const walletAddress = page.locator('text=/G[A-Z0-9]{50,}/');
    const addressFound = await walletAddress.isVisible({ timeout: 2000 }).catch(() => false);
    if (addressFound) {
      const address = await walletAddress.textContent();
      console.log(`✅ Wallet address found: ${address?.substring(0, 20)}...`);
    }
    
    // Check console logs for connection success
    const connectionLogs = agentLogs.filter(log =>
      log.text.includes('connect') || log.text.includes('success') || 
      log.text.includes('Session established') || log.text.includes('authenticated')
    );
    
    if (connectionLogs.length > 0) {
      console.log(`✅ Found ${connectionLogs.length} connection-related logs`);
      connectionLogs.forEach(log => {
        console.log(`   ${log.timestamp}: ${log.text}`);
      });
    }
    
    // Step 8: Test deployment if agent is connected
    const isAgentConnected = agentModeFound || addressFound || connectionLogs.length > 0;
    console.log(`📊 Agent connection status: ${isAgentConnected ? 'SUCCESS' : 'UNCLEAR'}`);
    
    if (isAgentConnected) {
      console.log('\n🚀 Testing deployment with agent connection...');
      
      // Fill in token details
      const tokenNameInput = page.locator('input').first();
      const tokenSymbolInput = page.locator('input').nth(1);
      
      if (await tokenNameInput.isVisible()) {
        await tokenNameInput.fill('Agent Test Token');
        console.log('✅ Token name filled');
      }
      
      if (await tokenSymbolInput.isVisible()) {
        await tokenSymbolInput.fill('AGENT');
        console.log('✅ Token symbol filled');
      }
      
      // Find and click deploy button
      const deployButton = page.locator('button:has-text("Deploy SEP-41 Token")');
      if (await deployButton.isVisible()) {
        console.log('🚀 Starting deployment...');
        await deployButton.click();
        
        // Monitor deployment progress
        console.log('⏳ Monitoring deployment progress...');
        await sleep(10000); // Wait 10 seconds for deployment activity
        
        // Check for deployment success indicators
        const deploymentLogs = agentLogs.filter(log =>
          log.text.includes('deploy') || log.text.includes('sign') || 
          log.text.includes('transaction') || log.text.includes('success')
        );
        
        console.log(`📊 Found ${deploymentLogs.length} deployment-related logs`);
        deploymentLogs.slice(-5).forEach(log => {
          console.log(`   ${log.timestamp}: ${log.text}`);
        });
      } else {
        console.log('⚠️ Deploy button not found');
      }
    }
    
    // Step 9: Take final screenshot
    await page.screenshot({ path: 'screenshots/agent-auth-final.png', fullPage: true });
    
    // Step 10: Summary Report
    console.log('\n=== Authenticated Agent Test Summary ===');
    console.log(`🤖 Agent logs captured: ${agentLogs.length}`);
    console.log(`📊 Total console messages: ${allLogs.length}`);
    console.log(`❌ Page errors: ${pageErrors.length}`);
    console.log(`🔐 Authentication handled: ${authenticationHandled}`);
    console.log(`🔗 Agent mode detected: ${agentModeFound}`);
    console.log(`📍 Wallet address found: ${addressFound}`);
    console.log(`✅ Overall connection success: ${isAgentConnected}`);
    
    // Show key agent logs
    if (agentLogs.length > 0) {
      console.log('\n=== Key Agent Activity Logs ===');
      agentLogs.slice(-10).forEach(log => {
        console.log(`[${log.timestamp}] ${log.type}: ${log.text}`);
      });
    }
    
    // Show errors if any
    if (pageErrors.length > 0) {
      console.log('\n=== Page Errors ===');
      pageErrors.forEach(error => {
        console.log(`❌ ${error}`);
      });
    }
    
    console.log('\n🎯 Authenticated agent test completed');
    
    if (!authenticationHandled) {
      console.log('\n⚠️ IMPORTANT: No authentication prompt was detected');
      console.log('💡 This could mean:');
      console.log('   1. The authentication is handled programmatically');
      console.log('   2. The prompt appeared too quickly to detect');
      console.log('   3. The authentication flow has changed');
      console.log('   4. There may be an issue with the authentication implementation');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    console.log('\n🔍 Keeping browser open for manual inspection...');
    console.log('Press Ctrl+C to close when done inspecting');
    
    // Keep browser open for manual inspection
    await new Promise(() => {}); // Infinite wait
  }
}

testAuthenticatedAgentFlow().catch(console.error);