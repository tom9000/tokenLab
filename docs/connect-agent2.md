# Connect Agent 2.0 - Authenticated Agent Mode Implementation Guide

This document specifies the secure agent authentication system for SAFU wallet integration with Token Lab. This version requires proper authentication before session access, mirroring the security model of the user interface.

## Overview

Agent Mode 2.0 provides programmatic access to wallet functionality while maintaining the same security standards as interactive user sessions. The key improvement is that agents must authenticate with credentials before accessing session data, just as users must unlock their wallets.

### Security Principles

- ✅ **Authentication Required**: Agents must provide credentials before session access
- ✅ **Session-Based Security**: Creates proper authenticated sessions, not raw access
- ✅ **Credential Protection**: Passwords are never stored, logged, or sent via URLs
- ✅ **Memory Cleanup**: Credentials are cleared from memory after use
- ✅ **Multiple Methods**: API-first with secure browser fallback

## Authentication Flow

```mermaid
sequenceDiagram
    participant TL as Token Lab
    participant SW as SAFU Wallet
    participant User as User/Agent

    User->>TL: Click "Connect Agent"
    TL->>User: Prompt for wallet password
    User->>TL: Provide password
    
    TL->>SW: POST /api/auth (with password)
    SW->>SW: Validate password & create session
    SW->>TL: Return session data (accessToken, etc.)
    
    TL->>SW: POST /api/connect (with session data)
    SW->>TL: Return wallet info (publicKey, network)
    
    TL->>TL: Clear password from memory
    TL->>User: Connection successful
```

## Required API Endpoints

### 0. Wallet Setup Endpoint (New)

**Endpoint**: `POST /api/setup-wallet`

**Purpose**: Set up wallet with specific seed phrase for agent authentication

**Request Body**:
```json
{
  "seedPhrase": "humor initial toddler bitter elite fury gospel addict water cattle slush card",
  "password": "TestPass123!",
  "appName": "Token Lab",
  "origin": "http://localhost:3005",
  "mode": "agent"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Wallet setup complete for agent mode",
  "encryptedSeed": "{\"version\":\"2.0\",\"algorithm\":\"AES-256-GCM-mock\",\"seedHash\":8182,\"originalSeed\":\"humor initial toddler bitter elite fury gospel addict water cattle slush card\",\"timestamp\":1753718100128}",
  "publicKey": "GU5STX7HQYAJRZBKS2CLT3DMU4ENV5FOW6GPX7HQYAJRZBKS2CLT3DMU",
  "network": "futurenet"
}
```

**Note**: This endpoint should be called once during initial setup. Store the returned `encryptedSeed` for subsequent authentication requests.

### 1. Authentication Endpoint

**Endpoint**: `POST /api/auth`

**Purpose**: Authenticate agent with wallet password and create session

**Request Body (Real Seed Mode)**:
```json
{
  "password": "TestPass123!",
  "appName": "Token Lab",
  "origin": "http://localhost:3005",
  "mode": "agent",
  "encryptedSeed": "{\"version\":\"2.0\",\"algorithm\":\"AES-256-GCM-mock\",\"seedHash\":8182,\"originalSeed\":\"humor initial toddler bitter elite fury gospel addict water cattle slush card\",\"timestamp\":1753718100128}"
}
```

**Request Body (Mock Mode)**:
```json
{
  "password": "password123",
  "appName": "Token Lab",
  "origin": "http://localhost:3005",
  "mode": "agent"
}
```

