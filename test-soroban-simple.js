#!/usr/bin/env node

/**
 * Test simple Soroban operation to verify basic functionality
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
  Contract
} from '@stellar/stellar-sdk';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// Authentication data
const AUTH_DATA = {
  publicKey: "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN"
};

async function testSorobanConnection() {
  console.log('🧪 Testing basic Soroban RPC connection...');
  
  try {
    // Initialize Soroban RPC server
    const server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
    console.log('✅ Connected to Futurenet RPC');
    
    // Get account details
    const sourceAccount = await server.getAccount(AUTH_DATA.publicKey);
    console.log('✅ Retrieved account from Futurenet');
    console.log(`📊 Account sequence: ${sourceAccount.sequenceNumber()}`);
    
    // Check account balance
    for (const balance of sourceAccount.balances) {
      if (balance.asset_type === 'native') {
        console.log(`💰 Native balance: ${balance.balance} XLM`);
      }
    }
    
    // Get latest ledger info
    const latestLedger = await server.getLatestLedger();
    console.log(`📊 Latest ledger: ${latestLedger.sequence}`);
    
    // Test basic Soroban functionality - get network info
    try {
      const network = await server.getNetwork();
      console.log(`🌐 Network passphrase: ${network.networkPassphrase}`);
      console.log(`📋 Soroban version: ${network.sorobanVersion || 'unknown'}`);
    } catch (e) {
      console.log('⚠️ Could not get network info:', e.message);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error testing Soroban connection:', error);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing Soroban Basic Functionality\n');
  
  const connectionOk = await testSorobanConnection();
  
  if (connectionOk) {
    console.log('\n✅ Soroban connection test passed!');
    console.log('🚀 Ready to attempt contract operations.');
  } else {
    console.log('\n❌ Soroban connection test failed!');
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);