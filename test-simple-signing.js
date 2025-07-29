#!/usr/bin/env node

/**
 * Test simple payment transaction signing with SAFU wallet agent mode
 */

import { 
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  rpc,
  BASE_FEE
} from '@stellar/stellar-sdk';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// Authentication data from fresh session
const AUTH_DATA = {
  accessToken: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzZXNzaW9uSWQiOiJhZ2VudF9zZXNzaW9uXzE3NTM3MjAwNDY0OTZfdWZzdWU0ZmdrIiwic3ViIjoiR0RKVktWRTM2QzIyUlJOUlVMN0tLV0hTR1JLR1k2UUE1SFRURUZDQVFMVFZHNEhLRVlJNE81RE4iLCJpYXQiOjE3NTM3MjAwNDYsImV4cCI6MTc1MzcyMTg0NiwiaXNzIjoic2FmdS13YWxsZXQiLCJhdWQiOiJzYWZ1LXdhbGxldC1jbGllbnQiLCJ0eXBlIjoiYWNjZXNzIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDozMDA1IiwiYXBwTmFtZSI6IlRva2VuIExhYiIsIm1vZGUiOiJhZ2VudCJ9.",
  sessionPassword: "password123",
  encryptedSeed: "mock_encrypted_mnemonic_data_for_testing",
  publicKey: "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN",
  network: "futurenet"
};

async function buildSimplePaymentTransaction() {
  console.log('💰 Building simple payment transaction...');
  
  try {
    // Initialize RPC server
    const server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
    console.log('✅ Connected to Futurenet RPC');
    
    // Get account details
    const sourceAccount = await server.getAccount(AUTH_DATA.publicKey);
    console.log('✅ Retrieved account from Futurenet');
    console.log(`📊 Account sequence: ${sourceAccount.sequenceNumber()}`);
    
    // Build simple payment operation
    const paymentOp = Operation.payment({
      destination: AUTH_DATA.publicKey, // Self-payment for testing
      asset: Asset.native(),
      amount: '0.0000001', // Minimal XLM amount
    });
    
    console.log('✅ Payment operation created');
    
    // Build the transaction
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(paymentOp)
    .setTimeout(60)
    .build();
    
    console.log('✅ Payment transaction built successfully');
    
    // Convert to XDR
    const transactionXdr = transaction.toXDR();
    console.log(`✅ Transaction XDR generated (${transactionXdr.length} chars)`);
    console.log(`📋 XDR: ${transactionXdr.substring(0, 100)}...`);
    
    return transactionXdr;
    
  } catch (error) {
    console.error('❌ Error building payment transaction:', error);
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
        description: 'Test Payment Transaction',
        appName: 'Token Lab',
        mode: 'agent',
        origin: 'http://localhost:3005',
        accessToken: AUTH_DATA.accessToken,
        sessionPassword: AUTH_DATA.sessionPassword,
        encryptedSeed: AUTH_DATA.encryptedSeed
      })
    });
    
    console.log(`📡 Response status: ${response.status}`);
    
    const result = await response.json();
    console.log('📋 Response:', JSON.stringify(result, null, 2));
    
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
  console.log('🧪 Testing Simple Payment Signing with SAFU Wallet Agent Mode\n');
  
  // Step 1: Build simple payment transaction
  const transactionXdr = await buildSimplePaymentTransaction();
  if (!transactionXdr) {
    console.error('❌ Failed to build payment transaction');
    process.exit(1);
  }
  
  // Step 2: Test signing with agent mode
  const signedXdr = await testTransactionSigning(transactionXdr);
  if (!signedXdr) {
    console.error('❌ Failed to sign transaction');
    process.exit(1);
  }
  
  console.log('\n✅ Simple payment signing test passed!');
  console.log('🚀 Ready to test more complex transactions.');
}

// Run the test
main().catch(console.error);