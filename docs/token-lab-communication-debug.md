# Token Lab Cross-Origin Communication Debug Guide

**Date**: July 24, 2025  
**Status**: SAFU Wallet Ready, Token Lab Communication Issue Identified  

## Current Situation

✅ **SAFU Wallet**: Fully ready and enhanced with dual message format support  
❌ **Token Lab**: FreighterCrossOriginClient implemented but discovery timing out  

## Issue Analysis

### Token Lab Console Logs
```
FreighterCrossOriginClient: Discovery attempt 1 failed: Error: Discovery timeout
FreighterCrossOriginClient: Discovery attempt 2 failed: Error: Discovery timeout
FreighterCrossOriginClient: Discovery attempt 3/3
```

### SAFU Wallet Console Logs
```
📬 Received postMessage: {origin: http://localhost:3003, type: FREIGHTER_DISCOVERY, method: undefined, requestId: undefined}
```

**Problem**: SAFU wallet is only receiving messages from its own origin (`http://localhost:3003`), not from Token Lab (`http://localhost:3005`).

## Root Cause

The issue is that Token Lab's FreighterCrossOriginClient is not successfully establishing a communication channel with SAFU wallet. This is typically caused by:

1. **Window Reference Issues**: Token Lab can't get a proper window reference to SAFU wallet
2. **Popup Blocking**: Browser blocking popup attempts
3. **Message Timing**: Messages sent before SAFU wallet is ready to receive them

## SAFU Wallet Enhancements Made

I've enhanced SAFU wallet to support both message formats:

```typescript
// SAFU wallet now handles both message types
if (event.data?.type === 'FREIGHTER_DISCOVERY' || event.data?.type === 'wallet_discovery_request') {
  console.log('🔍 Received wallet discovery request from:', event.origin, 'type:', event.data?.type);
  
  const discoveryResponse = {
    type: event.data?.type === 'wallet_discovery_request' ? 'wallet_discovery_response' : 'FREIGHTER_DISCOVERY_RESPONSE',
    available: true,
    success: true, // Added for compatibility
    methods: ['isConnected', 'isAllowed', 'setAllowed', 'getPublicKey', 'getNetwork', 'getNetworkDetails', 'signTransaction', 'signBlob'],
    isSafuWallet: true,
    version: '1.0.0'
  };

  event.source.postMessage(discoveryResponse, event.origin);
  console.log('✅ Sent wallet discovery response to:', event.origin, 'type:', discoveryResponse.type);
}
```

## Recommended Solutions for Token Lab

### Option 1: Manual Window Opening (Most Reliable)

Instead of trying to automatically establish communication, let the user manually open SAFU wallet:

```typescript
// In Token Lab's FreighterCrossOriginClient
async discoverWallet(): Promise<boolean> {
  return new Promise((resolve) => {
    // Show user instruction to open SAFU wallet
    console.log('Please open SAFU wallet at http://localhost:3003 in a new tab/window');
    
    // Set up listener first
    const discoveryTimeout = setTimeout(() => {
      console.log('Discovery timeout - please ensure SAFU wallet is open and unlocked');
      resolve(false);
    }, 10000); // Longer timeout

    const discoveryListener = (event: MessageEvent) => {
      if (event.origin === 'http://localhost:3003' && 
          (event.data?.type === 'wallet_discovery_response' || event.data?.type === 'FREIGHTER_DISCOVERY_RESPONSE')) {
        clearTimeout(discoveryTimeout);
        window.removeEventListener('message', discoveryListener);
        console.log('✅ SAFU wallet discovered:', event.data);
        resolve(true);
      }
    };

    window.addEventListener('message', discoveryListener);
    
    // Send discovery request to all possible targets
    this.broadcastDiscovery();
  });
}

private broadcastDiscovery(): void {
  const discoveryMessage = { type: 'wallet_discovery_request' };
  
  // Method 1: Try to get existing SAFU wallet window
  try {
    const walletWindow = window.open('', 'safu-wallet'); // Try to get existing window
    if (walletWindow && !walletWindow.closed) {
      walletWindow.postMessage(discoveryMessage, 'http://localhost:3003');
      console.log('📤 Sent discovery to existing SAFU wallet window');
    }
  } catch (error) {
    console.log('No existing SAFU wallet window found');
  }

  // Method 2: Broadcast to parent/opener (if Token Lab was opened from SAFU wallet)
  if (window.opener) {
    window.opener.postMessage(discoveryMessage, 'http://localhost:3003');
    console.log('📤 Sent discovery to opener window');
  }

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(discoveryMessage, 'http://localhost:3003');
    console.log('📤 Sent discovery to parent window');
  }

  // Method 3: Try all windows (browser security permitting)
  try {
    // This broadcasts to all windows that share the same origin policy
    window.postMessage(discoveryMessage, 'http://localhost:3003');
  } catch (error) {
    console.log('Broadcast to other windows failed');
  }
}
```

### Option 2: User-Initiated Connection Flow

Create a UI flow where the user explicitly connects:

