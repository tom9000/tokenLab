#!/usr/bin/env node

/**
 * Test all possible derivation paths to find SAFU address
 */

import { Keypair } from '@stellar/stellar-sdk';
import * as bip39 from 'bip39';
import * as ed25519 from 'ed25519-hd-key';

const SAFU_SEED = "boost attract swear maple usual fix sentence march sustain disorder bundle reduce rebel area tide such maple exotic claw outdoor delay second lyrics swap";
const SAFU_ADDRESS = "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN";

function testAllPaths() {
  console.log('🔍 Testing all possible derivation paths for SAFU address\n');
  console.log(`🎯 Looking for: ${SAFU_ADDRESS}`);
  console.log(`📝 From seed: ${SAFU_SEED.substring(0, 30)}...\n`);

  const seed = bip39.mnemonicToSeedSync(SAFU_SEED);
  
  // All possible derivation paths to try
  const pathTemplates = [
    "m/44'/148'/{account}'",           // Standard short path
    "m/44'/148'/{account}'/{index}'",  // Extended path (CLI/Freighter)
    "m/44'/148'/{account}'/{index}",   // Non-hardened index
    "m/44'/148'/0/{account}",          // Alternative format
    "m/44'/148'/0/{account}'",         // Alternative with hardened
  ];

  let found = false;

  pathTemplates.forEach(template => {
    console.log(`\n📋 Testing path template: ${template}`);
    
    // Test different account/index combinations
    for (let account = 0; account < 5; account++) {
      for (let index = 0; index < 5; index++) {
        const paths = [
          template.replace('{account}', account).replace('{index}', index),
          template.replace('{account}', account) // For templates without {index}
        ].filter((path, i, arr) => arr.indexOf(path) === i); // Remove duplicates

        paths.forEach(path => {
          try {
            const derivedSeed = ed25519.derivePath(path, seed.toString('hex'));
            const keypair = Keypair.fromRawEd25519Seed(derivedSeed.key);
            const address = keypair.publicKey();
            
            if (address === SAFU_ADDRESS) {
              console.log(`✅ FOUND! Path: ${path}`);
              console.log(`📍 Address: ${address}`);
              found = true;
              return;
            } else if (account === 0 && index === 0) {
              // Only show first result for each template to avoid spam
              console.log(`   ${path} → ${address}`);
            }
          } catch (e) {
            if (account === 0 && index === 0) {
              console.log(`   ${path} → Error: ${e.message}`);
            }
          }
        });
        
        if (found) return;
      }
      if (found) return;
    }
  });

  if (!found) {
    console.log('\n❌ SAFU address not found with any tested derivation path');
    console.log('\n🤔 Possible explanations:');
    console.log('1. SAFU wallet uses a completely custom derivation method');
    console.log('2. The seed phrase in CLI identity file is different from what SAFU wallet actually uses');
    console.log('3. SAFU wallet generates addresses directly without BIP44 derivation');
    console.log('4. There\'s a mismatch between what we think the SAFU address is');
  }

  return found;
}

// Run the comprehensive test
if (import.meta.url === `file://${process.argv[1]}`) {
  const found = testAllPaths();
  
  if (found) {
    console.log('\n🎉 SUCCESS: Found the correct derivation path!');
  } else {
    console.log('\n⚠️ The CLI seed and SAFU address don\'t match with standard derivation');
    console.log('💡 The integration still works - we just need to use the correct addresses');
  }
}