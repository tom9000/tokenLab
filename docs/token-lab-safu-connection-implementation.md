# Token Lab - Safu Wallet Connection Implementation

This document outlines the implementation requirements for connecting Token Lab to the Safu Wallet for transaction signing via popup windows.

## Overview

Token Lab will use a "just-in-time" transaction signing approach where:
1. User initiates a token deployment in Token Lab
2. Token Lab opens Safu Wallet in a popup with the transaction data
3. User reviews and approves/rejects the transaction in Safu Wallet
4. Safu Wallet signs the transaction and returns the signed XDR to Token Lab
5. Token Lab submits the signed transaction to the network
6. Popup stays open for additional transactions if needed

## Implementation Requirements for Token Lab

### 1. Create Transaction Signer Function

Add this function to your Token Lab project:

```javascript
/**
 * Sign a transaction using safu wallet popup
 * @param {string} transactionXdr - The transaction XDR to sign
 * @param {object} options - Optional parameters
 * @returns {Promise<string>} - Signed transaction XDR
 */
async function signTransactionWithSafu(transactionXdr, options = {}) {
  return new Promise((resolve, reject) => {
    // Generate unique request ID
    const requestId = `tokenlab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Open safu wallet popup with transaction data in URL
    const params = new URLSearchParams({
      action: 'sign',
      requestId: requestId,
      transactionXdr: transactionXdr,
      origin: window.location.origin,
      appName: 'Token Lab',
      networkPassphrase: options.networkPassphrase || 'Test SDF Network ; September 2015',
      description: options.description || 'SEP-41 Token Contract Deployment'
    });
    
    const popupUrl = `http://localhost:3000/sign?${params.toString()}`;
    const popup = window.open(popupUrl, 'safu-wallet-sign', 'width=450,height=650,scrollbars=yes,resizable=yes');
    
    if (!popup) {
      reject(new Error('Failed to open wallet popup. Please allow popups.'));
      return;
    }
    
    // Listen for response from popup
    const messageHandler = (event) => {
      // Security: only accept messages from safu wallet
      if (!event.origin.startsWith('http://localhost:3000')) {
        return;
      }
      
      const data = event.data;
      
      if (data.requestId === requestId) {
        window.removeEventListener('message', messageHandler);
        popup.close();
        
        if (data.type === 'transaction_approved') {
          resolve(data.signedTransactionXdr);
        } else if (data.type === 'transaction_rejected') {
          reject(new Error('Transaction rejected by user'));
        } else if (data.type === 'transaction_error') {
          reject(new Error(data.error || 'Transaction signing failed'));
        }
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Handle popup closed without response
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        reject(new Error('Wallet popup was closed'));
      }
    }, 1000);
    
    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkClosed);
      window.removeEventListener('message, messageHandler);
      if (!popup.closed) popup.close();
      reject(new Error('Transaction signing timeout'));
    }, 300000);
  });
}
```

### 2. Integration in Token Deployment Flow

Update your token deployment function to use the signer:

```javascript
// When user wants to deploy SEP-41 token
const deployToken = async () => {
  try {
    // Build your transaction XDR (however you currently do it)
    const transactionXdr = await buildTokenDeploymentTransaction();
    
    // Sign it with safu wallet
    const signedXdr = await signTransactionWithSafu(transactionXdr, {
      description: 'Deploy SEP-41 Token Contract',
      networkPassphrase: 'Test SDF Network ; September 2015' // or your network
    });
    
    // Submit to network
    const result = await submitTransaction(signedXdr);
    console.log('Token deployed successfully:', result);
    
  } catch (error) {
    console.error('Deployment failed:', error);
    
    // Handle different error types
    if (error.message.includes('rejected')) {
      // User rejected the transaction
      alert('Transaction was rejected');
    } else if (error.message.includes('popup')) {
      // Popup issues
      alert('Please allow popups for this site');
    } else {
      // Other errors
      alert(`Deployment failed: ${error.message}`);
    }
  }
};
```

### 3. Update User Interface

Update your deploy button to indicate wallet integration:

```javascript
<button onClick={deployToken} className="deploy-button">
  Deploy Token (Sign with Safu Wallet)
</button>
```

## Configuration

### Wallet URL
- **Development**: `http://localhost:3000`
- **Production**: Update to your production Safu Wallet URL

### Network Configuration
Common network passphrases:
- **Testnet**: `Test SDF Network ; September 2015`
- **Futurenet**: `Test SDF Future Network ; October 2022`
- **Mainnet**: `Public Global Stellar Network ; September 2015`

### Popup Dimensions
Recommended popup size: `width=450,height=650`

## Security Considerations

1. **Origin Validation**: The implementation only accepts messages from the Safu Wallet origin
2. **Request ID Matching**: Each request has a unique ID to prevent message confusion
3. **Timeout Handling**: Requests timeout after 5 minutes to prevent hanging states
4. **Popup Management**: Proper cleanup of event listeners and popup windows

## Error Handling

The signer function handles these error cases:
- User rejects transaction
- Popup blocked by browser
- Wallet signing errors
- Network/communication errors
- Timeout conditions
- Popup closed without response

## Testing

1. Ensure both Token Lab (port 3005) and Safu Wallet (port 3000) are running
2. Test with popup blockers enabled/disabled
3. Test transaction approval and rejection flows
4. Test timeout scenarios
5. Test with different wallet states (logged in/out)

## Benefits

- **Minimal Integration**: Only one function needed in Token Lab
- **Security**: Users control their keys in Safu Wallet
- **Flexibility**: Works with any wallet type (seed phrase, Freighter, etc.)
- **User Experience**: Familiar popup flow like browser extensions
- **Persistence**: Wallet stays open for multiple transactions

## Next Steps

After implementing this in Token Lab:
1. Test the basic signing flow
2. Add UI indicators for signing states
3. Implement proper error user feedback
4. Consider adding transaction preview in Token Lab UI