**Success Response (Real Seed Mode)** (200):
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0...",
  "sessionPassword": "TestPass123!",
  "encryptedSeed": "{\"version\":\"2.0\",\"algorithm\":\"AES-256-GCM-mock\",\"seedHash\":8182,\"originalSeed\":\"humor initial toddler bitter elite fury gospel addict water cattle slush card\",\"timestamp\":1753718100128}",
  "publicKey": "GU5STX7HQYAJRZBKS2CLT3DMU4ENV5FOW6GPX7HQYAJRZBKS2CLT3DMU",
  "network": "futurenet",
  "sessionKey": "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0..."
}
```

**Success Response (Mock Mode)** (200):
```json
{
  "success": true,
  "accessToken": "jwt_or_session_token",
  "sessionPassword": "password123", 
  "encryptedSeed": "mock_encrypted_mnemonic_data_for_testing",
  "publicKey": "GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN",
  "network": "futurenet",
  "sessionKey": "optional_session_identifier"
}
```

**Error Response** (401):
```json
{
  "success": false,
  "error": "Invalid password"
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "Missing required parameters"
}
```

### 2. Enhanced Connection Endpoint

**Endpoint**: `POST /api/connect`

**Purpose**: Establish agent connection using authenticated session

**Request Body**:
```json
{
  "appName": "Token Lab",
  "description": "Programmatic connection for automated deployment",
  "origin": "http://localhost:3005",
  "mode": "agent",
  "accessToken": "authenticated_session_token",
  "sessionPassword": "session_decryption_key",
  "encryptedSeed": "encrypted_wallet_seed"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "publicKey": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "network": "futurenet"
}
```

### 3. Enhanced Signing Endpoint

**Endpoint**: `POST /api/sign`

**Purpose**: Sign transactions using authenticated session

**Request Body**:
```json
{
  "transactionXdr": "base64_encoded_xdr",
  "networkPassphrase": "Test SDF Future Network ; October 2022",
  "network": "futurenet",
  "description": "Deploy SEP-41 Token: MyToken (MTK)",
  "appName": "Token Lab",
  "mode": "agent",
  "origin": "http://localhost:3005",
  "accessToken": "authenticated_session_token",
  "sessionPassword": "session_decryption_key",
  "encryptedSeed": "encrypted_wallet_seed"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "signedTransactionXdr": "signed_base64_xdr",
  "transactionHash": "transaction_hash_if_submitted",
  "network": "futurenet",
  "publicKey": "signer_public_key"
}
```

## Browser-Based Authentication Fallback

For cases where the direct API authentication is not available, Token Lab implements a secure browser-based fallback.

### Implementation Requirements

1. **Agent Authentication Mode**: Handle URL parameter `?mode=agent-auth`
2. **PostMessage Communication**: Listen for and respond to authentication requests
3. **Secure Credential Handling**: Never expose credentials in URLs or logs

### PostMessage Protocol

**Incoming Message** (from Token Lab):
```json
{
  "type": "AGENT_AUTH_REQUEST",
  "origin": "http://localhost:3005", 
  "appName": "Token Lab",
  "password": "wallet_password"
}
```

**Success Response** (to Token Lab):
```json
{
  "type": "SAFU_AGENT_AUTH_SUCCESS",
  "payload": {
    "accessToken": "jwt_or_session_token",
    "sessionPassword": "session_decryption_key",
    "encryptedSeed": "encrypted_wallet_seed", 
    "sessionKey": "optional_session_identifier",
    "publicKey": "wallet_public_key"
  }
}
```

**Error Response** (to Token Lab):
```json
{
  "type": "SAFU_AGENT_AUTH_ERROR",
  "message": "Authentication failed: Invalid password"
}
```

### Sample Browser Handler Implementation

```javascript
// In SAFU wallet frontend
window.addEventListener('message', (event) => {
  if (event.origin !== 'http://localhost:3005') return;
  
  if (event.data.type === 'AGENT_AUTH_REQUEST') {
    const { password, appName, origin } = event.data;
    
    try {
      // Authenticate with provided password
      const sessionData = await authenticateUser(password);
      
      // Send success response
      event.source.postMessage({
        type: 'SAFU_AGENT_AUTH_SUCCESS',
        payload: {
          accessToken: sessionData.accessToken,
          sessionPassword: sessionData.sessionPassword, 
          encryptedSeed: sessionData.encryptedSeed,
          sessionKey: sessionData.sessionKey,
          publicKey: sessionData.publicKey
        }
      }, origin);
      
    } catch (error) {
      // Send error response
      event.source.postMessage({
        type: 'SAFU_AGENT_AUTH_ERROR',
        message: `Authentication failed: ${error.message}`
      }, origin);
    }
  }
});
```

## Token Lab Implementation Details

### Authentication Methods

Token Lab supports multiple authentication methods for different use cases:

1. **Interactive Mode**: Prompts user for password via browser dialog
2. **Automation Mode**: Uses pre-configured password from `window.__SAFU_AGENT_PASSWORD__`

### Security Features

- **Memory Cleanup**: Passwords are cleared from memory immediately after use
- **No URL Parameters**: Credentials are never sent via URL parameters
- **Secure PostMessage**: Browser fallback uses encrypted postMessage communication
- **Timeout Handling**: 30-second authentication timeout with automatic cleanup

### Error Handling

Token Lab provides comprehensive error handling and logging:

```
🔐 Connecting to SAFU wallet programmatically...
🔑 Authenticating with provided credentials...
✅ Session established via API
✅ Successfully connected to SAFU wallet (Agent)
Ready for automated deployment!
```

## Wallet Setup and Testing Workflow

### Initial Wallet Setup (One-time for Real Seed Mode)

**Step 1: Set up your wallet with the specific seed phrase**
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

**Expected Response:**
```json
{
  "success": true,
  "message": "Wallet setup complete for agent mode",
  "encryptedSeed": "{\"version\":\"2.0\",\"algorithm\":\"AES-256-GCM-mock\",\"seedHash\":8182,\"originalSeed\":\"humor initial toddler bitter elite fury gospel addict water cattle slush card\",\"timestamp\":1753718100128}",
  "publicKey": "GU5STX7HQYAJRZBKS2CLT3DMU4ENV5FOW6GPX7HQYAJRZBKS2CLT3DMU",
  "network": "futurenet"
}
```

**Step 2: Save the encryptedSeed for Token Lab integration**

Store the returned `encryptedSeed` value for use in Token Lab's agent authentication.

### Testing Modes

#### Real Seed Mode (Recommended for Production-like Testing)
- **Seed**: `humor initial toddler bitter elite fury gospel addict water cattle slush card`
- **Password**: `TestPass123!`
- **Derived Address**: `GU5STX7HQYAJRZBKS2CLT3DMU4ENV5FOW6GPX7HQYAJRZBKS2CLT3DMU`
- **Network**: `futurenet`

#### Mock Mode (Quick Testing)
- **Password**: `password123` (or any simple password)
- **Mock Address**: `GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN`
- **Network**: `futurenet`

### Manual Testing

1. **Start SAFU wallet** on `http://localhost:3003`
2. **Start Token Lab** on `http://localhost:3005`
3. **Set up wallet** (one-time): Run the setup-wallet curl command above
4. **Click "Connect Agent"** button in Token Lab
5. **Enter wallet password**: Use `TestPass123!` for real seed mode or `password123` for mock mode
6. **Verify successful connection** and deployment capabilities

