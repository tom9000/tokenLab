# Token Lab x SAFU Wallet Connect Agent 2.0 Integration Specification

**Date**: July 30, 2025  
**Version**: 1.0  
**Target**: Token Lab Development Team  
**Scope**: Integration with SAFU Wallet Connect Agent 2.0

## Executive Summary

SAFU Wallet has implemented **Connect Agent 2.0**, a production-ready agent authentication system that provides enhanced security, user control, and reliability for automated operations. This document outlines the integration requirements, new capabilities, and migration strategy for Token Lab.

## 🔄 Migration Impact Assessment

### For Token Lab Developers

**Good News**: 
- ✅ **Backward Compatible**: Existing Freighter API integration continues to work
- ✅ **Gradual Migration**: Can implement dual support during transition
- ✅ **Enhanced Capabilities**: New features improve security and user experience

**Changes Required**:
- 🔧 **Authentication**: Add API key support alongside existing session auth
- 🔧 **Transaction Flow**: Implement approve-then-transmit pattern
- 🔧 **UI Updates**: Handle async transaction approval workflow

## 🏗️ Current vs New Architecture

### Current Integration (Freighter API)
```typescript
// Token Lab currently uses
const connection = await window.freighter.connect();
const signedXdr = await window.freighter.signTransaction(xdr);
// Immediate response - transaction signed and returned
```

### New Integration (Agent 2.0)
```typescript
// New agent approach
const agent = new SafuAgent(apiKey, keyId);
await agent.authenticate();

const response = await agent.submitTransaction({
  transactionType: 'deploy',
  details: contractData,
  description: 'Deploy SEP-41 Token'
});

// Poll for user approval and network transmission
const result = await agent.waitForCompletion(response.transactionId);
```

## 🔐 Authentication: API Keys vs Passwords

### User Setup Process (SAFU Wallet Side)
1. User navigates to SAFU wallet → Addresses page
2. Clicks "Create API Key" next to desired address
3. Enters name/description: "Token Lab Agent"
4. **One-time display** of API key (user must save securely)
5. API key provides access to that specific address only

### Token Lab Integration
```typescript
class TokenLabAgent {
  constructor(apiKey: string, keyId: string) {
    this.apiKey = apiKey;
    this.keyId = keyId;
  }

  // Step 1: Challenge-response authentication
  async authenticate(): Promise<string> {
    // Request challenge from SAFU wallet
    const challenge = await fetch('/api/agent/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ keyId: this.keyId })
    });

    // Solve challenge with partial API key
    const challengeData = await challenge.json();
    const fragments = challengeData.positions.map(pos => this.apiKey.charAt(pos));
    
    // Submit response
    const authResponse = await fetch('/api/agent/auth/response', {
      method: 'POST',
      body: JSON.stringify({
        challengeId: challengeData.challengeId,
        keyFragments: fragments
      })
    });

    const { sessionToken } = await authResponse.json();
    return sessionToken;
  }
}
```

### Security Benefits
- ✅ **No Password Storage**: Token Lab never handles user passwords
- ✅ **Partial Key Transmission**: Only 5 of 64 characters sent per auth
- ✅ **Per-Address Access**: User controls which addresses are accessible
- ✅ **Revocable**: User can instantly revoke API key access

## 🔄 Transaction Flow: Approve-Then-Transmit

### The New Pattern
**Old**: Submit → Sign → Return signed XDR → Token Lab transmits  
**New**: Submit → User Approves → SAFU Wallet Signs & Transmits → Return network hash

