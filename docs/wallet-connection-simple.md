# Token Lab - Simple Wallet Connection Technical Design

This document outlines the technical design for the simple wallet connection system between Token Lab and SAFU wallet, using a MetaMask-style popup approach.

## Overview

The simple connection system uses a two-step process:
1. **Authentication/Connection** - Establish wallet connection and get user account
2. **Transaction Signing** - Present specific transactions for user review and confirmation

This approach is perfect for token deployment and simple dApp interactions where users need clear transaction review without complex persistent connections.

## Technical Flow

### 1. Authentication Flow (Connect Local/Browser Buttons)

```
Token Lab (localhost:3005)                 SAFU Wallet (localhost:3003)
┌─────────────────────────┐                ┌─────────────────────────────┐
│ User clicks             │                │                             │
│ "Connect Local"         │                │                             │
│                         │                │                             │
│ signTransactionWithPopup│ ──────────────▶│ /sign?action=connect        │
│ ('connect_request', {   │                │                             │
│   description: 'Connect │                │ ┌─────────────────────────┐ │
│   to Token Lab',        │                │ │ Login/Auth UI           │ │
│   appName: 'Token Lab'  │                │ │ - Show app name         │ │
│ })                      │                │ │ - Confirm connection    │ │
│                         │                │ │ - No transaction fees   │ │
│                         │                │ └─────────────────────────┘ │
│                         │                │                             │
│                         │ ◀──────────────│ postMessage({               │
│ Wallet connected ✅     │                │   type: 'transaction_signed'│
│ - Store publicKey       │                │   publicKey: 'G...',        │
│ - Store network         │                │   network: 'futurenet'     │
│ - Update UI state       │                │ })                          │
│ - Popup closes          │                │                             │
└─────────────────────────┘                └─────────────────────────────┘
```

### 2. Transaction Signing Flow (Deploy Token, Mint, etc.)

```
Token Lab (localhost:3005)                 SAFU Wallet (localhost:3003)
┌─────────────────────────┐                ┌─────────────────────────────┐
│ User clicks             │                │                             │
│ "Deploy SEP-41 Token"   │                │                             │
│                         │                │                             │
│ 1. Build transaction XDR│                │                             │
│ 2. signTransactionWithPopup ──────────▶  │ /sign?action=sign           │
│ (transactionXdr, {      │                │ &transactionXdr=AAAABg...   │
│   description: 'Deploy  │                │ &description=Deploy%20Token │
│   SEP-41 Token: MyToken │                │                             │
│   (MTK)',               │                │ ┌─────────────────────────┐ │
│   networkPassphrase,    │                │ │ Transaction Review UI   │ │
│   network: 'futurenet'  │                │ │ - Show transaction type │ │
│ })                      │                │ │ - Show token details    │ │
│                         │                │ │ - Show network fees     │ │
│                         │                │ │ - Confirm/Reject buttons│ │
│                         │                │ └─────────────────────────┘ │
│                         │                │                             │
│                         │ ◀──────────────│ postMessage({               │
│ Transaction signed ✅   │                │   type: 'transaction_signed'│
│ - Receive signed XDR    │                │   signedTransactionXdr,     │
│ - Submit to network     │                │   transactionHash,          │
│ - Show success message  │                │   submitted: true/false     │
│ - Popup closes          │                │ })                          │
└─────────────────────────┘                └─────────────────────────────┘
```

## URL Parameters for SAFU Wallet

### Authentication Request
```
http://localhost:3003/sign?action=connect&requestId=tokenlab_123&origin=http://localhost:3005&appName=Token%20Lab&description=Connect%20to%20Token%20Lab
```

### Transaction Signing Request
```
http://localhost:3003/sign?action=sign&requestId=tokenlab_456&transactionXdr=AAAABg...&origin=http://localhost:3005&appName=Token%20Lab&networkPassphrase=Test%20SDF%20Future%20Network&network=futurenet&description=Deploy%20SEP-41%20Token%3A%20MyToken%20(MTK)
```

## Expected SAFU Wallet Behavior

### For Authentication (`action=connect`)
1. **UI Display:**
   - Show app name: "Token Lab"
   - Show description: "Connect to Token Lab"
   - Show connect/cancel buttons
   - **NO transaction fees** (this is just authentication)

2. **User Actions:**
   - **Approve:** Send success response with user's public key
   - **Reject:** Send rejection response
   - **Close:** Treated as rejection

