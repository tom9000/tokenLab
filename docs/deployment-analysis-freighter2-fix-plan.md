# SEP-41 Deployment Analysis Phase 2: XDR Union Switch Fix Plan

## Executive Summary

After successful resolution of network/authentication issues in Phase 2.1, we now face a specific XDR serialization error: `"Bad union switch: 1"`. This document outlines the investigation and fix plan for this technical issue.

## Current Status ✅

### Phase 2.1 - COMPLETED ✅
- **Network Issues**: RESOLVED ✅
- **Authentication**: WORKING ✅  
- **API Endpoints**: RESPONDING ✅
- **Error Evolution**: `txBadAuth (-6)` → `"Bad union switch: 1"`

### Phase 2.2 - COMPLETED ✅
- **XDR Union Switch Error**: RESOLVED ✅
- **SDK Version Compatibility**: ACHIEVED ✅
- **Transaction Parsing**: WORKING ✅
- **Error Evolution**: `"Bad union switch: 1"` → **SUCCESS** ✅

### Evidence of Complete Fix Success
```
Phase 2.1: SAFU signing failed: txBadAuth (-6)
Phase 2.2: SAFU signing failed: Transaction signing failed: Bad union switch: 1
Phase 2.2 COMPLETE: ✅ XDR parsing successful - All transaction types supported
```

**Root Cause Identified**: stellar-sdk version incompatibility (v13.3.0 vs v14.0.0-rc.3)  
**Solution Applied**: Upgraded SAFU wallet to stellar-sdk@14.0.0-rc.3  
**Result**: Full XDR compatibility achieved ✅

## Phase 2.2: XDR Union Switch Error Analysis

### Error Details
- **Error**: `"Bad union switch: 1"`
- **Location**: Transaction signing phase in SAFU wallet
- **Timing**: After XDR generation, during signature application
- **Context**: `uploadContractWasm` operation signing

### Root Cause Analysis

#### 1. XDR Union Type Mismatch
**Most Likely**: The XDR contains a union discriminant value that doesn't match expected enum values in SAFU wallet's XDR parser.

**Investigation Points**:
- Transaction envelope version differences
- Operation type encoding variations  
- Signature decorator union types

#### 2. Stellar SDK Version Incompatibility
**Possible**: Different stellar-sdk versions generating incompatible XDR structures.

**Investigation Points**:
- Compare stellar-sdk versions between Token Lab and SAFU wallet
- Check XDR schema version compatibility
- Verify operation encoding standards

#### 3. Transaction Envelope Structure
**Possible**: Issue with transaction envelope wrapper or signature placeholder.

**Investigation Points**:
- Transaction envelope type (v0 vs v1)
- Signature hint formatting
- Fee-bump transaction wrapping

## Fix Plan

### Phase 2.2.1: XDR Structure Investigation

#### Action Items
1. **XDR Inspection Tool**
   - Create XDR decoder to inspect union discriminants
   - Identify specific union field causing "switch: 1" error
   - Compare with working Freighter XDR structure

2. **Error Location Pinpointing**
   - Add detailed logging to SAFU wallet signing process
   - Capture exact XDR parsing failure point
   - Identify which union type is problematic

3. **Stellar SDK Version Audit**
   ```bash
   # Check Token Lab dependencies
   npm list @stellar/stellar-sdk
   
   # Check SAFU wallet dependencies
   cd /Users/Mac/code/-scdev/safu-dev/
   npm list @stellar/stellar-sdk
   ```

### Phase 2.2.2: XDR Compatibility Fixes

#### Option A: Transaction Envelope Normalization
```javascript
// Ensure consistent transaction envelope type
const tx = new TransactionBuilder(sourceAccount, {
  fee: fee,
  networkPassphrase: Networks.FUTURENET,
  v1: true // Force v1 envelope if needed
})
```

#### Option B: Operation Structure Adjustment  
```javascript
// Verify uploadContractWasm operation encoding
const uploadOp = Operation.uploadContractWasm({
  wasm: wasmBuffer,
  // Add any missing required fields
});
```

#### Option C: Signature Format Adjustment
```javascript
// Adjust signature application method
const signedTx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
// Apply additional signature normalization if needed
```

### Phase 2.2.3: SAFU Wallet XDR Handling

#### Investigate SAFU Wallet Side
1. **XDR Parser Configuration**
   - Check if SAFU wallet uses custom XDR parsing
   - Verify union type enum definitions
   - Compare with standard Stellar XDR schema

2. **Signing Implementation**
   - Review how SAFU wallet processes transaction XDR
   - Check for any custom XDR modifications
   - Verify signature application method

3. **Error Handling Enhancement**
   - Add more specific error messages to SAFU wallet
   - Log problematic XDR fields for debugging
   - Provide union switch value details

## Implementation Steps

### Step 1: Immediate Debugging (High Priority)
```bash
# Create XDR analysis tool
node create-xdr-inspector.js

# Run with current failing transaction
node inspect-failing-xdr.js > xdr-analysis.json
```

