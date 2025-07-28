# Connect Agent - Hybrid Mode How-To Guide

This guide shows how to use SAFU wallet's hybrid agent mode for automated Token Lab interactions without exposing access tokens to Token Lab directly.

## Overview

The hybrid approach separates wallet authentication from dApp interaction:

1. **Agent unlocks wallet** using Playwright to get session data
2. **Agent switches to Token Lab** and uses extracted data with "Connect Agent" 
3. **Agent continues** with API-based operations for efficiency

This keeps access tokens secure within the agent's control rather than exposing them to Token Lab.

## Quick Session Key Access

For the simplest approach, agents can get the session key directly:

```javascript
// Navigate to SAFU wallet and unlock it first
await mcp__playwright__playwright_navigate({url: "http://localhost:3003"});

// If needed, unlock the wallet (use Agent Test Wallet button for quick setup)
await mcp__playwright__playwright_click({
  selector: "button:has-text('🤖 Agent Test Wallet')"
});

// Get session key with one simple call
const sessionKey = await mcp__playwright__playwright_evaluate({
  script: "window.getSafuSessionKey()"
});

console.log('Session Key:', sessionKey);
// Returns: "4822150c148d16ab3decdbe1e2606cc5699934c21b843ccba5b630f53ea97db1"
```

**Benefits:**
- ✅ **Single function call** - No searching through logs
- ✅ **Fast execution** - Direct localStorage access and JWT decode  
- ✅ **Clean output** - Just returns the session key string
- ✅ **Error handling** - Returns `null` if no session or token issues

The `window.getSafuSessionKey()` function is automatically available once the wallet is loaded.

## Prerequisites

- SAFU wallet running on `http://localhost:3003`
- Token Lab running on `http://localhost:3005`
- Playwright MCP available for browser automation

## Step-by-Step Workflow

### Step 1: Unlock SAFU Wallet and Extract Session Data

```javascript
// 1. Navigate to SAFU wallet
await mcp__playwright__playwright_navigate({url: "http://localhost:3003"});

// 2. Check if wallet needs to be created or unlocked
const walletPage = await mcp__playwright__playwright_evaluate({
  script: "document.querySelector('meta[name=\"wallet-page\"]')?.content"
});

if (walletPage === "create") {
  // Use Agent Test Wallet for quick setup
  await mcp__playwright__playwright_click({
    selector: "button:has-text('🤖 Agent Test Wallet')"
  });
} else if (walletPage === "unlock") {
  // Unlock existing wallet
  await mcp__playwright__playwright_fill({
    selector: "input[type='password']", 
    value: "TestPass123!"
  });
  await mcp__playwright__playwright_click({
    selector: "button:has-text('Unlock')"
  });
}

// 3. Extract all required session data
const sessionData = await mcp__playwright__playwright_evaluate({
  script: `(() => {
    const accessToken = localStorage.getItem('safu_access_token');
    const sessionPassword = window.getSessionPasswordForAgent();
    const encryptedWalletData = localStorage.getItem('solana_encrypted_wallet_data_v2');
    const parsedData = encryptedWalletData ? JSON.parse(encryptedWalletData) : null;
    
    return {
      accessToken,
      sessionPassword,
      encryptedSeed: parsedData?.encryptedMnemonic || null,
      // Validation
      hasAccessToken: !!accessToken,
      hasSessionPassword: !!sessionPassword,
      hasEncryptedSeed: !!parsedData?.encryptedMnemonic
    };
  })()`
});

console.log('Session data extracted:', {
  hasAccessToken: sessionData.hasAccessToken,
  hasSessionPassword: sessionData.hasSessionPassword,
  hasEncryptedSeed: sessionData.hasEncryptedSeed
});
```

### Step 2: Connect to Token Lab Using Agent Mode

```javascript
// 1. Navigate to Token Lab
await mcp__playwright__playwright_navigate({url: "http://localhost:3005"});

// 2. Test connection using extracted session data
const connectResult = await mcp__playwright__playwright_evaluate({
  script: `(async () => {
    try {
      const response = await fetch('http://localhost:3003/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: 'Token Lab',
          description: 'Programmatic connection for automated deployment',
          origin: 'http://localhost:3005',
          mode: 'agent',
          accessToken: '${sessionData.accessToken}'
        })
      });
      
      const result = await response.json();
      console.log('Agent connect result:', result);
      return { status: response.status, ...result };
      
    } catch (error) {
      return { error: error.message };
    }
  })()`
});

if (connectResult.success) {
  console.log('✅ Agent connection successful:', connectResult.publicKey);
} else {
  console.error('❌ Agent connection failed:', connectResult.error);
}
```

### Step 3: Sign Transactions Using Hybrid API

```javascript
// Example: Deploy a SEP-41 token
const deployToken = async (tokenConfig) => {
  // In a real scenario, Token Lab would generate the deployment XDR
  // For this example, we'll use a placeholder
  const deploymentXdr = await generateSEP41DeploymentXdr(tokenConfig);
  
  const signResult = await mcp__playwright__playwright_evaluate({
    script: `(async () => {
      try {
        const response = await fetch('http://localhost:3003/api/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionXdr: '${deploymentXdr}',
            networkPassphrase: 'Test SDF Future Network ; October 2022',
            network: 'futurenet',
            description: 'Deploy SEP-41 Token: ${tokenConfig.name} (${tokenConfig.symbol})',
            appName: 'Token Lab',
            mode: 'agent',
            origin: 'http://localhost:3005',
            accessToken: '${sessionData.accessToken}',
            sessionPassword: '${sessionData.sessionPassword}',
            encryptedSeed: '${sessionData.encryptedSeed}'
          })
        });
        
        const result = await response.json();
        console.log('Agent signing result:', result);
        return { status: response.status, ...result };
        
      } catch (error) {
        return { error: error.message };
      }
    })()`
  });
  
  return signResult;
};

// Deploy a token
const tokenConfig = {
  name: "Test Token",
  symbol: "TEST",
  decimals: 7,
  initialSupply: 1000000
};

const deployResult = await deployToken(tokenConfig);
if (deployResult.success) {
  console.log('✅ Token deployed:', deployResult.transactionHash);
} else {
  console.error('❌ Deployment failed:', deployResult.error);
}
```

