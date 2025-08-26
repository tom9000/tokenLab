#!/usr/bin/env node

/**
 * Corrected SEP-41 deployment using SAFU wallet with proper Stellar CLI approach
 */

import {
  TransactionBuilder,
  Networks,
  Operation,
  rpc,
  BASE_FEE,
  Address,
  nativeToScVal,
  Contract
} from '@stellar/stellar-sdk';
import fs from 'fs';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// Fresh authentication data
const AUTH_DATA = {
  accessToken: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzZXNzaW9uSWQiOiJhZ2VudF9zZXNzaW9uXzE3NTM3MjExNjA3ODBfdHA0aTJvenJwIiwic3ViIjoiR0RKVktWRTM2QzIyUlJOUlVMN0tLV0hTR1JLR1k2UUE1SFRURUZDQVFMVFZHNEhLRVlJNE81RE4iLCJpYXQiOjE3NTM3MjExNjAsImV4cCI6MTc1MzcyMjk2MCwiaXNzIjoic2FmdS13YWxsZXQiLCJhdWQiOiJzYWZ1LXdhbGxldC1jbGllbnQiLCJ0eXBlIjoiYWNjZXNzIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDozMDA1IiwiYXBwTmFtZSI6IlRva2VuIExhYiIsIm1vZGUiOiJhZ2VudCJ9.",
  sessionPassword: "password123",
  encryptedSeed: "mock_encrypted_mnemonic_data_for_testing",
  publicKey: "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN"
};

// WASM hash from successful CLI deployment
const KNOWN_WASM_HASH = "bfbd693f13b4341603d6812f08b88a434c557f7af84412ab2c47cc33477f109c";

class CorrectedSAFUDeployer {
  constructor() {
    this.server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
  }

  async signWithSAFU(transactionXdr, description) {
    console.log(`🔐 Signing: ${description}`);
    
    const response = await fetch('http://localhost:3003/api/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionXdr,
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
        network: 'futurenet',
        description,
        appName: 'Token Lab',
        mode: 'agent',
        origin: 'http://localhost:3005',
        accessToken: AUTH_DATA.accessToken,
        sessionPassword: AUTH_DATA.sessionPassword,
        encryptedSeed: AUTH_DATA.encryptedSeed
      })
    });

    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(`SAFU signing failed: ${result.error}`);
    }

    console.log('✅ Signed successfully');
    return result.signedTransactionXdr;
  }

  async deployTokenContract() {
    console.log('🚀 Deploying SEP-41 contract using corrected approach\n');

    try {
      // Step 1: Deploy contract using the known WASM hash (like CLI does)
      console.log('🏗️ Step 1: Deploying contract instance...');
      const contractAddress = await this.deployContractInstance();
      console.log(`✅ Contract deployed: ${contractAddress}`);

      // Step 2: Initialize the token
      console.log('\n⚙️ Step 2: Initializing token...');
      await this.initializeToken(contractAddress);
      console.log('✅ Token initialized');

      const deploymentInfo = {
        contractAddress,
        wasmHash: KNOWN_WASM_HASH,
        adminAddress: AUTH_DATA.publicKey,
        network: 'futurenet',
        explorer: `https://futurenet.steexp.com/contract/${contractAddress}`
      };

      console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
      console.log('='.repeat(50));
      console.log(`📦 WASM Hash: ${KNOWN_WASM_HASH}`);
      console.log(`🏠 Contract: ${contractAddress}`);
      console.log(`🔑 Admin: ${AUTH_DATA.publicKey}`);
      console.log(`🔗 Explorer: ${deploymentInfo.explorer}`);

      return deploymentInfo;

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  async deployContractInstance() {
    // Get source account
    const sourceAccount = await this.server.getAccount(AUTH_DATA.publicKey);
    console.log(`📊 Account sequence: ${sourceAccount.sequenceNumber()}`);

    // Use the Stellar CLI approach: deploy operation with existing WASM hash
    const deployOp = Operation.createCustomContract({
      address: Address.fromString(AUTH_DATA.publicKey),
      wasmHash: Buffer.from(KNOWN_WASM_HASH, 'hex'),
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

    // Prepare transaction (this is what CLI does)
    deployTx = await this.server.prepareTransaction(deployTx);
    const deployTxXdr = deployTx.toXDR();

    // Sign with SAFU wallet
    const signedXdr = await this.signWithSAFU(deployTxXdr, 'Deploy SEP-41 Contract Instance');

    // Submit transaction
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    let deployResult = await this.server.sendTransaction(signedTx);

    console.log(`📊 Deploy result: ${deployResult.status}`);

    // Handle pending result
    if (deployResult.status === 'PENDING') {
      console.log('⏳ Waiting for deployment...');
      
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          deployResult = await this.server.getTransaction(deployResult.txHash);
          if (deployResult.status === 'SUCCESS') {
            console.log('✅ Deployment confirmed');
            break;
          } else if (deployResult.status === 'FAILED') {
            throw new Error('Deployment failed');
          }
        } catch (e) {
          console.log(`⏳ Waiting... (${i + 1}/30)`);
        }
      }
    }

    if (deployResult.status !== 'SUCCESS') {
      console.log('❌ Deploy result:', deployResult);
      throw new Error(`Contract deployment failed: ${deployResult.status}`);
    }

    // Extract contract address from result
    if (deployResult.returnValue) {
      try {
        return Address.fromScVal(deployResult.returnValue).toString();
      } catch (e) {
        console.log('Could not extract address from returnValue');
      }
    }

    throw new Error('Failed to extract contract address');
  }

  async initializeToken(contractAddress) {
    const contract = new Contract(contractAddress);
    const sourceAccount = await this.server.getAccount(AUTH_DATA.publicKey);

    // Build initialize operation
    const initOp = contract.call(
      'initialize',
      Address.fromString(AUTH_DATA.publicKey), // admin
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

    // Prepare transaction
    initTx = await this.server.prepareTransaction(initTx);
    const initTxXdr = initTx.toXDR();

    // Sign with SAFU wallet
    const signedXdr = await this.signWithSAFU(initTxXdr, 'Initialize SAFU Token');

    // Submit transaction
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    let initResult = await this.server.sendTransaction(signedTx);

    // Handle pending result
    if (initResult.status === 'PENDING') {
      console.log('⏳ Waiting for initialization...');
      
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          initResult = await this.server.getTransaction(initResult.txHash);
          if (initResult.status === 'SUCCESS') {
            console.log('✅ Initialization confirmed');
            break;
          } else if (initResult.status === 'FAILED') {
            throw new Error('Initialization failed');
          }
        } catch (e) {
          console.log(`⏳ Waiting... (${i + 1}/30)`);
        }
      }
    }

    if (initResult.status !== 'SUCCESS') {
      throw new Error(`Token initialization failed: ${initResult.status}`);
    }

    return initResult;
  }
}

// Test the corrected deployment
async function testCorrectedDeployment() {
  console.log('🧪 Testing corrected SAFU wallet deployment\n');

  const deployer = new CorrectedSAFUDeployer();
  
  try {
    const result = await deployer.deployTokenContract();
    
    console.log('\n🎊 SUCCESS: SAFU wallet deployment completed!');
    console.log('🚀 SEP-41 token deployed and initialized via SAFU wallet!');
    
    return result;
    
  } catch (error) {
    console.error('\n❌ Corrected deployment failed:', error);
    throw error;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testCorrectedDeployment()
    .then(result => {
      console.log('\n✅ FINAL SUCCESS: End-to-end SAFU wallet deployment!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Still having issues with deployment');
      process.exit(1);
    });
}

export { CorrectedSAFUDeployer };