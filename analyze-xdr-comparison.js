#!/usr/bin/env node

/**
 * XDR Comparison Tool: Freighter vs SAFU Deployment Transactions
 * 
 * This tool compares transaction XDRs to identify differences between
 * successful Freighter deployments and failing SAFU deployments.
 */

import {
  TransactionBuilder,
  Networks,
  Operation,
  rpc,
  BASE_FEE,
  Address,
  nativeToScVal,
  xdr
} from '@stellar/stellar-sdk';
import fs from 'fs';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// SEP-41 WASM data (same as used in tests)
const SEP41_WASM_BASE64 = `AGFzbQEAAAABLAhgAX8AYAAAYAF/AX9gAn9/AGACf38Bf2ADf39/AGADf39/AX9gBH9/f38AAgwBAWwBMAAAAQAAAwsKAAECAwQFBgcHBAAEBQFwAQEBBQMBAAEGCQF/AUGAgMAAC2daDDxpbnN0cnVjdGlvbj48aW5zdHJ1Y3Rpb24+AXYTaW5pdGlhbGl6ZV90YWJsZQEAAVsDaW5zdHJ1Y3Rpb24+PGluc3RydWN0aW9uPgAQX19zdGFja19wb2ludGVyBAABLgQAQYCAwAALJwEAAAABAAAAAQAAAAEAAAABAAAAAQAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAEBCvkDCgUAQQALxgJuYW1lAABAAYICNwAAAAl0b2tlbi5yczAAAAAOdG9rZW5fc2VjdXJpdHkwCWluaXRpYWxpemUxCG5hbWVfc2VjMgdzeW1ib2wuM2RlY2ltYWxzNAh0b3RhbF9zdXBwbHk1B2JhbGFuY2U2BG1pbnQ3CHRyYW5zZmVyOAplbmRfa2V5X2hhc2g5CWNhbGxvc2VjdGlvbjEwEmFsbGV3YW5jZV9wcm92aWRlcjExDAAxEg==`;

class XDRComparator {
  constructor() {
    this.server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
  }

