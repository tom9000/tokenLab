#!/usr/bin/env node

/**
 * Test the correct derivation path that matches CLI and Freighter
 */

import { deriveAddressFromMnemonic, verifyMnemonicAddress, deriveMultipleAddresses } from './stellar-wallet-utils.js';

// Test cases
const testCases = [
  {
    seed: "humor initial toddler bitter elite fury gospel addict water cattle slush card",
    expected: "GBU2KCWUTTRJEFIPCBICXJK2XOIJGJLRGDMAWXLW2PDPFBQ7LD56XN3E",
    accountIndex: 0
  },
  {
    seed: "boost attract swear maple usual fix sentence march sustain disorder bundle reduce rebel area tide such maple exotic claw outdoor delay second lyrics swap",  
    expected: "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN",
    accountIndex: 0
  }
];

async function testCorrectDerivation() {
  console.log('🧪 Testing Correct Stellar Address Derivation\n');

  for (const testCase of testCases) {
    console.log(`📝 Testing seed: ${testCase.seed.substring(0, 30)}...`);
    console.log(`🎯 Expected: ${testCase.expected}`);
    
    try {
      // Test derivation
      const { address, keypair } = deriveAddressFromMnemonic(testCase.seed, testCase.accountIndex);
      console.log(`📍 Derived:  ${address}`);
      
      const matches = address === testCase.expected;
      console.log(`✅ Match: ${matches ? 'YES' : 'NO'}`);
      
      // Test verification function
      const verified = verifyMnemonicAddress(testCase.seed, testCase.expected, testCase.accountIndex);
      console.log(`🔍 Verified: ${verified ? 'YES' : 'NO'}`);
      
      // Show multiple addresses for context
      console.log('📋 Multiple addresses from this seed:');
      const addresses = deriveMultipleAddresses(testCase.seed, 3);
      addresses.forEach(({ index, address }) => {
        const marker = address === testCase.expected ? ' ← EXPECTED' : '';
        console.log(`   [${index}] ${address}${marker}`);
      });
      
      if (!matches) {
        console.log('❌ DERIVATION MISMATCH - Check derivation path');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Derivation failed:', error);
      return false;
    }
    
    console.log(''); // blank line
  }
  
  console.log('🎉 ALL DERIVATIONS SUCCESSFUL!');
  console.log('✅ Our code matches CLI and Freighter derivation');
  console.log('✅ Seed phrase handling is consistent');
  
  return true;
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testCorrectDerivation()
    .then(success => {
      if (success) {
        console.log('\n🏆 SUCCESS: Address derivation is correct!');
        process.exit(0);
      } else {
        console.log('\n💥 FAILURE: Address derivation needs fixing');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}