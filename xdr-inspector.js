#!/usr/bin/env node

/**
 * XDR Inspector Tool
 * Analyzes XDR structures to identify union discriminant issues
 */

import { xdr } from '@stellar/stellar-sdk';

class XDRInspector {
  constructor() {
    this.unionTypes = new Map();
    this.setupUnionTypes();
  }

  setupUnionTypes() {
    // Map common union types and their expected switch values
    this.unionTypes.set('TransactionEnvelope', {
      v0: 0,
      v1: 1
    });
    
    this.unionTypes.set('Operation', {
      CREATE_ACCOUNT: 0,
      PAYMENT: 1,
      PATH_PAYMENT_STRICT_RECEIVE: 2,
      MANAGE_SELL_OFFER: 3,
      CREATE_PASSIVE_SELL_OFFER: 4,
      SET_OPTIONS: 5,
      CHANGE_TRUST: 6,
      ALLOW_TRUST: 7,
      ACCOUNT_MERGE: 8,
      INFLATION: 9,
      MANAGE_DATA: 10,
      BUMP_SEQUENCE: 11,
      MANAGE_BUY_OFFER: 12,
      PATH_PAYMENT_STRICT_SEND: 13,
      CREATE_CLAIMABLE_BALANCE: 14,
      CLAIM_CLAIMABLE_BALANCE: 15,
      BEGIN_SPONSORING_FUTURE_RESERVES: 16,
      END_SPONSORING_FUTURE_RESERVES: 17,
      REVOKE_SPONSORSHIP: 18,
      CLAWBACK: 19,
      CLAWBACK_CLAIMABLE_BALANCE: 20,
      SET_TRUST_LINE_FLAGS: 21,
      LIQUIDITY_POOL_DEPOSIT: 22,
      LIQUIDITY_POOL_WITHDRAW: 23,
      INVOKE_HOST_FUNCTION: 24,
      EXTEND_FOOTPRINT_TTL: 25,
      RESTORE_FOOTPRINT: 26
    });

    this.unionTypes.set('HostFunction', {
      HOST_FUNCTION_TYPE_INVOKE_CONTRACT: 0,
      HOST_FUNCTION_TYPE_CREATE_CONTRACT: 1,
      HOST_FUNCTION_TYPE_UPLOAD_CONTRACT_WASM: 2
    });

    this.unionTypes.set('ContractExecutable', {
      CONTRACT_EXECUTABLE_STELLAR_ASSET: 0,
      CONTRACT_EXECUTABLE_WASM: 1
    });
  }

  inspectXDR(xdrString, expectedType = 'TransactionEnvelope') {
    console.log(`\n=== XDR Inspector Analysis ===`);
    console.log(`XDR Length: ${xdrString.length}`);
    console.log(`Expected Type: ${expectedType}`);
    console.log(`XDR Preview: ${xdrString.substring(0, 100)}...`);

    try {
      // Try to parse as TransactionEnvelope
      const envelope = xdr.TransactionEnvelope.fromXDR(xdrString, 'base64');
      console.log(`\n✅ Successfully parsed as TransactionEnvelope`);
      
      this.analyzeTransactionEnvelope(envelope);
      
      return {
        success: true,
        envelope,
        analysis: this.getEnvelopeAnalysis(envelope)
      };
      
    } catch (error) {
      console.log(`\n❌ Failed to parse XDR: ${error.message}`);
      
      // Try to extract union switch information from error
      this.analyzeError(error, xdrString);
      
      return {
        success: false,
        error: error.message,
        unionSwitch: this.extractUnionSwitch(error.message)
      };
    }
  }

  analyzeTransactionEnvelope(envelope) {
    console.log(`\n--- Transaction Envelope Analysis ---`);
    
    // Check envelope type - handle both old and new SDK formats
    let envelopeType;
    try {
      const switchValue = envelope.switch();
      if (typeof switchValue === 'object' && switchValue !== null) {
        // New SDK format - extract numeric value
        envelopeType = switchValue.value !== undefined ? switchValue.value : switchValue;
      } else {
        envelopeType = switchValue;
      }
    } catch (err) {
      console.log(`⚠️  Could not determine envelope type: ${err.message}`);
      return;
    }
    
    console.log(`Envelope Type Switch Value: ${envelopeType}`);
    console.log(`Envelope Type Name: ${this.getEnvelopeTypeName(envelopeType)}`);

    // Analyze transaction content
    let transaction;
    try {
      switch (envelopeType) {
        case 0: // ENVELOPE_TYPE_TX_V0
          transaction = envelope.v0().tx();
          console.log(`Transaction Type: v0`);
          break;
        case 1: // ENVELOPE_TYPE_TX
          transaction = envelope.v1().tx();
          console.log(`Transaction Type: v1`);
          break;
        case 2: // ENVELOPE_TYPE_TX_FEE_BUMP
          // Check if we actually have a fee bump transaction
          try {
            if (envelope.feeBump) {
              transaction = envelope.feeBump().tx().innerTx().v1().tx();
              console.log(`Transaction Type: fee bump`);
            } else {
              // This might actually be a v1 transaction mislabeled as fee bump
              console.log(`⚠️  Envelope type 2 but no feeBump field - trying v1 parsing`);
              transaction = envelope.v1().tx();
              console.log(`Transaction Type: v1 (corrected from type 2)`);
            }
          } catch (err) {
            console.log(`⚠️  Error parsing fee bump, trying v1: ${err.message}`);
            try {
              transaction = envelope.v1().tx();
              console.log(`Transaction Type: v1 (fallback from fee bump error)`);
            } catch (fallbackErr) {
              console.log(`⚠️  Both fee bump and v1 parsing failed: ${fallbackErr.message}`);
              return;
            }
          }
          break;
        default:
          console.log(`⚠️  Unknown envelope type: ${envelopeType}`);
          return;
      }

      this.analyzeTransaction(transaction);
    } catch (err) {
      console.log(`⚠️  Error analyzing transaction: ${err.message}`);
    }
  }

