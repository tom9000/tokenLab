#!/usr/bin/env node

/**
 * Test WASM upload only to debug hash extraction
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

async function testWasmUploadOnly() {
  console.log('🧪 Testing WASM upload and hash extraction\n');
  
  // Generate a test keypair
  const testKeypair = Keypair.random();
  console.log(`🔑 Test keypair: ${testKeypair.publicKey()}`);
  
  // Fund the account
  console.log('💰 Funding account...');
  try {
    const fundResponse = await fetch(`${FUTURENET_CONFIG.friendbotUrl}?addr=${testKeypair.publicKey()}`);
    if (!fundResponse.ok) {
      throw new Error('Friendbot funding failed');
    }
    console.log('✅ Account funded');
  } catch (error) {
    console.error('❌ Funding failed:', error);
    return;
  }

  // Initialize server
  const server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);

  try {
    // Load WASM
    const wasmPath = '/Users/mac/code/-scdev/tokenLab/contracts/sep41_token/target/wasm32-unknown-unknown/release/sep41_token.optimized.wasm';
    const wasmBuffer = fs.readFileSync(wasmPath);
    console.log(`📦 Loaded WASM (${wasmBuffer.length} bytes)`);

    // Get source account
    const sourceAccount = await server.getAccount(testKeypair.publicKey());
    console.log(`📊 Account sequence: ${sourceAccount.sequenceNumber()}`);

    // Create upload operation
    const uploadOp = Operation.uploadContractWasm({
      wasm: wasmBuffer,
    });

    // Build transaction
    let transaction = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 100000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(uploadOp)
    .setTimeout(60)
    .build();

    // Prepare for Soroban
    transaction = await server.prepareTransaction(transaction);
    console.log('✅ Transaction prepared');

    // Sign and submit
    transaction.sign(testKeypair);
    const result = await server.sendTransaction(transaction);

    console.log(`📊 Upload result: ${result.status}`);

    if (result.status === 'PENDING') {
      console.log('⏳ Waiting for confirmation...');
      
      // Wait for confirmation
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const txResult = await server.getTransaction(result.hash);
          console.log(`📊 Check ${i + 1}: ${txResult.status}`);
          
          if (txResult.status === 'SUCCESS') {
            console.log('✅ Upload confirmed!');
            
            // Debug all available data
            console.log('\n🔍 Debugging transaction result:');
            console.log('Keys in result:', Object.keys(txResult));
            
            if (txResult.resultMetaXdr) {
              console.log('📋 Has resultMetaXdr');
              
              try {
                const meta = xdr.TransactionMeta.fromXDR(txResult.resultMetaXdr, 'base64');
                console.log('✅ Parsed transaction metadata');
                
                // Check what version we have
                console.log(`📊 Meta version: ${meta.switch()}`);
                
                if (meta.v3()) {
                  console.log('📊 Has v3 metadata');
                  const v3Meta = meta.v3();
                  
                  if (v3Meta.sorobanMeta()) {
                    console.log('📊 Has Soroban metadata'); 
                    const sorobanMeta = v3Meta.sorobanMeta();
                    
                    if (sorobanMeta.returnValue()) {
                      console.log('📊 Has return value');
                      const returnValue = sorobanMeta.returnValue();
                      console.log(`📊 Return value type: ${returnValue.switch().name}`);
                      
                      if (returnValue.switch().name === 'scvBytes') {
                        const bytes = returnValue.bytes();
                        console.log('📋 Raw bytes:', bytes);
                        console.log('📋 Bytes type:', typeof bytes);
                        console.log('📋 Bytes constructor:', bytes.constructor.name);
                        
                        // Try different ways to convert to hex
                        try {
                          const wasmHash = Buffer.from(bytes).toString('hex');
                          console.log(`🎉 WASM Hash: ${wasmHash}`);
                          return wasmHash;
                        } catch (e) {
                          console.log('❌ Buffer.from failed:', e.message);
                          
                          // Try as array
                          try {
                            const wasmHash = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
                            console.log(`🎉 WASM Hash (array method): ${wasmHash}`);
                            return wasmHash;
                          } catch (e2) {
                            console.log('❌ Array method failed:', e2.message);
                          }
                        }
                      }
                    }
                    
                    // Check events too
                    if (sorobanMeta.events()) {
                      console.log(`📊 Has ${sorobanMeta.events().length} events`);
                      sorobanMeta.events().forEach((event, i) => {
                        console.log(`📋 Event ${i}: ${event.type()}`);
                      });
                    }
                  }
                }
                
              } catch (e) {
                console.log('❌ Error parsing metadata:', e.message);
              }
            }
            
            if (txResult.resultXdr) {
              console.log('📋 Has resultXdr');
              
              try {
                const resultData = xdr.TransactionResult.fromXDR(txResult.resultXdr, 'base64');
                console.log('✅ Parsed transaction result XDR');
                console.log('📋 Result keys:', Object.keys(resultData));
              } catch (e) {
                console.log('❌ Error parsing result XDR:', e.message);
              }
            }
            
            console.log(`\n⚠️ Could not extract WASM hash, using transaction hash: ${result.hash}`);
            return result.hash;
            
          } else if (txResult.status === 'FAILED') {
            console.error('❌ Transaction failed:', txResult);
            return null;
          }
        } catch (e) {
          console.log(`⏳ Still waiting... (${i + 1}/30)`);
        }
      }
      
      console.error('❌ Transaction timed out');
      return null;
    } else if (result.status === 'SUCCESS') {
      console.log('✅ Upload successful immediately');
      return result.hash;
    } else {
      console.error('❌ Upload failed:', result);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Run the test
testWasmUploadOnly().catch(console.error);