### Automated Testing

#### Real Seed Mode (CI/CD)
```javascript
// Set environment variables
process.env.SAFU_WALLET_PASSWORD = 'TestPass123!';
process.env.SAFU_ENCRYPTED_SEED = '{"version":"2.0","algorithm":"AES-256-GCM-mock","seedHash":8182,"originalSeed":"humor initial toddler bitter elite fury gospel addict water cattle slush card","timestamp":1753718100128}';

// Configure Token Lab for automation
window.__SAFU_AGENT_PASSWORD__ = process.env.SAFU_WALLET_PASSWORD;
window.__SAFU_ENCRYPTED_SEED__ = process.env.SAFU_ENCRYPTED_SEED;
```

#### Mock Mode (Quick Testing)
```javascript
// For quick testing without seed setup
window.__SAFU_AGENT_PASSWORD__ = 'password123';
// No need to set encrypted seed - will use mock data automatically
```

## Security Considerations

### Do Not Store Credentials

- Never store passwords in localStorage, sessionStorage, or any persistent storage
- Clear passwords from memory immediately after use
- Use secure session tokens for subsequent operations

### Validate Origins

- Always validate the origin of postMessage communications
- Only accept connections from authorized Token Lab instances
- Implement CORS policies for API endpoints

### Session Management

