/**
 * Simple Popup Wallet Integration (MetaMask-style)
 * 
 * Perfect for: Token deployment, one-time transactions, simple dApps
 * Flow: Build Transaction → Open Popup → User Signs → Wallet Submits → Done
 * 
 * This approach is much simpler than the advanced FreighterCrossOriginClient
 * and follows the familiar MetaMask pattern where the wallet handles everything.
 */

export interface PopupSigningOptions {
  /** Description shown to user in wallet */
  description?: string;
  /** Network passphrase (defaults to Futurenet) */
  networkPassphrase?: string;
  /** Network name for display */
  network?: string;
  /** App name shown in wallet */
  appName?: string;
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
  /** Keep popup open after signing (default: false) */
  keepPopupOpen?: boolean;
}

export interface PopupSigningResult {
  /** The signed transaction XDR */
  signedTransactionXdr: string;
  /** Transaction hash after submission (if wallet submitted) */
  transactionHash?: string;
  /** Whether wallet submitted the transaction automatically */
  submitted: boolean;
  /** Network details from wallet */
  network?: string;
  /** Public key that signed the transaction */
  publicKey?: string;
}

/**
 * Sign a transaction using SAFU wallet popup (MetaMask-style)
 * 
 * @param transactionXdr - The unsigned transaction XDR to sign
 * @param options - Optional signing parameters
 * @returns Promise<PopupSigningResult> - Signed transaction and metadata
 * 
 * @example
 * ```typescript
 * // Simple usage
 * const result = await signTransactionWithPopup(transactionXdr, {
 *   description: 'Deploy SEP-41 Token: MyToken (MTK)'
 * });
 * 
 * if (result.submitted) {
 *   console.log('Transaction submitted:', result.transactionHash);
 * } else {
 *   // Submit manually if needed
 *   const hash = await submitTransaction(result.signedTransactionXdr);
 * }
 * ```
 */
export async function signTransactionWithPopup(
  transactionXdr: string,
  options: PopupSigningOptions = {}
): Promise<PopupSigningResult> {
  
  return new Promise((resolve, reject) => {
    // Generate unique request ID for this signing session
    const requestId = `tokenlab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Default options
    const {
      description = 'Sign Transaction',
      networkPassphrase = 'Test SDF Future Network ; October 2022', // Futurenet
      network = 'futurenet',
      appName = 'Token Lab',
      timeout = 300000, // 5 minutes
      keepPopupOpen = false
    } = options;
    
    // Build popup URL using SAFU wallet's industry-standard format
    const params = new URLSearchParams({
      mode: 'simple',
      action: 'sign_and_submit',
      requestId: requestId,
      transactionXdr: transactionXdr,
      origin: window.location.origin,
      appName: appName,
      networkPassphrase: networkPassphrase,
      network: network,
      description: description,
      // Add timestamp for cache busting
      timestamp: Date.now().toString()
    });
    
    const popupUrl = `http://localhost:3003/sign?${params.toString()}`;
    
    console.log('🚀 Opening SAFU wallet popup for transaction signing:', {
      description,
      network,
      requestId
    });
    
    // Open wallet popup with proper dimensions
    const popup = window.open(
      popupUrl, 
      'safu-wallet-sign', 
      'width=450,height=650,scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no'
    );
    
    if (!popup) {
      reject(new Error('Failed to open wallet popup. Please allow popups for this site.'));
      return;
    }
    
    // Set up response listener
    const messageHandler = (event: MessageEvent) => {
      // Security: Only accept messages from SAFU wallet origin
      if (event.origin !== 'http://localhost:3003') {
        return;
      }
      
      const data = event.data;
      
      // Check if this message is for our request
      if (data.requestId === requestId) {
        // Clean up
        window.removeEventListener('message', messageHandler);
        clearInterval(popupCheckInterval);
        clearTimeout(timeoutHandle);
        
        // Only close popup if keepPopupOpen is false
        if (!popup.closed && !keepPopupOpen) {
          popup.close();
        }
        
        console.log('📨 Received response from SAFU wallet:', data.type);
        
        // Handle different response types
        if (data.type === 'transaction_signed') {
          resolve({
            signedTransactionXdr: data.signedTransactionXdr,
            transactionHash: data.transactionHash,
            submitted: !!data.transactionHash,
            network: data.network,
            publicKey: data.publicKey
          });
        } else if (data.type === 'transaction_rejected') {
          reject(new Error('Transaction was rejected by user'));
        } else if (data.type === 'transaction_error') {
          reject(new Error(data.error || 'Transaction signing failed'));
        } else {
          reject(new Error(`Unknown response type: ${data.type}`));
        }
      }
    };
    
    // Listen for messages from wallet
    window.addEventListener('message', messageHandler);
    
    // Monitor if popup is closed manually
    const popupCheckInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupCheckInterval);
        clearTimeout(timeoutHandle);
        window.removeEventListener('message', messageHandler);
        reject(new Error('Wallet popup was closed by user'));
      }
    }, 1000);
    
    // Set timeout for signing
    const timeoutHandle = setTimeout(() => {
      clearInterval(popupCheckInterval);
      window.removeEventListener('message', messageHandler);
      
      // Only close popup on timeout if keepPopupOpen is false
      if (!popup.closed && !keepPopupOpen) {
        popup.close();
      }
      
      reject(new Error(`Transaction signing timed out after ${timeout / 1000} seconds`));
    }, timeout);
  });
}

