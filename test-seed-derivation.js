#!/usr/bin/env node

/**
 * Test seed phrase derivation to verify CLI, Freighter, and our code produce same address
 */

import {
  Keypair
} from '@stellar/stellar-sdk';
import * as bip39 from 'bip39';
import * as ed25519 from 'ed25519-hd-key';

// Test seed phrase
const TEST_SEED = "humor initial toddler bitter elite fury gospel addict water cattle slush card";
const EXPECTED_ADDRESS = "GBU2KCWUTTRJEFIPCBICXJK2XOIJGJLRGDMAWXLW2PDPFBQ7LD56XN3E";

function testSeedDerivation() {
  console.log('🧪 Testing Seed Phrase Derivation\n');
  console.log(`📝 Seed: ${TEST_SEED}`);
  console.log(`🎯 Expected: ${EXPECTED_ADDRESS}\n`);

  try {
    // Method 1: BIP39 + ED25519 derivation (standard Stellar path)
    console.log('🔍 Method 1: BIP39 + ED25519 (Stellar standard)');
    const seed = bip39.mnemonicToSeedSync(TEST_SEED);
    const derivedSeed = ed25519.derivePath("m/44'/148'/0'", seed.toString('hex'));
    const keypair1 = Keypair.fromRawEd25519Seed(derivedSeed.key);
    const address1 = keypair1.publicKey();
    console.log(`📍 Derived: ${address1}`);
    console.log(`✅ Match: ${address1 === EXPECTED_ADDRESS ? 'YES' : 'NO'}\n`);

    // Method 2: Try different derivation paths
    console.log('🔍 Method 2: Different derivation paths');
    
    const paths = [
      "m/44'/148'/0'",      // Standard Stellar
      "m/44'/148'/0'/0'",   // Extended path
      "m/44'/148'/0'/0/0'", // Full BIP44 path
      "m/44'/148'/1'",      // Account 1
    ];

    paths.forEach((path, index) => {
      try {
        const derivedSeed = ed25519.derivePath(path, seed.toString('hex'));
        const keypair = Keypair.fromRawEd25519Seed(derivedSeed.key);
        const address = keypair.publicKey();
        console.log(`Path ${path}: ${address} ${address === EXPECTED_ADDRESS ? '✅' : '❌'}`);
      } catch (e) {
        console.log(`Path ${path}: Error - ${e.message}`);
      }
    });

    // Method 3: Direct seed conversion (no derivation)
    console.log('\n🔍 Method 3: Direct seed conversion');
    try {
      const directKeypair = Keypair.fromSecret(seed.slice(0, 32));
      const directAddress = directKeypair.publicKey();
      console.log(`📍 Direct: ${directAddress}`);
      console.log(`✅ Match: ${directAddress === EXPECTED_ADDRESS ? 'YES' : 'NO'}`);
    } catch (e) {
      console.log(`❌ Direct method failed: ${e.message}`);
    }

    // Method 4: Check seed validity
    console.log('\n🔍 Method 4: Seed validation');
    const isValid = bip39.validateMnemonic(TEST_SEED);
    console.log(`📋 Seed valid: ${isValid ? 'YES' : 'NO'}`);
    
    if (isValid) {
      const entropy = bip39.mnemonicToEntropy(TEST_SEED);
      console.log(`📊 Entropy: ${entropy}`);
      console.log(`📊 Seed length: ${seed.length} bytes`);
    }

    return {
      testSeed: TEST_SEED,
      expectedAddress: EXPECTED_ADDRESS,
      derivedAddress: address1,
      matches: address1 === EXPECTED_ADDRESS,
      seedValid: isValid
    };

  } catch (error) {
    console.error('❌ Derivation test failed:', error);
    throw error;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = testSeedDerivation();
  
  console.log('\n🎯 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Expected: ${result.expectedAddress}`);
  console.log(`Derived:  ${result.derivedAddress}`);
  console.log(`Match:    ${result.matches ? '✅ YES' : '❌ NO'}`);
  
  if (result.matches) {
    console.log('\n🎉 SUCCESS: CLI and our derivation match!');
    console.log('✅ Seed phrase derivation is consistent');
  } else {
    console.log('\n⚠️ MISMATCH: Different derivation method needed');
    console.log('🔧 May need to adjust derivation path or method');
  }
  
  process.exit(result.matches ? 0 : 1);
}

export { testSeedDerivation };