#!/usr/bin/env node

/**
 * SEP-41 deployment using SAFU wallet agent mode
 * Based on our proven working deployment pattern
 */

import {
  TransactionBuilder,
  Networks,
  Operation,
  rpc,
  BASE_FEE,
  Address,
  nativeToScVal,
  Contract,
  scValToNative
} from '@stellar/stellar-sdk';
import fs from 'fs';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// Fresh authentication data
const AUTH_DATA = {
  accessToken: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzZXNzaW9uSWQiOiJhZ2VudF9zZXNzaW9uXzE3NTM3MjExNjA3ODBfdHA0aTJvenJwIiwic3ViIjoiR0RKVktWRTM2QzIyUlJOUlVMN0tLV0hTR1JLR1k2UUE1SFRURUZDQVFMVFZHNEhLRVlJNE81RE4iLCJpYXQiOjE3NTM3MjExNjAsImV4cCI6MTc1MzcyMjk2MCwiaXNzIjoic2FmdS13YWxsZXQiLCJhdWQiOiJzYWZ1LXdhbGxldC1jbGllbnQiLCJ0eXBlIjoiYWNjZXNzIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDozMDA1IiwiYXBwTmFtZSI6IlRva2VuIExhYiIsIm1vZGUiOiJhZ2VudCJ9.",
  sessionPassword: "password123",
  encryptedSeed: "mock_encrypted_mnemonic_data_for_testing",
  publicKey: "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN",
  network: "futurenet"
};

class SAFUTokenDeployer {
  constructor() {
    this.server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
  }

