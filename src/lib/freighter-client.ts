// Freighter-compatible wallet client that works with safu-dev wallet

export interface FreighterWalletAPI {
  isConnected(): Promise<boolean>;
  getPublicKey(): Promise<string>;
  getNetwork(): Promise<string>;
  getNetworkDetails(): Promise<{
    network: string;
    networkPassphrase: string;
    networkUrl: string;
  }>;
  signTransaction(xdr: string, opts?: {
    network?: string;
    networkPassphrase?: string;
    accountToSign?: string;
  }): Promise<string>;
  signAuthEntry(entryXdr: string, opts?: {
    accountToSign?: string;
  }): Promise<string>;
}

export interface WalletConnection {
  isConnected: boolean;
  publicKey?: string;
  address?: string;
  network?: string;
  networkPassphrase?: string;
  networkUrl?: string;
}

export interface ConnectParams {
  appName: string;
  appIcon?: string;
}

export type WalletType = 'extension' | 'safu' | 'unknown';

export interface WalletDetection {
  extensionAvailable: boolean;
  safuAvailable: boolean;
  bothAvailable: boolean;
}

export class FreighterClient {
  private connection: WalletConnection | null = null;
  private walletApi: FreighterWalletAPI | null = null;
  private popupCheckInterval: NodeJS.Timeout | null = null;
  private walletType: WalletType = 'unknown';
  private selectedWalletType: WalletType | null = null;

  constructor() {
    this.checkForWallets();
    // Check for wallet periodically (safu wallet loads dynamically)
    this.popupCheckInterval = setInterval(() => {
      this.checkForWallets();
    }, 1000);
  }

  private checkForWallets() {
    const detection = this.detectAvailableWallets();
    
    // If user hasn't selected a wallet type yet, use auto-detection
    if (!this.selectedWalletType) {
      if (detection.extensionAvailable && !detection.safuAvailable) {
        // Only extension available
        this.walletType = 'extension';
        this.walletApi = (window as any).freighter;
      } else if (!detection.extensionAvailable && detection.safuAvailable) {
        // Only safu available
        this.walletType = 'safu';
        this.walletApi = (window as any).freighter;
      } else if (detection.bothAvailable) {
        // Both available - will require user choice
        this.walletType = 'unknown';
        this.walletApi = null;
      }
    } else {
      // User has made a choice, use selected wallet
      if (this.selectedWalletType === 'extension' && detection.extensionAvailable) {
        this.walletType = 'extension';
        this.walletApi = (window as any).freighter;
      } else if (this.selectedWalletType === 'safu' && detection.safuAvailable) {
        this.walletType = 'safu';
        this.walletApi = (window as any).freighter;
      } else if (this.selectedWalletType === 'extension') {
        // Extension was selected but not available
        this.walletType = 'extension';
        this.walletApi = null;
      } else if (this.selectedWalletType === 'safu') {
        // Safu was selected but not available
        this.walletType = 'safu';
        this.walletApi = null;
      }
    }
  }

  /**
   * Detect which wallets are available
   */
  public detectAvailableWallets(): WalletDetection {
    const freighter = (window as any).freighter;
    
    // Debug logging
    console.log('FreighterClient: Debugging window.freighter:', {
      exists: !!freighter,
      hasGetPublicKey: freighter && typeof freighter.getPublicKey === 'function',
      hasIsConnected: freighter && typeof freighter.isConnected === 'function',
      isSafuWallet: freighter && freighter._isSafuWallet,
      allMethods: freighter ? Object.keys(freighter) : []
    });
    
    // Check for Freighter browser extension
    const extensionAvailable = !!freighter && 
      typeof freighter.getPublicKey === 'function' &&
      typeof freighter.isConnected === 'function' &&
      !freighter._isSafuWallet;
    
    // Check if this is safu wallet by looking for safu-specific indicators
    const safuAvailable = !!freighter && 
      (freighter._isSafuWallet || 
       window.location.href.includes('localhost:3003'));
    
    console.log('FreighterClient: Detection result:', {
      extensionAvailable,
      safuAvailable,
      bothAvailable: extensionAvailable && safuAvailable
    });
    
    return {
      extensionAvailable,
      safuAvailable,
      bothAvailable: extensionAvailable && safuAvailable
    };
  }