3. **Response Format:**
   ```javascript
   // Success
   window.opener.postMessage({
     requestId: 'tokenlab_123',
     type: 'transaction_signed',
     publicKey: 'G...',
     network: 'futurenet'
   }, 'http://localhost:3005');
   
   // Rejection
   window.opener.postMessage({
     requestId: 'tokenlab_123',
     type: 'transaction_rejected'
   }, 'http://localhost:3005');
   ```

### For Transaction Signing (`action=sign`)
1. **UI Display:**
   - Parse and display transaction details
   - Show token name, symbol, amounts, etc.
   - Show network fees and gas costs
   - Show approve/reject buttons
   - Clear transaction summary

2. **User Actions:**
   - **Approve:** Sign transaction and optionally submit to network
   - **Reject:** Send rejection response
   - **Close:** Treated as rejection

3. **Response Format:**
   ```javascript
   // Success (wallet submits)
   window.opener.postMessage({
     requestId: 'tokenlab_456',
     type: 'transaction_signed',
     signedTransactionXdr: 'AAAABg...',
     transactionHash: 'abc123...',
     submitted: true,
     publicKey: 'G...',
     network: 'futurenet'
   }, 'http://localhost:3005');
   
   // Success (wallet returns signed XDR only)
   window.opener.postMessage({
     requestId: 'tokenlab_456',
     type: 'transaction_signed',
     signedTransactionXdr: 'AAAABg...',
     submitted: false,
     publicKey: 'G...',
     network: 'futurenet'
   }, 'http://localhost:3005');
   ```

## Security Considerations

1. **Origin Validation:** SAFU wallet should only accept messages from `http://localhost:3005` (or configured Token Lab origin)

2. **Request ID Matching:** Each request includes a unique `requestId` that must be included in the response

3. **Timeout Handling:** Token Lab sets a 5-minute timeout for transaction signing, 1-minute for authentication

4. **Popup Management:** Proper cleanup of event listeners and popup windows

## Error Handling

### Common Error Scenarios
1. **Popup Blocked:** Browser blocks popup → Show user instructions
2. **Wallet Offline:** SAFU wallet not running → Show connection instructions  
3. **User Rejection:** User cancels in wallet → Show cancellation message
4. **Network Error:** Communication failure → Show retry options
5. **Timeout:** User doesn't respond → Show timeout message

### Error Response Format
```javascript
window.opener.postMessage({
  requestId: 'tokenlab_456',
  type: 'transaction_error',
  error: 'User rejected transaction'
}, 'http://localhost:3005');
```

## Implementation Files

### Token Lab Side
- `src/lib/wallet-simple.ts` - Core simple wallet integration
- `src/components/RealTokenDeployer.tsx` - Main UI using simple connection
- `docs/wallet-connection-simple.md` - This technical specification

### SAFU Wallet Side (Expected)
- `/sign` route handler for popup interface
- Transaction parsing and display logic
- User authentication flow
- postMessage communication back to Token Lab

## Benefits of This Approach

1. **Simplicity:** Clear separation between authentication and transaction signing
2. **Security:** Each transaction explicitly reviewed by user
3. **Familiarity:** MetaMask-style flow that users understand
4. **Flexibility:** Works for any transaction type (deploy, mint, burn, transfer)
5. **Debuggability:** Clear request/response flow with visible popups
6. **No State Management:** No complex persistent connections to maintain

## Future Considerations

1. **Multiple Networks:** Easy to extend for testnet/mainnet by changing URL parameters
2. **Transaction Batching:** Could group multiple operations in single popup
3. **Hardware Wallet Support:** SAFU wallet could integrate hardware wallets transparently
4. **Mobile Support:** Popup approach works well on mobile browsers

## Testing Scenarios

1. **Happy Path:** Connect → Deploy Token → Success
2. **User Rejection:** Connect → Deploy Token → User rejects → Handle gracefully
3. **Popup Blocked:** Browser blocks popup → Show instructions
4. **Wallet Offline:** SAFU wallet not running → Show error and instructions
5. **Network Switch:** User changes network in wallet → Handle appropriately
6. **Multiple Transactions:** Deploy → Mint → Burn → All work correctly

This design provides a clean, secure, and user-friendly approach to wallet integration that's perfect for Token Lab's needs while being simple to implement and maintain.