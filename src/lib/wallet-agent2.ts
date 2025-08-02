/**
 * SAFU Wallet Connect Agent 2.0 Client
 * Implements the new API key-based authentication and approve-then-transmit flow
 */

export interface Agent2Config {
  apiKey?: string;
  keyId?: string;
  walletUrl?: string;
  origin?: string;
}

export interface WalletConnection {
  type: 'agent2' | 'freighter' | 'popup';
  sessionToken?: string;
  publicKey: string;
  network: string;
  agent?: SafuAgent2;
}

export interface TransactionSubmitRequest {
  transactionType: 'deploy' | 'send' | 'sign';
  details: any;
  description: string;
  network: string;
  transmitAfterApproval?: boolean;
}

export interface TransactionSubmitResponse {
  transactionId: string;
  status: 'pending_approval' | 'approved' | 'auto_approved';
  message: string;
}

export interface TransactionStatus {
  transactionId: string;
  status: 'pending_approval' | 'approved' | 'signing' | 'transmitting' | 'transmitted' | 'denied' | 'expired' | 'failed';
  networkTxHash?: string;
  error?: string;
  timestamp: string;
}

export class SafuAgent2 {
  private apiKey: string;
  private keyId: string;
  private walletUrl: string;
  private origin: string;
  private sessionToken?: string;

  constructor(config: Agent2Config) {
    this.apiKey = config.apiKey || '';
    this.keyId = config.keyId || '';
    this.walletUrl = config.walletUrl || 'http://localhost:3003';
    this.origin = config.origin || window.location.origin;
  }