```typescript
// In Token Lab UI component
function ConnectSafuWallet() {
  const [connectionState, setConnectionState] = useState('disconnected'); // disconnected, connecting, connected, failed

  const handleConnect = async () => {
    setConnectionState('connecting');
    
    // Open SAFU wallet for user
    const walletWindow = window.open('http://localhost:3003', 'safu-wallet', 'width=400,height=600');
    
    // Show user instructions
    console.log('Please unlock SAFU wallet in the opened window, then click "Allow Connection" when prompted');
    
    try {
      const client = new FreighterCrossOriginClient();
      const connected = await client.discoverWallet();
      
      if (connected) {
        setConnectionState('connected');
        // Proceed with API calls
        const publicKey = await client.getPublicKey();
        console.log('Connected to SAFU wallet:', publicKey);
      } else {
        setConnectionState('failed');
      }
    } catch (error) {
      setConnectionState('failed');
      console.error('Connection failed:', error);
    }
  };

  return (
    <div>
      {connectionState === 'disconnected' && (
        <button onClick={handleConnect}>Connect to SAFU Wallet</button>
      )}
      {connectionState === 'connecting' && (
        <div>
          <p>Connecting to SAFU wallet...</p>
          <p>Please ensure SAFU wallet is open at <a href="http://localhost:3003" target="_blank">localhost:3003</a> and unlocked</p>
        </div>
      )}
      {connectionState === 'connected' && (
        <div>✅ Connected to SAFU wallet!</div>
      )}
      {connectionState === 'failed' && (
        <div>
          ❌ Connection failed. Please:
          <ul>
            <li>Ensure SAFU wallet is running at <a href="http://localhost:3003" target="_blank">localhost:3003</a></li>
            <li>Unlock the wallet with your password</li>
            <li>Try connecting again</li>
          </ul>
        </div>
      )}
    </div>
  );
}
```

### Option 3: Enhanced Message Broadcasting (Technical Solution)

If automatic connection is required, enhance the message broadcasting:

```typescript
// In FreighterCrossOriginClient
private async attemptConnection(): Promise<boolean> {
  // Try multiple communication methods in sequence
  const methods = [
    () => this.tryPopupConnection(),
    () => this.tryIframeConnection(), 
    () => this.tryExistingWindowConnection(),
    () => this.tryBroadcastConnection()
  ];

  for (const method of methods) {
    try {
      const success = await method();
      if (success) return true;
    } catch (error) {
      console.log('Connection method failed:', error.message);
    }
  }

  return false;
}

private async tryPopupConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    const popup = window.open('http://localhost:3003', 'safu-wallet', 'width=400,height=600');
    
    if (!popup || popup.closed) {
      resolve(false);
      return;
    }

    // Wait for popup to load, then send message
    setTimeout(() => {
      popup.postMessage({ type: 'wallet_discovery_request' }, 'http://localhost:3003');
      
      // Listen for response
      const responseTimeout = setTimeout(() => resolve(false), 3000);
      
      const listener = (event: MessageEvent) => {
        if (event.origin === 'http://localhost:3003' && event.data?.type === 'wallet_discovery_response') {
          clearTimeout(responseTimeout);
          window.removeEventListener('message', listener);
          resolve(true);
        }
      };
      
      window.addEventListener('message', listener);
    }, 1000); // Wait for popup to load
  });
}
```

## Testing Commands

### For Token Lab Developer

Test if messages are being sent:

```javascript
// In Token Lab console
window.postMessage({ 
  type: 'wallet_discovery_request',
  test: true 
}, 'http://localhost:3003');

// Then check SAFU wallet console for received message
```

### For SAFU Wallet Verification

Test if SAFU wallet is receiving messages:

```javascript
// In SAFU wallet console  
window.addEventListener('message', (event) => {
  console.log('🧪 Test message received:', {
    origin: event.origin,
    type: event.data?.type,
    data: event.data
  });
});
```

## Expected Working Flow

### 1. User Journey
1. User opens Token Lab (localhost:3005)
2. User clicks "Connect Local" 
3. Token Lab opens SAFU wallet popup (localhost:3003)
4. User unlocks SAFU wallet if needed
5. Token Lab sends discovery message to SAFU wallet
6. SAFU wallet responds with capabilities
7. Connection established, API calls work

### 2. Message Flow
```
Token Lab → SAFU Wallet: { type: 'wallet_discovery_request' }
SAFU Wallet → Token Lab: { type: 'wallet_discovery_response', available: true, success: true, methods: [...] }
Token Lab → SAFU Wallet: { type: 'FREIGHTER_API_REQUEST', method: 'isConnected', requestId: '...' }
SAFU Wallet → Token Lab: { type: 'FREIGHTER_API_RESPONSE', success: true, result: true, requestId: '...' }
```

### 3. Console Logs When Working

**Token Lab Console:**
```
FreighterCrossOriginClient: Starting wallet discovery...
📤 Sent discovery to SAFU wallet
✅ SAFU wallet discovered: {type: "wallet_discovery_response", available: true}
📤 API request sent: isConnected
✅ API response received: {success: true, result: true}
```

**SAFU Wallet Console:**
```
📬 Received postMessage: {origin: "http://localhost:3005", type: "wallet_discovery_request"}
🔍 Received wallet discovery request from: http://localhost:3005 type: wallet_discovery_request
✅ Sent wallet discovery response to: http://localhost:3005 type: wallet_discovery_response
📬 Received postMessage: {origin: "http://localhost:3005", type: "FREIGHTER_API_REQUEST"}
📨 Processing PostMessage API call: isConnected
✅ PostMessage API response sent for isConnected
```

## Current Status Summary

✅ **SAFU Wallet Ready**:
- Handles both `FREIGHTER_DISCOVERY` and `wallet_discovery_request`
- Responds with compatible message formats
- Session management integrated
- Enhanced logging for debugging
- Origin validation working (localhost:3005 is allowed)

🔄 **Token Lab Needs**:
- Fix message delivery to SAFU wallet
- Ensure popup/window communication working
- Add user guidance for connection flow
- Handle discovery timeout gracefully

The SAFU wallet side is completely ready. The issue is purely on the Token Lab side with establishing the initial communication channel.