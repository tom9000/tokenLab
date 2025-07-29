#!/usr/bin/env node

/**
 * Real SEP-41 Contract Deployment Test
 * This will actually deploy a contract to Futurenet and return the contract ID
 */

import { chromium } from 'playwright';

async function deployRealContract() {
  console.log('🚀 Real SEP-41 Contract Deployment Test\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Track all important information
  const contractInfo = {
    contractId: null,
    transactionHash: null,
    deploymentSuccess: false,
    walletAddress: null
  };
  
  // Monitor all logs and network activity
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push({ time: new Date().toLocaleTimeString(), type: msg.type(), text });
    
    // Look for contract ID
    if (text.includes('Contract:') || text.includes('contract:') || text.match(/C[A-Z0-9]{55}/)) {
      console.log(`📍 POTENTIAL CONTRACT ID: ${text}`);
    }
    
    // Look for transaction hash
    if (text.includes('TX:') || text.includes('hash') || text.match(/[A-F0-9]{64}/i)) {
      console.log(`🔗 POTENTIAL TX HASH: ${text}`);
    }
    
    if (text.includes('🤖') || text.includes('deploy') || text.includes('contract') || text.includes('success')) {
      console.log(`📊 ${text}`);
    }
  });
  
  // Monitor network requests to Stellar
  page.on('request', request => {
    if (request.url().includes('stellar') || request.url().includes('futurenet') || 
        request.url().includes('horizon') || request.url().includes('soroban')) {
      console.log(`🌐 STELLAR REQUEST: ${request.method()} ${request.url()}`);
    }
  });
  
  try {
    console.log('🌐 Loading Token Lab...');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('networkidle');
    
    // Set up agent password
    await page.evaluate(() => {
      window.__SAFU_AGENT_PASSWORD__ = 'password123';
      console.log('Agent password configured');
    });
    
    // Connect agent
    console.log('🤖 Connecting agent...');
    const connectButton = page.locator('button:has-text("Connect Agent")');
    await connectButton.click();
    await page.waitForTimeout(3000);
    
    // Verify connection
    const disconnectButton = page.locator('button:has-text("Disconnect")');
    const isConnected = await disconnectButton.isVisible();
    console.log(`📊 Agent connected: ${isConnected}`);
    
    if (!isConnected) {
      console.log('❌ Agent connection failed - cannot proceed');
      return contractInfo;
    }
    
    // Get wallet address
    const walletAddressElement = page.locator('text=/G[A-Z0-9]{50,}/').first();
    if (await walletAddressElement.isVisible()) {
      contractInfo.walletAddress = await walletAddressElement.textContent();
      console.log(`💼 Wallet Address: ${contractInfo.walletAddress}`);
    }
    
    // Configure token
    console.log('📝 Configuring token...');
    const nameInput = page.locator('input').first();
    await nameInput.fill('Real SEP-41 Token');
    
    const symbolInput = page.locator('input').nth(1);
    await symbolInput.fill('REAL41');
    
    console.log('✅ Token configured: Real SEP-41 Token (REAL41)');
    
    // Deploy token
    console.log('🚀 Starting deployment...');
    const deployButton = page.locator('button:has-text("Deploy SEP-41 Token")');
    await deployButton.click();
    
    // Monitor deployment for up to 2 minutes
    console.log('⏳ Monitoring deployment (up to 120 seconds)...');
    let deploymentComplete = false;
    
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(1000);
      
      // Check for deployment success in UI
      const successElements = await page.locator('text=/deployed.*success/i, text=/token.*created/i, text=/contract.*deployed/i').all();
      if (successElements.length > 0) {
        console.log('✅ Deployment success detected in UI');
        deploymentComplete = true;
        break;
      }
      
      // Check for contract ID in deployed tokens section
      const contractElements = await page.locator('code').all();
      for (const element of contractElements) {
        const text = await element.textContent().catch(() => '');
        if (text && text.startsWith('C') && text.length === 56) {
          contractInfo.contractId = text;
          console.log(`🎉 CONTRACT ID FOUND: ${contractInfo.contractId}`);
          deploymentComplete = true;
          break;
        }
      }
      
      if (deploymentComplete) break;
      
      // Progress updates
      if (i % 15 === 0 && i > 0) {
        console.log(`⏳ Still monitoring... ${i} seconds elapsed`);
      }
    }
    
    // Extract final results
    console.log('\n🔍 Extracting final deployment results...');
    
    // Look for contract ID in deployed tokens section
    const deployedSection = page.locator('text="Deployed SEP-41 Tokens"').locator('..');
    if (await deployedSection.isVisible()) {
      const contractCodes = await deployedSection.locator('code').all();
      for (const code of contractCodes) {
        const text = await code.textContent();
        if (text && text.startsWith('C') && text.length === 56) {
          contractInfo.contractId = text;
          console.log(`📍 Final Contract ID: ${contractInfo.contractId}`);
          break;
        }
      }
    }
    
    // Look for transaction hash in logs
    const txLogs = logs.filter(log => 
      log.text.includes('TX:') || log.text.includes('hash') || log.text.includes('transaction')
    );
    
    if (txLogs.length > 0) {
      console.log('🔗 Transaction logs found:');
      txLogs.forEach(log => {
        console.log(`   ${log.text}`);
        // Extract hash if present
        const hashMatch = log.text.match(/[A-F0-9]{64}/i);
        if (hashMatch) {
          contractInfo.transactionHash = hashMatch[0];
        }
      });
    }
    
    // Test token transfer if contract was deployed
    if (contractInfo.contractId) {
      console.log('\n🧪 Testing token transfer functionality...');
      
      const testTransferButton = page.locator('button:has-text("Test Transfer")').first();
      if (await testTransferButton.isVisible()) {
        await testTransferButton.click();
        await page.waitForTimeout(2000);
        
        // Fill transfer details if form appears
        const recipientInput = page.locator('input[placeholder*="GXXX"]');
        const amountInput = page.locator('input[type="number"]').last();
        
        if (await recipientInput.isVisible() && await amountInput.isVisible()) {
          // Use the same wallet address as recipient (send to self)
          await recipientInput.fill(contractInfo.walletAddress || 'GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN');
          await amountInput.fill('10');
          
          const executeButton = page.locator('button:has-text("Execute Transfer")');
          if (await executeButton.isVisible()) {
            console.log('🔄 Executing test transfer...');
            await executeButton.click();
            await page.waitForTimeout(5000);
            
            // Check for transfer success
            const transferLogs = logs.filter(log => 
              log.text.includes('transfer') && (log.text.includes('success') || log.text.includes('✅'))
            );
            
            if (transferLogs.length > 0) {
              console.log('✅ Token transfer test successful!');
              transferLogs.forEach(log => console.log(`   ${log.text}`));
            } else {
              console.log('⚠️ Token transfer status unclear');
            }
          }
        }
      }
    }
    
    contractInfo.deploymentSuccess = !!contractInfo.contractId;
    
  } catch (error) {
    console.error('❌ Deployment error:', error.message);
  } finally {
    await page.screenshot({ path: 'screenshots/real-contract-deployment.png', fullPage: true });
    await browser.close();
  }
  
  // Final report
  console.log('\n=== REAL CONTRACT DEPLOYMENT REPORT ===');
  console.log(`🏆 Deployment Success: ${contractInfo.deploymentSuccess ? 'YES' : 'NO'}`);
  console.log(`📍 Contract ID: ${contractInfo.contractId || 'Not found'}`);
  console.log(`🔗 Transaction Hash: ${contractInfo.transactionHash || 'Not found'}`);
  console.log(`💼 Wallet Address: ${contractInfo.walletAddress || 'Not found'}`);
  
  if (contractInfo.contractId) {
    console.log(`\n🔍 Block Explorer Links:`);
    console.log(`   Futurenet Contract: https://futurenet.stellarchain.io/contracts/${contractInfo.contractId}`);
    if (contractInfo.transactionHash) {
      console.log(`   Transaction: https://futurenet.stellarchain.io/transactions/${contractInfo.transactionHash}`);
    }
    if (contractInfo.walletAddress) {
      console.log(`   Wallet: https://futurenet.stellarchain.io/accounts/${contractInfo.walletAddress}`);
    }
  }
  
  return contractInfo;
}

deployRealContract().then(result => {
  console.log('\n🎯 Final Result:', result);
  process.exit(result.deploymentSuccess ? 0 : 1);
}).catch(console.error);