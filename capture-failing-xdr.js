#!/usr/bin/env node

/**
 * Capture Failing XDR Script
 * Reproduces the upload contract WASM operation that causes XDR union switch errors
 */

import { 
  Keypair, 
  Networks, 
  TransactionBuilder, 
  Operation, 
  Asset,
  Account,
  BASE_FEE,
  xdr
} from '@stellar/stellar-sdk';
import { readFileSync } from 'fs';
import { XDRInspector } from './xdr-inspector.js';

async function createFailingXDR() {
  console.log('=== Creating XDR that causes "Bad union switch: 1" error ===\n');

  try {
    // Read the WASM file
    let wasmBuffer;
    try {
      wasmBuffer = readFileSync('./contracts/sep41_token/target/wasm32-unknown-unknown/release/sep41_token.wasm');
      console.log(`✅ WASM file loaded: ${wasmBuffer.length} bytes`);
    } catch (err) {
      // Fallback to a minimal WASM for testing
      console.log('⚠️  Using minimal test WASM');
      wasmBuffer = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]); // Basic WASM header
    }

    // Create source keypair (this doesn't need to be real for XDR generation)
    const sourceKeypair = Keypair.random();
    console.log(`Source Keypair: ${sourceKeypair.publicKey()}`);

    // Create mock source account with sequence number
    const sourceAccount = new Account(sourceKeypair.publicKey(), '123456789');

    console.log('\n--- Building uploadContractWasm Transaction ---');

    // Create the upload WASM operation
    const uploadOp = Operation.uploadContractWasm({
      wasm: wasmBuffer,
    });

    console.log('Upload operation created');

    // Build transaction
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.FUTURENET,
    })
      .addOperation(uploadOp)
      .setTimeout(300)
      .build();

    console.log('Transaction built');

    // Get XDR before signing
    const unsignedXdr = transaction.toXDR();
    console.log(`\n--- Unsigned Transaction XDR ---`);
    console.log(`XDR: ${unsignedXdr}`);

    // Try to sign transaction (this will create the problematic XDR)
    transaction.sign(sourceKeypair);
    const signedXdr = transaction.toXDR();
    
    console.log(`\n--- Signed Transaction XDR ---`);
    console.log(`XDR: ${signedXdr}`);

    // Analyze both XDRs
    console.log('\n=== ANALYZING UNSIGNED XDR ===');
    const inspector = new XDRInspector();
    const unsignedResult = inspector.inspectXDR(unsignedXdr);

    console.log('\n=== ANALYZING SIGNED XDR ===');
    const signedResult = inspector.inspectXDR(signedXdr);

    // Test what happens when we try to parse with older stellar-sdk version methods
    console.log('\n=== TESTING COMPATIBILITY ===');
    await testCompatibility(signedXdr);

    return {
      unsignedXdr,
      signedXdr,
      unsignedAnalysis: unsignedResult,
      signedAnalysis: signedResult
    };

  } catch (error) {
    console.error(`❌ Error creating XDR: ${error.message}`);
    console.error(error.stack);
    return null;
  }
}

async function testCompatibility(xdrString) {
  console.log('Testing different parsing approaches...');

  // Test 1: Basic parsing
  try {
    const envelope = xdr.TransactionEnvelope.fromXDR(xdrString, 'base64');
    console.log('✅ Basic TransactionEnvelope parsing works');
    
    // Check envelope type
    const envelopeType = envelope.switch();
    console.log(`Envelope switch value: ${envelopeType}`);
    
  } catch (err) {
    console.log(`❌ Basic parsing failed: ${err.message}`);
  }

  // Test 2: Try to parse as different envelope types
  try {
    // Force parse as v0
    console.log('\nTrying to force parse as v0 envelope...');
    const buffer = Buffer.from(xdrString, 'base64');
    // Modify first 4 bytes to be 0 (v0 envelope)
    buffer.writeUInt32BE(0, 0);
    const modifiedXdr = buffer.toString('base64');
    
    const v0Envelope = xdr.TransactionEnvelope.fromXDR(modifiedXdr, 'base64');
    console.log('✅ Forced v0 parsing works');
    
  } catch (err) {
    console.log(`❌ Forced v0 parsing failed: ${err.message}`);
  }

  // Test 3: Check specific union discriminants
  try {
    console.log('\nChecking raw XDR bytes...');
    const buffer = Buffer.from(xdrString, 'base64');
    
    console.log(`First 16 bytes: ${buffer.subarray(0, 16).toString('hex')}`);
    console.log(`Envelope discriminant (first 4 bytes): ${buffer.readUInt32BE(0)}`);
    
    if (buffer.length > 4) {
      console.log(`Next discriminant (bytes 4-8): ${buffer.readUInt32BE(4)}`);
    }
    
  } catch (err) {
    console.log(`❌ Raw byte analysis failed: ${err.message}`);
  }
}

// Save results to file for analysis
async function saveResults(results) {
  const analysisData = {
    timestamp: new Date().toISOString(),
    stellarSdkVersion: '14.0.0-rc.3',
    network: 'FUTURENET',
    results: results
  };

  try {
    const { writeFile } = await import('fs/promises');
    await writeFile(
      './xdr-analysis-results.json', 
      JSON.stringify(analysisData, null, 2)
    );
    console.log('\n✅ Results saved to xdr-analysis-results.json');
  } catch (err) {
    console.log(`⚠️  Could not save results: ${err.message}`);
  }
}

// Main execution
async function main() {
  const results = await createFailingXDR();
  
  if (results) {
    await saveResults(results);
    
    console.log('\n=== NEXT STEPS ===');
    console.log('1. Take the signed XDR and test it with SAFU wallet');
    console.log('2. Compare the XDR structure with what Freighter expects');
    console.log('3. Check if the issue is envelope version or operation encoding');
    
    console.log('\n=== TEST COMMANDS ===');
    console.log(`node xdr-inspector.js "${results.signedXdr}"`);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createFailingXDR };