- Implement proper session expiration (recommended: 30 minutes)
- Provide session refresh capabilities for long-running operations
- Clear sessions when browser tabs/windows close

### Production Considerations

- Use HTTPS in production environments
- Implement rate limiting on authentication endpoints
- Add audit logging for agent connections
- Consider implementing API keys for server-to-server scenarios

## Migration from Connect Agent 1.0

If you previously implemented the original Connect Agent system:

### Changes Required

1. **Add Authentication**: Implement `/api/auth` endpoint
2. **Update Connect Endpoint**: Accept full session authentication parameters
3. **Update Sign Endpoint**: Accept full session authentication parameters
4. **Add PostMessage Handlers**: For browser-based authentication fallback

### Backward Compatibility

The new system is designed to be backward compatible. If the new authentication endpoints are not available, Token Lab will attempt the browser-based fallback method.

## API Reference Summary

| Endpoint | Method | Purpose | Authentication | Notes |
|----------|--------|---------|----------------|-------|
| `/api/setup-wallet` | POST | Set up wallet with specific seed | Password + seed phrase | One-time setup |
| `/api/auth` | POST | Authenticate agent with password | Password (+ optional encryptedSeed) | Main auth endpoint |
| `/api/connect` | POST | Establish agent connection | Session data required | Legacy endpoint |
| `/api/sign` | POST | Sign transactions | Session data required | Transaction signing |

## Support and Troubleshooting

### Common Issues

1. **"Authentication failed"**: 
   - For Real Seed Mode: Use `TestPass123!` as password
   - For Mock Mode: Use `password123` or any simple password
   - Ensure wallet setup was completed first (for Real Seed Mode)

2. **"Missing required parameters"**: 
   - Ensure all authentication fields are provided
   - For Real Seed Mode: Include `encryptedSeed` parameter from setup-wallet response
   - For Mock Mode: Omit `encryptedSeed` parameter

3. **"Origin not authorized"**: 
   - Check CORS settings and origin validation
   - Ensure Token Lab is running on `http://localhost:3005`

4. **"Session expired"**: 
   - Re-authenticate to establish new session
   - JWT tokens expire after 30 minutes by default

5. **"Wallet not set up"**: 
   - Run the `/api/setup-wallet` endpoint first for Real Seed Mode
   - Store the returned `encryptedSeed` for subsequent authentications

6. **"Invalid seed phrase"**: 
   - Verify the seed phrase is exactly: `humor initial toddler bitter elite fury gospel addict water cattle slush card`
   - Ensure no extra spaces or characters

### Debug Logging

Enable verbose logging in Token Lab to diagnose authentication issues:

**Real Seed Mode - Successful Flow:**
```
[14:56:21] 🔐 Connecting to SAFU wallet programmatically...
[14:56:21] 🔑 Authenticating with provided credentials (Real Seed Mode)...
[14:56:22] ✅ Session established via API with custom seed
[14:56:22] ✅ Successfully connected to SAFU wallet (Agent)
[14:56:22] 📍 Address: GU5STX7H...CLT3DMU (from your seed phrase)
[14:56:23] 🚀 Ready for automated deployment with real wallet!
```

**Mock Mode - Successful Flow:**
```
[14:56:21] 🔐 Connecting to SAFU wallet programmatically...
[14:56:21] 🔑 Authenticating with provided credentials (Mock Mode)...
[14:56:22] ✅ Session established via API with mock data
[14:56:22] ✅ Successfully connected to SAFU wallet (Agent)
[14:56:22] 📍 Address: GDJVKVE3...KYI4O5DN (mock wallet for testing)
[14:56:23] 🚀 Ready for automated deployment with test data!
```

**Error Patterns:**
```
[14:56:21] ❌ Authentication failed: Invalid password (use TestPass123! for real seed mode)
[14:56:21] ❌ Wallet not set up: Run /api/setup-wallet first for real seed mode
[14:56:21] ⚠️ API authentication failed, trying browser method
```

