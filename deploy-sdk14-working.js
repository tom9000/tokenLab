#!/usr/bin/env node

/**
 * Working SEP-41 deployment using SDK v14 patterns
 * Based on existing deploy.js but updated for current SDK
 */

import {
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  rpc,
  xdr,
  BASE_FEE,
  Address,
  nativeToScVal,
  Contract
} from '@stellar/stellar-sdk';
import fs from 'fs';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
  friendbotUrl: 'https://friendbot-futurenet.stellar.org'
};

// Test token configuration
const TOKEN_CONFIG = {
  name: 'TestToken',
  symbol: 'TTK',
  decimals: 7,
  initialSupply: '1000000',
  maxSupply: '10000000',
  isMintable: true,
  isBurnable: true,
  isFreezable: false
};

class ModernSEP41Deployer {
  constructor(sourceKeypair) {
    this.source = sourceKeypair;
    this.server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
  }

  async deployContract(tokenConfig) {
    console.log('🚀 Starting modern SEP-41 deployment...');
    console.log(`📋 Token: ${tokenConfig.name} (${tokenConfig.symbol})`);

    try {
      // Step 1: Upload contract WASM
      console.log('\n📤 Step 1: Uploading contract WASM...');
      const wasmHash = await this.uploadWasm();
      console.log(`✅ WASM uploaded with hash: ${wasmHash}`);

      // Step 2: Deploy contract instance
      console.log('\n🏗️ Step 2: Creating contract instance...');
      const contractAddress = await this.createContractInstance(wasmHash);
      console.log(`✅ Contract deployed at: ${contractAddress}`);

      // Step 3: Initialize the token
      console.log('\n⚙️ Step 3: Initializing token...');
      await this.initializeToken(contractAddress, tokenConfig);
      console.log('✅ Token initialized');

      // Step 4: Mint initial supply if specified
      if (tokenConfig.initialSupply && parseInt(tokenConfig.initialSupply) > 0) {
        console.log(`\n💰 Step 4: Minting initial supply: ${tokenConfig.initialSupply}`);
        await this.mintInitialSupply(contractAddress, tokenConfig.initialSupply);
        console.log('✅ Initial supply minted');
      }

      const deploymentInfo = {
        contractId: contractAddress,
        wasmHash,
        config: tokenConfig,
        network: 'futurenet',
        deployedAt: new Date(),
      };

      console.log('\n🎉 Deployment completed successfully!');
      console.log(`📄 Contract ID: ${contractAddress}`);
      console.log(`📦 WASM Hash: ${wasmHash}`);
      console.log(`🔗 Explorer: https://futurenet.steexp.com/contract/${contractAddress}`);

      return deploymentInfo;

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  async uploadWasm() {
    console.log('Loading WASM file...');
    
    // Try the optimized version first
    let wasmPath = '/Users/mac/code/-scdev/tokenLab/contracts/sep41_token/target/wasm32-unknown-unknown/release/sep41_token.optimized.wasm';
    
    if (!fs.existsSync(wasmPath)) {
      // Fallback to unoptimized version
      wasmPath = '/Users/mac/code/-scdev/tokenLab/contracts/sep41_token/target/wasm32-unknown-unknown/release/sep41_token.wasm';
    }
    
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM file not found at: ${wasmPath}`);
    }

    const wasmBuffer = fs.readFileSync(wasmPath);
    console.log(`✅ Loaded WASM (${wasmBuffer.length} bytes)`);

    // Get source account
    const sourceAccount = await this.server.getAccount(this.source.publicKey());
    console.log(`📊 Account sequence: ${sourceAccount.sequenceNumber()}`);

    // Create upload operation
    const uploadOp = Operation.uploadContractWasm({
      wasm: wasmBuffer,
    });

    // Build transaction
    let transaction = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 100000).toString(), // Higher fee for WASM upload
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(uploadOp)
    .setTimeout(60)
    .build();

    // Prepare for Soroban
    transaction = await this.server.prepareTransaction(transaction);
    console.log('✅ Transaction prepared');

    // Sign and submit
    transaction.sign(this.source);
    const result = await this.server.sendTransaction(transaction);

    console.log(`📊 Upload result: ${result.status}`);

    if (result.status === 'SUCCESS') {
      return this.extractWasmHash(result);
    } else if (result.status === 'PENDING') {
      console.log('⏳ Transaction pending, waiting for confirmation...');
      
      // Wait for confirmation
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const txResult = await this.server.getTransaction(result.hash);
          console.log(`📊 Check ${i + 1}: ${txResult.status}`);
          
          if (txResult.status === 'SUCCESS') {
            console.log('✅ Upload confirmed!');
            return this.extractWasmHash(txResult);
          } else if (txResult.status === 'FAILED') {
            throw new Error(`Upload failed after pending: ${JSON.stringify(txResult)}`);
          }
        } catch (e) {
          console.log(`⏳ Still waiting... (${i + 1}/30)`);
        }
      }
      
      throw new Error('Upload transaction timed out after 60 seconds');
    } else {
      throw new Error(`Upload failed: ${result.status} - ${JSON.stringify(result)}`);
    }
  }

  async createContractInstance(wasmHash) {
    console.log(`Creating contract instance with WASM hash: ${wasmHash}`);

    // Get source account
    const sourceAccount = await this.server.getAccount(this.source.publicKey());

    // Create contract instance operation using custom contract
    const salt = Buffer.alloc(32); // Use zero salt for deterministic address
    
    const createOp = Operation.createCustomContract({
      address: Address.fromString(this.source.publicKey()),
      wasmHash: Buffer.from(wasmHash, 'hex'),
      salt: salt
    });

    // Build transaction
    let transaction = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 50000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(createOp)
    .setTimeout(60)
    .build();

    // Prepare for Soroban
    transaction = await this.server.prepareTransaction(transaction);

    // Sign and submit
    transaction.sign(this.source);
    const result = await this.server.sendTransaction(transaction);

    if (result.status !== 'SUCCESS') {
      throw new Error(`Contract creation failed: ${result.status}`);
    }

    // Extract contract address from result
    return this.extractContractAddress(result);
  }

  async initializeToken(contractAddress, tokenConfig) {
    const contract = new Contract(contractAddress);
    const sourceAccount = await this.server.getAccount(this.source.publicKey());

    // Build initialize operation
    const initOp = contract.call(
      'initialize',
      Address.fromString(this.source.publicKey()), // admin
      nativeToScVal(tokenConfig.decimals, { type: 'u32' }),
      nativeToScVal(tokenConfig.name, { type: 'string' }),
      nativeToScVal(tokenConfig.symbol, { type: 'string' }),
      tokenConfig.maxSupply ? 
        nativeToScVal(tokenConfig.maxSupply, { type: 'i128' }) : 
        nativeToScVal(null, { type: 'option' }),
      nativeToScVal(tokenConfig.isMintable, { type: 'bool' }),
      nativeToScVal(tokenConfig.isBurnable, { type: 'bool' }),
      nativeToScVal(tokenConfig.isFreezable, { type: 'bool' })
    );

    // Build transaction
    let transaction = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 10000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(initOp)
    .setTimeout(60)
    .build();

    // Prepare for Soroban
    transaction = await this.server.prepareTransaction(transaction);

    // Sign and submit
    transaction.sign(this.source);
    const result = await this.server.sendTransaction(transaction);

    if (result.status !== 'SUCCESS') {
      throw new Error(`Token initialization failed: ${result.status}`);
    }

    return result;
  }

  async mintInitialSupply(contractAddress, amount) {
    const contract = new Contract(contractAddress);
    const sourceAccount = await this.server.getAccount(this.source.publicKey());

    // Build mint operation
    const mintOp = contract.call(
      'mint',
      Address.fromString(this.source.publicKey()), // to
      nativeToScVal(amount, { type: 'i128' })
    );

    // Build transaction
    let transaction = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 10000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(mintOp)
    .setTimeout(60)
    .build();

    // Prepare for Soroban
    transaction = await this.server.prepareTransaction(transaction);

    // Sign and submit
    transaction.sign(this.source);
    const result = await this.server.sendTransaction(transaction);

    if (result.status !== 'SUCCESS') {
      throw new Error(`Minting failed: ${result.status}`);
    }

    return result;
  }

  extractWasmHash(result) {
    try {
      if (result.resultMetaXdr) {
        const meta = xdr.TransactionMeta.fromXDR(result.resultMetaXdr, 'base64');
        
        if (meta.v3() && meta.v3().sorobanMeta() && meta.v3().sorobanMeta().returnValue()) {
          const returnValue = meta.v3().sorobanMeta().returnValue();
          if (returnValue.switch().name === 'scvBytes') {
            const wasmHash = Buffer.from(returnValue.bytes()).toString('hex');
            console.log(`📦 Extracted WASM hash: ${wasmHash}`);
            return wasmHash;
          }
        }
        
        // Also check in the result XDR
        if (result.resultXdr) {
          try {
            const resultData = xdr.TransactionResult.fromXDR(result.resultXdr, 'base64');
            console.log('📋 Transaction result data available');
          } catch (e) {
            console.log('Could not parse result XDR');
          }
        }
      }
    } catch (e) {
      console.log('Could not extract WASM hash from result:', e.message);
    }
    
    // Fallback: return transaction hash as identifier
    console.log('⚠️ Using transaction hash as WASM identifier');
    return result.hash;
  }

  extractContractAddress(result) {
    try {
      if (result.resultMetaXdr) {
        const meta = xdr.TransactionMeta.fromXDR(result.resultMetaXdr, 'base64');
        
        if (meta.v3() && meta.v3().sorobanMeta() && meta.v3().sorobanMeta().returnValue()) {
          const returnValue = meta.v3().sorobanMeta().returnValue();
          if (returnValue.switch().name === 'scvAddress') {
            return Address.fromScVal(returnValue).toString();
          }
        }
      }
    } catch (e) {
      console.log('Could not extract contract address from result');
    }
    
    throw new Error('Failed to extract contract address from deployment result');
  }
}

// Test function with a temporary keypair
async function testDeployment() {
  console.log('🧪 Testing SEP-41 deployment with SDK v14\n');
  
  // Generate a test keypair
  const testKeypair = Keypair.random();
  console.log(`🔑 Test keypair generated: ${testKeypair.publicKey()}`);
  
  // Fund the account
  console.log('💰 Funding account via Friendbot...');
  try {
    const fundResponse = await fetch(`${FUTURENET_CONFIG.friendbotUrl}?addr=${testKeypair.publicKey()}`);
    if (fundResponse.ok) {
      console.log('✅ Account funded successfully');
    } else {
      throw new Error('Friendbot funding failed');
    }
  } catch (error) {
    console.error('❌ Funding failed:', error);
    return;
  }

  // Deploy the contract
  const deployer = new ModernSEP41Deployer(testKeypair);
  
  try {
    const result = await deployer.deployContract(TOKEN_CONFIG);
    console.log('\n🎉 Test deployment successful!');
    console.log('Result:', result);
  } catch (error) {
    console.error('\n❌ Test deployment failed:', error);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDeployment().catch(console.error);
}

export { ModernSEP41Deployer };