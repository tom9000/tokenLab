# SEP-41 Real Contract Deployment Plan: Token Lab → SAFU Wallet → Futurenet

## Executive Summary

This document outlines the comprehensive plan for verifying and implementing real SEP-41 smart contract deployment using Token Lab with SAFU wallet as the signer, targeting live deployment on the Futurenet blockchain with verifiable contract IDs.

## Project Context

Based on analysis of existing documentation and codebase research:

- **Connect Agent 2.0**: SAFU wallet integration is functional with both mock and real seed modes
- **Previous Analysis**: XDR compatibility issues resolved, authentication working
- **Current Status**: System ready for production testing with real blockchain deployment

## Objectives

### Primary Goal
Deploy a real SEP-41 token contract on Futurenet blockchain using:
- **Token Lab** as the deployment interface
- **SAFU wallet** as the transaction signer (agent mode)  
- **Futurenet** as the target network
- **Real contract ID** verification on blockchain explorers

### Success Criteria
- ✅ Contract successfully deployed with verifiable contract ID
- ✅ Contract initialized with SAFU wallet as admin
- ✅ Token operations functional (mint, transfer, balance checks)
- ✅ Contract visible on Futurenet blockchain explorers
- ✅ End-to-end workflow documented and reproducible

## Current System Analysis

### Infrastructure Status ✅
- **SEP-41 Contract**: Ready in `/contracts/sep41_token/` with optimized WASM
- **Token Lab**: React/Vite app with deployment UI at port 3005
- **SAFU Wallet**: Agent-enabled wallet at localhost:3003
- **Network Config**: Futurenet RPC endpoints configured
- **SDK Compatibility**: v14.0.0-rc.3 aligned between applications

### Integration Status ✅
- **Authentication**: Agent mode with password authentication working
- **XDR Compatibility**: SDK version alignment resolved (Phase 2.2 complete)
- **Transaction Signing**: All transaction types supported
- **Error Handling**: Comprehensive debugging and logging in place

### Build System Status ✅
- **Contract Build**: `./contracts/build.sh` generates optimized WASM
- **Deployment Scripts**: Multiple working deployment examples available
- **Test Suite**: Playwright-based testing infrastructure ready

## Implementation Plan

### Phase 1: Pre-Deployment Verification (1-2 hours)

#### 1.1 System Readiness Check
- [ ] **Build Contract**: Ensure latest WASM is compiled and optimized
  ```bash
  cd /Users/mac/code/-scdev/tokenLab
  ./contracts/build.sh
  ```
- [ ] **Start Services**: Launch both applications
  ```bash
  ~/restart-tokenlab.sh
  cd /Users/Mac/code/-scdev/safu-dev && npm run dev &
  ```
- [ ] **Verify Connectivity**: Test SAFU wallet health and Token Lab connection
- [ ] **Account Funding**: Ensure SAFU wallet account has sufficient XLM for deployment fees

#### 1.2 Integration Testing
- [ ] **Agent Authentication**: Test Connect Agent 2.0 with both mock and real seed modes
- [ ] **Transaction Signing**: Verify XDR compatibility with simple transactions
- [ ] **Network Access**: Confirm Futurenet RPC connectivity
- [ ] **Error Handling**: Test failure scenarios and recovery

### Phase 2: Live Deployment Execution (2-3 hours)

#### 2.1 Pre-Deployment Setup
- [ ] **Configure Real Seed Mode**:
  ```bash
  curl -X POST http://localhost:3003/api/setup-wallet \
    -H "Content-Type: application/json" \
    -d '{
      "seedPhrase": "humor initial toddler bitter elite fury gospel addict water cattle slush card",
      "password": "TestPass123!",
      "appName": "Token Lab",
      "origin": "http://localhost:3005",
      "mode": "agent"
    }'
  ```
- [ ] **Fund Account**: Use Friendbot to ensure sufficient XLM balance
- [ ] **Network Validation**: Confirm Futurenet network configuration

#### 2.2 Contract Deployment
- [ ] **Token Configuration**:
  ```javascript
  const tokenConfig = {
    name: 'TokenLab Test Token',
    symbol: 'TLTT',
    decimals: 7,
    initialSupply: 1000000n * 10n**7n, // 1M tokens
    admin: safuWalletPublicKey
  };
  ```
