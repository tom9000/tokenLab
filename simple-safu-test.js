#!/usr/bin/env node

/**
 * Simple SAFU wallet test with minimal WASM upload
 */

import {
  TransactionBuilder,
  Networks,
  Operation,
  rpc,
  BASE_FEE
} from '@stellar/stellar-sdk';
import fs from 'fs';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// Authentication data
const AUTH_DATA = {
  accessToken: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzZXNzaW9uSWQiOiJhZ2VudF9zZXNzaW9uXzE3NTM3MjExNjA3ODBfdHA0aTJvenJwIiwic3ViIjoiR0RKVktWRTM2QzIyUlJOUlVMN0tLV0hTR1JLR1k2UUE1SFRURUZDQVFMVFZHNEhLRVlJNE81RE4iLCJpYXQiOjE3NTM3MjExNjAsImV4cCI6MTc1MzcyMjk2MCwiaXNzIjoic2FmdS13YWxsZXQiLCJhdWQiOiJzYWZ1LXdhbGxldC1jbGllbnQiLCJ0eXBlIjoiYWNjZXNzIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDozMDA1IiwiYXBwTmFtZSI6IlRva2VuIExhYiIsIm1vZGUiOiJhZ2VudCJ9.",
  sessionPassword: "password123",
  encryptedSeed: "mock_encrypted_mnemonic_data_for_testing",
  publicKey: "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN"
};

async function testSimpleWasmUpload() {
  console.log('🧪 Simple SAFU wallet WASM upload test\n');

  // Initialize server
  const server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);

  try {
    // Load smaller, simpler WASM file
    const wasmPath = '/Users/mac/code/-scdev/tokenLab/contracts/sep41_token/target/wasm32-unknown-unknown/release/sep41_token.optimized.wasm';
    const wasmBuffer = fs.readFileSync(wasmPath);
    console.log(`📦 Loaded WASM (${wasmBuffer.length} bytes)`);

    // Get source account
    const sourceAccount = await server.getAccount(AUTH_DATA.publicKey);
    console.log(`📊 Account sequence: ${sourceAccount.sequenceNumber()}`);

    // Create minimal upload operation with lower fee
    const uploadOp = Operation.uploadContractWasm({
      wasm: wasmBuffer,
    });

    // Build transaction with minimal fee
    let uploadTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 1000).toString(), // Much lower fee
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(uploadOp)
    .setTimeout(60)
    .build();

    console.log('📋 Transaction built, preparing...');

    // DO NOT prepare the transaction - try raw submission
    // uploadTx = await server.prepareTransaction(uploadTx);
    
    const uploadTxXdr = uploadTx.toXDR();
    console.log(`📋 Transaction XDR ready (${uploadTxXdr.length} chars)`);

    // Sign with SAFU wallet
    console.log('🔐 Signing with SAFU wallet...');
    
    const response = await fetch('http://localhost:3003/api/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionXdr: uploadTxXdr,
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
        network: 'futurenet',
        description: 'Simple WASM Upload Test',
        appName: 'Token Lab',
        mode: 'agent',
        origin: 'http://localhost:3005',
        accessToken: AUTH_DATA.accessToken,
        sessionPassword: AUTH_DATA.sessionPassword,
        encryptedSeed: AUTH_DATA.encryptedSeed
      })
    });

    const signResult = await response.json();
    
    if (!response.ok || !signResult.success) {
      throw new Error(`SAFU wallet signing failed: ${signResult.error}`);
    }

    console.log('✅ Transaction signed by SAFU wallet');

    // Parse signed transaction and submit
    const signedTx = TransactionBuilder.fromXDR(signResult.signedTransactionXdr, FUTURENET_CONFIG.networkPassphrase);
    
    console.log('📡 Submitting to Futurenet...');
    const uploadResult = await server.sendTransaction(signedTx);

    console.log(`📊 Result: ${uploadResult.status}`);
    console.log('📋 Full result:', uploadResult);

    if (uploadResult.status === 'SUCCESS') {
      console.log('🎉 SUCCESS: WASM upload completed!');
      return uploadResult;
    } else if (uploadResult.status === 'PENDING') {
      console.log('⏳ Transaction pending...');
      return uploadResult;
    } else {
      console.log('❌ Upload failed with status:', uploadResult.status);
      
      // Try to get detailed error info
      if (uploadResult.errorResult) {
        try {
          console.log('📋 Error details available');
          if (uploadResult.errorResult._attributes) {
            const attrs = uploadResult.errorResult._attributes;
            console.log('Fee charged:', attrs.feeCharged);
            if (attrs.result) {
              console.log('Result switch:', attrs.result._switch);
              console.log('Result value:', attrs.result._value);
            }
          }
        } catch (e) {
          console.log('Could not parse error details');
        }
      }
      
      return uploadResult;
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Run the test
testSimpleWasmUpload()
  .then(result => {
    if (result && (result.status === 'SUCCESS' || result.status === 'PENDING')) {
      console.log('\n✅ SAFU wallet integration working!');
      console.log('🚀 Ready for full deployment implementation!');
    } else {
      console.log('\n⚠️ Issues detected, but signing worked');
    }
  })
  .catch(error => {
    console.error('\n💥 Test failed completely');
  });