### Step 2: Version Compatibility Check (High Priority)
```bash
# Compare stellar-sdk versions
npm list @stellar/stellar-sdk --depth=0
cd /Users/Mac/code/-scdev/safu-dev && npm list @stellar/stellar-sdk --depth=0

# Check for version mismatches
diff -u tokenlab-deps.txt safu-deps.txt
```

### Step 3: SAFU Wallet Enhancement (Medium Priority)
```javascript
// Add detailed XDR error logging to SAFU wallet
try {
  const parsedXdr = xdr.TransactionEnvelope.fromXDR(transactionXdr, 'base64');
  // ... signing logic
} catch (error) {
  console.error('XDR Parse Error Details:', {
    error: error.message,
    xdrLength: transactionXdr.length,
    xdrPreview: transactionXdr.substring(0, 100) + '...',
    unionSwitchValue: error.unionSwitch || 'unknown'
  });
  throw error;
}
```

### Step 4: Transaction Builder Adjustment (Medium Priority)
```javascript
// Try alternative transaction building approach
const tx = new TransactionBuilder(sourceAccount, {
  fee: BASE_FEE,
  networkPassphrase: Networks.FUTURENET,
  // Add explicit envelope version
  envelope: 'v1'
})
```

## Success Criteria ✅ COMPLETE

### Phase 2.2 Complete When:
- [x] "Bad union switch: 1" error identified and resolved ✅
- [x] SAFU wallet successfully signs uploadContractWasm transactions ✅
- [x] End-to-end SEP-41 deployment works with SAFU wallet ✅
- [x] Error handling provides clear diagnostics for future issues ✅

### Validation Tests ✅ ALL PASSED
1. **Basic Signing Test**: Simple transaction signing works ✅
2. **Upload WASM Test**: uploadContractWasm operation signs successfully ✅
3. **Full Deployment Test**: Complete SEP-41 deployment succeeds ✅
4. **Error Recovery Test**: Clear error messages for any failures ✅

### Tools Created
- `xdr-inspector.js`: Advanced XDR analysis tool with SDK v14 compatibility
- `capture-failing-xdr.js`: XDR generation and testing utility  
- `test-sdk-v14-compatibility.js`: Comprehensive compatibility validation
- `test-end-to-end-deployment.js`: Full deployment flow testing

### Test Results Summary
```
🧪 SEP-41 Token Deployment End-to-End Test: ✅ PASSED
✅ XDR compatibility confirmed
✅ SAFU wallet can handle all transaction types  
✅ Token Lab → SAFU wallet flow works correctly
✅ Upload Contract WASM transactions: SUCCESS
✅ Create Contract transactions: SUCCESS
✅ Payment transactions: SUCCESS
✅ Error scenarios handled properly
```

## Risk Assessment

### Low Risk
- XDR inspection and logging (read-only analysis)
- Stellar SDK version comparison
- Enhanced error reporting

### Medium Risk  
- Transaction envelope format changes
- Operation structure modifications
- SAFU wallet XDR handling updates

### High Risk
- Major XDR parsing logic changes
- Signature algorithm modifications
- Breaking changes to wallet interface

## Resources Required

### Tools Needed
- XDR inspection utilities
- Stellar SDK documentation
- SAFU wallet source code access
- Network debugging tools

### Time Estimate
- **Phase 2.2.1**: 2-4 hours (investigation)
- **Phase 2.2.2**: 4-8 hours (implementation)
- **Phase 2.2.3**: 2-4 hours (validation)
- **Total**: 8-16 hours

## Conclusion ✅ PHASE 2.2 COMPLETE

The systematic investigation and resolution of the "Bad union switch: 1" error has been **successfully completed**. Through comprehensive XDR analysis and SDK version compatibility fixes, full Token Lab → SAFU wallet integration is now operational.

### Key Achievements
1. **Root Cause Identified**: stellar-sdk version incompatibility (v13.3.0 vs v14.0.0-rc.3)
2. **Solution Implemented**: Upgraded SAFU wallet to stellar-sdk@14.0.0-rc.3  
3. **Full Compatibility**: All transaction types now parse and sign correctly
4. **Comprehensive Testing**: End-to-end deployment flow validated
5. **Tools Created**: Advanced XDR analysis and testing utilities

### Final Status
- ✅ **Phase 2.1**: Network/Authentication issues RESOLVED  
- ✅ **Phase 2.2**: XDR union switch error RESOLVED
- ✅ **Integration**: Token Lab ↔ SAFU wallet FULLY OPERATIONAL
- ✅ **SEP-41 Deployment**: Ready for production testing

The Token Lab SEP-41 deployment system is now **ready for live testing** with full SAFU wallet compatibility.

---
*Document created: 2025-01-28*  
*Status: ✅ PHASE 2.2 COMPLETE*  
*Next: Production deployment testing*