- [ ] **Deploy via Agent Mode**:
  - Connect to SAFU wallet using Agent 2.0
  - Upload WASM to Futurenet
  - Create contract instance
  - Initialize contract with token parameters
- [ ] **Transaction Monitoring**: Track each deployment step with detailed logging

#### 2.3 Deployment Verification
- [ ] **Contract ID Capture**: Record the deployed contract address
- [ ] **Blockchain Verification**: Confirm contract exists on Futurenet explorers:
  - `https://futurenet.steexp.com/contract/${contractId}`
  - `https://futurenet.stellar.expert/explorer/contract/${contractId}`
- [ ] **Admin Verification**: Confirm SAFU wallet is set as contract admin
- [ ] **Initial State Check**: Verify contract initialization parameters

### Phase 3: Functional Testing (1-2 hours)

#### 3.1 Token Operations Testing
- [ ] **Balance Check**: Query initial token balance of admin account
- [ ] **Mint Operation**: Mint additional tokens using SAFU wallet
- [ ] **Transfer Test**: Transfer tokens between accounts
- [ ] **Admin Functions**: Test admin-only operations

#### 3.2 End-to-End Workflow Validation
- [ ] **Disconnect/Reconnect**: Test wallet reconnection capabilities
- [ ] **Multiple Transactions**: Execute sequential operations
- [ ] **Error Recovery**: Test handling of failed transactions
- [ ] **UI Responsiveness**: Verify Token Lab UI updates correctly

### Phase 4: Documentation and Finalization (1 hour)

#### 4.1 Results Documentation
- [ ] **Contract Details**: Record contract ID, admin account, token parameters
- [ ] **Transaction Hashes**: Document all successful transaction IDs
- [ ] **Explorer Links**: Create verifiable links to contract on Futurenet explorers
- [ ] **Performance Metrics**: Record deployment times, fees, success rates

#### 4.2 Reproducibility Testing
- [ ] **Fresh Deployment**: Attempt second deployment with different parameters
- [ ] **Documentation Update**: Update user guides with verified workflow
- [ ] **Test Automation**: Create automated test suite for regression testing

## Technical Implementation Details

### Network Configuration
```javascript
const FUTURENET_CONFIG = {
  rpcUrl: 'https://rpc-futurenet.stellar.org',
  networkPassphrase: 'Test SDF Future Network ; October 2022',
  friendbotUrl: 'https://friendbot-futurenet.stellar.org',
  explorerUrls: [
    'https://futurenet.steexp.com',
    'https://futurenet.stellar.expert',
    'https://futurenet.stellarchain.io'
  ]
};
```

### SAFU Wallet Configuration
```javascript
const SAFU_CONFIG = {
  mode: 'agent',
  password: 'TestPass123!',
  seedPhrase: 'humor initial toddler bitter elite fury gospel addict water cattle slush card',
  publicKey: 'GU5STX7HQYAJRZBKS2CLT3DMU4ENV5FOW6GPX7HQYAJRZBKS2CLT3DMU',
  endpoint: 'http://localhost:3003'
};
```

### Deployment Parameters
```javascript
const DEPLOYMENT_PARAMS = {
  contractWasm: '/contracts/sep41_token.optimized.wasm',
  tokenName: 'TokenLab Test Token',
  tokenSymbol: 'TLTT',
  decimals: 7,
  initialSupply: '1000000.0000000', // 1M with 7 decimals
  maxSupply: '10000000.0000000',   // 10M tokens max
  isMintable: true,
  adminAccount: 'GU5STX7HQYAJRZBKS2CLT3DMU4ENV5FOW6GPX7HQYAJRZBKS2CLT3DMU'
};
```

## Risk Assessment and Mitigation

### High-Priority Risks
1. **Network Connectivity**: Futurenet RPC downtime or instability
   - **Mitigation**: Test with multiple RPC endpoints, implement retry logic
2. **Authentication Failures**: SAFU wallet authentication issues
   - **Mitigation**: Test both mock and real seed modes, implement fallback
3. **XDR Compatibility**: SDK version mismatches
   - **Mitigation**: Verify SDK versions aligned, test parsing before deployment