  analyzeTransaction(transaction) {
    console.log(`\n--- Transaction Content Analysis ---`);
    console.log(`Source Account: ${transaction.sourceAccount().ed25519()}`);
    console.log(`Fee: ${transaction.fee()}`);
    console.log(`Sequence Number: ${transaction.seqNum()}`);
    
    const operations = transaction.operations();
    console.log(`Number of Operations: ${operations.length}`);

    operations.forEach((op, index) => {
      this.analyzeOperation(op, index);
    });
  }

  analyzeOperation(operation, index) {
    console.log(`\n--- Operation ${index + 1} Analysis ---`);
    
    // Handle both old and new SDK formats for operation type
    let opType;
    try {
      const switchValue = operation.body().switch();
      if (typeof switchValue === 'object' && switchValue !== null) {
        opType = switchValue.value !== undefined ? switchValue.value : switchValue;
      } else {
        opType = switchValue;
      }
    } catch (err) {
      console.log(`⚠️  Could not determine operation type: ${err.message}`);
      return;
    }
    
    console.log(`Operation Type Switch Value: ${opType}`);
    console.log(`Operation Type Name: ${this.getOperationTypeName(opType)}`);

    // Special analysis for INVOKE_HOST_FUNCTION (24) operations
    if (opType === 24) {
      try {
        this.analyzeInvokeHostFunction(operation.body().invokeHostFunctionOp());
      } catch (err) {
        console.log(`⚠️  Error analyzing invoke host function: ${err.message}`);
      }
    }
  }

  analyzeInvokeHostFunction(invokeOp) {
    console.log(`\n--- Invoke Host Function Analysis ---`);
    
    const hostFunction = invokeOp.hostFunction();
    const hostFuncType = hostFunction.switch();
    
    console.log(`Host Function Type Switch Value: ${hostFuncType}`);
    console.log(`Host Function Type Name: ${this.getHostFunctionTypeName(hostFuncType)}`);

    // Analyze based on host function type
    switch (hostFuncType) {
      case 2: // HOST_FUNCTION_TYPE_UPLOAD_CONTRACT_WASM
        console.log(`WASM Upload Operation Detected`);
        const wasm = hostFunction.wasm();
        console.log(`WASM Size: ${wasm.length} bytes`);
        break;
      case 1: // HOST_FUNCTION_TYPE_CREATE_CONTRACT
        console.log(`Contract Creation Operation Detected`);
        const createContract = hostFunction.createContract();
        const executable = createContract.executable();
        const executableType = executable.switch();
        console.log(`Contract Executable Type Switch: ${executableType}`);
        break;
      case 0: // HOST_FUNCTION_TYPE_INVOKE_CONTRACT
        console.log(`Contract Invocation Operation Detected`);
        break;
    }
  }

  analyzeError(error, xdrString) {
    console.log(`\n--- Error Analysis ---`);
    
    const unionSwitch = this.extractUnionSwitch(error.message);
    if (unionSwitch !== null) {
      console.log(`❌ Problematic Union Switch Value: ${unionSwitch}`);
      
      // Try to identify which union type might be causing the issue
      this.identifyPossibleUnionType(unionSwitch);
    }

    // Try partial parsing to identify where it fails
    this.attemptPartialParsing(xdrString);
  }

  extractUnionSwitch(errorMessage) {
    const match = errorMessage.match(/switch:?\s*(\d+)/i);
    return match ? parseInt(match[1]) : null;
  }

  identifyPossibleUnionType(switchValue) {
    console.log(`\n--- Union Type Identification ---`);
    console.log(`Looking for union types that might use switch value: ${switchValue}`);

    for (const [typeName, switches] of this.unionTypes.entries()) {
      const matchingValues = Object.entries(switches).filter(([name, value]) => value === switchValue);
      if (matchingValues.length > 0) {
        console.log(`✅ ${typeName} could use switch ${switchValue}:`);
        matchingValues.forEach(([name, value]) => {
          console.log(`   - ${name} = ${value}`);
        });
      }
    }
  }