/**
 * Connect to SAFU wallet (simple permission request, not transaction signing)
 * 
 * @param options - Optional connection parameters
 * @returns Promise<{publicKey: string, network: string}> - Connected wallet info
 * 
 * @example
 * ```typescript
 * const wallet = await connectToWallet({
 *   appName: 'Token Lab'
 * });
 * console.log('Connected:', wallet.publicKey);
 * ```
 */
export async function connectToWallet(options: {
  appName?: string;
  timeout?: number;
} = {}): Promise<{
  publicKey: string;
  network: string;
}> {
  
  return new Promise((resolve, reject) => {
    // Generate unique request ID for this connection session
    const requestId = `tokenlab_connect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Default options
    const {
      appName = 'Token Lab',
      timeout = 60000 // 1 minute for connection
    } = options;
    
    // Build popup URL using SAFU wallet's industry-standard format
    const params = new URLSearchParams({
      mode: 'simple',
      action: 'connect',
      requestId: requestId,
      transactionXdr: 'connect_request',
      origin: window.location.origin,
      appName: appName,
      description: `Connect to ${appName}`,
      network: 'futurenet',
      // Add timestamp for cache busting
      timestamp: Date.now().toString()
    });
    
    const popupUrl = `http://localhost:3003/sign?${params.toString()}`;
    
    console.log('🔗 Opening SAFU wallet popup for connection:', {
      appName,
      requestId
    });
    
    // Open wallet popup with proper dimensions
    const popup = window.open(
      popupUrl, 
      'safu-wallet-connect', 
      'width=450,height=650,scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no'
    );
    
    if (!popup) {
      reject(new Error('Failed to open wallet popup. Please allow popups for this site.'));
      return;
    }
    
    // Set up response listener
    const messageHandler = (event: MessageEvent) => {
      // Security: Only accept messages from SAFU wallet origin
      if (event.origin !== 'http://localhost:3003') {
        return;
      }
      
      const data = event.data;
      
      // Check if this message is for our request
      if (data.requestId === requestId) {
        // Clean up
        window.removeEventListener('message', messageHandler);
        clearInterval(popupCheckInterval);
        clearTimeout(timeoutHandle);
        
        if (!popup.closed) {
          popup.close();
        }
        
        console.log('📨 Received connection response from SAFU wallet:', data.type);
        
        // Handle different response types
        if (data.type === 'connection_approved') {
          resolve({
            publicKey: data.publicKey,
            network: data.network || 'futurenet'
          });
        } else if (data.type === 'connection_rejected') {
          reject(new Error('Connection was rejected by user'));
        } else if (data.type === 'connection_error') {
          reject(new Error(data.error || 'Connection failed'));
        } else {
          reject(new Error(`Unknown response type: ${data.type}`));
        }
      }
    };
    
    // Listen for messages from wallet
    window.addEventListener('message', messageHandler);
    
    // Monitor if popup is closed manually
    const popupCheckInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupCheckInterval);
        clearTimeout(timeoutHandle);
        window.removeEventListener('message', messageHandler);
        reject(new Error('Wallet popup was closed by user'));
      }
    }, 1000);
    
    // Set timeout for connection
    const timeoutHandle = setTimeout(() => {
      clearInterval(popupCheckInterval);
      window.removeEventListener('message', messageHandler);
      
      if (!popup.closed) {
        popup.close();
      }
      
      reject(new Error(`Connection timed out after ${timeout / 1000} seconds`));
    }, timeout);
  });
}