### Medium-Priority Risks
1. **Contract Deployment Fees**: Insufficient XLM for deployment costs
   - **Mitigation**: Pre-fund account with extra XLM via Friendbot
2. **Transaction Timeouts**: Long deployment transaction processing
   - **Mitigation**: Implement proper timeout handling and retry logic
3. **UI/UX Issues**: Token Lab interface problems during deployment
   - **Mitigation**: Test UI workflows thoroughly, have CLI backup ready

### Contingency Plans
1. **SAFU Wallet Failure**: Use Freighter wallet as backup signer
2. **Token Lab UI Issues**: Use direct CLI deployment scripts
3. **Futurenet Issues**: Switch to Testnet for initial testing
4. **Contract Bugs**: Use pre-tested contract WASM from working deployments

## Success Metrics and Validation

### Quantitative Metrics
- **Deployment Success Rate**: 100% successful deployments
- **Transaction Time**: < 30 seconds per deployment step
- **Contract Verification**: Contract ID appears on all blockchain explorers
- **Token Operations**: All basic operations (mint, transfer, balance) functional

### Qualitative Metrics
- **User Experience**: Smooth Token Lab → SAFU wallet interaction
- **Error Handling**: Clear error messages and recovery guidance
- **Documentation**: Complete, reproducible deployment instructions
- **Reliability**: Consistent results across multiple deployment attempts

## Deliverables

### Primary Deliverables
1. **Live Contract ID**: Verifiable SEP-41 contract on Futurenet
2. **Explorer Verification**: Contract visible on blockchain explorers
3. **Working Token Operations**: Demonstrated mint, transfer, balance operations
4. **Deployment Documentation**: Complete step-by-step reproduction guide

### Secondary Deliverables
1. **Performance Analysis**: Deployment timing, fees, resource usage
2. **Error Scenarios**: Documentation of failure modes and recovery
3. **User Guide Updates**: Refined Token Lab usage instructions
4. **Test Automation**: Automated test suite for regression testing

## Timeline and Resource Requirements

### Estimated Timeline: 4-6 hours total
- **Phase 1**: 1-2 hours (verification and setup)
- **Phase 2**: 2-3 hours (deployment execution)
- **Phase 3**: 1-2 hours (functional testing)
- **Phase 4**: 1 hour (documentation)

### Required Resources
- **Development Environment**: Token Lab and SAFU wallet running locally
- **Network Access**: Reliable internet for Futurenet RPC communication
- **Funding**: XLM for deployment fees (minimal on Futurenet)
- **Monitoring Tools**: Blockchain explorers for verification

### Dependencies
- **SAFU Wallet**: Must be operational at localhost:3003
- **Token Lab**: Must be running at localhost:3005 or higher
- **Futurenet**: Network must be accessible and stable
- **Contract WASM**: Latest optimized contract build available

## Quality Assurance

### Pre-Deployment Checklist
- [ ] Latest contract WASM compiled and optimized
- [ ] SAFU wallet agent authentication tested
- [ ] Token Lab UI fully functional
- [ ] Network connectivity verified
- [ ] Account funding confirmed
- [ ] SDK versions aligned between applications

### Post-Deployment Validation
- [ ] Contract ID recorded and verified
- [ ] Admin account confirmed as SAFU wallet
- [ ] Token operations tested successfully
- [ ] Explorer verification completed
- [ ] Documentation updated with results
- [ ] Deployment reproducibility confirmed

## Conclusion

This comprehensive plan provides a structured approach to achieving real SEP-41 contract deployment on Futurenet using the Token Lab → SAFU wallet integration. The plan builds on previous successful debugging efforts and provides clear success criteria, risk mitigation, and validation steps.

The execution of this plan will result in:
- **Proven Production Capability**: Real contract deployment on live blockchain
- **Verified Integration**: Token Lab ↔ SAFU wallet workflow validation
- **Complete Documentation**: Reproducible deployment process
- **Foundation for Scaling**: Template for future contract deployments

Upon successful completion, the Token Lab system will be validated as production-ready for SEP-41 token deployment with SAFU wallet integration on the Stellar Futurenet.

---

*Document Version: 1.0*  
*Created: 2025-01-29*  
*Status: Ready for Implementation*  
*Target Network: Stellar Futurenet*  
*Integration: Token Lab → SAFU Wallet (Agent Mode)*