  async signWithSAFU(transactionXdr, description) {
    console.log(`🔐 Signing transaction with SAFU wallet: ${description}`);
    
    const response = await fetch('http://localhost:3003/api/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionXdr,
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
        network: 'futurenet',
        description,
        appName: 'Token Lab',
        mode: 'agent',
        origin: 'http://localhost:3005',
        accessToken: AUTH_DATA.accessToken,
        sessionPassword: AUTH_DATA.sessionPassword,
        encryptedSeed: AUTH_DATA.encryptedSeed
      })
    });

    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(`SAFU wallet signing failed: ${result.error}`);
    }

    console.log('✅ Transaction signed by SAFU wallet');
    return result.signedTransactionXdr;
  }

  async waitForTransaction(txHash, description) {
    console.log(`⏳ Waiting for ${description}...`);
    
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const result = await this.server.getTransaction(txHash);
        console.log(`📊 Check ${i + 1}: ${result.status}`);
        
        if (result.status === 'SUCCESS') {
          console.log(`✅ ${description} confirmed`);
          return result;
        } else if (result.status === 'FAILED') {
          throw new Error(`${description} failed`);
        }
      } catch (e) {
        console.log(`⏳ Still waiting... (${i + 1}/30)`);
      }
    }
    
    throw new Error(`${description} timed out after 60 seconds`);
  }

  async deployToken(tokenConfig) {
    console.log('🚀 Deploying SEP-41 token with SAFU wallet agent mode');
    console.log(`📋 Token: ${tokenConfig.name} (${tokenConfig.symbol})\n`);

    try {
      // Step 1: Upload WASM
      console.log('📤 Step 1: Uploading WASM...');
      const wasmHash = await this.uploadWasm();
      console.log(`📦 WASM Hash: ${wasmHash}`);

      // Step 2: Create contract instance
      console.log('\n🏗️ Step 2: Creating contract instance...');
      const contractAddress = await this.createContract(wasmHash);
      console.log(`🏠 Contract Address: ${contractAddress}`);

      // Step 3: Initialize token
      console.log('\n⚙️ Step 3: Initializing token...');
      await this.initializeToken(contractAddress, tokenConfig);
      console.log('✅ Token initialized');

      // Step 4: Mint initial supply
      if (tokenConfig.initialSupply && parseInt(tokenConfig.initialSupply) > 0) {
        console.log(`\n💰 Step 4: Minting initial supply: ${tokenConfig.initialSupply}`);
        await this.mintTokens(contractAddress, tokenConfig.initialSupply);
        console.log('✅ Initial supply minted');
      }

      const deploymentInfo = {
        contractAddress,
        wasmHash,
        config: tokenConfig,
        network: 'futurenet',
        deployedAt: new Date(),
        explorer: `https://futurenet.steexp.com/contract/${contractAddress}`
      };

      console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
      console.log('='.repeat(50));
      console.log(`📦 WASM Hash: ${wasmHash}`);
      console.log(`🏠 Contract Address: ${contractAddress}`);
      console.log(`🔑 Admin: ${AUTH_DATA.publicKey}`);
      console.log(`🔗 Explorer: ${deploymentInfo.explorer}`);

      return deploymentInfo;

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  async uploadWasm() {
    // Load WASM file
    const wasmPath = '/Users/mac/code/-scdev/tokenLab/contracts/sep41_token/target/wasm32-unknown-unknown/release/sep41_token.optimized.wasm';
    const wasmBuffer = fs.readFileSync(wasmPath);
    console.log(`📦 Loaded WASM (${wasmBuffer.length} bytes)`);

    // Get source account
    const sourceAccount = await this.server.getAccount(AUTH_DATA.publicKey);
    console.log(`📊 Account sequence: ${sourceAccount.sequenceNumber()}`);

    // Create upload operation
    const uploadOp = Operation.uploadContractWasm({
      wasm: wasmBuffer,
    });

    // Build transaction
    let uploadTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 100000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(uploadOp)
    .setTimeout(60)
    .build();

    // Prepare transaction
    uploadTx = await this.server.prepareTransaction(uploadTx);
    const uploadTxXdr = uploadTx.toXDR();

    // Sign with SAFU wallet
    const signedXdr = await this.signWithSAFU(uploadTxXdr, 'Upload SEP-41 Token WASM');

    // Parse signed transaction and submit
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    let uploadResult = await this.server.sendTransaction(signedTx);

    // Handle pending result
    if (uploadResult.status === 'PENDING') {
      uploadResult = await this.waitForTransaction(uploadResult.txHash, 'WASM upload');
    }

    if (uploadResult.status !== 'SUCCESS') {
      console.log('📋 Upload result details:', uploadResult);
      throw new Error(`WASM upload failed: ${uploadResult.status}`);
    }

    // Extract WASM hash
    let wasmHash;
    if (uploadResult.returnValue) {
      try {
        const hashBytes = scValToNative(uploadResult.returnValue);
        wasmHash = Buffer.from(hashBytes).toString('hex');
      } catch (e) {
        console.log('Using transaction hash as WASM identifier');
        wasmHash = uploadResult.txHash;
      }
    } else {
      wasmHash = uploadResult.txHash;
    }

    return wasmHash;
  }

  async createContract(wasmHash) {
    // Get source account
    const sourceAccount = await this.server.getAccount(AUTH_DATA.publicKey);

    // Create contract with deterministic salt
    const salt = Buffer.alloc(32);
    
    const createOp = Operation.createCustomContract({
      address: Address.fromString(AUTH_DATA.publicKey),
      wasmHash: Buffer.from(wasmHash, 'hex'),
      salt: salt
    });

    // Build transaction
    let createTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 50000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(createOp)
    .setTimeout(60)
    .build();

    // Prepare transaction
    createTx = await this.server.prepareTransaction(createTx);
    const createTxXdr = createTx.toXDR();

    // Sign with SAFU wallet
    const signedXdr = await this.signWithSAFU(createTxXdr, 'Create SEP-41 Token Contract Instance');

    // Parse signed transaction and submit
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    let createResult = await this.server.sendTransaction(signedTx);

    // Handle pending result
    if (createResult.status === 'PENDING') {
      createResult = await this.waitForTransaction(createResult.txHash, 'contract creation');
    }

    if (createResult.status !== 'SUCCESS') {
      throw new Error(`Contract creation failed: ${createResult.status}`);
    }

    // Extract contract address
    if (createResult.returnValue) {
      try {
        return Address.fromScVal(createResult.returnValue).toString();
      } catch (e) {
        throw new Error('Failed to extract contract address from result');
      }
    } else {
      throw new Error('No contract address returned from creation');
    }
  }

  async initializeToken(contractAddress, tokenConfig) {
    const contract = new Contract(contractAddress);
    const sourceAccount = await this.server.getAccount(AUTH_DATA.publicKey);

    // Build initialize operation
    const initOp = contract.call(
      'initialize',
      Address.fromString(AUTH_DATA.publicKey), // admin
      nativeToScVal(tokenConfig.decimals, { type: 'u32' }),
      nativeToScVal(tokenConfig.name, { type: 'string' }),
      nativeToScVal(tokenConfig.symbol, { type: 'string' }),
      nativeToScVal(tokenConfig.maxSupply, { type: 'i128' }),
      nativeToScVal(tokenConfig.isMintable, { type: 'bool' }),
      nativeToScVal(tokenConfig.isBurnable, { type: 'bool' }),
      nativeToScVal(tokenConfig.isFreezable, { type: 'bool' })
    );

    // Build transaction
    let initTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 10000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(initOp)
    .setTimeout(60)
    .build();

    // Prepare transaction
    initTx = await this.server.prepareTransaction(initTx);
    const initTxXdr = initTx.toXDR();

    // Sign with SAFU wallet
    const signedXdr = await this.signWithSAFU(initTxXdr, `Initialize Token: ${tokenConfig.name} (${tokenConfig.symbol})`);

    // Parse signed transaction and submit
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    let initResult = await this.server.sendTransaction(signedTx);

    // Handle pending result
    if (initResult.status === 'PENDING') {
      initResult = await this.waitForTransaction(initResult.txHash, 'token initialization');
    }

    if (initResult.status !== 'SUCCESS') {
      throw new Error(`Token initialization failed: ${initResult.status}`);
    }

    return initResult;
  }

  async mintTokens(contractAddress, amount) {
    const contract = new Contract(contractAddress);
    const sourceAccount = await this.server.getAccount(AUTH_DATA.publicKey);

    // Build mint operation
    const mintOp = contract.call(
      'mint',
      Address.fromString(AUTH_DATA.publicKey), // to
      nativeToScVal(amount, { type: 'i128' })
    );

    // Build transaction
    let mintTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 10000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(mintOp)
    .setTimeout(60)
    .build();

    // Prepare transaction
    mintTx = await this.server.prepareTransaction(mintTx);
    const mintTxXdr = mintTx.toXDR();

    // Sign with SAFU wallet
    const signedXdr = await this.signWithSAFU(mintTxXdr, `Mint ${amount} tokens`);

    // Parse signed transaction and submit
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    let mintResult = await this.server.sendTransaction(signedTx);

    // Handle pending result
    if (mintResult.status === 'PENDING') {
      mintResult = await this.waitForTransaction(mintResult.txHash, 'token minting');
    }

    if (mintResult.status !== 'SUCCESS') {
      throw new Error(`Token minting failed: ${mintResult.status}`);
    }

    return mintResult;
  }
}

// Test deployment with SAFU wallet
async function testSAFUDeployment() {
  console.log('🧪 Testing SEP-41 deployment with SAFU wallet agent mode\n');

  // Test token configuration
  const tokenConfig = {
    name: 'SAFU Test Token',
    symbol: 'STT',
    decimals: 7,
    initialSupply: '1000000',
    maxSupply: '10000000',
    isMintable: true,
    isBurnable: true, 
    isFreezable: false
  };

  const deployer = new SAFUTokenDeployer();
  
  try {
    const result = await deployer.deployToken(tokenConfig);
    
    console.log('\n🎉 SAFU WALLET DEPLOYMENT SUCCESSFUL!');
    console.log('🚀 Full end-to-end SEP-41 token deployment completed!');
    console.log('✅ Agent mode integration working perfectly!');
    
    return result;
    
  } catch (error) {
    console.error('\n❌ SAFU deployment failed:', error);
    throw error;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testSAFUDeployment()
    .then(result => {
      console.log('\n🎊 SUCCESS: SEP-41 token deployed via SAFU wallet!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 FAILED: Could not deploy via SAFU wallet');
      process.exit(1);
    });
}

export { SAFUTokenDeployer };