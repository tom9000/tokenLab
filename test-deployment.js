#!/usr/bin/env node

/**
 * Test real SEP-41 token deployment with SAFU wallet agent mode
 */

import { 
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  rpc,
  xdr,
  BASE_FEE
} from '@stellar/stellar-sdk';
import fs from 'fs';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
  friendbotUrl: 'https://friendbot-futurenet.stellar.org'
};

// Authentication data from fresh session
const AUTH_DATA = {
  accessToken: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzZXNzaW9uSWQiOiJhZ2VudF9zZXNzaW9uXzE3NTM3MjAwNDY0OTZfdWZzdWU0ZmdrIiwic3ViIjoiR0RKVktWRTM2QzIyUlJOUlVMN0tLV0hTR1JLR1k2UUE1SFRURUZDQVFMVFZHNEhLRVlJNE81RE4iLCJpYXQiOjE3NTM3MjAwNDYsImV4cCI6MTc1MzcyMTg0NiwiaXNzIjoic2FmdS13YWxsZXQiLCJhdWQiOiJzYWZ1LXdhbGxldC1jbGllbnQiLCJ0eXBlIjoiYWNjZXNzIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDozMDA1IiwiYXBwTmFtZSI6IlRva2VuIExhYiIsIm1vZGUiOiJhZ2VudCJ9.",
  sessionPassword: "password123",
  encryptedSeed: "mock_encrypted_mnemonic_data_for_testing",
  publicKey: "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN",
  network: "futurenet"
};

async function buildRealDeploymentTransaction() {
  console.log('🚀 Building real SEP-41 token deployment transaction...');
  
  try {
    // Initialize Soroban RPC server
    const server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
    console.log('✅ Connected to Futurenet RPC');
    
    // Get account details
    let sourceAccount;
    try {
      sourceAccount = await server.getAccount(AUTH_DATA.publicKey);
      console.log('✅ Retrieved account from Futurenet');
      console.log(`📊 Account sequence: ${sourceAccount.sequenceNumber()}`);
    } catch (error) {
      if (error.code === 404) {
        console.error(`❌ Account not found on Futurenet. Fund it at: ${FUTURENET_CONFIG.friendbotUrl}?addr=${AUTH_DATA.publicKey}`);
        return null;
      }
      throw error;
    }
    
    // Load real WASM file
    console.log('📦 Loading SEP-41 contract WASM...');
    const wasmPath = '/Users/mac/code/-scdev/tokenLab/contracts/sep41_token/target/wasm32-unknown-unknown/release/sep41_token.optimized.wasm';
    
    if (!fs.existsSync(wasmPath)) {
      console.error(`❌ WASM file not found at: ${wasmPath}`);
      return null;
    }
    
    const contractWasm = fs.readFileSync(wasmPath);
    console.log(`✅ Loaded WASM file (${contractWasm.length} bytes)`);
    
    // Build contract deployment operation using SDK v14
    console.log('🏗️ Building contract upload operation (SDK v14)...');
    
    const uploadOp = Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(contractWasm),
      auth: []
    });
    
    console.log('✅ Upload operation created');
    
    // Build the transaction
    const deployTransaction = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 100000).toString(), // Higher fee for contract deployment
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(uploadOp)
    .setTimeout(300) // 5 minutes timeout
    .build();
    
    console.log('✅ Deployment transaction built successfully');
    
    // Convert to XDR
    const transactionXdr = deployTransaction.toXDR();
    console.log(`✅ Transaction XDR generated (${transactionXdr.length} chars)`);
    console.log(`📋 XDR: ${transactionXdr.substring(0, 100)}...`);
    
    return transactionXdr;
    
  } catch (error) {
    console.error('❌ Error building deployment transaction:', error);
    return null;
  }
}

async function testTransactionSigning(transactionXdr) {
  console.log('\n🔐 Testing transaction signing with SAFU wallet agent mode...');
  
  try {
    const response = await fetch('http://localhost:3003/api/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionXdr,
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
        network: 'futurenet',
        description: 'Deploy SEP-41 Token: TestToken (TTK)',
        appName: 'Token Lab',
        mode: 'agent',
        origin: 'http://localhost:3005',
        accessToken: AUTH_DATA.accessToken,
        sessionPassword: AUTH_DATA.sessionPassword,
        encryptedSeed: AUTH_DATA.encryptedSeed
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Transaction signed successfully!');
      console.log(`📋 Signed XDR: ${result.signedTransactionXdr.substring(0, 100)}...`);
      return result.signedTransactionXdr;
    } else {
      console.error('❌ Transaction signing failed:', result.error);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Signing request failed:', error);
    return null;
  }
}

async function main() {
  console.log('🧪 Testing SEP-41 Token Deployment with SAFU Wallet Agent Mode\n');
  
  // Step 1: Build real deployment transaction
  const transactionXdr = await buildRealDeploymentTransaction();
  if (!transactionXdr) {
    console.error('❌ Failed to build deployment transaction');
    process.exit(1);
  }
  
  // Step 2: Test signing with agent mode
  const signedXdr = await testTransactionSigning(transactionXdr);
  if (!signedXdr) {
    console.error('❌ Failed to sign transaction');
    process.exit(1);
  }
  
  console.log('\n✅ All tests passed! Ready for real deployment.');
  console.log('🚀 Transaction built and signed successfully with agent mode.');
}

// Run the test
main().catch(console.error);