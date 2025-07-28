/**
 * Optimized Wallet Client for Token Lab
 * 
 * This client addresses:
 * - Single port communication (only 3003)
 * - SDK compatibility issues
 * - Reduced connection attempts
 * - Better error handling
 */

export interface OptimizedSigningOptions {
  description?: string;
  networkPassphrase?: string;
  network?: string;
  appName?: string;
  timeout?: number;
}

export interface OptimizedSigningResult {
  signedTransactionXdr: string;
  transactionHash?: string;
  submitted: boolean;
  network?: string;
  publicKey?: string;
}

/**
 * Optimized wallet client that only communicates with port 3003
 * and handles SDK compatibility issues
 */
export class OptimizedWalletClient {
  private readonly SAFU_ORIGIN = 'http://localhost:3003';
  private readonly TOKENLAB_ORIGIN = 'http://localhost:3005';
  
  constructor() {
    // No discovery needed - we know SAFU runs on 3003
  }

  /**
   * Check if SAFU wallet is available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.SAFU_ORIGIN}/api/health`, {
        method: 'GET',
        mode: 'cors',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });
      return response.ok;
    } catch (error) {
      console.warn('SAFU wallet not available at port 3003:', error);
      return false;
    }
  }

  /**
   * Connect to wallet (get public key and network info)
   */
  public async connect(options: { appName?: string } = {}): Promise<{
    publicKey: string;
    network: string;
    networkPassphrase: string;
  }> {
    const { appName = 'Token Lab' } = options;

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      // Build connection URL
      const params = new URLSearchParams({
        mode: 'connect',
        requestId,
        origin: this.TOKENLAB_ORIGIN,
        appName,
        timestamp: Date.now().toString()
      });
      
      const popupUrl = `${this.SAFU_ORIGIN}/connect?${params.toString()}`;
      
      console.log('🔗 Opening SAFU wallet for connection...');
      
      // Open popup
      const popup = window.open(
        popupUrl, 
        'safu-connect', 
        'width=450,height=650,scrollbars=yes,resizable=yes'
      );
      
      if (!popup) {
        reject(new Error('Failed to open wallet popup. Please allow popups.'));
        return;
      }
      
      // Single message handler - only listen to port 3003
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== this.SAFU_ORIGIN) {
          return; // Ignore messages from other origins
        }
        
