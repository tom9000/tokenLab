#!/usr/bin/env node

/**
 * Agent Connection Test with Proper Authentication
 * Tests the complete authentication flow including password prompt handling
 */

import { chromium } from 'playwright';

async function testAgentWithAuthentication() {
  console.log('🤖 Agent Authentication Flow Test\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Monitor agent logs
  const agentLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🤖') || text.includes('[AGENT]') || text.includes('TOKEN_LAB_AGENT')) {
      agentLogs.push({ time: new Date().toLocaleTimeString(), text });
      console.log(`🤖 ${text}`);
    }
  });
  
  try {
    console.log('🌐 Loading Token Lab...');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('networkidle');
    console.log('✅ Token Lab loaded');
    
    // Method 1: Set up pre-configured password for automation
    console.log('🔧 Setting up pre-configured password for automation...');
    await page.evaluate(() => {
      window.__SAFU_AGENT_PASSWORD__ = 'password123';
      console.log('✅ Pre-configured password set for agent automation');
    });
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Find and click Connect Agent button
    console.log('🔗 Clicking Connect Agent button...');
    const connectAgentButton = page.locator('button:has-text("Connect Agent")');
    await connectAgentButton.click();
    
    // Wait for authentication and connection process
    console.log('⏳ Waiting for authentication process...');
    await page.waitForTimeout(5000);
    
    // Check if agent mode is active
    const agentModeIndicator = page.locator('text=/🤖.*AGENT/i, text=/AGENT MODE/i');
    const isAgentModeActive = await agentModeIndicator.isVisible().catch(() => false);
    
    console.log(`📊 Agent mode active: ${isAgentModeActive}`);
    
    // Test Method 2: Manual authentication if automated didn't work
    if (!isAgentModeActive) {
      console.log('\n🔄 Trying manual authentication method...');
      
      // Clear any existing state
      await page.evaluate(() => {
        delete window.__SAFU_AGENT_PASSWORD__;
      });
      
      // Set up dialog handler for password prompt
      let dialogHandled = false;
      page.on('dialog', async dialog => {
        console.log(`🔔 Dialog: "${dialog.message()}"`);
        if (dialog.message().includes('password') || dialog.message().includes('Agent')) {
          console.log('🔑 Entering password: password123');
          await dialog.accept('password123');
          dialogHandled = true;
        } else {
          await dialog.dismiss();
        }
      });
      
      // Try connecting again
      const connectAgentButton2 = page.locator('button:has-text("Connect Agent")');
      if (await connectAgentButton2.isVisible()) {
        await connectAgentButton2.click();
        await page.waitForTimeout(3000);
        
        console.log(`📊 Dialog handled: ${dialogHandled}`);
      }
    }
    
    // Final check for agent connection
    await page.waitForTimeout(2000);
    const finalAgentCheck = await page.locator('text=/🤖.*AGENT/i, text=/AGENT MODE/i').isVisible().catch(() => false);
    const walletConnected = await page.locator('text=/G[A-Z0-9]{50,}/').isVisible().catch(() => false);
    
    console.log('\n=== Final Status ===');
    console.log(`🤖 Agent mode indicator: ${finalAgentCheck}`);
    console.log(`💼 Wallet connected: ${walletConnected}`);
    console.log(`📊 Agent logs captured: ${agentLogs.length}`);
    
    if (agentLogs.length > 0) {
      console.log('\n=== Agent Activity ===');
      agentLogs.forEach(log => {
        console.log(`[${log.time}] ${log.text}`);
      });
    }
    
    // Test deployment if connected
    if (finalAgentCheck || walletConnected) {
      console.log('\n🚀 Testing deployment with authenticated agent...');
      
      // Fill token details
      const nameInput = page.locator('input').first();
      const symbolInput = page.locator('input').nth(1);
      
      if (await nameInput.isVisible()) {
        await nameInput.fill('Auth Test Token');
        console.log('✅ Token name filled');
      }
      
      if (await symbolInput.isVisible()) {
        await symbolInput.fill('AUTH');
        console.log('✅ Token symbol filled');
      }
      
      // Click deploy
      const deployButton = page.locator('button:has-text("Deploy SEP-41 Token")');
      if (await deployButton.isVisible()) {
        console.log('🚀 Starting deployment...');
        await deployButton.click();
        
        // Wait and monitor
        await page.waitForTimeout(8000);
        
        const deploymentLogs = agentLogs.filter(log => 
          log.text.includes('deploy') || log.text.includes('sign') || log.text.includes('Building')
        );
        
        console.log(`📊 Deployment logs: ${deploymentLogs.length}`);
        deploymentLogs.forEach(log => {
          console.log(`   ${log.text}`);
        });
      }
    } else {
      console.log('\n⚠️ Agent not connected - skipping deployment test');
      console.log('💡 Check SAFU wallet is running at localhost:3003');
      console.log('💡 Verify the authentication API endpoints are working');
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'screenshots/agent-auth-complete.png', fullPage: true });
    
    console.log('\n✅ Agent authentication test completed');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
}

testAgentWithAuthentication().catch(console.error);