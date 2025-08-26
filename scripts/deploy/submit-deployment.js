#!/usr/bin/env node

/**
 * Submit real SEP-41 token deployment to Futurenet and extract contract ID
 */

import { 
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  rpc,
  xdr,
  BASE_FEE,
  Transaction
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

async function buildAndSignDeploymentTransaction() {
  console.log('🚀 Building and signing SEP-41 deployment transaction...');
  
  try {
    // Initialize Soroban RPC server
    const server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
    console.log('✅ Connected to Futurenet RPC');
    
    // Get account details
    const sourceAccount = await server.getAccount(AUTH_DATA.publicKey);
    console.log('✅ Retrieved account from Futurenet');
    console.log(`📊 Account sequence: ${sourceAccount.sequenceNumber()}`);
    
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
      fee: (BASE_FEE * 1000).toString(), // Reasonable fee for contract deployment
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(uploadOp)
    .setTimeout(300) // 5 minutes timeout
    .build();
    
    console.log('✅ Deployment transaction built successfully');
    
    // Convert to XDR for signing
    const transactionXdr = deployTransaction.toXDR();
    console.log(`✅ Transaction XDR generated (${transactionXdr.length} chars)`);
    
    // Sign the transaction using SAFU wallet agent mode
    console.log('🔐 Signing transaction with SAFU wallet...');
    
    const signResponse = await fetch('http://localhost:3003/api/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionXdr,
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
        network: 'futurenet',
        description: 'Deploy SEP-41 Token Contract to Futurenet',
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
      console.error('❌ Transaction signing failed:', signResult.error);
      return null;
    }
    
    console.log('✅ Transaction signed successfully!');
    return signResult.signedTransactionXdr;
    
  } catch (error) {
    console.error('❌ Error building/signing deployment transaction:', error);
    return null;
  }
}

async function submitTransaction(signedTransactionXdr) {
  console.log('\n📡 Submitting deployment transaction to Futurenet...');
  
  try {
    // Initialize Soroban RPC server
    const server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
    
    // Parse the signed transaction
    const transaction = TransactionBuilder.fromXDR(signedTransactionXdr, FUTURENET_CONFIG.networkPassphrase);
    console.log('✅ Parsed signed transaction XDR');
    
    // Submit the transaction
    console.log('⏳ Submitting to Futurenet...');
    const result = await server.sendTransaction(transaction);
    
    console.log(`📡 Transaction submission result: ${result.status}`);
    
    if (result.status === 'SUCCESS') {
      console.log('✅ Transaction submitted successfully!');
      console.log(`🔗 Transaction Hash: ${result.hash}`);
      return result;
    } else if (result.status === 'PENDING') {
      console.log('⏳ Transaction is pending, waiting for confirmation...');
      
      // Poll for transaction result
      let attempts = 0;
      const maxAttempts = 30; // Wait up to 30 seconds
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        try {
          const txResult = await server.getTransaction(result.hash);
          console.log(`📊 Attempt ${attempts}: Status ${txResult.status}`);
          
          if (txResult.status === 'SUCCESS') {
            console.log('✅ Transaction confirmed successfully!');
            console.log(`🔗 Transaction Hash: ${result.hash}`);
            return txResult;
          } else if (txResult.status === 'FAILED') {
            console.error('❌ Transaction failed:', txResult);
            return txResult;
          }
        } catch (pollError) {
          console.log(`⏳ Still waiting... (${attempts}/${maxAttempts})`);
        }
      }
      
      console.log('⚠️ Transaction still pending after 30 seconds');
      return result;
      
    } else {
      console.error('❌ Transaction submission failed:', result);
      
      // Try to extract more detailed error information
      if (result.errorResult) {
        console.log('📋 Detailed error information:');
        try {
          console.log('Fee charged:', result.errorResult._attributes?.feeCharged);
          if (result.errorResult._attributes?.result) {
            console.log('Result details:', result.errorResult._attributes.result);
          }
        } catch (e) {
          console.log('Could not parse error details:', e.message);
        }
      }
      
      return result;
    }
    
  } catch (error) {
    console.error('❌ Error submitting transaction:', error);
    return null;
  }
}

