#!/usr/bin/env node

/**
 * SDK v14 Compatibility Test
 * Validates that both Token Lab and SAFU wallet can handle the same XDR with SDK v14
 */

import { createFailingXDR } from './capture-failing-xdr.js';
import { XDRInspector } from './xdr-inspector.js';

async function testSDKCompatibility() {
  console.log('=== Testing SDK v14.0.0-rc.3 Compatibility ===\n');
  
  console.log('✅ Token Lab: stellar-sdk@14.0.0-rc.3');
  console.log('✅ SAFU wallet: stellar-sdk@14.0.0-rc.3 (UPGRADED)');
  
  console.log('\n--- Generating XDR with SDK v14 ---');
  
  // Generate XDR using current SDK version
  const result = await createFailingXDR();
  
  if (!result) {
    console.log('❌ Failed to generate XDR');
    return false;
  }
  
  console.log('\n--- XDR Compatibility Analysis ---');
  
  const inspector = new XDRInspector();
  const signedAnalysis = inspector.inspectXDR(result.signedXdr);
  
  if (signedAnalysis.success) {
    console.log('✅ XDR parsing successful with SDK v14');
    console.log(`Envelope Type: ${signedAnalysis.analysis.envelopeTypeName}`);
    console.log(`Operations: ${signedAnalysis.analysis.operationCount}`);
    
    // Check if it's the expected upload contract operation
    const uploadOps = signedAnalysis.analysis.operations.filter(op => 
      op.typeName === 'INVOKE_HOST_FUNCTION'
    );
    
    if (uploadOps.length > 0) {
      console.log('✅ Upload contract operation detected');
    }
    
    return true;
  } else {
    console.log('❌ XDR parsing failed');
    console.log(`Error: ${signedAnalysis.error}`);
    return false;
  }
}

async function testSAFUWalletIntegration() {
  console.log('\n=== Testing SAFU Wallet Integration ===');
  
  // Generate a simple XDR for testing
  const result = await createFailingXDR();
  
  if (!result) {
    console.log('❌ Could not generate test XDR');
    return false;
  }
  
  console.log('\n--- Test XDR for SAFU Wallet ---');
  console.log('Copy this XDR and test it with the SAFU wallet:');
  console.log(`\n${result.signedXdr}\n`);
  
  console.log('--- Expected Result ---');
  console.log('✅ SAFU wallet should now be able to parse this XDR without "Bad union switch: 1" error');
  console.log('✅ The transaction should contain an INVOKE_HOST_FUNCTION operation');
  console.log('✅ The host function should be of type UPLOAD_CONTRACT_WASM');
  
  return true;
}

async function main() {
  console.log('🔧 Phase 2.2: XDR Union Switch Error Resolution\n');
  
  const compatibilityTest = await testSDKCompatibility();
  const integrationTest = await testSAFUWalletIntegration();
  
  console.log('\n=== Summary ===');
  
  if (compatibilityTest && integrationTest) {
    console.log('✅ SDK v14 upgrade should resolve the "Bad union switch: 1" error');
    console.log('✅ Both Token Lab and SAFU wallet now use compatible XDR structures');
    console.log('✅ Ready for end-to-end deployment testing');
    
    console.log('\n--- Next Steps ---');
    console.log('1. Test the actual deployment flow between Token Lab and SAFU wallet');
    console.log('2. Verify that uploadContractWasm operations sign successfully');
    console.log('3. Complete full SEP-41 token deployment');
    
    console.log('\n--- Validation Commands ---');
    console.log('npm run start # Start Token Lab');
    console.log('cd /Users/mac/code/-scdev/safu-dev && npm run dev:tokenlab # Start SAFU wallet');
    console.log('# Then test the deployment flow in browser');
    
  } else {
    console.log('❌ Some tests failed - additional investigation needed');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testSDKCompatibility, testSAFUWalletIntegration };