        const data = event.data;
        if (data.requestId === requestId) {
          this.cleanup(popup, messageHandler, popupCheckInterval, timeoutHandle);
          
          if (data.type === 'connection_success') {
            resolve({
              publicKey: data.publicKey,
              network: data.network || 'futurenet',
              networkPassphrase: data.networkPassphrase || 'Test SDF Future Network ; October 2022'
            });
          } else if (data.type === 'connection_rejected') {
            reject(new Error('Connection rejected by user'));
          } else if (data.type === 'connection_error') {
            reject(new Error(data.error || 'Connection failed'));
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Monitor popup closure
      const popupCheckInterval = setInterval(() => {
        if (popup.closed) {
          this.cleanup(popup, messageHandler, popupCheckInterval, timeoutHandle);
          reject(new Error('Popup closed by user'));
        }
      }, 1000);
      
      // Connection timeout
      const timeoutHandle = setTimeout(() => {
        this.cleanup(popup, messageHandler, popupCheckInterval, timeoutHandle);
        reject(new Error('Connection timeout'));
      }, 60000); // 1 minute timeout
    });
  }

  /**
   * Sign transaction with improved SDK compatibility
   */
  public async signTransaction(
    transactionXdr: string,
    options: OptimizedSigningOptions = {}
  ): Promise<OptimizedSigningResult> {
    
    const {
      description = 'Sign Transaction',
      networkPassphrase = 'Test SDF Future Network ; October 2022',
      network = 'futurenet',
      appName = 'Token Lab',
      timeout = 300000 // 5 minutes
    } = options;

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      // Build signing URL with improved parameters
      const params = new URLSearchParams({
        mode: 'sign',
        action: 'sign_and_submit',
        requestId,
        transactionXdr,
        origin: this.TOKENLAB_ORIGIN,
        appName,
        networkPassphrase,
        network,
        description,
        compatibilityMode: 'v13', // Indicate SDK version
        timestamp: Date.now().toString()
      });
      
      const popupUrl = `${this.SAFU_ORIGIN}/sign?${params.toString()}`;
      
      console.log('📝 Opening SAFU wallet for transaction signing:', {
        description,
        network,
        requestId: requestId.substring(0, 12) + '...'
      });
      
      // Open popup
      const popup = window.open(
        popupUrl, 
        'safu-sign', 
        'width=450,height=650,scrollbars=yes,resizable=yes'
      );
      
      if (!popup) {
        reject(new Error('Failed to open wallet popup. Please allow popups.'));
        return;
      }
      
      // Enhanced message handler with better error reporting
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== this.SAFU_ORIGIN) {
          return; // Only accept messages from SAFU wallet
        }
        
        const data = event.data;
        if (data.requestId === requestId) {
          this.cleanup(popup, messageHandler, popupCheckInterval, timeoutHandle);
          
          console.log('📨 Received wallet response:', data.type);
          
          if (data.type === 'transaction_signed') {
            resolve({
              signedTransactionXdr: data.signedTransactionXdr,
              transactionHash: data.transactionHash,
              submitted: !!data.transactionHash,
              network: data.network,
              publicKey: data.publicKey
            });
          } else if (data.type === 'transaction_rejected') {
            reject(new Error('Transaction rejected by user'));
          } else if (data.type === 'transaction_error') {
            // Enhanced error reporting
            const errorMessage = data.error || 'Transaction signing failed';
            console.error('Transaction signing error:', data);
            
            if (errorMessage.includes('DecoratedSignature') || errorMessage.includes('constructor')) {
              reject(new Error(
                'SDK compatibility issue detected. ' +
                'This may be resolved by updating the wallet or using a different signing method. ' +
                `Details: ${errorMessage}`
              ));
            } else {
              reject(new Error(errorMessage));
            }
          } else if (data.type === 'sdk_compatibility_error') {
            reject(new Error(
              'Stellar SDK version mismatch between Token Lab and SAFU wallet. ' +
              'Please ensure both applications are using compatible SDK versions.'
            ));
          } else {
            reject(new Error(`Unknown response type: ${data.type}`));
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Monitor popup closure
      const popupCheckInterval = setInterval(() => {
        if (popup.closed) {
          this.cleanup(popup, messageHandler, popupCheckInterval, timeoutHandle);
          reject(new Error('Popup closed by user'));
        }
      }, 1000);
      
      // Signing timeout
      const timeoutHandle = setTimeout(() => {
        this.cleanup(popup, messageHandler, popupCheckInterval, timeoutHandle);
        reject(new Error(`Transaction signing timeout after ${timeout / 1000} seconds`));
      }, timeout);
    });
  }

  /**
   * Alternative signing method using direct API (fallback for SDK issues)
   */
  public async signTransactionAPI(
    transactionXdr: string,
    options: OptimizedSigningOptions = {}
  ): Promise<OptimizedSigningResult> {
    
    const {
      description = 'Sign Transaction (API)',
      networkPassphrase = 'Test SDF Future Network ; October 2022',
      network = 'futurenet',
      appName = 'Token Lab'
    } = options;
    
    try {
      console.log('🔄 Attempting API-based signing as fallback...');
      
      const response = await fetch(`${this.SAFU_ORIGIN}/api/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionXdr,
          networkPassphrase,
          network,
          description,
          appName,
          mode: 'api',
          origin: this.TOKENLAB_ORIGIN,
          compatibilityMode: 'v13',
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`API signing failed: ${response.statusText}`);
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
        throw new Error(result.error || 'API signing failed');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`API signing failed: ${errorMessage}`);
    }
  }

  /**
   * Smart signing method - tries popup first, falls back to API
   */
  public async signTransactionSmart(
    transactionXdr: string,
    options: OptimizedSigningOptions = {}
  ): Promise<OptimizedSigningResult> {
    
    try {
      // Try popup method first
      return await this.signTransaction(transactionXdr, options);
    } catch (popupError) {
      console.warn('Popup signing failed, trying API fallback:', popupError);
      
      // If popup fails due to SDK issues, try API method
      if (popupError instanceof Error && 
          (popupError.message.includes('DecoratedSignature') || 
           popupError.message.includes('constructor') ||
           popupError.message.includes('SDK compatibility'))) {
        
        console.log('🔄 SDK compatibility issue detected, using API fallback...');
        return await this.signTransactionAPI(transactionXdr, options);
      }
      
      // For other errors, rethrow
      throw popupError;
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `tokenlab_opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up event listeners and popups
   */
  private cleanup(
    popup: Window | null,
    messageHandler: (event: MessageEvent) => void,
    popupCheckInterval: NodeJS.Timeout,
    timeoutHandle: NodeJS.Timeout
  ): void {
    window.removeEventListener('message', messageHandler);
    clearInterval(popupCheckInterval);
    clearTimeout(timeoutHandle);
    
    if (popup && !popup.closed) {
      popup.close();
    }
  }

  /**
   * Get wallet info for debugging
   */
  public async getWalletInfo(): Promise<{
    available: boolean;
    origin: string;
    version?: string;
    features?: string[];
  }> {
    const available = await this.isAvailable();
    
    if (!available) {
      return {
        available: false,
        origin: this.SAFU_ORIGIN
      };
    }

    try {
      const response = await fetch(`${this.SAFU_ORIGIN}/api/info`, {
        method: 'GET',
        mode: 'cors'
      });
      
      if (response.ok) {
        const info = await response.json();
        return {
          available: true,
          origin: this.SAFU_ORIGIN,
          version: info.version,
          features: info.features
        };
      }
    } catch (error) {
      console.warn('Could not get wallet info:', error);
    }

    return {
      available: true,
      origin: this.SAFU_ORIGIN
    };
  }
}

// Singleton instance
let optimizedWalletInstance: OptimizedWalletClient | null = null;

/**
 * Get shared optimized wallet client instance
 */
export function getOptimizedWalletClient(): OptimizedWalletClient {
  if (!optimizedWalletInstance) {
    optimizedWalletInstance = new OptimizedWalletClient();
  }
  return optimizedWalletInstance;
}

/**
 * Legacy wrapper for backward compatibility
 */
export async function signTransactionOptimized(
  transactionXdr: string,
  options: OptimizedSigningOptions = {}
): Promise<OptimizedSigningResult> {
  const client = getOptimizedWalletClient();
  return await client.signTransactionSmart(transactionXdr, options);
}

/**
 * Connect to wallet with optimized client
 */
export async function connectWalletOptimized(options: { appName?: string } = {}): Promise<{
  publicKey: string;
  network: string;
  networkPassphrase: string;
}> {
  const client = getOptimizedWalletClient();
  return await client.connect(options);
}