### Implementation Example
```typescript
class TokenLabDeployment {
  async deployContract(contractData: ContractDeployment): Promise<string> {
    // 1. Submit transaction for approval
    const response = await fetch('/api/agent/transaction/submit', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.sessionToken}` },
      body: JSON.stringify({
        transactionType: 'deploy',
        details: {
          contractCode: contractData.wasmHash,
          initArgs: contractData.initArgs,
          network: 'futurenet'
        },
        description: `Deploy ${contractData.name} (${contractData.symbol})`,
        transmitAfterApproval: true
      })
    });

    const submitResult = await response.json();

    // 2. Handle different response types
    if (submitResult.status === 'approved') {
      // Auto-approved, wallet is transmitting
      this.showStatus('Auto-approved! Transmitting to network...');
      return await this.waitForTransmission(submitResult.transactionId);
    } else {
      // Pending user approval
      this.showStatus('Transaction submitted! Please approve in SAFU wallet.');
      return await this.waitForApprovalAndTransmission(submitResult.transactionId);
    }
  }

  async waitForApprovalAndTransmission(transactionId: string): Promise<string> {
    const maxWait = 5 * 60 * 1000; // 5 minutes
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const status = await this.checkTransactionStatus(transactionId);
      
      switch (status.status) {
        case 'pending_approval':
          this.showStatus('⏳ Waiting for wallet approval...');
          break;
        case 'approved':
        case 'signing':
        case 'transmitting':
          this.showStatus('✅ Approved! Wallet is processing...');
          break;
        case 'transmitted':
          this.showStatus(`🎉 Success! Transaction: ${status.networkTxHash}`);
          return status.networkTxHash;
        case 'denied':
          throw new Error('Transaction denied by user');
        case 'expired':
          throw new Error('Transaction expired - please try again');
        case 'failed':
          throw new Error(`Transaction failed: ${status.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Transaction timeout');
  }

  async checkTransactionStatus(transactionId: string) {
    const response = await fetch(`/api/agent/transaction/${transactionId}/status`, {
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });
    return await response.json();
  }
}
```

## 🎛️ User Interface Updates

### Required UI Components

**1. Agent Authentication Setup**
```tsx
const AgentSetup = () => {
  const [apiKey, setApiKey] = useState('');
  const [keyId, setKeyId] = useState('');
  
  return (
    <div className="agent-setup">
      <h3>Connect SAFU Wallet (Agent Mode)</h3>
      <div className="setup-steps">
        <p>1. Open SAFU wallet → Addresses → Create API Key</p>
        <p>2. Enter the API key details below:</p>
        
        <input 
          type="text" 
          placeholder="API Key ID (UUID)"
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
        />
        
        <input 
          type="password" 
          placeholder="API Key (will be hidden)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        
        <button onClick={() => connectAgent(apiKey, keyId)}>
          Connect Agent
        </button>
      </div>
    </div>
  );
};
```

**2. Transaction Status Display**
```tsx
const TransactionStatus = ({ transactionId, onComplete }) => {
  const [status, setStatus] = useState('submitting');
  const [message, setMessage] = useState('Submitting transaction...');

  const statusMessages = {
    'pending_approval': '⏳ Please approve in SAFU wallet',
    'approved': '✅ Approved! Processing...',
    'signing': '📝 Wallet is signing transaction...',
    'transmitting': '🚀 Transmitting to network...',
    'transmitted': '🎉 Transaction successful!',
    'denied': '❌ Transaction denied',
    'expired': '⏰ Transaction expired',
    'failed': '💥 Transaction failed'
  };

  useEffect(() => {
    if (transactionId) {
      pollTransactionStatus(transactionId, setStatus, setMessage, onComplete);
    }
  }, [transactionId]);

  return (
    <div className="transaction-status">
      <div className="status-indicator">
        <span className={`status-${status}`}>{statusMessages[status]}</span>
      </div>
      <div className="status-details">
        {message}
      </div>
    </div>
  );
};
```

## 🔄 Migration Strategy

### Phase 1: Dual Support (Recommended)
```typescript
class TokenLabWalletConnector {
  async connect(): Promise<WalletConnection> {
    // Try Agent 2.0 first (if user has set up API key)
    if (this.hasApiKeyConfiguration()) {
      try {
        return await this.connectAgent2();
      } catch (error) {
        console.warn('Agent 2.0 connection failed, falling back to Freighter:', error);
      }
    }
    
    // Fallback to Freighter API
    return await this.connectFreighter();
  }

  private hasApiKeyConfiguration(): boolean {
    return !!(localStorage.getItem('safu_api_key') && localStorage.getItem('safu_key_id'));
  }

  private async connectAgent2(): Promise<WalletConnection> {
    const apiKey = localStorage.getItem('safu_api_key');
    const keyId = localStorage.getItem('safu_key_id');
    
    const agent = new SafuAgent(apiKey, keyId);
    const sessionToken = await agent.authenticate();
    
    return {
      type: 'agent',
      sessionToken,
      publicKey: await agent.getPublicKey(),
      network: await agent.getNetwork()
    };
  }

  private async connectFreighter(): Promise<WalletConnection> {
    // Existing Freighter implementation
    const connection = await window.freighter.connect();
    
    return {
      type: 'freighter',
      connection,
      publicKey: await window.freighter.getPublicKey(),
      network: await window.freighter.getNetwork()
    };
  }
}
```

### Phase 2: Full Migration (Future)
- Remove Freighter API fallback
- Require API key setup for agent operations
- Maintain Freighter support for manual user interactions

## 🚀 Enhanced Capabilities

### Auto-Approval Configuration
```typescript
// Users can enable auto-approval for specific conditions
const autoApprovalSettings = {
  enabled: true,
  maxAmount: 1000, // Max USDC per transaction
  allowedTokens: ['USDC', 'XLM'],
  trustedOrigins: ['http://localhost:3005'] // Token Lab
};

// When enabled, transactions meeting criteria are auto-approved
```

### Multiple Address Support
```typescript
// Token Lab can now work with multiple wallet addresses
const availableAddresses = await agent.getAvailableAddresses();
// User can generate API keys for different addresses
// Each deployment can use different funding sources
```

### Real-Time Updates (Future)
```typescript
// WebSocket support for live transaction updates
const ws = new WebSocket('wss://wallet.safu.com/agent/transaction-updates');
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  this.updateTransactionStatus(update.transactionId, update.status);
};
```

## 🛠️ Implementation Checklist

### Required Changes
- [ ] **Authentication**: Implement API key authentication flow
- [ ] **Transaction Flow**: Update to approve-then-transmit pattern
- [ ] **UI Components**: Add agent setup and status display components
- [ ] **Error Handling**: Handle new error states (denied, expired, etc.)
- [ ] **Status Polling**: Implement transaction status polling system

### Optional Enhancements
- [ ] **Auto-Approval**: Support auto-approval configuration
- [ ] **Multiple Addresses**: Handle multiple API keys/addresses
- [ ] **Real-Time Updates**: Implement WebSocket status updates
- [ ] **Audit Trail**: Display transaction history and approval logs

### Testing Requirements
- [ ] **End-to-End**: Full deployment flow with approval
- [ ] **Error Scenarios**: Test denied, expired, failed transactions
- [ ] **Fallback**: Verify Freighter API still works
- [ ] **User Experience**: Test approval workflow UX

## 📚 API Reference

### Authentication Endpoints
```typescript
POST /api/agent/auth/challenge
Body: { keyId: string }
Response: { challengeId: string, positions: number[], expiresAt: string }

POST /api/agent/auth/response
Body: { challengeId: string, keyFragments: string[] }
Response: { sessionToken: string, expiresAt: string, publicKey: string }
```

### Transaction Endpoints
```typescript
POST /api/agent/transaction/submit
Headers: { Authorization: "Bearer session-token" }
Body: {
  transactionType: 'deploy' | 'send' | 'sign',
  details: TransactionDetails,
  description: string,
  network: string
}
Response: { transactionId: string, status: string, message: string }

GET /api/agent/transaction/{id}/status
Response: {
  transactionId: string,
  status: 'pending_approval' | 'approved' | 'transmitted' | 'denied' | 'failed',
  networkTxHash?: string,
  error?: string
}
```

## 🤝 Support and Integration Assistance

### SAFU Wallet Team Support
- **Technical Questions**: Available for integration support
- **Testing Environment**: Shared testnet setup for validation
- **Documentation**: This spec will be updated based on feedback

### Token Lab Implementation Timeline
**Recommended**: 2-3 week implementation timeline
- **Week 1**: Authentication and basic transaction flow
- **Week 2**: UI updates and error handling
- **Week 3**: Testing and optimization

## 🎯 Benefits Summary

### For Token Lab
- ✅ **Enhanced Security**: No password handling, per-address access
- ✅ **Better UX**: Clear approval workflow, user control
- ✅ **Production Ready**: Proper session management, monitoring
- ✅ **Future-Proof**: Extensible for advanced features

### For Token Lab Users
- ✅ **Full Control**: Manual approval for each transaction
- ✅ **Granular Access**: Choose which addresses to expose
- ✅ **Revocable**: Instant API key revocation
- ✅ **Transparent**: Complete transaction history and status

---

**Next Steps**: Review this specification with the Token Lab team, identify any questions or concerns, and establish an implementation timeline. The SAFU Wallet team is available to support the integration process.