## Complete Example Script

```javascript
// Complete hybrid agent workflow
async function runHybridAgentWorkflow() {
  try {
    console.log('🚀 Starting hybrid agent workflow...');
    
    // Step 1: Unlock wallet and extract session data
    await mcp__playwright__playwright_navigate({url: "http://localhost:3003"});
    
    const walletPage = await mcp__playwright__playwright_evaluate({
      script: "document.querySelector('meta[name=\"wallet-page\"]')?.content"
    });
    
    if (walletPage === "create") {
      await mcp__playwright__playwright_click({
        selector: "button:has-text('🤖 Agent Test Wallet')"
      });
    }
    
    const sessionData = await mcp__playwright__playwright_evaluate({
      script: `(() => {
        const accessToken = localStorage.getItem('safu_access_token');
        const sessionPassword = window.getSessionPasswordForAgent();
        const encryptedWalletData = localStorage.getItem('solana_encrypted_wallet_data_v2');
        const parsedData = encryptedWalletData ? JSON.parse(encryptedWalletData) : null;
        
        return {
          accessToken,
          sessionPassword,
          encryptedSeed: parsedData?.encryptedMnemonic || null
        };
      })()`
    });
    
    // Step 2: Navigate to Token Lab and test connection
    await mcp__playwright__playwright_navigate({url: "http://localhost:3005"});
    
    const connectResult = await mcp__playwright__playwright_evaluate({
      script: `(async () => {
        const response = await fetch('http://localhost:3003/api/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appName: 'Token Lab',
            origin: 'http://localhost:3005',
            mode: 'agent',
            accessToken: '${sessionData.accessToken}'
          })
        });
        return response.json();
      })()`
    });
    
    if (connectResult.success) {
      console.log('✅ Hybrid agent workflow successful!');
      console.log('Wallet:', connectResult.publicKey);
      console.log('Network:', connectResult.network);
      
      // Continue with token deployments or other operations...
      
    } else {
      console.error('❌ Connection failed:', connectResult.error);
    }
    
  } catch (error) {
    console.error('❌ Workflow failed:', error);
  }
}

// Run the workflow
await runHybridAgentWorkflow();
```

## Security Best Practices

### ✅ Secure Approach (Recommended)
- Agent controls all session data
- Access tokens never exposed to Token Lab
- Session data extracted only when needed
- Agent manages authentication lifecycle

### ❌ Insecure Approach (Avoid)
- Token Lab directly accessing wallet localStorage
- Storing access tokens in Token Lab's storage
- Sharing session passwords across applications

## Error Handling

### Common Issues and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing required parameters` | No access token provided | Ensure sessionData.accessToken is valid |
| `Wallet is locked` | Wallet not unlocked properly | Check wallet unlock step succeeded |
| `Session password not available` | sessionPassword extraction failed | Verify `window.getSessionPasswordForAgent()` works |
| `Origin not authorized` | Wrong origin in request | Use exact origin: `http://localhost:3005` |

### Validation Checklist

Before proceeding with agent operations, verify:

```javascript
const isReady = sessionData.hasAccessToken && 
                sessionData.hasSessionPassword && 
                sessionData.hasEncryptedSeed;

if (!isReady) {
  console.error('❌ Session data incomplete:', {
    hasAccessToken: sessionData.hasAccessToken,
    hasSessionPassword: sessionData.hasSessionPassword,
    hasEncryptedSeed: sessionData.hasEncryptedSeed
  });
  return;
}
```

## Advanced Usage

### Batch Operations

Once connected, agents can perform multiple operations efficiently:

```javascript
// Deploy multiple tokens in sequence
const tokens = [
  { name: "Token A", symbol: "TKA" },
  { name: "Token B", symbol: "TKB" },
  { name: "Token C", symbol: "TKC" }
];

for (const token of tokens) {
  const result = await deployToken(token);
  console.log(`${token.symbol}: ${result.success ? '✅' : '❌'}`);
}
```

### Session Management

```javascript
// Check if session is still valid before operations
const validateSession = async () => {
  const connectTest = await fetch('http://localhost:3003/api/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appName: 'Token Lab',
      origin: 'http://localhost:3005',
      mode: 'agent',
      accessToken: sessionData.accessToken
    })
  });
  
  return (await connectTest.json()).success;
};
```

## Troubleshooting

### Debug Mode

Enable verbose logging to diagnose issues:

```javascript
// Add this before API calls
console.log('🔍 Debug session data:', {
  hasAccessToken: !!sessionData.accessToken,
  tokenLength: sessionData.accessToken?.length,
  hasPassword: !!sessionData.sessionPassword,
  passwordLength: sessionData.sessionPassword?.length,
  hasEncryptedSeed: !!sessionData.encryptedSeed,
  seedLength: sessionData.encryptedSeed?.length
});
```

### Common Playwright Issues

1. **Window context lost**: Always check current URL before operations
2. **Session expired**: Re-extract session data if calls start failing
3. **Network timeouts**: Add appropriate delays between operations

## Conclusion

The hybrid agent mode provides a secure and efficient way to automate Token Lab operations while maintaining full control over wallet credentials. This approach scales well for CI/CD pipelines, automated testing, and batch operations.