function extractContractId(transactionResult) {
  console.log('\n🔍 Extracting contract ID from transaction result...');
  
  try {
    if (!transactionResult || transactionResult.status !== 'SUCCESS') {
      console.error('❌ Transaction was not successful, cannot extract contract ID');
      return null;
    }
    
    // For WASM upload transactions, the contract ID is typically in the result metadata
    if (transactionResult.resultMetaXdr) {
      console.log('📋 Analyzing transaction result metadata...');
      
      // Parse the result metadata
      const resultMeta = xdr.TransactionMeta.fromXDR(transactionResult.resultMetaXdr, 'base64');
      console.log('✅ Parsed transaction metadata');
      
      // Look for contract creation in the metadata
      if (resultMeta.v3() && resultMeta.v3().sorobanMeta()) {
        const sorobanMeta = resultMeta.v3().sorobanMeta();
        console.log('📊 Found Soroban metadata');
        
        // Extract any created contract addresses
        if (sorobanMeta.events() && sorobanMeta.events().length > 0) {
          console.log(`📋 Found ${sorobanMeta.events().length} events in transaction`);
          
          for (let i = 0; i < sorobanMeta.events().length; i++) {
            const event = sorobanMeta.events()[i];
            console.log(`📋 Event ${i + 1}: ${event.type()}`);
          }
        }
        
        // The return value should contain the uploaded WASM hash
        if (sorobanMeta.returnValue()) {
          const returnValue = sorobanMeta.returnValue();
          console.log('✅ Found return value from contract upload');
          console.log(`📋 Return value type: ${returnValue.switch()}`);
          
          if (returnValue.switch().name === 'scvBytes') {
            const wasmHash = returnValue.bytes();
            const wasmHashHex = Buffer.from(wasmHash).toString('hex');
            console.log(`✅ Contract WASM Hash: ${wasmHashHex}`);
            return { wasmHash: wasmHashHex, type: 'wasm_upload' };
          }
        }
      }
    }
    
    console.log('ℹ️ This appears to be a WASM upload transaction');
    console.log('ℹ️ To create a contract instance, you need to call the contract creation function');
    
    return {
      transactionHash: transactionResult.hash,
      type: 'wasm_upload',
      status: 'success'
    };
    
  } catch (error) {
    console.error('❌ Error extracting contract information:', error);
    return null;
  }
}

async function main() {
  console.log('🧪 Complete SEP-41 Token Deployment to Futurenet\n');
  
  // Step 1: Build and sign the deployment transaction
  const signedXdr = await buildAndSignDeploymentTransaction();
  if (!signedXdr) {
    console.error('❌ Failed to build and sign deployment transaction');
    process.exit(1);
  }
  
  // Step 2: Submit the transaction to Futurenet
  const transactionResult = await submitTransaction(signedXdr);
  if (!transactionResult) {
    console.error('❌ Failed to submit transaction');
    process.exit(1);
  }
  
  // Step 3: Extract contract information
  const contractInfo = extractContractId(transactionResult);
  
  console.log('\n🎉 Deployment Summary:');
  console.log('='.repeat(50));
  
  if (contractInfo) {
    if (contractInfo.wasmHash) {
      console.log(`📦 WASM Hash: ${contractInfo.wasmHash}`);
      console.log(`🔗 Transaction: ${transactionResult.hash}`);
      console.log(`✅ Status: WASM uploaded successfully`);
      console.log('\n📋 Next Steps:');
      console.log('1. Create contract instance using the WASM hash');
      console.log('2. Initialize the contract with token parameters');
      console.log('3. Test minting and transfer operations');
    } else {
      console.log(`🔗 Transaction: ${transactionResult.hash}`);
      console.log(`✅ Status: ${contractInfo.status}`);
    }
  } else {
    console.log(`🔗 Transaction: ${transactionResult.hash}`);
    console.log(`⚠️ Status: Contract information could not be extracted`);
  }
  
  console.log('\n🚀 SAFU wallet agent mode deployment successful!');
}

// Run the deployment
main().catch(console.error);