  /**
   * Wait for Freighter extension to be available with retry
   */
  private async waitForFreighter(maxRetries = 10, delayMs = 200): Promise<boolean> {
    console.log('FreighterClient: Waiting for Freighter extension...');
    
    for (let i = 0; i < maxRetries; i++) {
      const freighter = (window as any).freighter;
      
      console.log(`FreighterClient: Attempt ${i + 1}/${maxRetries}:`, {
        freighterExists: !!freighter,
        hasGetPublicKey: freighter && typeof freighter.getPublicKey === 'function',
        hasIsConnected: freighter && typeof freighter.isConnected === 'function'
      });
      
      if (freighter && 
          typeof freighter.getPublicKey === 'function' && 
          typeof freighter.isConnected === 'function') {
        console.log('FreighterClient: Freighter extension found!');
        return true;
      }
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.log('FreighterClient: Freighter extension not found after waiting');
    return false;
  }

  /**
   * Set wallet preference when multiple options are available
   */
  public selectWalletType(type: WalletType): void {
    this.selectedWalletType = type;
    this.checkForWallets();
  }

  /**
   * Open safu wallet popup and wait for it to load
   */
  private async openSafuWalletPopup(): Promise<void> {
    const safuPopup = window.open(
      'http://localhost:3003/sign',
      'safu-wallet',
      'width=400,height=600,scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no'
    );

    if (!safuPopup) {
      throw new Error('Failed to open safu wallet popup. Please allow popups.');
    }

    // Wait for safu wallet to load and expose Freighter API
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds max wait
    
    while (!this.walletApi && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.checkForWallets();
      attempts++;
    }

    if (!this.walletApi) {
      safuPopup.close();
      throw new Error('Safu wallet did not load properly. Please ensure it is running on http://localhost:3003');
    }
  }

  /**
   * Check if Freighter-compatible wallet is available
   */
  public isWalletAvailable(): boolean {
    return this.walletApi !== null;
  }

  /**
   * Get current wallet type
   */
  public getWalletType(): WalletType {
    return this.walletType;
  }

  /**
   * Connect to wallet (handles both extension and safu popup)
   */
  public async connect(params?: ConnectParams): Promise<WalletConnection> {
    // If extension type was selected, wait for it to be available
    if (this.selectedWalletType === 'extension') {
      console.log('FreighterClient: Waiting for Freighter extension...');
      await this.waitForFreighter();
    }
    
    const detection = this.detectAvailableWallets();
    
    // If both wallets available and no selection made, throw error for user to choose
    if (detection.bothAvailable && !this.selectedWalletType) {
      throw new Error('Multiple wallets available. Please select one first.');
    }

    // If no wallet available, handle based on selected type
    if (!this.walletApi) {
      if (this.selectedWalletType === 'safu' || (this.walletType === 'safu' && !this.selectedWalletType)) {
        await this.openSafuWalletPopup();
      } else if (this.selectedWalletType === 'extension') {
        throw new Error('Freighter browser extension not found. Please install the Freighter extension and reload the page.');
      } else {
        throw new Error('No compatible wallet found. Please install Freighter extension or start Safu wallet.');
      }
    }

    try {
      // Now use standard Freighter API calls
      const isAlreadyConnected = await this.walletApi.isConnected();
      
      if (!isAlreadyConnected) {
        // Getting public key triggers connection request in Freighter API
        const publicKey = await this.walletApi.getPublicKey();
        
        if (!publicKey) {
          throw new Error('Failed to get public key from wallet');
        }
      }

      // Get wallet details using Freighter API
      const publicKey = await this.walletApi.getPublicKey();
      const network = await this.walletApi.getNetwork();
      const networkDetails = await this.walletApi.getNetworkDetails();

      this.connection = {
        isConnected: true,
        publicKey,
        address: publicKey, // For Stellar, public key is the address
        network: networkDetails.network,
        networkPassphrase: networkDetails.networkPassphrase,
        networkUrl: networkDetails.networkUrl
      };

      return this.connection;

    } catch (error: any) {
      // Handle common Freighter errors
      if (error.code === 4001) {
        throw new Error('User rejected the connection request');
      } else if (error.code === -32002) {
        throw new Error('Wallet connection request already pending');
      } else {
        throw new Error(`Failed to connect to wallet: ${error.message}`);
      }
    }
  }

  /**
   * Check if connected
   */
  public async isConnected(): Promise<boolean> {
    if (!this.walletApi) {
      return false;
    }

    try {
      const connected = await this.walletApi.isConnected();
      return connected && !!this.connection?.isConnected;
    } catch {
      return false;
    }
  }

  /**
   * Get current connection
   */
  public getConnection(): WalletConnection | null {
    return this.connection;
  }

  /**
   * Get public key
   */
  public async getPublicKey(): Promise<string | null> {
    if (!this.walletApi || !this.connection?.isConnected) {
      return null;
    }

    try {
      return await this.walletApi.getPublicKey();
    } catch {
      return null;
    }
  }

  /**
   * Get network
   */
  public async getNetwork(): Promise<string | null> {
    if (!this.walletApi || !this.connection?.isConnected) {
      return null;
    }

    try {
      const networkDetails = await this.walletApi.getNetworkDetails();
      return networkDetails.network;
    } catch {
      return null;
    }
  }

  /**
   * Sign transaction
   */
  public async signTransaction(xdr: string, options?: {
    network?: string;
    networkPassphrase?: string;
    accountToSign?: string;
  }): Promise<string> {
    if (!this.walletApi || !this.connection?.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const signedXdr = await this.walletApi.signTransaction(xdr, {
        network: options?.network || this.connection.network,
        networkPassphrase: options?.networkPassphrase || this.connection.networkPassphrase,
        accountToSign: options?.accountToSign || this.connection.publicKey
      });

      return signedXdr;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the transaction');
      } else {
        throw new Error(`Failed to sign transaction: ${error.message}`);
      }
    }
  }