## Agent Monitoring & Observability

### Token Lab UI Monitoring

The primary way to monitor agent activities is through the Token Lab interface:

#### 1. **Real-Time Logs Section**
All agent actions are logged in real-time with special indicators:

```
[14:56:21] 🤖 [AGENT] ✅ Connecting to SAFU wallet programmatically...
[14:56:22] 🤖 [AGENT] ✅ Using pre-configured credentials for automation
[14:56:23] 🤖 [AGENT] ✅ Session established via API
[14:56:24] 🤖 [AGENT] ✅ Successfully connected to SAFU wallet (Agent)
[14:56:25] 🤖 [AGENT] ℹ️ Signing transaction programmatically with agent...
[14:56:26] 🤖 [AGENT] ✅ Transaction signed successfully!
```

**Key Features:**
- `🤖 [AGENT]` prefix clearly identifies agent actions
- Timestamps for precise activity tracking
- Color-coded status indicators (✅ success, ❌ error, ⚠️ warning, ℹ️ info)
- Automatic log retention (latest 250 entries)

#### 2. **Agent Status Indicator**
When connected in agent mode, a blue status badge appears next to the wallet connection:

```
✅ GA7IF0GH...UDOALZI6    🤖 AGENT MODE
                         Programmatic control active
```

#### 3. **Operation Differentiation**
Agent operations are clearly distinguished from manual operations:
- Agent deployments: `🤖 Signing transaction programmatically with agent...`
- Manual deployments: `🔐 Opening wallet popup for user confirmation...`

### Console Monitoring

For programmatic monitoring, all agent actions are also logged to the browser console:

```javascript
[TOKEN_LAB_AGENT] 14:56:21 - Connecting to SAFU wallet programmatically...
[TOKEN_LAB_AGENT] 14:56:22 - Authentication successful
[TOKEN_LAB_AGENT] 14:56:23 - Transaction signed successfully
```

**Access via Browser DevTools:**
1. Open DevTools (F12)
2. Go to Console tab
3. Filter by `TOKEN_LAB_AGENT` to see only agent activities

### Monitoring Methods by Use Case

#### **Interactive Development**
- **Primary**: Token Lab UI logs section
- **Secondary**: Browser console for detailed debugging
- **Best for**: Real-time development and testing

#### **Automated Testing**
```javascript
// Monitor agent activities programmatically
const originalConsoleLog = console.log;
const agentLogs = [];

console.log = function(...args) {
  if (args[0] && args[0].includes('[TOKEN_LAB_AGENT]')) {
    agentLogs.push(args.join(' '));
  }
  originalConsoleLog.apply(console, args);
};

// Your agent operations here...

// Analyze logs
console.log('Agent performed', agentLogs.length, 'operations');
```

#### **CI/CD Integration**
```javascript
// Set up monitoring for CI environment
window.__SAFU_AGENT_PASSWORD__ = process.env.SAFU_WALLET_PASSWORD;

// Monitor for completion
const waitForAgentCompletion = () => {
  return new Promise((resolve, reject) => {
    const checkLogs = () => {
      const logs = document.querySelectorAll('[data-log-entry]');
      const lastLog = logs[logs.length - 1]?.textContent || '';
      
      if (lastLog.includes('🤖 [AGENT] ✅') && lastLog.includes('deployment')) {
        resolve('Agent deployment completed successfully');
      } else if (lastLog.includes('🤖 [AGENT] ❌')) {
        reject(new Error('Agent operation failed'));
      } else {
        setTimeout(checkLogs, 1000);
      }
    };
    checkLogs();
  });
};
```

### Log Message Categories

#### **Connection & Authentication**
```
🤖 [AGENT] ✅ Connecting to SAFU wallet programmatically...
🤖 [AGENT] ✅ Using pre-configured credentials for automation  
🤖 [AGENT] ✅ Session established via API
🤖 [AGENT] ✅ Successfully connected to SAFU wallet (Agent)
```

