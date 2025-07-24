// Wallet client for connecting to safu-dev wallet via localStorage

export interface WalletConnection {
  isConnected: boolean;
  address?: string;
  publicKey?: string;
  accounts?: WalletAddress[];
  currentAccount?: WalletAddress | null;
  network?: string;
}

export interface WalletAddress {
  id: string;
  address: string;
  publicKey: string;
  network: 'solana' | 'soroban';
  source: 'derived' | 'imported-seed' | 'imported-key';
}

export interface WalletMessage {
  id: string;
  type: 'request' | 'response' | 'event';
  method: string;
  origin: string;
  timestamp: number;
  params?: any;
  result?: any;
  error?: any;
}

export interface ConnectParams {
  permissions: string[];
  appName: string;
  appIcon?: string;
}

export class LocalStorageClient {
  private connection: WalletConnection | null = null;
  private pendingRequests = new Map<string, { resolve: Function, reject: Function, timestamp: number }>();
  private eventHandlers = new Map<string, Function[]>();
  private pollInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(private config: {
    connectionTimeout: number;
    pollInterval: number;
    enableLogging: boolean;
  }) {
    this.startPolling();
  }

  private startPolling(): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.pollInterval = setInterval(() => {
      this.checkForResponses();
      this.cleanupPendingRequests();
    }, this.config.pollInterval);

    if (this.config.enableLogging) {
      console.log('🔄 Started polling localStorage for wallet responses');
    }
  }

  private stopPolling(): void {
    if (!this.isPolling) return;
    
    this.isPolling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private checkForResponses(): void {
    try {
      const responsesJson = localStorage.getItem('safu-wallet-responses');
      if (!responsesJson) return;

      const responses: WalletMessage[] = JSON.parse(responsesJson);
      
      for (const response of responses) {
        const pendingRequest = this.pendingRequests.get(response.id);
        if (pendingRequest) {
          this.pendingRequests.delete(response.id);
          
          if (response.error) {
            pendingRequest.reject(response.error);
          } else {
            pendingRequest.resolve(response.result);
          }

          if (this.config.enableLogging) {
            console.log('📨 Received wallet response:', response.method, response.id);
          }
        }
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('❌ Error checking localStorage responses:', error);
      }
    }
  }

  private cleanupPendingRequests(): void {
    const now = Date.now();
    const expiredRequests: string[] = [];

    this.pendingRequests.forEach((request, id) => {
      if (now - request.timestamp > this.config.connectionTimeout) {
        expiredRequests.push(id);
        request.reject(new Error('Request timeout'));
      }
    });

    expiredRequests.forEach(id => {
      this.pendingRequests.delete(id);
    });
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    const message: WalletMessage = {
      id: Math.random().toString(36).substring(2, 15),
      type: 'request',
      method,
      origin: window.location.origin,
      timestamp: Date.now(),
      params
    };

    // Create promise for response
    const responsePromise = new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id, { 
        resolve, 
        reject, 
        timestamp: Date.now() 
      });
    });

    try {
      // Get existing requests
      const existingRequestsJson = localStorage.getItem('safu-wallet-requests');
      const existingRequests: WalletMessage[] = existingRequestsJson 
        ? JSON.parse(existingRequestsJson) 
        : [];

      // Add new request
      existingRequests.push(message);

      // Store requests
      localStorage.setItem('safu-wallet-requests', JSON.stringify(existingRequests));

      if (this.config.enableLogging) {
        console.log('📡 Sent request to wallet:', method, message.id);
      }

      // Wait for response
      const result = await responsePromise;
      return result;

    } catch (error) {
      // Clean up pending request
      this.pendingRequests.delete(message.id);
      throw error;
    }
  }

  // Public API
  public async connect(params?: ConnectParams): Promise<WalletConnection> {
    if (this.connection?.isConnected) {
      return this.connection;
    }

    try {
      const connectParams: ConnectParams = {
        permissions: ['read_accounts', 'sign_transactions'],
        appName: document.title || 'Token Lab',
        appIcon: `${window.location.origin}/favicon.ico`,
        ...params
      };

      const result = await this.sendRequest('wallet_connect', connectParams);
      
      this.connection = result;

      if (this.config.enableLogging) {
        console.log('✅ Successfully connected to wallet:', {
          accounts: result.accounts?.length || 0,
          currentAccount: result.currentAccount?.address || 'none'
        });
      }

      // Emit connect event
      this.emitEvent('connect', {
        accounts: result.accounts,
        currentAccount: result.currentAccount,
        network: result.network
      });

      return result;

    } catch (error) {
      throw error;
    }
  }

  public disconnect(): void {
    if (this.connection?.isConnected) {
      this.sendRequest('wallet_disconnect').catch(() => {});
    }

    this.connection = null;

    if (this.config.enableLogging) {
      console.log('🚪 Disconnected from wallet');
    }

    // Emit disconnect event
    this.emitEvent('disconnect', {});
  }

  public isConnected(): boolean {
    return this.connection?.isConnected === true;
  }

  public getCurrentAccount(): WalletAddress | null {
    return this.connection?.currentAccount || null;
  }

  public async signTransaction(transaction: any): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    const signature = await this.sendRequest('wallet_signTransaction', {
      transaction,
      network: this.connection?.network
    });
    
    return signature;
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emitEvent(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('❌ Error in event handler:', error);
      }
    });
  }

  public cleanup(): void {
    this.stopPolling();
    this.connection = null;
    this.pendingRequests.clear();
    this.eventHandlers.clear();

    if (this.config.enableLogging) {
      console.log('🧹 LocalStorageClient cleaned up');
    }
  }
}