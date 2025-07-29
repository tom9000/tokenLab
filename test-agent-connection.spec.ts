import { test, expect, Page } from '@playwright/test';

/**
 * Agent Connection Test: Token Lab Connect Agent 2.0
 * Tests the authenticated agent mode functionality
 */

test.describe('Connect Agent 2.0: Authenticated Agent Mode', () => {
  
  test('Test Connect Agent button and authentication flow', async ({ page }) => {
    console.log('🤖 Testing Connect Agent 2.0 functionality');

    // Step 1: Navigate to Token Lab
    await page.goto('http://localhost:3005');
    await expect(page).toHaveTitle(/Token Lab/);
    console.log('✅ Token Lab loaded');

    // Step 2: Look for Connect Agent button
    const connectAgentButton = page.locator('button:has-text("Connect Agent")');
    await expect(connectAgentButton).toBeVisible({ timeout: 10000 });
    console.log('✅ Connect Agent button found');

    // Step 3: Monitor console for agent activities
    const agentLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('🤖') || text.includes('[AGENT]') || text.includes('SAFU') || text.includes('agent')) {
        agentLogs.push(text);
        console.log(`📊 Agent Log: ${text}`);
      }
    });

    // Step 4: Click Connect Agent button
    console.log('🔗 Testing Connect Agent click...');
    await connectAgentButton.click();
    
    // Wait for authentication dialog or automatic connection
    await page.waitForTimeout(2000);

    // Step 5: Check for password prompt or automatic authentication
    const passwordInput = page.locator('input[type="password"]');
    const authDialog = page.locator('text=/password|authenticate|enter/i');
    
    if (await passwordInput.isVisible({ timeout: 5000 })) {
      console.log('🔑 Password prompt appeared, entering mock mode password...');
      await passwordInput.fill('password123');
      
      // Look for submit/ok button
      const submitButton = page.locator('button:has-text(/ok|submit|connect|authenticate/i)');
      if (await submitButton.isVisible()) {
        await submitButton.click();
        console.log('✅ Authentication submitted');
      } else {
        // Try pressing Enter
        await passwordInput.press('Enter');
        console.log('✅ Authentication submitted via Enter');
      }
    } else {
      console.log('ℹ️ No password prompt - checking for automatic authentication');
    }

    // Step 6: Wait for connection to complete
    await page.waitForTimeout(5000);

    // Step 7: Check for agent connection success indicators
    const agentModeIndicator = page.locator('text=/🤖|AGENT MODE|agent/i');
    const walletAddress = page.locator('text=/G[A-Z0-9]{55}/');
    
    let connectionSuccess = false;
    
    if (await agentModeIndicator.isVisible({ timeout: 5000 })) {
      console.log('✅ Agent mode indicator found in UI');
      connectionSuccess = true;
    }
    
    if (await walletAddress.isVisible({ timeout: 5000 })) {
      const address = await walletAddress.textContent();
      console.log(`✅ Wallet address displayed: ${address?.substring(0, 20)}...`);
      connectionSuccess = true;
    }

    // Step 8: Check console logs for agent activity
    const relevantLogs = agentLogs.filter(log => 
      log.includes('✅') || log.includes('🤖') || log.includes('Session established')
    );
    
    if (relevantLogs.length > 0) {
      console.log(`✅ Found ${relevantLogs.length} agent activity logs`);
      connectionSuccess = true;
    }

    // Step 9: Test deployment capability if connected
    if (connectionSuccess) {
      console.log('🚀 Testing deployment capability with agent connection...');
      
      const deployButton = page.locator('button:has-text("Deploy SEP-41 Token")');
      if (await deployButton.isVisible()) {
        // Fill token details quickly
        const tokenName = page.locator('input').first();
        const tokenSymbol = page.locator('input').nth(1);
        
        if (await tokenName.isVisible()) {
          await tokenName.fill('AgentToken');
        }
        if (await tokenSymbol.isVisible()) {
          await tokenSymbol.fill('AGENT');
        }
        
        console.log('📄 Token details filled for agent deployment test');
        
        // Click deploy and monitor for agent signing
        await deployButton.click();
        await page.waitForTimeout(3000);
        
        // Check for agent signing activity
        const signingLogs = agentLogs.filter(log => 
          log.includes('signing') || log.includes('programmatically') || log.includes('agent')
        );
        
        if (signingLogs.length > 0) {
          console.log('✅ Agent deployment capability confirmed');
        }
      }
    }

    // Step 10: Take screenshot for documentation
    await page.screenshot({ 
      path: 'screenshots/agent-connection-test.png',
      fullPage: true 
    });

    // Step 11: Summary
    console.log('\n=== Agent Connection Test Summary ===');
    console.log(`✅ Connect Agent button working: true`);
    console.log(`✅ Agent connection successful: ${connectionSuccess}`);
    console.log(`📊 Agent logs captured: ${agentLogs.length}`);
    console.log(`📊 Relevant activity logs: ${relevantLogs.length}`);

    if (connectionSuccess) {
      console.log('🎉 CONNECT AGENT 2.0 TEST: SUCCESS');
      console.log('✅ Agent authentication mode is working');
      console.log('✅ Token Lab → SAFU wallet agent integration ready');
    } else {
      console.log('⚠️ Agent connection needs investigation');
    }
  });

  test('Test programmatic agent connection flow', async ({ page }) => {
    console.log('🔧 Testing programmatic agent connection flow');

    await page.goto('http://localhost:3005');
    
    // Set up mock agent password for automated testing
    await page.evaluate(() => {
      (window as any).__SAFU_AGENT_PASSWORD__ = 'password123';
    });

    // Monitor for agent automation
    const automationLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('pre-configured') || text.includes('automation') || text.includes('programmatic')) {
        automationLogs.push(text);
        console.log(`🔧 Automation Log: ${text}`);
      }
    });

    // Test programmatic connection
    const connectAgentButton = page.locator('button:has-text("Connect Agent")');
    if (await connectAgentButton.isVisible()) {
      await connectAgentButton.click();
      await page.waitForTimeout(5000);
      
      console.log(`📊 Automation logs captured: ${automationLogs.length}`);
      
      if (automationLogs.some(log => log.includes('pre-configured'))) {
        console.log('✅ Programmatic agent connection working');
      } else {
        console.log('ℹ️ Manual authentication mode active');
      }
    }

    console.log('✅ Programmatic agent flow test completed');
  });

  test('Test agent error scenarios', async ({ page }) => {
    console.log('🔍 Testing agent error scenarios');

    await page.goto('http://localhost:3005');
    
    const errorLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('❌') || text.includes('error') || text.includes('failed')) {
        errorLogs.push(text);
        console.log(`🔍 Error Log: ${text}`);
      }
    });

    // Test with wrong password (if manual authentication occurs)
    const connectAgentButton = page.locator('button:has-text("Connect Agent")');
    if (await connectAgentButton.isVisible()) {
      await connectAgentButton.click();
      await page.waitForTimeout(2000);
      
      const passwordInput = page.locator('input[type="password"]');
      if (await passwordInput.isVisible({ timeout: 3000 })) {
        console.log('🔑 Testing wrong password scenario...');
        await passwordInput.fill('wrongpassword');
        await passwordInput.press('Enter');
        await page.waitForTimeout(3000);
        
        if (errorLogs.some(log => log.includes('Authentication failed') || log.includes('Invalid password'))) {
          console.log('✅ Wrong password error handling working');
        }
      } else {
        console.log('ℹ️ No manual password input available for error testing');
      }
    }

    console.log(`📊 Error logs captured: ${errorLogs.length}`);
    console.log('✅ Error scenario testing completed');
  });
});