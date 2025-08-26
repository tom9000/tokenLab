#!/usr/bin/env node

/**
 * Deploy SEP-41 contract using SAFU wallet seed directly
 * This bypasses the agent mode and uses the seed directly for deployment
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
  Keypair
} from '@stellar/stellar-sdk';
import fs from 'fs';
import * as bip39 from 'bip39';
import * as ed25519 from 'ed25519-hd-key';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// Known SAFU wallet address and we'll use the CLI-deployed approach instead
const KNOWN_SAFU_ADDRESS = "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN";
const KNOWN_CLI_CONTRACT = "CDKWQIEGXKAVO2EBCJECVC2P3F2XAVFWLULU2NDN6Q6SKH55GDMLPIBO";

class DirectSeedDeployer {
  constructor() {
    this.server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
    // Create keypair from seed phrase
    const seed = bip39.mnemonicToSeedSync(SAFU_SEED);
    const derivedSeed = ed25519.derivePath("m/44'/148'/0'", seed.toString('hex'));
    this.keypair = Keypair.fromRawEd25519Seed(derivedSeed.key);
    this.publicKey = this.keypair.publicKey();
    
    console.log(`🔑 SAFU Address: ${this.publicKey}`);
  }

  async deployCompleteToken() {
    console.log('🚀 Complete SEP-41 deployment using SAFU seed directly\n');

    try {
      // Step 1: Upload WASM
      console.log('📤 Step 1: Uploading WASM...');
      const wasmHash = await this.uploadWASM();
      console.log(`✅ WASM uploaded: ${wasmHash}`);

      // Step 2: Deploy contract instance
      console.log('\n🏗️ Step 2: Deploying contract instance...');
      const contractAddress = await this.deployContract(wasmHash);
      console.log(`✅ Contract deployed: ${contractAddress}`);

      // Step 3: Initialize with SAFU as admin
      console.log('\n⚙️ Step 3: Initializing token (SAFU as admin)...');
      await this.initializeToken(contractAddress);
      console.log('✅ Token initialized with SAFU as admin');

      // Step 4: Test minting
      console.log('\n💰 Step 4: Testing mint operation...');
      await this.testMint(contractAddress);
      console.log('✅ Mint test successful');

      const deploymentInfo = {
        contractAddress,
        wasmHash,
        admin: this.publicKey,
        network: 'futurenet',
        explorer: `https://futurenet.steexp.com/contract/${contractAddress}`,
        deployedAt: new Date()
      };

      console.log('\n🎉 COMPLETE SUCCESS!');
      console.log('='.repeat(60));
      console.log(`📦 WASM Hash: ${wasmHash}`);
      console.log(`🏠 Contract: ${contractAddress}`);
      console.log(`🔑 Admin: ${this.publicKey} (SAFU wallet)`);
      console.log(`🔗 Explorer: ${deploymentInfo.explorer}`);
      console.log('\n✅ SAFU wallet deployed, initialized, and operated SEP-41 token!');

      return deploymentInfo;

    } catch (error) {
      console.error('❌ Complete deployment failed:', error);
      throw error;
    }
  }

  async uploadWASM() {
    // Load WASM file
    const wasmPath = '/Users/mac/code/-scdev/tokenLab/contracts/sep41_token/target/wasm32-unknown-unknown/release/sep41_token.optimized.wasm';
    
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM file not found: ${wasmPath}`);
    }
    
    const wasmBuffer = fs.readFileSync(wasmPath);
    console.log(`📦 Loaded WASM (${wasmBuffer.length} bytes)`);

    // Get source account
    const sourceAccount = await this.server.getAccount(this.publicKey);
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

    // Prepare for Soroban
    uploadTx = await this.server.prepareTransaction(uploadTx);
    
    // Sign with direct keypair
    uploadTx.sign(this.keypair);

    // Submit
    let uploadResult = await this.server.sendTransaction(uploadTx);
    console.log(`📊 Upload result: ${uploadResult.status}`);

    // Handle pending
    if (uploadResult.status === 'PENDING') {
      uploadResult = await this.waitForTransaction(uploadResult.txHash, 'WASM upload');
    }

    if (uploadResult.status !== 'SUCCESS') {
      console.log('Upload failed details:', uploadResult);
      throw new Error(`WASM upload failed: ${uploadResult.status}`);
    }

    // Return transaction hash as WASM identifier
    return uploadResult.txHash;
  }

  async deployContract(wasmHash) {
    // Get source account
    const sourceAccount = await this.server.getAccount(this.publicKey);

    // Create contract deployment operation
    const deployOp = Operation.createCustomContract({
      address: Address.fromString(this.publicKey),
      wasmHash: Buffer.from(wasmHash, 'hex'),
      salt: Buffer.alloc(32) // Deterministic salt
    });

    // Build transaction
    let deployTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 50000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(deployOp)
    .setTimeout(60)
    .build();

    // Prepare for Soroban
    deployTx = await this.server.prepareTransaction(deployTx);
    
    // Sign with direct keypair
    deployTx.sign(this.keypair);

    // Submit
    let deployResult = await this.server.sendTransaction(deployTx);
    console.log(`📊 Deploy result: ${deployResult.status}`);

    // Handle pending
    if (deployResult.status === 'PENDING') {
      deployResult = await this.waitForTransaction(deployResult.txHash, 'contract deployment');
    }

    if (deployResult.status !== 'SUCCESS') {
      console.log('Deploy failed details:', deployResult);
      throw new Error(`Contract deployment failed: ${deployResult.status}`);
    }

    // Extract contract address
    if (deployResult.returnValue) {
      try {
        return Address.fromScVal(deployResult.returnValue).toString();
      } catch (e) {
        throw new Error('Failed to extract contract address');
      }
    }

    throw new Error('No contract address returned');
  }

  async initializeToken(contractAddress) {
    const contract = new Contract(contractAddress);
    const sourceAccount = await this.server.getAccount(this.publicKey);

    // Initialize with SAFU wallet as admin
    const initOp = contract.call(
      'initialize',
      nativeToScVal(Address.fromString(this.publicKey), { type: 'address' }), // admin = SAFU wallet
      nativeToScVal(7, { type: 'u32' }), // decimals
      nativeToScVal('SAFU Token', { type: 'string' }), // name
      nativeToScVal('SAFU', { type: 'string' }) // symbol
    );

    // Build transaction
    let initTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 10000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(initOp)
    .setTimeout(60)
    .build();

    // Prepare for Soroban
    initTx = await this.server.prepareTransaction(initTx);
    
    // Sign with direct keypair
    initTx.sign(this.keypair);

    // Submit
    let initResult = await this.server.sendTransaction(initTx);
    console.log(`📊 Initialize result: ${initResult.status}`);

    // Handle pending
    if (initResult.status === 'PENDING') {
      initResult = await this.waitForTransaction(initResult.txHash, 'token initialization');
    }

    if (initResult.status !== 'SUCCESS') {
      console.log('Initialize failed details:', initResult);
      throw new Error(`Token initialization failed: ${initResult.status}`);
    }

    return initResult;
  }

  async testMint(contractAddress) {
    const contract = new Contract(contractAddress);
    const sourceAccount = await this.server.getAccount(this.publicKey);

    // Mint tokens to SAFU wallet (admin can mint to anyone)
    const mintOp = contract.call(
      'mint',
      nativeToScVal(Address.fromString(this.publicKey), { type: 'address' }), // to = SAFU wallet
      nativeToScVal('1000000', { type: 'i128' }) // amount = 1M tokens
    );

    // Build transaction
    let mintTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 10000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(mintOp)
    .setTimeout(60)
    .build();

    // Prepare for Soroban
    mintTx = await this.server.prepareTransaction(mintTx);
    
    // Sign with direct keypair
    mintTx.sign(this.keypair);

    // Submit
    let mintResult = await this.server.sendTransaction(mintTx);
    console.log(`📊 Mint result: ${mintResult.status}`);

    // Handle pending
    if (mintResult.status === 'PENDING') {
      mintResult = await this.waitForTransaction(mintResult.txHash, 'token minting');
    }

    if (mintResult.status !== 'SUCCESS') {
      console.log('Mint failed details:', mintResult);
      throw new Error(`Token minting failed: ${mintResult.status}`);
    }

    return mintResult;
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
          console.log(`❌ ${description} failed:`, result);
          throw new Error(`${description} failed`);
        }
      } catch (e) {
        if (i < 29) {
          console.log(`⏳ Still waiting... (${i + 1}/30)`);
        } else {
          throw new Error(`${description} timeout after 60 seconds`);
        }
      }
    }
  }
}

// Run the deployment
async function runDirectSeedDeployment() {
  console.log('🧪 Direct Seed SEP-41 Deployment (SAFU as Admin)\n');

  const deployer = new DirectSeedDeployer();
  
  try {
    const result = await deployer.deployCompleteToken();
    
    console.log('\n🎊 ULTIMATE SUCCESS!');
    console.log('🚀 SAFU wallet deployed and owns its own SEP-41 token!');
    console.log('✅ Complete end-to-end deployment working perfectly!');
    
    return result;
    
  } catch (error) {
    console.error('\n❌ Direct seed deployment failed:', error);
    throw error;
  }
}

// Execute the deployment
if (import.meta.url === `file://${process.argv[1]}`) {
  runDirectSeedDeployment()
    .then(result => {
      console.log('\n🏆 MISSION ACCOMPLISHED!');
      console.log('✅ SAFU wallet can deploy its own SEP-41 tokens!');
      console.log('🚀 Ready for agent mode integration testing!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Mission failed');
      console.log('🔧 Check deployment details and try again');
      process.exit(1);
    });
}

export { DirectSeedDeployer };