  /**
   * Sign auth entry (for Soroban authorization)
   */
  public async signAuthEntry(entryXdr: string, options?: {
    accountToSign?: string;
  }): Promise<string> {
    if (!this.walletApi || !this.connection?.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const signedEntry = await this.walletApi.signAuthEntry(entryXdr, {
        accountToSign: options?.accountToSign || this.connection.publicKey
      });

      return signedEntry;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the authorization');
      } else {
        throw new Error(`Failed to sign auth entry: ${error.message}`);
      }
    }
  }

  /**
   * Disconnect wallet
   */
  public disconnect(): void {
    this.connection = null;
  }

  /**
   * Cleanup client
   */
  public cleanup(): void {
    if (this.popupCheckInterval) {
      clearInterval(this.popupCheckInterval);
      this.popupCheckInterval = null;
    }
    this.connection = null;
    this.walletApi = null;
  }

  /**
   * Get wallet info for debugging
   */
  public getWalletInfo(): { 
    available: boolean; 
    connected: boolean; 
    network?: string; 
    publicKey?: string;
    walletType: WalletType;
    detection: WalletDetection;
  } {
    return {
      available: this.isWalletAvailable(),
      connected: !!this.connection?.isConnected,
      network: this.connection?.network,
      publicKey: this.connection?.publicKey,
      walletType: this.walletType,
      detection: this.detectAvailableWallets()
    };
  }
}

// Global wallet instance
let walletInstance: FreighterClient | null = null;

/**
 * Get shared wallet instance
 */
export function getWalletClient(): FreighterClient {
  if (!walletInstance) {
    walletInstance = new FreighterClient();
  }
  return walletInstance;
}

/**
 * Check if running in browser with wallet support
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Wait for safu wallet to be available (useful for development)
 */
export async function waitForSafuWallet(timeout: number = 10000): Promise<FreighterClient> {
  const client = getWalletClient();
  
  if (client.isWalletAvailable()) {
    return client;
  }

  // Wait for wallet to load
  return new Promise((resolve, reject) => {
    const checkInterval = 500;
    let elapsed = 0;

    const check = () => {
      if (client.isWalletAvailable()) {
        resolve(client);
      } else if (elapsed >= timeout) {
        reject(new Error('Safu wallet not found after timeout. Please ensure it is running on http://localhost:3003'));
      } else {
        elapsed += checkInterval;
        setTimeout(check, checkInterval);
      }
    };

    check();
  });
}