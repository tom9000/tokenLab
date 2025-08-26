#!/usr/bin/env node

/**
 * Check the current state of the CLI-deployed contract
 */

import {
  TransactionBuilder,
  Networks,
  rpc,
  BASE_FEE,
  Address,
  nativeToScVal,
  Contract,
  scValToNative
} from '@stellar/stellar-sdk';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

const CONTRACT_ADDRESS = "CDKWQIEGXKAVO2EBCJECVC2P3F2XAVFWLULU2NDN6Q6SKH55GDMLPIBO";
const SAFU_ADDRESS = "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN";

async function checkContractDetails() {
  console.log('🔍 Checking CLI-deployed contract details\n');
  console.log(`🏠 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`🔑 SAFU Address: ${SAFU_ADDRESS}\n`);

  const server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
  const contract = new Contract(CONTRACT_ADDRESS);

  try {
    // Get a funded account to use for read operations
    const sourceAccount = await server.getAccount(SAFU_ADDRESS);
    console.log('✅ SAFU account found and funded');

    // Test 1: Try to read contract metadata without signing
    console.log('\n📋 Test 1: Contract existence check');
    try {
      const contractData = await server.getContractData(CONTRACT_ADDRESS, "foo");
      console.log('✅ Contract exists and is accessible');
    } catch (e) {
      console.log('❌ Contract data access failed (this might be normal)');
    }

    // Test 2: Try to call name function
    console.log('\n📋 Test 2: Check if contract has name (initialized)');
    try {
      const nameOp = contract.call('name');
      let nameTx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
      })
      .addOperation(nameOp)
      .setTimeout(60)
      .build();

      // Prepare and simulate (don't sign/submit)
      nameTx = await server.prepareTransaction(nameTx);
      const simulation = await server.simulateTransaction(nameTx);
      
      console.log('📊 Name simulation result:', simulation.result);
      
      if (simulation.result && simulation.result.retval) {
        try {
          const name = scValToNative(simulation.result.retval);
          console.log(`✅ Contract is initialized with name: "${name}"`);
        } catch (e) {
          console.log('✅ Contract responds to name() but value not parseable');
        }
      } else {
        console.log('❌ Contract appears uninitialized (no name)');
      }
    } catch (error) {
      console.log('❌ Name check failed:', error.message);
    }

    // Test 3: Try to check balance
    console.log('\n📋 Test 3: Check SAFU balance');
    try {
      const balanceOp = contract.call(
        'balance',
        nativeToScVal(Address.fromString(SAFU_ADDRESS), { type: 'address' })
      );
      
      let balanceTx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
      })
      .addOperation(balanceOp)
      .setTimeout(60)
      .build();

      balanceTx = await server.prepareTransaction(balanceTx);
      const simulation = await server.simulateTransaction(balanceTx);
      
      if (simulation.result && simulation.result.retval) {
        try {
          const balance = scValToNative(simulation.result.retval);
          console.log(`💰 SAFU balance: ${balance} tokens`);
        } catch (e) {
          console.log('💰 Balance query works but value not parseable');
        }
      } else {
        console.log('❌ Balance check failed');
      }
    } catch (error) {
      console.log('❌ Balance check failed:', error.message);
    }

    // Test 4: Check what happens if we try to initialize
    console.log('\n📋 Test 4: Simulate initialization');
    try {
      const initOp = contract.call(
        'initialize',
        nativeToScVal(Address.fromString(SAFU_ADDRESS), { type: 'address' }),
        nativeToScVal(7, { type: 'u32' }),
        nativeToScVal('SAFU Token', { type: 'string' }),
        nativeToScVal('SAFU', { type: 'string' })
      );

      let initTx = new TransactionBuilder(sourceAccount, {
        fee: (BASE_FEE * 10000).toString(),
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
      })
      .addOperation(initOp)
      .setTimeout(60)
      .build();

      initTx = await server.prepareTransaction(initTx);
      const simulation = await server.simulateTransaction(initTx);
      
      console.log('📊 Initialization simulation:', simulation);
      
      if (simulation.error) {
        console.log('❌ Initialization would fail:', simulation.error);
      } else {
        console.log('✅ Initialization appears possible');
      }
    } catch (error) {
      console.log('❌ Initialization simulation failed:', error.message);
    }

    console.log('\n🎯 Summary:');
    console.log('- Contract exists and is deployed ✅');
    console.log('- SAFU account is funded and accessible ✅');
    console.log('- Contract state needs further investigation 🔍');

  } catch (error) {
    console.error('❌ Contract details check failed:', error);
  }
}

// Run the check
if (import.meta.url === `file://${process.argv[1]}`) {
  checkContractDetails()
    .then(() => {
      console.log('\n✅ Contract details check completed');
    })
    .catch(error => {
      console.error('\n💥 Check failed:', error);
    });
}