  async authenticate(): Promise<string> {
    if (!this.apiKey || !this.keyId) {
      throw new Error('API key and key ID are required for Agent 2.0 authentication');
    }

    // Step 1: Request challenge
    const challengeResponse = await fetch(`${this.walletUrl}/api/agent/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyId: this.keyId })
    });

    if (!challengeResponse.ok) {
      throw new Error(`Challenge request failed: ${challengeResponse.statusText}`);
    }

    const challengeData = await challengeResponse.json();

    // Step 2: Solve challenge with partial API key
    const fragments = challengeData.positions.map((pos: number) => this.apiKey.charAt(pos));

    const authResponse = await fetch(`${this.walletUrl}/api/agent/auth/response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: challengeData.challengeId,
        keyFragments: fragments
      })
    });

    if (!authResponse.ok) {
      const errorData = await authResponse.json();
      throw new Error(`Authentication failed: ${errorData.error || authResponse.statusText}`);
    }

    const authData = await authResponse.json();
    this.sessionToken = authData.sessionToken;
    
    return authData.sessionToken;
  }

  async getPublicKey(): Promise<string> {
    this.ensureAuthenticated();
    
    const response = await fetch(`${this.walletUrl}/api/agent/account/info`, {
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to get public key: ${response.statusText}`);
    }

    const data = await response.json();
    return data.publicKey;
  }

  async getNetwork(): Promise<string> {
    this.ensureAuthenticated();
    
    const response = await fetch(`${this.walletUrl}/api/agent/account/info`, {
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to get network info: ${response.statusText}`);
    }

    const data = await response.json();
    return data.network;
  }

  async submitTransaction(request: TransactionSubmitRequest): Promise<TransactionSubmitResponse> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.walletUrl}/api/agent/transaction/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sessionToken}`
      },
      body: JSON.stringify({
        ...request,
        appName: 'Token Lab',
        origin: this.origin
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Transaction submit failed: ${errorData.error || response.statusText}`);
    }

    return await response.json();
  }

  async getTransactionStatus(transactionId: string): Promise<TransactionStatus> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.walletUrl}/api/agent/transaction/${transactionId}/status`, {
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to get transaction status: ${response.statusText}`);
    }

    return await response.json();
  }

  async waitForCompletion(transactionId: string, maxWaitMs: number = 300000): Promise<TransactionStatus> {
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getTransactionStatus(transactionId);
      
      if (['transmitted', 'denied', 'expired', 'failed'].includes(status.status)) {
        return status;
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Transaction timeout - exceeded maximum wait time');
  }

  private ensureAuthenticated(): void {
    if (!this.sessionToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }
  }

  // Legacy password-based authentication for backward compatibility
  async authenticateWithPassword(password: string, encryptedSeed?: string): Promise<any> {
    const authData = {
      password,
      appName: 'Token Lab',
      origin: this.origin,
      mode: 'agent'
    };

    if (encryptedSeed) {
      (authData as any).encryptedSeed = encryptedSeed;
    }

    const response = await fetch(`${this.walletUrl}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Password authentication failed: ${errorData.error || response.statusText}`);
    }

    return await response.json();
  }

  // Legacy transaction signing for backward compatibility
  async signTransaction(transactionXdr: string, networkPassphrase: string, sessionData: any): Promise<string> {
    const response = await fetch(`${this.walletUrl}/api/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionXdr,
        networkPassphrase,
        network: 'futurenet',
        description: 'Legacy transaction signing',
        appName: 'Token Lab',
        mode: 'agent',
        origin: this.origin,
        ...sessionData
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Transaction signing failed: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    return result.signedTransactionXdr;
  }
}

export class UnifiedWalletClient {
  private agent2?: SafuAgent2;
  private walletUrl: string;

  constructor(walletUrl: string = 'http://localhost:3003') {
    this.walletUrl = walletUrl;
  }

  async connect(config?: Agent2Config): Promise<WalletConnection> {
    // Try Agent 2.0 first if API key is provided
    if (config?.apiKey && config?.keyId) {
      try {
        return await this.connectAgent2(config);
      } catch (error) {
        console.warn('Agent 2.0 connection failed, falling back to legacy methods:', error);
      }
    }

    // Try legacy password-based agent connection
    const agentPassword = (window as any).__SAFU_AGENT_PASSWORD__;
    const encryptedSeed = (window as any).__SAFU_ENCRYPTED_SEED__;
    
    if (agentPassword) {
      try {
        return await this.connectLegacyAgent(agentPassword, encryptedSeed);
      } catch (error) {
        console.warn('Legacy agent connection failed, falling back to Freighter:', error);
      }
    }

    // Fallback to Freighter API
    return await this.connectFreighter();
  }

  private async connectAgent2(config: Agent2Config): Promise<WalletConnection> {
    this.agent2 = new SafuAgent2(config);
    const sessionToken = await this.agent2.authenticate();
    
    const publicKey = await this.agent2.getPublicKey();
    const network = await this.agent2.getNetwork();

    return {
      type: 'agent2',
      sessionToken,
      publicKey,
      network,
      agent: this.agent2
    };
  }

  private async connectLegacyAgent(password: string, encryptedSeed?: string): Promise<WalletConnection> {
    const agent = new SafuAgent2({ walletUrl: this.walletUrl });
    const authData = await agent.authenticateWithPassword(password, encryptedSeed);

    return {
      type: 'agent2',
      sessionToken: authData.accessToken,
      publicKey: authData.publicKey,
      network: authData.network,
      agent
    };
  }

  private async connectFreighter(): Promise<WalletConnection> {
    // Check if Freighter is available
    if (typeof window !== 'undefined' && (window as any).freighter) {
      const freighter = (window as any).freighter;
      await freighter.requestAccess();
      
      const publicKey = await freighter.getPublicKey();
      const network = await freighter.getNetwork();

      return {
        type: 'freighter',
        publicKey,
        network
      };
    }

    // Fallback to popup method
    return await this.connectPopup();
  }

  private async connectPopup(): Promise<WalletConnection> {
    // Use existing popup connection logic
    const response = await this.openWalletPopup('/connect');
    
    return {
      type: 'popup',
      publicKey: response.publicKey,
      network: response.network || 'futurenet'
    };
  }

  private async openWalletPopup(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        `${this.walletUrl}${path}?mode=connect&origin=${encodeURIComponent(window.location.origin)}`,
        'safu-wallet',
        'width=400,height=600,resizable=yes,scrollbars=yes'
      );

      if (!popup) {
        reject(new Error('Failed to open wallet popup'));
        return;
      }

      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== this.walletUrl) return;

        if (event.data.type === 'SAFU_CONNECTION_SUCCESS') {
          window.removeEventListener('message', messageHandler);
          popup.close();
          resolve(event.data.payload);
        } else if (event.data.type === 'SAFU_CONNECTION_ERROR') {
          window.removeEventListener('message', messageHandler);
          popup.close();
          reject(new Error(event.data.message));
        }
      };

      window.addEventListener('message', messageHandler);

      // Handle popup close
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          reject(new Error('Wallet popup was closed'));
        }
      }, 1000);
    });
  }

  async deployToken(connection: WalletConnection, contractData: any): Promise<string> {
    if (connection.type === 'agent2' && connection.agent) {
      // Use new approve-then-transmit flow
      const submitResponse = await connection.agent.submitTransaction({
        transactionType: 'deploy',
        details: {
          contractCode: contractData.wasmHash,
          initArgs: contractData.initArgs,
          network: 'futurenet'
        },
        description: `Deploy ${contractData.name} (${contractData.symbol})`,
        network: 'futurenet',
        transmitAfterApproval: true
      });

      // Wait for completion
      const result = await connection.agent.waitForCompletion(submitResponse.transactionId);
      
      if (result.status === 'transmitted' && result.networkTxHash) {
        return result.networkTxHash;
      } else {
        throw new Error(`Deployment failed: ${result.error || result.status}`);
      }
    } else {
      // Use legacy signing flow for other connection types
      throw new Error('Legacy deployment flow not implemented in this version');
    }
  }
}