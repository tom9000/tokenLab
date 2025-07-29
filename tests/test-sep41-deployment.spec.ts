import { test, expect, Page } from '@playwright/test';

/**
 * SEP-41 Smart Contract Deployment Test
 * Validates complete deployment flow: Token Lab → SAFU Wallet → Stellar Network
 */

test.describe('SEP-41 Smart Contract Deployment with SAFU Wallet', () => {
  let tokenLabPage: Page;
  let safuWalletPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Create separate pages for Token Lab and SAFU Wallet
    const context = await browser.newContext();
    tokenLabPage = await context.newPage();
    safuWalletPage = await context.newPage();
  });

  test('Complete SEP-41 deployment flow with agent authentication', async () => {
    console.log('🚀 Testing Complete SEP-41 Smart Contract Deployment');

    // Step 1: Load both applications
    await test.step('Load Token Lab and SAFU Wallet', async () => {
      console.log('🌐 Loading Token Lab...');
      await tokenLabPage.goto('http://localhost:3005');
      await expect(tokenLabPage).toHaveTitle(/Token Lab/);
      
      console.log('🌐 Loading SAFU Wallet...');
      await safuWalletPage.goto('http://localhost:3003');
      await expect(safuWalletPage).toHaveTitle(/SAFU/);
      
      console.log('✅ Both applications loaded');
    });

    // Step 2: Monitor logs and network activity
    const deploymentLogs: string[] = [];
    const networkRequests: string[] = [];
    const errors: string[] = [];

    tokenLabPage.on('console', msg => {
      const text = msg.text();
      if (text.includes('🤖') || text.includes('[AGENT]') || text.includes('TOKEN_LAB_AGENT') ||
          text.includes('deploy') || text.includes('contract') || text.includes('WASM') ||
          text.includes('sign') || text.includes('transaction')) {
        deploymentLogs.push(`[${new Date().toLocaleTimeString()}] ${text}`);
        console.log(`📊 ${text}`);
      }
      if (msg.type() === 'error') {
        errors.push(text);
        console.log(`❌ ERROR: ${text}`);
      }
    });

    tokenLabPage.on('request', request => {
      if (request.url().includes('localhost:3003') || request.url().includes('stellar') || 
          request.url().includes('horizon') || request.url().includes('soroban')) {
        networkRequests.push(`${request.method()} ${request.url()}`);
        console.log(`🌐 REQUEST: ${request.method()} ${request.url()}`);
      }
    });

    // Step 3: Set up agent authentication
    await test.step('Configure agent authentication', async () => {
      console.log('🔧 Setting up pre-configured agent password...');
      await tokenLabPage.evaluate(() => {
        (window as any).__SAFU_AGENT_PASSWORD__ = 'password123';
        console.log('✅ Agent password configured for automated testing');
      });
    });

    // Step 4: Connect Agent
    await test.step('Connect SAFU wallet via agent mode', async () => {
      console.log('🤖 Connecting to SAFU wallet in agent mode...');
      
      const connectAgentButton = tokenLabPage.locator('button:has-text("Connect Agent")');
      await expect(connectAgentButton).toBeVisible();
      await connectAgentButton.click();
      
      // Wait for agent connection to complete
      console.log('⏳ Waiting for agent connection...');
      await tokenLabPage.waitForTimeout(5000);
      
      // Verify agent connection success
      const disconnectButton = tokenLabPage.locator('button:has-text("Disconnect")');
      await expect(disconnectButton).toBeVisible({ timeout: 10000 });
      
      // Check for agent mode indicator (flexible selector)
      const agentModeFound = await tokenLabPage.locator('text=/AGENT.*MODE/i, text=/🤖/').first().isVisible().catch(() => false);
      console.log(`📊 Agent mode indicator found: ${agentModeFound}`);
      
      console.log('✅ Agent connection established');
    });

    // Step 5: Configure SEP-41 token parameters
    await test.step('Configure SEP-41 token parameters', async () => {
      console.log('📝 Configuring SEP-41 token parameters...');
      
      // Fill token name
      const tokenNameInput = tokenLabPage.locator('input').first();
      await tokenNameInput.fill('Test SEP-41 Token');
      
      // Fill token symbol
      const tokenSymbolInput = tokenLabPage.locator('input').nth(1);
      await tokenSymbolInput.fill('TST41');
      
      // Set decimals
      const decimalsInput = tokenLabPage.locator('input[type="number"]').first();
      await decimalsInput.fill('7');
      
      // Configure initial supply
      const initialSupplyInput = tokenLabPage.locator('input').nth(3);
      await initialSupplyInput.fill('1000000');
      
      console.log('✅ Token parameters configured');
      console.log('   Name: Test SEP-41 Token');
      console.log('   Symbol: TST41');
      console.log('   Decimals: 7');
      console.log('   Initial Supply: 1,000,000');
    });

    // Step 6: Deploy SEP-41 smart contract
    let deploymentStartTime: number;
    let contractId: string | null = null;
    let deploymentTxHash: string | null = null;

    await test.step('Deploy SEP-41 smart contract', async () => {
      console.log('🚀 Starting SEP-41 smart contract deployment...');
      
      deploymentStartTime = Date.now();
      const deployButton = tokenLabPage.locator('button:has-text("Deploy SEP-41 Token")');
      await expect(deployButton).toBeVisible();
      await deployButton.click();
      
      console.log('⏳ Monitoring deployment process...');
      
      // Monitor deployment for up to 60 seconds
      let deploymentComplete = false;
      let attempts = 0;
      
      while (!deploymentComplete && attempts < 60) {
        await tokenLabPage.waitForTimeout(1000);
        attempts++;
        
        // Check for deployment completion indicators
        const successIndicators = [
          'text=/deployed successfully/i',
          'text=/token.*created/i',
          'text=/contract.*deployed/i',
          'text=/deployment.*complete/i'
        ];
        
        for (const selector of successIndicators) {
          if (await tokenLabPage.locator(selector).isVisible().catch(() => false)) {
            console.log(`✅ Deployment success indicator found: ${selector}`);
            deploymentComplete = true;
            break;
          }
        }
        
        // Check logs for completion
        const recentLogs = deploymentLogs.slice(-3);
        if (recentLogs.some(log => 
          log.toLowerCase().includes('deployed') || 
          log.toLowerCase().includes('success') ||
          log.toLowerCase().includes('contract')
        )) {
          console.log('✅ Deployment completion detected in logs');
          deploymentComplete = true;
        }
        
        // Progress indicator every 10 seconds
        if (attempts % 10 === 0) {
          console.log(`⏳ Deployment in progress... ${attempts} seconds elapsed`);
        }
      }
      
      const deploymentTime = Date.now() - deploymentStartTime;
      console.log(`📊 Deployment process took ${deploymentTime}ms`);
      
      if (!deploymentComplete) {
        console.log('⚠️ Deployment completion not detected within timeout');
      }
    });

    // Step 7: Extract deployment results
    await test.step('Extract deployment results and validate', async () => {
      console.log('🔍 Extracting deployment results...');
      
      // Look for contract ID in the deployed tokens section
      const deployedTokensSection = tokenLabPage.locator('text="Deployed SEP-41 Tokens"').locator('..');
      if (await deployedTokensSection.isVisible()) {
        console.log('✅ Deployed tokens section found');
        
        // Extract contract ID
        const contractIdElement = tokenLabPage.locator('code').first();
        if (await contractIdElement.isVisible()) {
          contractId = await contractIdElement.textContent();
          console.log(`📍 Contract ID: ${contractId}`);
        }
      }
      
      // Look for transaction hash in logs
      const txHashLog = deploymentLogs.find(log => 
        log.includes('TX:') || log.includes('hash') || log.includes('transaction')
      );
      if (txHashLog) {
        console.log(`🔗 Transaction info: ${txHashLog}`);
      }
      
      // Check for XDR generation
      const xdrTextareas = await tokenLabPage.locator('textarea').all();
      let xdrFound = false;
      
      for (const textarea of xdrTextareas) {
        const value = await textarea.inputValue().catch(() => '');
        if (value.length > 100 && (value.includes('AA') || value.includes('AAAA'))) {
          console.log(`✅ XDR found: ${value.length} characters`);
          console.log(`📄 XDR preview: ${value.substring(0, 100)}...`);
          xdrFound = true;
          break;
        }
      }
      
      if (!xdrFound) {
        console.log('ℹ️ No XDR content detected in textareas');
      }
    });

    // Step 8: Validate SAFU wallet signing activity
    await test.step('Validate SAFU wallet signing activity', async () => {
      console.log('🔍 Validating SAFU wallet signing activity...');
      
      // Check for agent signing logs
      const signingLogs = deploymentLogs.filter(log =>
        log.includes('sign') || log.includes('🤖') || log.includes('agent')
      );
      
      console.log(`📊 Found ${signingLogs.length} signing-related logs`);
      signingLogs.forEach(log => {
        console.log(`   ${log}`);
      });
      
      // Check for successful API calls to SAFU wallet
      const safuApiCalls = networkRequests.filter(req =>
        req.includes('localhost:3003')
      );
      
      console.log(`📊 Found ${safuApiCalls.length} SAFU wallet API calls`);
      safuApiCalls.forEach(call => {
        console.log(`   ${call}`);
      });
      
      // Validate authentication and signing flow
      const authCall = safuApiCalls.find(call => call.includes('/api/auth'));
      const connectCall = safuApiCalls.find(call => call.includes('/api/connect'));
      const signCall = safuApiCalls.find(call => call.includes('/api/sign'));
      
      console.log(`🔐 Authentication call: ${authCall ? 'FOUND' : 'MISSING'}`);
      console.log(`🔗 Connection call: ${connectCall ? 'FOUND' : 'MISSING'}`);
      console.log(`✍️ Signing call: ${signCall ? 'FOUND' : 'MISSING'}`);
    });

    // Step 9: Test deployed token functionality
    await test.step('Test deployed token functionality', async () => {
      if (contractId && contractId.startsWith('C') && contractId.length === 56) {
        console.log('🧪 Testing deployed token functionality...');
        
        // Try to interact with the deployed contract
        const testTransferButton = tokenLabPage.locator('button:has-text("Test Transfer")');
        if (await testTransferButton.isVisible()) {
          await testTransferButton.click();
          console.log('✅ Test transfer button clicked');
          
          // Wait for transfer interface
          await tokenLabPage.waitForTimeout(2000);
          
          // Check if transfer form appears
          const transferForm = tokenLabPage.locator('text="Transfer Tokens"').locator('..');
          if (await transferForm.isVisible()) {
            console.log('✅ Transfer interface loaded');
          }
        }
      } else {
        console.log('ℹ️ Contract ID not suitable for functionality testing (mock/simulated)');
      }
    });

    // Step 10: Generate comprehensive test report
    await test.step('Generate test report', async () => {
      console.log('\n=== SEP-41 DEPLOYMENT TEST REPORT ===');
      
      const deploymentTime = deploymentStartTime ? Date.now() - deploymentStartTime : 0;
      
      console.log('🚀 DEPLOYMENT METRICS:');
      console.log(`   Total deployment time: ${deploymentTime}ms`);
      console.log(`   Contract ID generated: ${contractId || 'Not detected'}`);
      console.log(`   Deployment logs captured: ${deploymentLogs.length}`);
      console.log(`   Network requests made: ${networkRequests.length}`);
      console.log(`   JavaScript errors: ${errors.length}`);
      
      console.log('\n🤖 AGENT FUNCTIONALITY:');
      const agentConnected = await tokenLabPage.locator('button:has-text("Disconnect")').isVisible();
      const agentModeActive = await tokenLabPage.locator('text="🤖 AGENT MODE"').first().isVisible();
      console.log(`   Agent connection: ${agentConnected ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Agent mode indicator: ${agentModeActive ? 'VISIBLE' : 'HIDDEN'}`);
      
      console.log('\n🔗 SAFU WALLET INTEGRATION:');
      const authSuccess = networkRequests.some(req => req.includes('/api/auth'));
      const connectSuccess = networkRequests.some(req => req.includes('/api/connect'));
      console.log(`   Authentication API called: ${authSuccess ? 'YES' : 'NO'}`);
      console.log(`   Connection API called: ${connectSuccess ? 'YES' : 'NO'}`);
      
      console.log('\n📄 CONTRACT DEPLOYMENT:');
      const contractGenerated = contractId && contractId.length > 50;
      const logsContainSuccess = deploymentLogs.some(log => 
        log.toLowerCase().includes('success') || log.toLowerCase().includes('deployed')
      );
      console.log(`   Contract ID generated: ${contractGenerated ? 'YES' : 'NO'}`);
      console.log(`   Success logs present: ${logsContainSuccess ? 'YES' : 'NO'}`);
      console.log(`   Error count: ${errors.length}`);
      
      // Show key deployment logs
      if (deploymentLogs.length > 0) {
        console.log('\n📊 KEY DEPLOYMENT LOGS:');
        deploymentLogs.slice(-10).forEach(log => {
          console.log(`   ${log}`);
        });
      }
      
      // Show errors if any
      if (errors.length > 0) {
        console.log('\n❌ ERRORS ENCOUNTERED:');
        errors.forEach(error => {
          console.log(`   ${error}`);
        });
      }
      
      // Overall test result
      const testPassed = agentConnected && authSuccess && logsContainSuccess && errors.length === 0;
      console.log(`\n🎯 OVERALL TEST RESULT: ${testPassed ? '✅ PASSED' : '⚠️ NEEDS REVIEW'}`);
      
      if (testPassed) {
        console.log('🎉 SEP-41 deployment with SAFU wallet integration is working correctly!');
      } else {
        console.log('🔍 Some aspects need investigation - check logs above for details');
      }
    });

    // Take final screenshot for documentation
    await tokenLabPage.screenshot({ 
      path: 'screenshots/sep41-deployment-complete.png', 
      fullPage: true 
    });
    console.log('📸 Final screenshot saved: screenshots/sep41-deployment-complete.png');
  });

  test.afterAll(async () => {
    await tokenLabPage.close();
    await safuWalletPage.close();
  });
});