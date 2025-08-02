#!/usr/bin/env node

/**
 * Mint SEP-41 tokens to a specific address using SAFU wallet
 */

import {
  TransactionBuilder,
  Networks,
  rpc,
  BASE_FEE,
  Address,
  nativeToScVal,
  Contract
} from '@stellar/stellar-sdk';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// Your deployed contract
const CONTRACT_ADDRESS = "CDKWQIEGXKAVO2EBCJECVC2P3F2XAVFWLULU2NDN6Q6SKH55GDMLPIBO";

// Authentication data for SAFU wallet
const AUTH_DATA = {
  accessToken: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzZXNzaW9uSWQiOiJhZ2VudF9zZXNzaW9uXzE3NTM3MjExNjA3ODBfdHA0aTJvenJwIiwic3ViIjoiR0RKVktWRTM2QzIyUlJOUlVMN0tLV0hTR1JLR1k2UUE1SFRURUZDQVFMVFZHNEhLRVlJNE81RE4iLCJpYXQiOjE3NTM3MjExNjAsImV4cCI6MTc1MzcyMjk2MCwiaXNzIjoic2FmdS13YWxsZXQiLCJhdWQiOiJzYWZ1LXdhbGxldC1jbGllbnQiLCJ0eXBlIjoiYWNjZXNzIiwib3JpZ2luIjoiaHR0cDovL2xvY2FsaG9zdDozMDA1IiwiYXBwTmFtZSI6IlRva2VuIExhYiIsIm1vZGUiOiJhZ2VudCJ9.",
  sessionPassword: "password123",
  encryptedSeed: "mock_encrypted_mnemonic_data_for_testing",
  publicKey: "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN"
};

class TokenMinter {
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

    console.log('✅ Signed by SAFU wallet');
    return result.signedTransactionXdr;
  }

  async mintTokens(toAddress, amount) {
    console.log(`💰 Minting ${amount} tokens to ${toAddress}`);
    
    const contract = new Contract(CONTRACT_ADDRESS);
    const sourceAccount = await this.server.getAccount(AUTH_DATA.publicKey);

    // Build mint operation
    const mintOp = contract.call(
      'mint',
      nativeToScVal(Address.fromString(toAddress), { type: 'address' }), // to
      nativeToScVal(amount, { type: 'i128' }) // amount
    );

    // Build transaction
    let mintTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 10000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(mintOp)
    .setTimeout(60)
    .build();

    // Prepare transaction
    console.log('📋 Preparing mint transaction...');
    mintTx = await this.server.prepareTransaction(mintTx);
    const mintTxXdr = mintTx.toXDR();

    // Sign with SAFU wallet
    const signedXdr = await this.signWithSAFU(mintTxXdr, `Mint ${amount} tokens to ${toAddress}`);

    // Submit transaction
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    let mintResult = await this.server.sendTransaction(signedTx);

    console.log(`📊 Mint result: ${mintResult.status}`);
    console.log(`🔗 TX Hash: ${mintResult.txHash}`);

    // Handle pending result
    if (mintResult.status === 'PENDING') {
      console.log('⏳ Waiting for confirmation...');
      
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          mintResult = await this.server.getTransaction(mintResult.txHash);
          if (mintResult.status === 'SUCCESS') {
            console.log('✅ Mint confirmed!');
            console.log(`🔗 Explorer: https://futurenet.stellarchain.io/transactions/${mintResult.txHash}`);
            return mintResult;
          } else if (mintResult.status === 'FAILED') {
            console.log('❌ Mint failed:', mintResult);
            throw new Error('Token minting failed');
          }
        } catch (e) {
          console.log(`⏳ Waiting... (${i + 1}/30)`);
        }
      }
      
      throw new Error('Mint timeout');
    } else if (mintResult.status === 'SUCCESS') {
      console.log('✅ Mint successful!');
      console.log(`🔗 Explorer: https://futurenet.stellarchain.io/transactions/${mintResult.txHash}`);
      return mintResult;
    } else {
      console.log('❌ Mint failed:', mintResult);
      throw new Error(`Token minting failed: ${mintResult.status}`);
    }
  }

  async getBalance(address) {
    console.log(`📊 Checking balance for ${address}`);
    
    const contract = new Contract(CONTRACT_ADDRESS);
    const sourceAccount = await this.server.getAccount(AUTH_DATA.publicKey);

    // Build balance query operation
    const balanceOp = contract.call(
      'balance',
      nativeToScVal(Address.fromString(address), { type: 'address' })
    );

    // Build transaction for simulation
    let balanceTx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE.toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(balanceOp)
    .setTimeout(60)
    .build();

    // Simulate the transaction to get balance
    const simResult = await this.server.simulateTransaction(balanceTx);
    
    if (simResult.result && simResult.result.retval) {
      const balance = simResult.result.retval.value();
      console.log(`💰 Balance: ${balance} tokens`);
      return balance;
    } else {
      console.log('❌ Failed to get balance');
      return null;
    }
  }
}

// Main execution
async function main() {
  const minter = new TokenMinter();
  const targetAddress = "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN";
  const amount = "1000000"; // 1 million tokens (with 7 decimals = 0.1 actual tokens)

  try {
    console.log('🚀 Starting token mint operation');
    console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`🎯 Target: ${targetAddress}`);
    console.log(`💰 Amount: ${amount}\n`);

    // Check balance before
    console.log('📊 Balance before minting:');
    await minter.getBalance(targetAddress);

    // Mint tokens
    const result = await minter.mintTokens(targetAddress, amount);
    
    // Check balance after
    console.log('\n📊 Balance after minting:');
    await minter.getBalance(targetAddress);

    console.log('\n🎉 SUCCESS! Tokens minted successfully!');
    
  } catch (error) {
    console.error('\n❌ Minting failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}