#### **Transaction Operations**
```
🤖 [AGENT] ℹ️ Signing transaction programmatically with agent...
🤖 [AGENT] ✅ Transaction signed successfully!
🤖 [AGENT] ℹ️ Submitting WASM upload to Futurenet...
🤖 [AGENT] ✅ Token deployed successfully
```

#### **Error Handling**
```
🤖 [AGENT] ❌ Authentication failed: Invalid password
🤖 [AGENT] ❌ Transaction signing failed: Network error
🤖 [AGENT] ⚠️ API authentication failed, trying browser method
```

### Advanced Monitoring Features

#### **Log Export**
```javascript
// Export agent logs for analysis
function exportAgentLogs() {
  const logs = Array.from(document.querySelectorAll('[data-log-entry]'))
    .map(el => el.textContent)
    .filter(log => log.includes('🤖 [AGENT]'));
  
  const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-logs-${new Date().toISOString()}.txt`;
  a.click();
}
```

#### **Performance Monitoring**
```javascript
// Track agent operation timing
const agentMetrics = {
  connectionTime: 0,
  deploymentTime: 0,
  operationCount: 0
};

// This data is available in browser performance timeline
performance.mark('agent-start');
// ... agent operations ...
performance.mark('agent-end');
performance.measure('agent-operation', 'agent-start', 'agent-end');
```

### Troubleshooting with Logs

#### **Common Patterns to Watch For**

1. **Successful Agent Flow**:
   ```
   🤖 [AGENT] ✅ Connecting → Authentication → Session → Deploy → Success
   ```

2. **Authentication Issues**:
   ```
   🤖 [AGENT] ❌ Authentication failed: Invalid password
   🤖 [AGENT] ⚠️ API authentication failed, trying browser method
   ```

3. **Network/API Issues**:
   ```
   🤖 [AGENT] ❌ Connection failed: Bad Request
   🤖 [AGENT] ℹ️ Make sure SAFU wallet is running at localhost:3003
   ```

#### **Debug Mode**
Enable verbose logging by setting:
```javascript
window.__SAFU_DEBUG_MODE__ = true;
```

This will show additional internal state information in the logs.

### Best Practices for Monitoring

1. **Always Monitor**: Keep the Token Lab logs visible during agent operations
2. **Log Retention**: Important logs are kept for 250 entries (about 30-60 minutes of activity)
3. **Error Investigation**: Check both Token Lab logs and browser console for complete error context
4. **Performance Tracking**: Use browser DevTools Performance tab for detailed timing analysis
5. **Automated Monitoring**: In CI/CD, capture and analyze log patterns for success/failure detection

For SAFU wallet implementation questions or issues, please refer to the Token Lab team or create an issue in the Token Lab repository.

## Quick Start Guide

### Option 1: Real Seed Mode (Production-like Testing)

**Step 1: Set up wallet with your specific seed**
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

**Step 2: Use Token Lab with agent mode**
- Click "Connect Agent" in Token Lab
- Enter password: `TestPass123!`
- Your real address: `GU5STX7HQYAJRZBKS2CLT3DMU4ENV5FOW6GPX7HQYAJRZBKS2CLT3DMU`

### Option 2: Mock Mode (Quick Testing)

**No setup required - just use Token Lab directly:**
- Click "Connect Agent" in Token Lab  
- Enter password: `password123`
- Mock address: `GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN`

### Integration Summary

The SAFU wallet now supports:

1. ✅ **Dual Mode Operation**: Real seed mode for production-like testing, mock mode for quick tests
2. ✅ **Deterministic Address Generation**: Your specific seed generates `GU5STX7H...CLT3DMU` consistently
3. ✅ **Persistent Agent Sessions**: JWT tokens with 30-minute expiration
4. ✅ **Real Transaction Signing**: Actual cryptographic signing with your wallet
5. ✅ **Token Lab Integration**: Seamless agent connection with proper authentication

The system provides a smooth development experience while maintaining security best practices for production-ready token deployment workflows.