  attemptPartialParsing(xdrString) {
    console.log(`\n--- Partial Parsing Attempt ---`);
    
    try {
      // Try to read just the envelope discriminant
      const buffer = Buffer.from(xdrString, 'base64');
      const discriminant = buffer.readUInt32BE(0);
      console.log(`First 4 bytes (envelope discriminant): ${discriminant}`);
      
      if (discriminant === 0) {
        console.log(`Envelope Type: ENVELOPE_TYPE_TX_V0`);
      } else if (discriminant === 1) {
        console.log(`Envelope Type: ENVELOPE_TYPE_TX (v1)`);
      } else if (discriminant === 2) {
        console.log(`Envelope Type: ENVELOPE_TYPE_TX_FEE_BUMP`);
      } else {
        console.log(`⚠️  Unknown envelope discriminant: ${discriminant}`);
      }
      
    } catch (err) {
      console.log(`❌ Partial parsing failed: ${err.message}`);
    }
  }

  getEnvelopeTypeName(type) {
    const types = {
      0: 'ENVELOPE_TYPE_TX_V0',
      1: 'ENVELOPE_TYPE_TX',
      2: 'ENVELOPE_TYPE_TX_FEE_BUMP'
    };
    return types[type] || `UNKNOWN_${type}`;
  }

  getOperationTypeName(type) {
    const operations = Object.entries(this.unionTypes.get('Operation'));
    const found = operations.find(([name, value]) => value === type);
    return found ? found[0] : `UNKNOWN_${type}`;
  }

  getHostFunctionTypeName(type) {
    const hostFunctions = Object.entries(this.unionTypes.get('HostFunction'));
    const found = hostFunctions.find(([name, value]) => value === type);
    return found ? found[0] : `UNKNOWN_${type}`;
  }

  getEnvelopeAnalysis(envelope) {
    // Handle both old and new SDK formats for envelope type
    let envelopeType;
    try {
      const switchValue = envelope.switch();
      if (typeof switchValue === 'object' && switchValue !== null) {
        envelopeType = switchValue.value !== undefined ? switchValue.value : switchValue;
      } else {
        envelopeType = switchValue;
      }
    } catch (err) {
      return { error: `Could not determine envelope type: ${err.message}` };
    }
    
    let transaction;
    
    try {
      switch (envelopeType) {
        case 0:
          transaction = envelope.v0().tx();
          break;
        case 1:
          transaction = envelope.v1().tx();
          break;
        case 2:
          // Handle envelope type 2 gracefully
          try {
            if (envelope.feeBump) {
              transaction = envelope.feeBump().tx().innerTx().v1().tx();
            } else {
              // Fallback to v1 parsing
              transaction = envelope.v1().tx();
            }
          } catch (err) {
            // Try v1 as fallback
            try {
              transaction = envelope.v1().tx();
            } catch (fallbackErr) {
              return { error: `Could not parse envelope type 2: ${fallbackErr.message}` };
            }
          }
          break;
        default:
          return { error: `Unknown envelope type: ${envelopeType}` };
      }

      const operations = transaction.operations();
      const operationTypes = operations.map(op => {
        let opType;
        try {
          const switchValue = op.body().switch();
          if (typeof switchValue === 'object' && switchValue !== null) {
            opType = switchValue.value !== undefined ? switchValue.value : switchValue;
          } else {
            opType = switchValue;
          }
        } catch (err) {
          opType = 'unknown';
        }
        
        return {
          type: opType,
          typeName: this.getOperationTypeName(opType)
        };
      });

      return {
        envelopeType,
        envelopeTypeName: this.getEnvelopeTypeName(envelopeType),
        operationCount: operations.length,
        operations: operationTypes,
        sourceAccount: transaction.sourceAccount(),
        fee: transaction.fee().toString(),
        sequenceNumber: transaction.seqNum().toString()
      };
    } catch (err) {
      return { error: `Error analyzing envelope: ${err.message}` };
    }
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.length < 3) {
    console.log(`
Usage: node xdr-inspector.js <XDR_STRING> [TYPE]

Examples:
  node xdr-inspector.js "AAAAA..." TransactionEnvelope
  node xdr-inspector.js "AAAAA..."
  
TYPE defaults to TransactionEnvelope if not specified.
    `);
    process.exit(1);
  }

  const xdrString = process.argv[2];
  const expectedType = process.argv[3] || 'TransactionEnvelope';

  const inspector = new XDRInspector();
  const result = inspector.inspectXDR(xdrString, expectedType);

  console.log(`\n=== Summary ===`);
  if (result.success) {
    console.log(`✅ XDR parsing successful`);
    console.log(`Envelope Type: ${result.analysis.envelopeTypeName}`);
    console.log(`Operations: ${result.analysis.operationCount}`);
  } else {
    console.log(`❌ XDR parsing failed`);
    console.log(`Error: ${result.error}`);
    if (result.unionSwitch !== null) {
      console.log(`Union Switch Value: ${result.unionSwitch}`);
    }
  }
}

export { XDRInspector };