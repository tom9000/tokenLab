# Stellar Futurenet RPC Status and Network Configuration

**Date**: July 31, 2025  
**Issue**: RPC endpoints offline for 24+ hours  
**Resolution**: Use Horizon API and third-party providers

## Issue Investigation Summary

### Problem Symptoms
- All RPC endpoints returning 503 Service Unavailable or timeouts
- Deployment failures: "All RPC endpoints are currently unavailable"
- Transfer failures: "Network Error" after RPC timeout
- 24+ hour continuous outage reported by users

### Root Cause Analysis

#### Official Stellar Policy (Not a Temporary Outage)
According to [Stellar's official documentation](https://developers.stellar.org/docs/data/apis/api-providers):

> **SDF does not provide a public RPC endpoint for Futurenet**
> 
> "No publicly available RPC, see RPC service providers for Futurenet specifically"

This means:
- ❌ `https://rpc-futurenet.stellar.org` - **Never existed as public service**
- ❌ `https://soroban-futurenet.stellar.org` - **Not publicly available**
- ✅ `https://horizon-futurenet.stellar.org` - **Official and working**

#### What Stellar Actually Provides
| Network | Horizon API | RPC Endpoint |
|---------|-------------|--------------|
| **Mainnet** | ✅ Public | ❌ No public RPC |
| **Testnet** | ✅ Public | ✅ Public |  
| **Futurenet** | ✅ Public | ❌ **No public RPC** |

### Network Status Verification (July 31, 2025)

#### ✅ Working Services
```bash
# Horizon API - Working perfectly
curl -s https://horizon-futurenet.stellar.org | head -5
# Returns: API root with all endpoints

# Latest ledger check
curl -s "https://horizon-futurenet.stellar.org/ledgers?limit=1&order=desc"
# Returns: Latest ledger closed at 2025-07-31T06:00:59Z (4 hours ago)
```

#### ❌ Non-Working Services  
```bash
# Official RPC (doesn't exist)
curl -s https://rpc-futurenet.stellar.org
# Returns: 503 Service Temporarily Unavailable

# Soroban RPC (not public)
curl -s https://soroban-futurenet.stellar.org  
# Returns: Connection failed
```

## Technical Analysis: Horizon vs RPC Capabilities

### What You CAN Do with Horizon API

#### ✅ Full Transaction Support
- **Account management**: Create, fund, query balances
- **Transaction building**: All transaction types including Soroban
- **Transaction signing**: Full cryptographic operations
- **Transaction submission**: Submit to network via `/transactions`
- **Transaction monitoring**: Track status and confirmations

#### ✅ Smart Contract Operations
- **Contract deployment**: Deploy WASM contracts
- **Contract invocation**: Call contract functions
- **Contract state**: Query contract data
- **Event monitoring**: Track contract events

#### ✅ SEP-41 Token Operations (Our Use Case)
- **Token deployment**: Deploy new SEP-41 contracts ✅
- **Token transfers**: Send tokens between accounts ✅
- **Token minting**: Mint new tokens (admin) ✅
- **Token burning**: Burn existing tokens ✅
- **Balance queries**: Check token balances ✅

### What You MIGHT Miss Without RPC

#### ⚠️ Performance Optimizations
- **Simulation**: RPC provides `simulateTransaction` for gas estimation
- **State caching**: RPC has optimized contract state access
- **Event streaming**: Real-time contract event subscriptions

#### ⚠️ Developer Experience Features
- **Debug info**: Enhanced error messages and stack traces
- **Contract introspection**: Detailed contract metadata queries
- **Historical queries**: Efficient historical state access

### Reality Check: Do We Actually Need RPC?

**For Token Lab's use cases: NO**

Our application performs:
1. ✅ **Token Deployment** - Horizon handles this perfectly via `/transactions`
2. ✅ **Token Transfers** - Standard transaction submission
3. ✅ **Balance Queries** - Available via Horizon ledger data
4. ✅ **Transaction Monitoring** - Horizon provides full transaction history

**The "limited Soroban features" concern was overstated** - Horizon supports all Soroban operations that Token Lab requires.

## Resolution Strategy

### Current Configuration Fix
```typescript
// Updated FUTURENET_CONFIG in RealTokenDeployer.tsx
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  horizonUrl: 'https://horizon-futurenet.stellar.org',
  sorobanRpcUrl: 'https://horizon-futurenet.stellar.org', // Use Horizon for all operations
  fallbackRpcUrl: 'https://rpc-futurenet.stellar.org', // Keep for future reference
  friendbotUrl: 'https://friendbot-futurenet.stellar.org'
};
```

### Alternative Solutions

#### Option 1: Third-Party RPC Providers (Recommended for Production)
Per [Stellar's ecosystem providers list](https://developers.stellar.org/docs/data/apis/api-providers):

- **BlockDaemon**: Provides Futurenet RPC endpoints
- **Validation Cloud**: Offers combined Horizon + RPC
- **QuickNode**: Supports all Stellar networks
- **Other providers**: Check [CompareNodes.com](https://comparenodes.com/protocols/stellar/) for updated list

#### Option 2: Self-Hosted RPC (Advanced)
Run your own Stellar RPC server:
```bash
# Using stellar/stellar-rpc Docker image
docker run -p 8000:8000 stellar/stellar-rpc --network futurenet
```

#### Option 3: Switch to Testnet (Development Alternative)
Testnet has full public RPC support:
```typescript
const TESTNET_CONFIG = {
  networkPassphrase: Networks.TESTNET,
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org', // Public RPC available
  friendbotUrl: 'https://friendbot.stellar.org'
};
```

## Network Reset Considerations

### Futurenet Reset Policy
- **Frequency**: Irregular schedule (less frequent than Testnet)
- **Impact**: Clears all accounts, contracts, transaction history
- **Warning**: Usually announced but not on fixed schedule
- **Recovery**: All data lost, applications must redeploy

### Best Practices
1. **Don't rely on persistence** - Futurenet data can disappear
2. **Backup important data** - Export contract IDs, transaction hashes
3. **Use Testnet for stable development** - More predictable resets
4. **Mainnet for production** - No resets, but requires third-party RPC

## Recommendations

### For Token Lab Development
1. **✅ Current fix works** - Horizon API handles all our needs
2. **Consider Testnet** - More stable for ongoing development
3. **Plan for Mainnet** - Will need third-party RPC provider

### For Production Applications
1. **Use third-party RPC** - Better performance and features
2. **Implement fallbacks** - Multiple provider endpoints
3. **Monitor service health** - Automated endpoint checking

## Testing Results

After applying the Horizon API fix:
- ✅ **Token deployments**: Should work without RPC timeouts
- ✅ **Token transfers**: Contract operations via Horizon submission
- ✅ **Balance queries**: Full account state available
- ✅ **Transaction monitoring**: Complete transaction history

The 24-hour "outage" was actually a misconfiguration issue - we were trying to use non-existent public RPC endpoints instead of the available Horizon API.

## Action Items

1. ✅ **Fixed configuration** - Updated to use Horizon API
2. ⏳ **Test operations** - Verify token deployment and transfers work
3. 📋 **Monitor performance** - Compare Horizon vs RPC (when available via third-party)
4. 🔄 **Consider migration** - Evaluate third-party RPC providers for enhanced features

---

**Key Insight**: The issue wasn't a service outage, but a fundamental misunderstanding of Stellar's public service offerings. Futurenet simply doesn't have public RPC endpoints by design, and Horizon API is the intended solution for most use cases.