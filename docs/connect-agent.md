# Connect Agent - Programmatic SAFU Wallet Integration

This document explains the **Connect Agent** functionality in Token Lab, which enables programmatic wallet connections and transaction signing without popup windows.

## Overview

The Connect Agent feature provides automated wallet integration for scenarios where popup-based user interaction is not desired:

- **Automated Testing** - CI/CD pipelines and test suites
- **Agent-Driven Deployments** - Programmatic contract deployment
- **Background Operations** - Scheduled or batch transactions
- **Development Workflows** - Streamlined testing and iteration

## User Interface

### Connect Agent Button

Located next to the "Connect Local" button in the wallet connection area:

```
[Connect Local] [Connect Agent] [Connect Browser]
```

- **Color**: Blue (`bg-blue-600`) to distinguish from popup mode
- **Behavior**: Direct API communication instead of popup windows
- **Icon**: Same wallet icon but indicates programmatic access

### Visual Indicators

When connected via Agent mode:
- Connection logs show "(Agent)" suffix
- Ready message indicates "Ready for automated deployment!"
- All subsequent operations use programmatic signing

## Technical Implementation

### Connection Flow

1. **User clicks "Connect Agent"**
2. **Direct API call** to SAFU wallet (no popup)
3. **Wallet authenticates** and returns account details
4. **Token Lab stores** connection in "agent" mode
5. **All transactions** use programmatic signing

### API Endpoints Required

The SAFU wallet must implement these endpoints:

#### POST /api/connect
```json
{
  "appName": "Token Lab",
  "description": "Programmatic connection for automated deployment",
  "origin": "http://localhost:3005", 
  "mode": "agent"
}
```

**Expected Response:**
```json
{
  "success": true,
  "publicKey": "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN",
  "network": "futurenet"
}
```

#### POST /api/sign
```json
{
  "transactionXdr": "AAAAAgAAAAA...",
  "networkPassphrase": "Test SDF Future Network ; October 2022",
  "network": "futurenet",
  "description": "Deploy SEP-41 Token: My Token (MTK)",
  "appName": "Token Lab",
  "mode": "agent",
  "origin": "http://localhost:3005"
}
```

**Expected Response:**
```json
{
  "success": true,
  "signedTransactionXdr": "AAAAAgAAAAA...",
  "transactionHash": "abc123...",
  "network": "futurenet",
  "publicKey": "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN"
}
```

## Code Architecture

### Connection Function

```typescript
const connectToWalletAgent = async () => {
  try {
    addLog('🔐 Connecting to SAFU wallet programmatically...', 'info');
    
    const response = await fetch('http://localhost:3003/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appName: 'Token Lab',
        description: 'Programmatic connection for automated deployment',
        origin: window.location.origin,
        mode: 'agent'
      })
    });

    const result = await response.json();
    
    if (result.success && result.publicKey) {
      setWallet({
        isConnected: true,
        publicKey: result.publicKey,
        network: result.network || 'futurenet',
        mode: 'agent'  // Key: tracks connection type
      });
      // ... success handling
    }
  } catch (error) {
    // ... error handling
  }
};
```

### Transaction Signing

```typescript
export async function signTransactionAgent(
  transactionXdr: string,
  options: PopupSigningOptions = {}
): Promise<PopupSigningResult> {
  
  const response = await fetch('http://localhost:3003/api/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionXdr,
      networkPassphrase,
      network,
      description,
      appName,
      mode: 'agent',
      origin: window.location.origin
    })
  });

  const result = await response.json();
  
  if (result.success) {
    return {
      signedTransactionXdr: result.signedTransactionXdr,
      transactionHash: result.transactionHash,
      submitted: !!result.transactionHash,
      network: result.network,
      publicKey: result.publicKey
    };
  }
  
  throw new Error(result.error || 'Transaction signing failed');
}
```

### Mode Detection

```typescript
// Automatic selection based on connection type
const signingResult = wallet.mode === 'agent' 
  ? await signTransactionAgent(transactionXdr, options)
  : await signTransactionWithPopup(transactionXdr, options);
```

## Wallet Implementation Requirements

### Authentication Strategy

The SAFU wallet should implement secure authentication for agent mode:

1. **Pre-approved Origins** - Whitelist trusted applications
2. **Session Management** - Temporary tokens for agent connections  
3. **Permission Levels** - Different scopes (read-only, signing, admin)
4. **Rate Limiting** - Prevent abuse of programmatic access