/**
 * Check if SAFU wallet is available for popup signing
 * 
 * @returns Promise<boolean> - True if wallet is reachable
 */
export async function isPopupWalletAvailable(): Promise<boolean> {
  try {
    // Try to ping the wallet's health endpoint
    const response = await fetch('http://localhost:3003/api/health', {
      method: 'GET',
      mode: 'cors'
    });
    return response.ok;
  } catch (error) {
    console.warn('SAFU wallet not available:', error);
    return false;
  }
}

/**
 * Get wallet information from popup (if needed for display purposes)
 * 
 * @returns Promise<{available: boolean, network?: string}>
 */
export async function getPopupWalletInfo(): Promise<{
  available: boolean;
  network?: string;
  version?: string;
}> {
  const available = await isPopupWalletAvailable();
  
  if (!available) {
    return { available: false };
  }
  
  // Could extend this to get more info from wallet if needed
  return {
    available: true,
    network: 'futurenet', // Default assumption
    version: '1.0.0'
  };
}

/**
 * Utility: Build a simple transaction deployment XDR
 * (This would be moved to a separate transaction builder utility)
 */
export interface TokenDeploymentConfig {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  adminPublicKey: string;
}

/**
 * Helper function to validate transaction XDR format
 */
export function isValidTransactionXdr(xdr: string): boolean {
  try {
    // Basic validation - check if it's base64 and reasonable length
    if (!xdr || typeof xdr !== 'string') return false;
    if (xdr.length < 100) return false; // Too short to be a valid transaction
    
    // Try to decode base64
    atob(xdr);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Utility types for better TypeScript support
 */
export type WalletIntegrationMethod = 'simple-popup' | 'advanced-connection';

export interface WalletCapabilities {
  method: WalletIntegrationMethod;
  supportsMultipleTransactions: boolean;
  supportsPersistentConnection: boolean;
  supportsAccountInfo: boolean;
  idealFor: string[];
}

/**
 * Get capabilities of different wallet integration methods
 */
export function getWalletCapabilities(method: WalletIntegrationMethod): WalletCapabilities {
  switch (method) {
    case 'simple-popup':
      return {
        method: 'simple-popup',
        supportsMultipleTransactions: false,
        supportsPersistentConnection: false,
        supportsAccountInfo: false,
        idealFor: [
          'Token deployment',
          'One-time transactions', 
          'Simple dApps',
          'Contract deployment'
        ]
      };
    
    case 'advanced-connection':
      return {
        method: 'advanced-connection',
        supportsMultipleTransactions: true,
        supportsPersistentConnection: true,
        supportsAccountInfo: true,
        idealFor: [
          'DEX platforms',
          'DeFi protocols',
          'Gaming applications',
          'Portfolio dashboards',
          'Multi-step workflows'
        ]
      };
    
    default:
      throw new Error(`Unknown wallet integration method: ${method}`);
  }
}

/**
 * Sign a transaction programmatically (no popup) for agent mode
 * 
 * @param transactionXdr - The unsigned transaction XDR to sign
 * @param options - Optional signing parameters
 * @returns Promise<PopupSigningResult> - Signed transaction and metadata
 */
export async function signTransactionAgent(
  transactionXdr: string,
  options: PopupSigningOptions & { sessionData?: any } = {}
): Promise<PopupSigningResult> {
  
  const {
    description = 'Sign Transaction (Agent)',
    networkPassphrase = 'Test SDF Future Network ; October 2022', // Futurenet
    network = 'futurenet',
    appName = 'Token Lab',
    sessionData
  } = options;
  
  try {
    // Direct API call to wallet's signing endpoint with authentication
    const requestBody: any = {
      transactionXdr,
      networkPassphrase,
      network,
      description,
      appName,
      mode: 'agent',
      origin: window.location.origin
    };

    // Add session data for authentication if available
    if (sessionData) {
      requestBody.accessToken = sessionData.accessToken;
      requestBody.sessionPassword = sessionData.sessionPassword;
      requestBody.encryptedSeed = sessionData.encryptedSeed;
    }

    const response = await fetch('http://localhost:3003/api/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Signing failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        signedTransactionXdr: result.signedTransactionXdr,
        transactionHash: result.transactionHash,
        submitted: !!result.transactionHash,
        network: result.network,
        publicKey: result.publicKey
      };
    } else {
      throw new Error(result.error || 'Transaction signing failed');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Agent signing failed: ${errorMessage}`);
  }
}