  /**
   * Generate SAFU-style deployment transaction for comparison
   */
  async generateSAFUStyleTransaction(accountAddress) {
    console.log('🔧 Generating SAFU-style deployment transaction...\n');

    try {
      const wasmBuffer = Uint8Array.from(atob(SEP41_WASM_BASE64), c => c.charCodeAt(0));
      console.log(`📦 WASM size: ${wasmBuffer.length} bytes`);

      // Get account
      const sourceAccount = await this.server.getAccount(accountAddress);
      console.log(`📊 Account sequence: ${sourceAccount.sequenceNumber()}`);

      // Create upload operation (SAFU approach)
      const uploadOp = Operation.uploadContractWasm({
        wasm: wasmBuffer,
      });

      // Build transaction with SAFU parameters
      let uploadTx = new TransactionBuilder(sourceAccount, {
        fee: (BASE_FEE * 200000).toString(), // SAFU uses 200000x base fee
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
      })
      .addOperation(uploadOp)
      .setTimeout(300) // SAFU uses 300 second timeout
      .build();

      console.log('📋 Preparing transaction with Soroban RPC (SAFU method)...');
      
      // This is where SAFU fails - during preparation
      uploadTx = await this.server.prepareTransaction(uploadTx);
      const uploadTxXdr = uploadTx.toXDR();

      console.log('✅ SAFU-style transaction generated successfully');
      console.log(`📝 Transaction XDR length: ${uploadTxXdr.length} characters\n`);

      return {
        xdr: uploadTxXdr,
        transaction: uploadTx,
        approach: 'SAFU',
        fee: (BASE_FEE * 200000).toString(),
        timeout: 300,
        wasmSize: wasmBuffer.length
      };

    } catch (error) {
      console.error('❌ SAFU-style transaction generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate Freighter-style deployment transaction for comparison
   */
  async generateFreighterStyleTransaction(accountAddress) {
    console.log('🔧 Generating Freighter-style deployment transaction...\n');

    try {
      const wasmBuffer = Uint8Array.from(atob(SEP41_WASM_BASE64), c => c.charCodeAt(0));
      
      // Get account
      const sourceAccount = await this.server.getAccount(accountAddress);

      // Create upload operation (Freighter approach - check if different)
      const uploadOp = Operation.uploadContractWasm({
        wasm: wasmBuffer,
      });

      // Build transaction with Freighter parameters (we'll match what works)
      let uploadTx = new TransactionBuilder(sourceAccount, {
        fee: (BASE_FEE * 200000).toString(), // Start with same fee
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
      })
      .addOperation(uploadOp)
      .setTimeout(300) // Start with same timeout
      .build();

      console.log('📋 Preparing transaction with Soroban RPC (Freighter method)...');
      
      uploadTx = await this.server.prepareTransaction(uploadTx);
      const uploadTxXdr = uploadTx.toXDR();

      console.log('✅ Freighter-style transaction generated successfully');
      console.log(`📝 Transaction XDR length: ${uploadTxXdr.length} characters\n`);

      return {
        xdr: uploadTxXdr,
        transaction: uploadTx,
        approach: 'Freighter',
        fee: (BASE_FEE * 200000).toString(),
        timeout: 300,
        wasmSize: wasmBuffer.length
      };

    } catch (error) {
      console.error('❌ Freighter-style transaction generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Compare two transactions in detail
   */
  compareTransactions(tx1, tx2) {
    console.log('🔍 Detailed Transaction Comparison\n');
    console.log('='.repeat(80));

    // Parse XDRs
    const parsed1 = TransactionBuilder.fromXDR(tx1.xdr, FUTURENET_CONFIG.networkPassphrase);
    const parsed2 = TransactionBuilder.fromXDR(tx2.xdr, FUTURENET_CONFIG.networkPassphrase);

    const comparison = {
      basic: this.compareBasicProperties(tx1, tx2, parsed1, parsed2),
      operations: this.compareOperations(parsed1, parsed2),
      signatures: this.compareSignatures(parsed1, parsed2),
      soroban: this.compareSorobanData(parsed1, parsed2),
      xdr: this.compareXDRStructure(tx1.xdr, tx2.xdr)
    };

    this.printComparison(comparison);
    return comparison;
  }

  compareBasicProperties(tx1, tx2, parsed1, parsed2) {
    console.log('📋 Basic Properties Comparison:');
    
    const basic = {
      fee: {
        [tx1.approach]: tx1.fee,
        [tx2.approach]: tx2.fee,
        match: tx1.fee === tx2.fee
      },
      timeout: {
        [tx1.approach]: tx1.timeout,
        [tx2.approach]: tx2.timeout,
        match: tx1.timeout === tx2.timeout
      },
      wasmSize: {
        [tx1.approach]: tx1.wasmSize,
        [tx2.approach]: tx2.wasmSize,
        match: tx1.wasmSize === tx2.wasmSize
      },
      sequence: {
        [tx1.approach]: parsed1.source,
        [tx2.approach]: parsed2.source,
        match: parsed1.source === parsed2.source
      }
    };

    Object.entries(basic).forEach(([key, value]) => {
      const status = value.match ? '✅' : '❌';
      console.log(`  ${status} ${key}: ${JSON.stringify(value)}`);
    });

    console.log('');
    return basic;
  }

  compareOperations(parsed1, parsed2) {
    console.log('⚙️ Operations Comparison:');
    
    const ops1 = parsed1.operations;
    const ops2 = parsed2.operations;
    
    const operations = {
      count: {
        tx1: ops1.length,
        tx2: ops2.length,
        match: ops1.length === ops2.length
      },
      types: {
        tx1: ops1.map(op => op.type),
        tx2: ops2.map(op => op.type),
        match: JSON.stringify(ops1.map(op => op.type)) === JSON.stringify(ops2.map(op => op.type))
      }
    };

    // Compare first operation in detail (should be uploadContractWasm)
    if (ops1.length > 0 && ops2.length > 0) {
      const op1 = ops1[0];
      const op2 = ops2[0];
      
      operations.uploadWasm = {
        type1: op1.type,
        type2: op2.type,
        wasm1: op1.wasm ? op1.wasm.length : 'N/A',
        wasm2: op2.wasm ? op2.wasm.length : 'N/A',
        match: op1.type === op2.type && 
               (op1.wasm?.length || 0) === (op2.wasm?.length || 0)
      };
    }

    Object.entries(operations).forEach(([key, value]) => {
      const status = value.match ? '✅' : '❌';
      console.log(`  ${status} ${key}: ${JSON.stringify(value)}`);
    });

    console.log('');
    return operations;
  }

  compareSignatures(parsed1, parsed2) {
    console.log('✍️ Signatures Comparison:');
    
    const signatures = {
      count: {
        tx1: parsed1.signatures.length,
        tx2: parsed2.signatures.length,
        match: parsed1.signatures.length === parsed2.signatures.length
      },
      present: {
        tx1: parsed1.signatures.length > 0,
        tx2: parsed2.signatures.length > 0,
        match: (parsed1.signatures.length > 0) === (parsed2.signatures.length > 0)
      }
    };

    Object.entries(signatures).forEach(([key, value]) => {
      const status = value.match ? '✅' : '❌';
      console.log(`  ${status} ${key}: ${JSON.stringify(value)}`);
    });

    console.log('');
    return signatures;
  }

  compareSorobanData(parsed1, parsed2) {
    console.log('🌐 Soroban Data Comparison:');
    
    // Extract Soroban data from transactions
    const sorobanData1 = parsed1.ext?.sorobanData();
    const sorobanData2 = parsed2.ext?.sorobanData();
    
    const soroban = {
      present: {
        tx1: !!sorobanData1,
        tx2: !!sorobanData2,
        match: !!sorobanData1 === !!sorobanData2
      }
    };

    if (sorobanData1 && sorobanData2) {
      soroban.resourceFee = {
        tx1: sorobanData1.resourceFee().toString(),
        tx2: sorobanData2.resourceFee().toString(),
        match: sorobanData1.resourceFee().toString() === sorobanData2.resourceFee().toString()
      };

      // Compare resource footprint
      const footprint1 = sorobanData1.resources().footprint();
      const footprint2 = sorobanData2.resources().footprint();
      
      soroban.footprint = {
        readOnly1: footprint1.readOnly().length,
        readOnly2: footprint2.readOnly().length,
        readWrite1: footprint1.readWrite().length,
        readWrite2: footprint2.readWrite().length,
        match: (footprint1.readOnly().length === footprint2.readOnly().length) &&
               (footprint1.readWrite().length === footprint2.readWrite().length)
      };
    }

    Object.entries(soroban).forEach(([key, value]) => {
      const status = value.match ? '✅' : '❌';
      console.log(`  ${status} ${key}: ${JSON.stringify(value)}`);
    });

    console.log('');
    return soroban;
  }

  compareXDRStructure(xdr1, xdr2) {
    console.log('📄 XDR Structure Comparison:');
    
    const xdrComp = {
      length: {
        tx1: xdr1.length,
        tx2: xdr2.length,
        match: xdr1.length === xdr2.length
      },
      identical: {
        match: xdr1 === xdr2
      },
      similarity: {
        percentage: this.calculateSimilarity(xdr1, xdr2)
      }
    };

    Object.entries(xdrComp).forEach(([key, value]) => {
      if (key === 'similarity') {
        console.log(`  📊 ${key}: ${value.percentage}% similar`);
      } else {
        const status = value.match ? '✅' : '❌';
        console.log(`  ${status} ${key}: ${JSON.stringify(value)}`);
      }
    });

    console.log('');
    return xdrComp;
  }

  calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 100;
    
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return Math.round((matches / maxLen) * 100);
  }

  printComparison(comparison) {
    console.log('📊 COMPARISON SUMMARY');
    console.log('='.repeat(80));
    
    const allMatches = [
      comparison.basic.fee.match,
      comparison.basic.timeout.match, 
      comparison.basic.wasmSize.match,
      comparison.operations.count.match,
      comparison.operations.types.match,
      comparison.signatures.present.match,
      comparison.soroban.present.match,
      comparison.xdr.identical.match
    ];
    
    const matchCount = allMatches.filter(m => m).length;
    const totalChecks = allMatches.length;
    
    console.log(`🎯 Overall Match: ${matchCount}/${totalChecks} (${Math.round(matchCount/totalChecks*100)}%)`);
    console.log(`📄 XDR Similarity: ${comparison.xdr.similarity.percentage}%`);
    
    if (matchCount === totalChecks) {
      console.log('✅ Transactions are identical - issue not in transaction building');
    } else {
      console.log('❌ Transactions differ - found potential root cause areas');
    }
    
    console.log('');
  }

  /**
   * Save comparison results to file
   */
  saveComparison(freighterTx, safuTx, comparison, filename) {
    const report = {
      timestamp: new Date().toISOString(),
      transactions: {
        freighter: {
          approach: freighterTx.approach,
          xdr: freighterTx.xdr,
          fee: freighterTx.fee,
          timeout: freighterTx.timeout,
          wasmSize: freighterTx.wasmSize
        },
        safu: {
          approach: safuTx.approach,
          xdr: safuTx.xdr,
          fee: safuTx.fee,
          timeout: safuTx.timeout,
          wasmSize: safuTx.wasmSize
        }
      },
      comparison,
      summary: {
        identical: comparison.xdr.identical.match,
        similarity: comparison.xdr.similarity.percentage,
        majorDifferences: this.identifyMajorDifferences(comparison)
      }
    };

    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`💾 Comparison report saved to: ${filename}`);
  }

  identifyMajorDifferences(comparison) {
    const differences = [];
    
    if (!comparison.basic.fee.match) differences.push('fee_mismatch');
    if (!comparison.operations.count.match) differences.push('operation_count_mismatch');
    if (!comparison.operations.types.match) differences.push('operation_type_mismatch');
    if (!comparison.soroban.present.match) differences.push('soroban_data_mismatch');
    if (comparison.soroban.resourceFee && !comparison.soroban.resourceFee.match) {
      differences.push('resource_fee_mismatch');
    }
    if (comparison.soroban.footprint && !comparison.soroban.footprint.match) {
      differences.push('footprint_mismatch');
    }
    
    return differences;
  }
}

/**
 * Load Freighter XDR from file (if available)
 */
function loadFreighterXDR(filename) {
  try {
    if (fs.existsSync(filename)) {
      const xdr = fs.readFileSync(filename, 'utf8').trim();
      console.log(`📄 Loaded Freighter XDR from: ${filename}`);
      return xdr;
    }
  } catch (error) {
    console.log(`⚠️ Could not load Freighter XDR from ${filename}: ${error.message}`);
  }
  return null;
}

/**
 * Main comparison function
 */
async function runXDRComparison() {
  console.log('🔍 XDR Comparison Analysis: Freighter vs SAFU\n');
  console.log('='.repeat(80));
  console.log('This tool compares deployment transaction XDRs to identify differences.\n');

  const comparator = new XDRComparator();
  
  // Use SAFU address for consistency
  const testAddress = "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN";
  
  try {
    // Generate SAFU-style transaction
    console.log('🔄 Generating transactions for comparison...\n');
    const safuTx = await comparator.generateSAFUStyleTransaction(testAddress);
    
    // Check if we have Freighter XDR from testing
    const freighterXdrFile = '/Users/mac/code/-scdev/tokenLab/freighter-deployment-transaction.xdr';
    const freighterXdr = loadFreighterXDR(freighterXdrFile);
    
    if (freighterXdr) {
      // Compare with actual Freighter XDR
      console.log('🎯 Comparing with actual Freighter deployment XDR...\n');
      
      const freighterTx = {
        xdr: freighterXdr,
        approach: 'Freighter (Actual)',
        fee: 'Unknown',
        timeout: 'Unknown',
        wasmSize: safuTx.wasmSize // Same WASM
      };
      
      const comparison = comparator.compareTransactions(freighterTx, safuTx);
      comparator.saveComparison(freighterTx, safuTx, comparison, 'xdr-comparison-actual.json');
      
    } else {
      // Generate theoretical Freighter transaction for comparison
      console.log('📝 Generating theoretical Freighter transaction...\n');
      const freighterTx = await comparator.generateFreighterStyleTransaction(testAddress);
      
      const comparison = comparator.compareTransactions(freighterTx, safuTx);
      comparator.saveComparison(freighterTx, safuTx, comparison, 'xdr-comparison-theoretical.json');
      
      console.log('💡 To get actual Freighter XDR for comparison:');
      console.log('   1. Run the Freighter test page');
      console.log('   2. Download the XDR file');
      console.log('   3. Save it as: freighter-deployment-transaction.xdr');
      console.log('   4. Re-run this script for actual comparison\n');
    }
    
    console.log('🎉 XDR comparison analysis complete!');
    
  } catch (error) {
    console.error('❌ XDR comparison failed:', error);
    
    if (error.message.includes('Account not found') || error.message.includes('404')) {
      console.log('\n💡 Account not found. This script needs a funded Futurenet account.');
      console.log('   You can run it with any funded account address by modifying testAddress.');
    }
  }
}

// Export for use as module
export { XDRComparator };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runXDRComparison()
    .then(() => {
      console.log('\n✅ Analysis complete!');
    })
    .catch(error => {
      console.error('\n💥 Analysis failed:', error);
      process.exit(1);
    });
}