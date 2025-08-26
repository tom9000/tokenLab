#!/usr/bin/env node

/**
 * Deploy SEP-41 using the working approach we tested earlier
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
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// Authentication data
const AUTH_DATA = {
  accessToken: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzZXNzaW9uSWQiOiJhZ2VudF9zZXNzaW9uXzE3NTM3MjAwNDY0OTZfdWZzdWU0ZmdrIiwic3ViIjoiR0RKVktWRTM2QzIyUlJOUlVMN0tLV0hTR1JLR1k2UUE1SFRURUZDQVFMVFZHNEhLRVlJNE81RE4iLCJpYXQiOjE3NTM3MjAwNDYsImV4cCI6MTc1MzcyMTg0NiwiaXNzIjoic2FmdS13YWxsZXQiLCJhdWQiOiJzYWZ1LXdhbGxldC1jbGllbnQiLCJ0eXBlIjoiYWNjZXNzIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDozMDA1IiwiYXBwTmFtZSI6IlRva2VuIExhYiIsIm1vZGUiOiJhZ2VudCJ9.",
  sessionPassword: "password123",
  encryptedSeed: "mock_encrypted_mnemonic_data_for_testing",  
  publicKey: "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN"
};

async function deployContractWorking() {
  console.log('🚀 Deploying using the working approach from our tests...');
  
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
    
    const contractWasm = fs.readFileSync(wasmPath);
    console.log(`✅ Loaded WASM (${contractWasm.length} bytes)`);
    
    // Build contract deployment operation using the same approach that worked in our tests
    console.log('🏗️ Building contract upload operation...');
    
    const uploadOp = Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(contractWasm),
      auth: []
    });
    
    console.log('✅ Upload operation created');
    
    // Build the transaction (using the same settings that worked)
    const deployTransaction = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 1000).toString(), // Same fee we used before
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(uploadOp)
    .setTimeout(300) // 5 minutes timeout
    .build();
    
    console.log('✅ Deployment transaction built');
    
    // Convert to XDR for signing (no preparation, use raw)
    const transactionXdr = deployTransaction.toXDR();
    console.log(`✅ Transaction XDR ready (${transactionXdr.length} chars)`);
    
    // Sign with SAFU wallet (same as our working tests)
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
        description: 'Deploy SEP-41 Token Contract',
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
    
    // Parse signed transaction
    const signedTransaction = TransactionBuilder.fromXDR(signResult.signedTransactionXdr, FUTURENET_CONFIG.networkPassphrase);
    
    console.log('📡 Submitting to Futurenet...');
    const submitResult = await server.sendTransaction(signedTransaction);
    
    console.log(`📊 Submit status: ${submitResult.status}`);
    
    if (submitResult.status === 'SUCCESS') {
      console.log('✅ Contract WASM uploaded successfully!');
      console.log(`🔗 Transaction hash: ${submitResult.hash}`);
      
      // Try to extract WASM hash
      if (submitResult.resultMetaXdr) {
        try {
          const meta = xdr.TransactionMeta.fromXDR(submitResult.resultMetaXdr, 'base64');
          
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
          console.log('⚠️ Could not extract WASM hash, but upload was successful');
        }
      }
      
      return {
        transactionHash: submitResult.hash,
        status: 'success'
      };
      
    } else if (submitResult.status === 'PENDING') {
      console.log('⏳ Transaction pending...');
      
      // Wait for confirmation
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const result = await server.getTransaction(submitResult.hash);
          console.log(`📊 Check ${i + 1}: ${result.status}`);
          
          if (result.status === 'SUCCESS') {
            console.log('✅ Transaction confirmed!');
            return {
              transactionHash: submitResult.hash,
              status: 'success'
            };
          } else if (result.status === 'FAILED') {
            console.error('❌ Transaction failed after being pending');
            return { status: 'failed', hash: submitResult.hash };
          }
        } catch (e) {
          console.log(`⏳ Waiting... (${i + 1}/30)`);
        }
      }
      
      return { status: 'timeout', hash: submitResult.hash };
      
    } else {
      console.error('❌ Transaction submission failed:', submitResult);
      
      // Show more details about the error
      if (submitResult.errorResult) {
        try {
          console.log('📋 Error details:');
          console.log(`Status: ${submitResult.status}`);
          console.log(`Hash: ${submitResult.hash}`);
          if (submitResult.errorResult._attributes) {
            console.log('Error attributes:', submitResult.errorResult._attributes);
          }
        } catch (e) {
          console.log('Could not parse error details');
        }
      }
      
      return { status: 'error', error: submitResult };
    }
    
  } catch (error) {
    console.error('❌ Deployment error:', error);
    return null;
  }
}

async function main() {
  console.log('🧪 SEP-41 Contract Deployment (Working Approach)\n');
  
  const result = await deployContractWorking();
  
  if (result && result.status === 'success') {
    console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
    console.log('='.repeat(50));
    console.log(`📦 Transaction Hash: ${result.transactionHash}`);
    if (result.wasmHash) {
      console.log(`📋 WASM Hash: ${result.wasmHash}`);
    }
    console.log(`🔗 Explorer: https://horizon-futurenet.stellar.org/transactions/${result.transactionHash}`);
    console.log('\n✅ SEP-41 token contract WASM uploaded to Futurenet!');
    console.log('📋 Next step: Create contract instance using this WASM');
    
  } else {
    console.log('\n❌ Deployment failed');
    if (result) {
      console.log(`Status: ${result.status}`);
      if (result.hash) {
        console.log(`Hash: ${result.hash}`);
      }
    }
    process.exit(1);
  }
}

main().catch(console.error);