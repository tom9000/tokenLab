#!/usr/bin/env node

/**
 * Find which account index produces the SAFU address
 */

import { deriveMultipleAddresses } from './stellar-wallet-utils.js';

const SAFU_SEED = "boost attract swear maple usual fix sentence march sustain disorder bundle reduce rebel area tide such maple exotic claw outdoor delay second lyrics swap";
const SAFU_ADDRESS = "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN";

function findSAFUAddress() {
  console.log('🔍 Searching for SAFU address in derivation path...\n');
  console.log(`🎯 Looking for: ${SAFU_ADDRESS}`);
  console.log(`📝 From seed: ${SAFU_SEED.substring(0, 30)}...\n`);

  // Check first 20 account indices
  const addresses = deriveMultipleAddresses(SAFU_SEED, 20);
  
  let found = false;
  addresses.forEach(({ index, address }) => {
    const isMatch = address === SAFU_ADDRESS;
    const marker = isMatch ? ' ✅ FOUND!' : '';
    console.log(`[${index.toString().padStart(2)}] ${address}${marker}`);
    
    if (isMatch) {
      found = true;
      console.log(`\n🎉 SAFU address found at account index: ${index}`);
    }
  });

  if (!found) {
    console.log('\n❌ SAFU address not found in first 20 accounts');
    console.log('🔧 The address might be:');
    console.log('   1. From a different derivation path');
    console.log('   2. From a different seed phrase');  
    console.log('   3. From a custom derivation method');
    console.log('   4. Generated outside of BIP44 standard');
  }

  return found;
}

// Run the search
if (import.meta.url === `file://${process.argv[1]}`) {
  const found = findSAFUAddress();
  process.exit(found ? 0 : 1);
}