### Security Considerations

- **CORS Configuration** - Properly configure cross-origin requests
- **Request Validation** - Validate all incoming parameters
- **Transaction Limits** - Optional spending limits for agent mode
- **Audit Logging** - Log all programmatic operations
- **Revocation** - Ability to revoke agent access

### Example Implementation

```javascript
// SAFU Wallet - Agent Connection Handler
app.post('/api/connect', async (req, res) => {
  const { appName, description, origin, mode } = req.body;
  
  if (mode === 'agent') {
    // Validate origin is whitelisted
    if (!isOriginWhitelisted(origin)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Origin not authorized for agent access' 
      });
    }
    
    // Check if wallet is unlocked
    if (!wallet.isUnlocked()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Wallet is locked' 
      });
    }
    
    // Return account details
    res.json({
      success: true,
      publicKey: wallet.getPublicKey(),
      network: wallet.getNetwork()
    });
  }
});

// SAFU Wallet - Agent Signing Handler  
app.post('/api/sign', async (req, res) => {
  const { transactionXdr, mode, origin } = req.body;
  
  if (mode === 'agent') {
    // Validate and sign
    const signedXdr = await wallet.signTransaction(transactionXdr);
    
    res.json({
      success: true,
      signedTransactionXdr: signedXdr,
      publicKey: wallet.getPublicKey(),
      network: wallet.getNetwork()
    });
  }
});
```

## Usage Examples

### Automated Testing

```typescript
// Test Suite
describe('Token Deployment', () => {
  beforeEach(async () => {
    await connectToWalletAgent();
  });
  
  it('should deploy SEP-41 token', async () => {
    await deployToken();
    expect(deployedTokens).toHaveLength(1);
  });
});
```

### CI/CD Pipeline

```yaml
# GitHub Actions
- name: Deploy Contract
  run: |
    npm run start:agent
    npm run deploy:automated
```

### Batch Operations

```typescript
// Deploy multiple tokens programmatically
const configs = [
  { name: "Token A", symbol: "TKA" },
  { name: "Token B", symbol: "TKB" },
  { name: "Token C", symbol: "TKC" }
];

for (const config of configs) {
  setTokenConfig(config);
  await deployToken(); // Uses agent signing
}
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Connection failed: 404` | SAFU wallet not running | Start wallet at localhost:3003 |
| `Origin not authorized` | App not whitelisted | Add origin to wallet whitelist |
| `Wallet is locked` | Wallet requires unlock | Unlock wallet or implement auto-unlock |
| `Signing failed: 401` | Invalid permissions | Check agent access permissions |

### Error Messages

```typescript
// Connection Errors
"Failed to connect (Agent): Connection failed: 404"
"Make sure SAFU wallet is running at localhost:3003"

// Signing Errors  
"Agent signing failed: Wallet is locked"
"Agent signing failed: Transaction rejected"
```

## Comparison: Agent vs Popup Mode

| Feature | Popup Mode | Agent Mode |
|---------|------------|------------|
| **User Interaction** | Required for each transaction | None after initial setup |
| **Security** | User confirms each action | Pre-authorized operations |
| **Automation** | Limited | Full automation possible |
| **Testing** | Manual testing only | Automated test suites |
| **CI/CD** | Not suitable | Perfect for pipelines |
| **Development** | Slower iteration | Rapid development |

## Future Enhancements

### Planned Features

- **Connection Persistence** - Remember agent connections across sessions
- **Permission Granularity** - Fine-grained access control per operation
- **Batch Transactions** - Sign multiple transactions in one call
- **Webhook Support** - Real-time transaction status updates
- **Session Management** - Temporary agent tokens with expiration

### Integration Ideas

- **VS Code Extension** - Deploy contracts directly from IDE
- **CLI Tool** - Command-line contract deployment
- **Monitoring Dashboard** - Real-time deployment status
- **Multi-Wallet Support** - Agent mode for multiple wallet types

## Conclusion

The Connect Agent feature bridges the gap between manual wallet interactions and fully automated blockchain operations. It enables powerful development workflows while maintaining security through proper authentication and authorization mechanisms.

For SAFU wallet developers: implementing these API endpoints will unlock automated testing, CI/CD integration, and streamlined development workflows for all Token Lab users.