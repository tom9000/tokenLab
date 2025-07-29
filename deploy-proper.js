#!/usr/bin/env node

/**
 * Proper SEP-41 token deployment using SDK v14 Soroban patterns
 */

import { 
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  rpc,
  xdr,
  BASE_FEE,
  Address
} from '@stellar/stellar-sdk';
import fs from 'fs';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// Authentication data
const AUTH_DATA = {
  accessToken: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzZXNzaW9uSWQiOiJhZ2VudF9zZXNzaW9uXzE3NTM3MjAwNDY0OTZfdWZzdWU0ZmdrIiwic3ViIjoiR0RKVktWRTM2QzIyUlJOUlVMN0tLV0hTR1JLR1k2UUE1SFRURUZDQVFMVFZHNEhLRVlJNE81RE4iLCJpYXQiOjE3NTM3MjAwNDYsImV4cCI6MTc1MzcyMTg0NiwiaXNzIjoic2FmdS13YWxsZXQiLCJhdWQiOiJzYWZ1LXdhbGxldC1jbGllbnQiLCJ0eXBlIjoiYWNjZXNzIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDozMDA1IiwiYXBwTmFtZSI6IlRva2VuIExhYiIsIm1vZGUiOiJhZ2VudCJ9.",
  sessionPassword: "password123",
  encryptedSeed: "mock_encrypted_mnemonic_data_for_testing",  
  publicKey: "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN"
};

async function deployContract() {
  console.log('🚀 Deploying SEP-41 contract using proper SDK v14 approach...');
  
  try {
    // Initialize server
    const server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
    
    // Get source account
    const sourceAccount = await server.getAccount(AUTH_DATA.publicKey);
    console.log(`✅ Source account loaded (sequence: ${sourceAccount.sequenceNumber()})`);
    
    // Load contract WASM
    const wasmPath = '/Users/mac/code/-scdev/tokenLab/contracts/sep41_token/target/wasm32-unknown-unknown/release/sep41_token.optimized.wasm';
    
    if (!fs.existsSync(wasmPath)) {
      console.error(`❌ WASM file not found: ${wasmPath}`);
      return null;
    }
    
    const wasmBuffer = fs.readFileSync(wasmPath);
    console.log(`✅ Loaded WASM (${wasmBuffer.length} bytes)`);
    
    // Create upload contract WASM operation
    const uploadOperation = Operation.uploadContractWasm({
      wasm: wasmBuffer,
    });
    
    console.log('✅ Created upload operation');
    
    // Build transaction
    let transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(uploadOperation)
    .setTimeout(30)
    .build();
    
    console.log('✅ Built upload transaction');
    
    // Prepare transaction for Soroban
    transaction = await server.prepareTransaction(transaction);
    console.log('✅ Transaction prepared by Soroban RPC');
    
    // Convert to XDR for signing
    const transactionXdr = transaction.toXDR();
    console.log(`✅ Transaction XDR ready (${transactionXdr.length} chars)`);
    
    // Sign with SAFU wallet
    console.log('🔐 Signing with SAFU wallet...');
    
    const signResponse = await fetch('http://localhost:3003/api/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionXdr,
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
        network: 'futurenet',
        description: 'Upload SEP-41 Token WASM to Futurenet',
        appName: 'Token Lab',
        mode: 'agent',
        origin: 'http://localhost:3005',
        accessToken: AUTH_DATA.accessToken,
        sessionPassword: AUTH_DATA.sessionPassword,
        encryptedSeed: AUTH_DATA.encryptedSeed
      })
    });
    
    const signResult = await signResponse.json();
    
    if (!signResponse.ok || !signResult.success) {
      console.error('❌ Signing failed:', signResult.error);
      return null;
    }
    
    console.log('✅ Transaction signed successfully');
    
    // Parse signed transaction and submit
    const signedTransaction = TransactionBuilder.fromXDR(signResult.signedTransactionXdr, FUTURENET_CONFIG.networkPassphrase);
    
    console.log('📡 Submitting to Futurenet...');
    const submitResult = await server.sendTransaction(signedTransaction);
    
    console.log(`📊 Submit result: ${submitResult.status}`);
    
    if (submitResult.status === 'SUCCESS') {
      console.log('✅ WASM upload successful!');
      console.log(`🔗 Transaction hash: ${submitResult.hash}`);
      
      // Extract WASM hash from the result
      if (submitResult.resultMetaXdr) {
        try {
          const meta = xdr.TransactionMeta.fromXDR(submitResult.resultMetaXdr, 'base64');
          console.log('✅ Transaction metadata parsed');
          
          // Look for the WASM hash in the result
          if (meta.v3() && meta.v3().sorobanMeta() && meta.v3().sorobanMeta().returnValue()) {
            const returnValue = meta.v3().sorobanMeta().returnValue();
            if (returnValue.switch().name === 'scvBytes') {
              const wasmHash = Buffer.from(returnValue.bytes()).toString('hex');
              console.log(`📦 WASM Hash: ${wasmHash}`);
              
              return {
                wasmHash,
                transactionHash: submitResult.hash,
                status: 'success'
              };
            }
          }
        } catch (e) {
          console.log('⚠️ Could not extract WASM hash:', e.message);
        }
      }
      
      return {
        transactionHash: submitResult.hash,
        status: 'success'
      };
      
    } else if (submitResult.status === 'PENDING') {
      console.log('⏳ Transaction pending, waiting for confirmation...');
      
      // Wait for confirmation
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const result = await server.getTransaction(submitResult.hash);
          console.log(`📊 Attempt ${i + 1}: ${result.status}`);
          
          if (result.status === 'SUCCESS') {
            console.log('✅ Transaction confirmed!');
            return {
              transactionHash: submitResult.hash,
              status: 'success'
            };
          } else if (result.status === 'FAILED') {
            console.error('❌ Transaction failed');
            return { status: 'failed', hash: submitResult.hash };
          }
        } catch (e) {
          console.log(`⏳ Still waiting... (${i + 1}/30)`);
        }
      }
      
      console.log('⚠️ Transaction still pending after 30 seconds');
      return { status: 'pending', hash: submitResult.hash };
      
    } else {
      console.error('❌ Transaction failed:', submitResult);
      return { status: 'failed', error: submitResult };
    }
    
  } catch (error) {
    console.error('❌ Deployment error:', error);
    return null;
  }
}

async function main() {
  console.log('🧪 SEP-41 Token WASM Upload (SDK v14)\n');
  
  const result = await deployContract();
  
  if (result) {
    console.log('\n🎉 Deployment Summary:');
    console.log('='.repeat(50));
    console.log(`Status: ${result.status}`);
    if (result.wasmHash) {
      console.log(`WASM Hash: ${result.wasmHash}`);
    }
    if (result.transactionHash) {
      console.log(`Transaction: ${result.transactionHash}`);
    }
    console.log('\n✅ WASM upload completed!');
    console.log('📋 Next: Create contract instance with this WASM hash');
  } else {
    console.log('\n❌ Deployment failed');
    process.exit(1);
  }
}

main().catch(console.error);