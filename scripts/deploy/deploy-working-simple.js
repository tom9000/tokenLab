#!/usr/bin/env node

/**
 * Working SEP-41 deployment using the direct return value approach
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
  Contract,
  scValToNative
} from '@stellar/stellar-sdk';
import fs from 'fs';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
  friendbotUrl: 'https://friendbot-futurenet.stellar.org'
};

async function deployWorkingContract() {
  console.log('🚀 Deploying SEP-41 contract (working approach)\n');
  
  // Generate a test keypair
  const testKeypair = Keypair.random();
  console.log(`🔑 Test keypair: ${testKeypair.publicKey()}`);
  
  // Fund the account
  console.log('💰 Funding account...');
  const fundResponse = await fetch(`${FUTURENET_CONFIG.friendbotUrl}?addr=${testKeypair.publicKey()}`);
  if (!fundResponse.ok) {
    throw new Error('Friendbot funding failed');
  }
  console.log('✅ Account funded');

  // Initialize server
  const server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);

  // Step 1: Upload WASM
  console.log('\n📤 Step 1: Uploading WASM...');
  
  const wasmPath = '/Users/mac/code/-scdev/tokenLab/contracts/sep41_token/target/wasm32-unknown-unknown/release/sep41_token.optimized.wasm';
  const wasmBuffer = fs.readFileSync(wasmPath);
  console.log(`📦 Loaded WASM (${wasmBuffer.length} bytes)`);

  const sourceAccount = await server.getAccount(testKeypair.publicKey());
  
  const uploadOp = Operation.uploadContractWasm({
    wasm: wasmBuffer,
  });

  let uploadTx = new TransactionBuilder(sourceAccount, {
    fee: (BASE_FEE * 100000).toString(),
    networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
  })
  .addOperation(uploadOp)
  .setTimeout(60)
  .build();

  uploadTx = await server.prepareTransaction(uploadTx);
  uploadTx.sign(testKeypair);
  
  let uploadResult = await server.sendTransaction(uploadTx);
  
  if (uploadResult.status === 'PENDING') {
    console.log('⏳ Waiting for WASM upload...');
    
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        uploadResult = await server.getTransaction(uploadResult.txHash);
        if (uploadResult.status === 'SUCCESS') {
          console.log('✅ WASM upload confirmed');
          break;
        } else if (uploadResult.status === 'FAILED') {
          throw new Error('WASM upload failed');
        }
      } catch (e) {
        console.log(`⏳ Still waiting... (${i + 1}/30)`);
      }
    }
  }

  if (uploadResult.status !== 'SUCCESS') {
    throw new Error(`WASM upload failed: ${uploadResult.status}`);
  }

  // Extract WASM hash from the direct returnValue
  let wasmHash;
  if (uploadResult.returnValue) {
    try {
      // The returnValue should be the WASM hash as bytes
      const hashBytes = scValToNative(uploadResult.returnValue);
      wasmHash = Buffer.from(hashBytes).toString('hex');
      console.log(`📦 WASM Hash: ${wasmHash}`);
    } catch (e) {
      console.log('Could not extract hash from returnValue, using tx hash');
      wasmHash = uploadResult.txHash;
    }
  } else {
    console.log('No returnValue, using tx hash as identifier');
    wasmHash = uploadResult.txHash;
  }

  // Step 2: Create contract instance
  console.log('\n🏗️ Step 2: Creating contract instance...');
  
  const sourceAccount2 = await server.getAccount(testKeypair.publicKey());
  
  // Use a deterministic salt
  const salt = Buffer.alloc(32);
  
  const createOp = Operation.createCustomContract({
    address: Address.fromString(testKeypair.publicKey()),
    wasmHash: Buffer.from(wasmHash, 'hex'),
    salt: salt
  });

  let createTx = new TransactionBuilder(sourceAccount2, {
    fee: (BASE_FEE * 50000).toString(),
    networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
  })
  .addOperation(createOp)
  .setTimeout(60)
  .build();

  createTx = await server.prepareTransaction(createTx);
  createTx.sign(testKeypair);
  
  let createResult = await server.sendTransaction(createTx);
  
  if (createResult.status === 'PENDING') {
    console.log('⏳ Waiting for contract creation...');
    
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        createResult = await server.getTransaction(createResult.txHash);
        if (createResult.status === 'SUCCESS') {
          console.log('✅ Contract creation confirmed');
          break;
        } else if (createResult.status === 'FAILED') {
          throw new Error('Contract creation failed');
        }
      } catch (e) {
        console.log(`⏳ Still waiting... (${i + 1}/30)`);
      }
    }
  }

  if (createResult.status !== 'SUCCESS') {
    throw new Error(`Contract creation failed: ${createResult.status}`);
  }

  // Extract contract address
  let contractAddress;
  if (createResult.returnValue) {
    try {
      contractAddress = Address.fromScVal(createResult.returnValue).toString();
      console.log(`🏠 Contract Address: ${contractAddress}`);
    } catch (e) {
      console.log('Could not extract contract address from returnValue');
    }
  }

  if (!contractAddress) {
    throw new Error('Failed to extract contract address');
  }

  // Step 3: Initialize the token
  console.log('\n⚙️ Step 3: Initializing token...');
  
  const contract = new Contract(contractAddress);
  const sourceAccount3 = await server.getAccount(testKeypair.publicKey());

  const initOp = contract.call(
    'initialize',
    Address.fromString(testKeypair.publicKey()), // admin
    nativeToScVal(7, { type: 'u32' }), // decimals
    nativeToScVal('TestToken', { type: 'string' }), // name
    nativeToScVal('TTK', { type: 'string' }), // symbol
    nativeToScVal('10000000', { type: 'i128' }), // maxSupply
    nativeToScVal(true, { type: 'bool' }), // isMintable
    nativeToScVal(true, { type: 'bool' }), // isBurnable
    nativeToScVal(false, { type: 'bool' }) // isFreezable
  );

  let initTx = new TransactionBuilder(sourceAccount3, {
    fee: (BASE_FEE * 10000).toString(),
    networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
  })
  .addOperation(initOp)
  .setTimeout(60)
  .build();

  initTx = await server.prepareTransaction(initTx);
  initTx.sign(testKeypair);
  
  let initResult = await server.sendTransaction(initTx);
  
  if (initResult.status === 'PENDING') {
    console.log('⏳ Waiting for initialization...');
    
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        initResult = await server.getTransaction(initResult.txHash);
        if (initResult.status === 'SUCCESS') {
          console.log('✅ Token initialization confirmed');
          break;
        } else if (initResult.status === 'FAILED') {
          throw new Error('Token initialization failed');
        }
      } catch (e) {
        console.log(`⏳ Still waiting... (${i + 1}/30)`);
      }
    }
  }

  if (initResult.status !== 'SUCCESS') {
    throw new Error(`Token initialization failed: ${initResult.status}`);
  }

  console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
  console.log('='.repeat(50));
  console.log(`📦 WASM Hash: ${wasmHash}`);
  console.log(`🏠 Contract Address: ${contractAddress}`);
  console.log(`🔑 Admin: ${testKeypair.publicKey()}`);
  console.log(`🔗 Explorer: https://futurenet.steexp.com/contract/${contractAddress}`);
  
  return {
    wasmHash,
    contractAddress,
    adminKeypair: testKeypair,
    network: 'futurenet'
  };
}

// Run the deployment
deployWorkingContract()
  .then(result => {
    console.log('\n✅ Full deployment completed successfully!');
    console.log('🚀 Ready for SAFU wallet integration!');
  })
  .catch(error => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });