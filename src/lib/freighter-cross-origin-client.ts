// FreighterCrossOriginClient - Cross-origin communication with SAFU wallet
// This replaces window.freighter detection with postMessage communication

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

interface CrossOriginMessage {
  type: string;
  requestId: string;
  payload?: any;
  error?: string;
}

interface DiscoveryResponse {
  type: 'wallet_discovery_response';
  walletType: 'safu' | 'extension';
  available: boolean;
  version?: string;
  capabilities?: string[];
}

export class FreighterCrossOriginClient implements FreighterWalletAPI {
  private connection: WalletConnection | null = null;
  private discoveryAttempts = 0;
  private maxDiscoveryAttempts = 3;
  private discoveryTimeout = 2000; // 2 seconds per attempt
  private safuWalletOrigin = 'http://localhost:3003';
  private tokenLabOrigin = 'http://localhost:3005';
  private extensionDetected = false;
  private safuDetected = false;
  private messageHandlers = new Map<string, (data: any) => void>();
  private discoveryComplete = false;

  constructor() {
    this.setupMessageListener();
    this.startDiscovery();
  }

  /**
   * Set up message listener for cross-origin communication
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      // Security: Only accept messages from trusted origins
      if (event.origin !== this.safuWalletOrigin) {
        return;
      }

      const data = event.data as CrossOriginMessage;
      
      // Handle discovery responses
      if (data.type === 'wallet_discovery_response') {
        this.handleDiscoveryResponse(data as any);
        return;
      }

      // Handle API responses
      if (data.requestId && this.messageHandlers.has(data.requestId)) {
        const handler = this.messageHandlers.get(data.requestId);
        if (handler) {
          handler(data);
          this.messageHandlers.delete(data.requestId);
        }
      }
    });
  }

  /**
   * Start wallet discovery process
   */
  private async startDiscovery(): Promise<void> {
    console.log('FreighterCrossOriginClient: Starting wallet discovery...');
    
    // First check for browser extension (traditional way)
    this.checkBrowserExtension();
    
    // Then discover SAFU wallet via cross-origin communication
    await this.discoverSafuWallet();
    
    this.discoveryComplete = true;
    console.log('FreighterCrossOriginClient: Discovery complete', {
      extensionDetected: this.extensionDetected,
      safuDetected: this.safuDetected
    });
  }

  /**
   * Check for browser extension (Freighter)
   */
  private checkBrowserExtension(): void {
    const freighter = (window as any).freighter;
    this.extensionDetected = !!freighter && 
      typeof freighter.getPublicKey === 'function' &&
      typeof freighter.isConnected === 'function' &&
      !freighter._isSafuWallet;
    
    console.log('FreighterCrossOriginClient: Browser extension check:', {
      detected: this.extensionDetected,
      hasFreighter: !!freighter,
      methods: freighter ? Object.keys(freighter) : []
    });
  }

  /**
   * Discover SAFU wallet via cross-origin communication
   */
  private async discoverSafuWallet(): Promise<void> {
    console.log('FreighterCrossOriginClient: Discovering SAFU wallet...');
    
    for (let attempt = 1; attempt <= this.maxDiscoveryAttempts; attempt++) {
      console.log(`FreighterCrossOriginClient: Discovery attempt ${attempt}/${this.maxDiscoveryAttempts}`);
      
      try {
        await this.sendDiscoveryMessage();
        if (this.safuDetected) {
          console.log('FreighterCrossOriginClient: SAFU wallet discovered successfully');
          return;
        }
      } catch (error) {
        console.log(`FreighterCrossOriginClient: Discovery attempt ${attempt} failed:`, error);
      }
      
      // Wait before next attempt
      if (attempt < this.maxDiscoveryAttempts) {
        await new Promise(resolve => setTimeout(resolve, this.discoveryTimeout));
      }
    }
    
    console.log('FreighterCrossOriginClient: SAFU wallet discovery completed', {
      detected: this.safuDetected
    });
  }

  /**
   * Send discovery message to SAFU wallet using multiple methods
   */
  private async sendDiscoveryMessage(): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      const message = {
        type: 'wallet_discovery_request',
        requestId,
        origin: window.location.origin,
        tokenLabPort: window.location.port,
        expectedOrigin: this.tokenLabOrigin,
        appName: 'Token Lab'
      };

      console.log('FreighterCrossOriginClient: Sending discovery message:', message);

      // Set up response handler
      const timeout = setTimeout(() => {
        console.log('FreighterCrossOriginClient: Discovery timeout - no response received');
        reject(new Error('Discovery timeout'));
      }, this.discoveryTimeout);

      const handleResponse = (event: MessageEvent) => {
        if (event.origin === this.safuWalletOrigin && 
            (event.data?.type === 'wallet_discovery_response' || event.data?.type === 'FREIGHTER_DISCOVERY_RESPONSE')) {
          console.log('FreighterCrossOriginClient: Discovery response received:', event.data);
          clearTimeout(timeout);
          window.removeEventListener('message', handleResponse);
          this.safuDetected = true;
          resolve();
        }
      };

      // Listen for discovery response
      window.addEventListener('message', handleResponse);

      // Try multiple methods to reach SAFU wallet
      this.broadcastDiscoveryMessage(message);
    });
  }

  /**
   * Broadcast discovery message using multiple methods
   */
  private broadcastDiscoveryMessage(message: any): void {
    console.log('FreighterCrossOriginClient: Broadcasting discovery message...');

    // Method 1: Try to send to stored popup reference if it exists
    if ((window as any).safuWalletPopup && !(window as any).safuWalletPopup.closed) {
      try {
        (window as any).safuWalletPopup.postMessage(message, this.safuWalletOrigin);
        console.log('📤 Sent discovery to existing SAFU wallet popup');
      } catch (error) {
        console.log('FreighterCrossOriginClient: Failed to send to existing popup:', error);
      }
    }

    // Method 2: Broadcast to parent/opener (if Token Lab was opened from SAFU wallet)
    if (window.opener && window.opener !== window) {
      try {
        window.opener.postMessage(message, this.safuWalletOrigin);
        console.log('📤 Sent discovery to opener window');
      } catch (error) {
        console.log('FreighterCrossOriginClient: Failed to send to opener:', error);
      }
    }

    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(message, this.safuWalletOrigin);
        console.log('📤 Sent discovery to parent window');
      } catch (error) {
        console.log('FreighterCrossOriginClient: Failed to send to parent:', error);
      }
    }

    // Method 3: Create temporary iframe for communication
    this.createTemporaryConnection(message);

    // Method 4: Try direct window reference if stored
    if ((window as any).safuWalletPopup && !(window as any).safuWalletPopup.closed) {
      try {
        (window as any).safuWalletPopup.postMessage(message, this.safuWalletOrigin);
        console.log('📤 Sent discovery to stored popup reference');
      } catch (error) {
        console.log('FreighterCrossOriginClient: Failed to send to stored popup:', error);
      }
    }
  }

  /**
   * Create temporary connection to SAFU wallet for discovery
   */
  private createTemporaryConnection(message: any): void {
    // Create a temporary hidden iframe to communicate with SAFU wallet
    const iframe = document.createElement('iframe');
    iframe.src = `${this.safuWalletOrigin}/discovery`;
    iframe.style.display = 'none';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    
    iframe.onload = () => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(message, this.safuWalletOrigin);
        }
      } catch (error) {
        console.log('FreighterCrossOriginClient: Iframe communication failed:', error);
      }
      
      // Clean up iframe after a short delay
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    };

    iframe.onerror = () => {
      console.log('FreighterCrossOriginClient: Failed to load discovery iframe');
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    document.body.appendChild(iframe);
  }

  /**
   * Handle discovery response from SAFU wallet
   */
  private handleDiscoveryResponse(data: DiscoveryResponse): void {
    console.log('FreighterCrossOriginClient: Received discovery response:', data);
    
    if (data.walletType === 'safu' && data.available) {
      this.safuDetected = true;
      console.log('FreighterCrossOriginClient: SAFU wallet is available');
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `tokenlab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send cross-origin message and wait for response
   */
  private async sendCrossOriginMessage(type: string, payload: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      const message = {
        type,
        requestId,
        payload,
        origin: window.location.origin,
        tokenLabPort: window.location.port,
        expectedOrigin: this.tokenLabOrigin,
        appName: 'Token Lab'
      };

      // Set up response handler
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(requestId);
        reject(new Error(`${type} request timeout`));
      }, 30000); // 30 second timeout

      const handleResponse = (data: CrossOriginMessage) => {
        clearTimeout(timeout);
        
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data.payload);
        }
      };

      this.messageHandlers.set(requestId, handleResponse);

      // Send message to SAFU wallet
      this.broadcastMessage(message);
    });
  }

  /**
   * Broadcast message to potential SAFU wallet instances
   */
  private broadcastMessage(message: any): void {
    // Method 1: Send to any SAFU wallet iframes
    const safuFrames = document.querySelectorAll('iframe[src*="localhost:3003"]');
    safuFrames.forEach(frame => {
      try {
        (frame as HTMLIFrameElement).contentWindow?.postMessage(message, this.safuWalletOrigin);
      } catch (error) {
        console.log('FreighterCrossOriginClient: Failed to send to iframe:', error);
      }
    });

    // Method 2: Try to send to SAFU wallet popup if it exists
    // We'll need to keep track of popups when they're opened
    if ((window as any).safuWalletPopup && !(window as any).safuWalletPopup.closed) {
      try {
        (window as any).safuWalletPopup.postMessage(message, this.safuWalletOrigin);
      } catch (error) {
        console.log('FreighterCrossOriginClient: Failed to send to popup:', error);
      }
    }
  }

  /**
   * Open SAFU wallet popup for connection and establish communication
   */
  private async openSafuWalletPopup(): Promise<Window> {
    console.log('FreighterCrossOriginClient: Opening SAFU wallet popup...');
    
    // Calculate popup position to center it on screen
    const width = 450;
    const height = 650;
    const left = Math.round((window.screen.width - width) / 2);
    const top = Math.round((window.screen.height - height) / 2);
    
    // Cleaner popup features to avoid blank tab
    const popupFeatures = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'scrollbars=yes',
      'resizable=yes',
      'status=no',
      'location=no',
      'toolbar=no',
      'menubar=no'
    ].join(',');
    
    // Create connection ID for this session
    const connectionId = `tokenlab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build URL with connection parameters to help SAFU wallet establish communication
    const safuUrl = new URL(`${this.safuWalletOrigin}/sign`);
    safuUrl.searchParams.set('origin', window.location.origin);
    safuUrl.searchParams.set('connectionId', connectionId);
    safuUrl.searchParams.set('appName', 'Token Lab');
    
    console.log('FreighterCrossOriginClient: Opening popup with connection URL:', safuUrl.toString());
    
    // Open popup with connection parameters
    const popup = window.open(
      safuUrl.toString(),
      'SafuWallet',
      popupFeatures
    );
    
    if (!popup) {
      throw new Error('Failed to open SAFU wallet popup. Please allow popups for this site.');
    }

    // Store popup reference and connection info
    (window as any).safuWalletPopup = popup;
    (window as any).safuConnectionId = connectionId;
    
    console.log('FreighterCrossOriginClient: Popup opened with connection ID:', connectionId);

    // Enhanced debugging
    console.log('FreighterCrossOriginClient: Detailed popup window state:', {
      popup: !!popup,
      closed: popup.closed,
      location: this.getWindowLocationDebug(popup),
      windowObject: typeof popup,
      name: popup.name,
      connectionId: connectionId
    });

    // Wait for popup to load before attempting communication
    await this.waitForPopupLoad(popup);

    // Establish robust communication channel
    await this.establishRobustCommunication(popup, connectionId);

    return popup;
  }

  /**
   * Wait for popup to load properly and verify it's the correct SAFU wallet
   */
  private async waitForPopupLoad(popup: Window): Promise<void> {
    console.log('FreighterCrossOriginClient: Waiting for popup to load and verifying SAFU wallet...');
    
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 20; // 10 seconds max
      
      const checkLoad = () => {
        attempts++;
        
        if (popup.closed) {
          console.log('FreighterCrossOriginClient: Popup was closed during loading');
          resolve();
          return;
        }
        
        // Enhanced popup verification
        try {
          console.log(`FreighterCrossOriginClient: Popup check attempt ${attempts}:`, {
            closed: popup.closed,
            name: popup.name,
            location: popup.location?.href || 'cross-origin',
            origin: popup.location?.origin || 'cross-origin'
          });
          
          // If we can access location and it shows SAFU wallet, we're good
          if (popup.location?.href?.includes('localhost:3003')) {
            console.log('✅ FreighterCrossOriginClient: Confirmed popup is SAFU wallet');
            resolve();
            return;
          }
          
          if (attempts >= maxAttempts) {
            console.log('FreighterCrossOriginClient: Popup load timeout reached');
            resolve();
            return;
          }
        } catch (error) {
          // Cross-origin error is expected for SAFU wallet
          console.log(`FreighterCrossOriginClient: Cross-origin error (expected for SAFU wallet): ${error.message}`);
          
          if (attempts >= 10) { // Give it at least 5 seconds for cross-origin
            console.log('✅ FreighterCrossOriginClient: Cross-origin popup assumed to be SAFU wallet');
            resolve();
            return;
          }
        }
        
        setTimeout(checkLoad, 500);
      };
      
      // Start checking after initial delay to allow navigation
      setTimeout(checkLoad, 1500);
    });
  }

  /**
   * Establish robust bidirectional communication
   */
  private async establishRobustCommunication(popup: Window, connectionId: string): Promise<void> {
    console.log('FreighterCrossOriginClient: Establishing robust communication...');
    
    return new Promise((resolve) => {
      let communicationEstablished = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      
      // Enhanced message listener waiting for SAFU_WALLET_READY signal
      const handshakeListener = (event: MessageEvent) => {
        console.log('FreighterCrossOriginClient: Received handshake message:', {
          origin: event.origin,
          type: event.data?.type,
          connectionId: event.data?.connectionId,
          data: event.data
        });
        
        if (event.origin === this.safuWalletOrigin) {
          if (event.data?.type === 'SAFU_WALLET_READY') {
            console.log('🎉 FreighterCrossOriginClient: SAFU wallet is READY! Starting handshake...');
            
            // Now that SAFU wallet is ready, send our handshake
            const handshakeMessage = {
              type: 'TOKEN_LAB_HANDSHAKE',
              connectionId: connectionId,
              origin: window.location.origin,
              appName: 'Token Lab',
              timestamp: Date.now()
            };
            
            try {
              popup.postMessage(handshakeMessage, this.safuWalletOrigin);
              console.log('📤 FreighterCrossOriginClient: Handshake sent after READY signal:', handshakeMessage);
            } catch (error) {
              console.log('❌ FreighterCrossOriginClient: Failed to send handshake after READY:', error.message);
            }
            
          } else if (event.data?.type === 'wallet_discovery_response' || 
                     event.data?.type === 'TOKEN_LAB_HANDSHAKE_RESPONSE' ||
                     event.data?.connectionId === connectionId) {
            console.log('🎉 FreighterCrossOriginClient: SAFU wallet communication established!');
            communicationEstablished = true;
            this.safuDetected = true;
            window.removeEventListener('message', handshakeListener);
            resolve();
          }
        }
      };
      
      window.addEventListener('message', handshakeListener);
      
      // Set up timeout in case READY signal never comes
      const readyTimeout = setTimeout(() => {
        if (!communicationEstablished) {
          console.log('⚠️  FreighterCrossOriginClient: SAFU_WALLET_READY signal timeout - proceeding anyway');
          console.log('💡 This may indicate SAFU wallet is not fully loaded or PostMessage bridge is not active');
          window.removeEventListener('message', handshakeListener);
          resolve();
        }
      }, 15000); // 15 second timeout for READY signal
      
      // Clean up timeout when communication is established
      const originalResolve = resolve;
      resolve = () => {
        clearTimeout(readyTimeout);
        originalResolve();
      };
      
      console.log('⏳ FreighterCrossOriginClient: Waiting for SAFU_WALLET_READY signal...');
      
      // If discovery already succeeded, we can proceed immediately
      if (this.safuDetected) {
        console.log('🚀 FreighterCrossOriginClient: Discovery already completed - proceeding with API calls');
        clearTimeout(readyTimeout);
        window.removeEventListener('message', handshakeListener);
        resolve();
        return;
      }
    });
  }

  /**
   * Get window location debug info safely
   */
  private getWindowLocationDebug(popup: Window): string {
    try {
      return popup.location.href ? 'same-origin' : 'unknown';
    } catch (error) {
      return 'cross-origin (expected)';
    }
  }

  /**
   * Test window reference to ensure it's valid for communication
   */
  private async testWindowReference(popup: Window): Promise<void> {
    console.log('FreighterCrossOriginClient: Testing window reference...');
    
    // Test 1: Basic window properties
    try {
      const basicTest = {
        closed: popup.closed,
        name: popup.name,
        typeof: typeof popup
      };
      console.log('FreighterCrossOriginClient: Basic window test passed:', basicTest);
    } catch (error) {
      console.error('FreighterCrossOriginClient: Basic window test failed:', error);
      throw new Error('Invalid popup window reference');
    }

    // Test 2: PostMessage capability test
    return new Promise((resolve, reject) => {
      const testTimeout = setTimeout(() => {
        reject(new Error('Window reference test timeout'));
      }, 3000);

      try {
        // Send a test message to verify postMessage works
        const testMessage = {
          type: 'WINDOW_REFERENCE_TEST',
          timestamp: Date.now(),
          origin: window.location.origin
        };
        
        popup.postMessage(testMessage, this.safuWalletOrigin);
        console.log('FreighterCrossOriginClient: Window reference test message sent successfully');
        
        // Don't wait for response, just verify we can send
        clearTimeout(testTimeout);
        resolve();
        
      } catch (error) {
        clearTimeout(testTimeout);
        console.error('FreighterCrossOriginClient: Window reference test failed:', error);
        reject(new Error(`Window postMessage test failed: ${error.message}`));
      }
    });
  }

  /**
   * Establish communication with popup using enhanced retry logic and parent-child testing
   */
  private async establishPopupCommunication(popup: Window): Promise<void> {
    console.log('FreighterCrossOriginClient: Establishing popup communication with enhanced debugging...');
    
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 40; // Longer timeout as recommended by wallet team
      let communicationEstablished = false;
      
      // Set up message listener FIRST before sending any messages
      const messageListener = (event: MessageEvent) => {
        console.log('FreighterCrossOriginClient: Received message:', {
          origin: event.origin,
          type: event.data?.type,
          source: event.source === popup ? 'popup' : 'other',
          data: event.data
        });
        
        if (event.origin === this.safuWalletOrigin) {
          if (event.data?.type === 'wallet_discovery_response' || 
              event.data?.type === 'FREIGHTER_DISCOVERY_RESPONSE' ||
              event.data?.type === 'FREIGHTER_API_RESPONSE') {
            console.log('🎉 FreighterCrossOriginClient: Valid response received from SAFU wallet!', event.data);
            communicationEstablished = true;
            this.safuDetected = true;
            window.removeEventListener('message', messageListener);
            resolve();
          } else if (event.data?.type === 'WINDOW_REFERENCE_TEST_RESPONSE') {
            console.log('✅ FreighterCrossOriginClient: Window reference test response received');
          }
        }
      };
      
      window.addEventListener('message', messageListener);
      console.log('FreighterCrossOriginClient: Message listener set up, starting communication attempts...');
      
      const attemptCommunication = () => {
        attempts++;
        
        // Check if popup is still open
        if (popup.closed) {
          console.log('FreighterCrossOriginClient: Popup was closed by user');
          window.removeEventListener('message', messageListener);
          resolve();
          return;
        }
        
        // Enhanced debugging every few attempts
        if (attempts % 5 === 0) {
          console.log(`FreighterCrossOriginClient: Communication attempt ${attempts}/${maxAttempts}`);
          console.log('FreighterCrossOriginClient: Current popup state:', {
            closed: popup.closed,
            name: popup.name,
            location: this.getWindowLocationDebug(popup)
          });
        }
        
        // Start sending different types of messages after initial load time
        if (attempts >= 5) { // Wait longer for SAFU wallet to fully load
          this.sendMultipleMessageTypes(popup, attempts);
        }
        
        if (attempts >= maxAttempts) {
          console.log('FreighterCrossOriginClient: Communication establishment timeout - but continuing');
          console.log('FreighterCrossOriginClient: Final attempt - trying direct API call...');
          
          // Final attempt with direct API call
          this.sendDirectApiCall(popup);
          
          window.removeEventListener('message', messageListener);
          resolve();
        } else {
          // Use longer intervals as recommended by wallet team
          setTimeout(attemptCommunication, 750); // 750ms intervals
        }
      };
      
      // Wait longer before starting as recommended by wallet team
      console.log('FreighterCrossOriginClient: Waiting for SAFU wallet to fully initialize...');
      setTimeout(() => {
        console.log('FreighterCrossOriginClient: Starting communication attempts...');
        attemptCommunication();
      }, 2000); // 2 second initial delay
      
      // Clean up listener after max time
      setTimeout(() => {
        if (!communicationEstablished) {
          console.log('FreighterCrossOriginClient: Cleaning up message listener after timeout');
          window.removeEventListener('message', messageListener);
        }
      }, maxAttempts * 750 + 3000);
    });
  }

  /**
   * Send multiple types of messages to test different communication patterns
   */
  private sendMultipleMessageTypes(popup: Window, attempt: number): void {
    const baseMessage = {
      origin: window.location.origin,
      appName: 'Token Lab',
      timestamp: Date.now(),
      attempt
    };

    // Message Type 1: Discovery request (original format)
    const discoveryMessage = {
      ...baseMessage,
      type: 'wallet_discovery_request',
      requestId: this.generateRequestId()
    };

    // Message Type 2: Alternative discovery format
    const altDiscoveryMessage = {
      ...baseMessage,
      type: 'FREIGHTER_DISCOVERY',
      requestId: this.generateRequestId()
    };

    // Message Type 3: Direct API request
    const apiMessage = {
      ...baseMessage,
      type: 'FREIGHTER_API_REQUEST',
      method: 'isConnected',
      requestId: this.generateRequestId()
    };

    try {
      // Send all three message types
      popup.postMessage(discoveryMessage, this.safuWalletOrigin);
      popup.postMessage(altDiscoveryMessage, this.safuWalletOrigin);
      popup.postMessage(apiMessage, this.safuWalletOrigin);
      
      if (attempt % 10 === 0) { // Log every 10th attempt
        console.log(`📤 Multiple messages sent (attempt ${attempt}):`, {
          discovery: discoveryMessage.type,
          alt: altDiscoveryMessage.type,
          api: apiMessage.type
        });
      }
    } catch (error) {
      console.error(`FreighterCrossOriginClient: Failed to send messages (attempt ${attempt}):`, error.message);
    }
  }

  /**
   * Send direct API call as final attempt
   */
  private sendDirectApiCall(popup: Window): void {
    const directApiMessage = {
      type: 'FREIGHTER_API_REQUEST',
      method: 'getPublicKey',
      requestId: this.generateRequestId(),
      origin: window.location.origin,
      appName: 'Token Lab',
      timestamp: Date.now(),
      finalAttempt: true
    };

    try {
      popup.postMessage(directApiMessage, this.safuWalletOrigin);
      console.log('📤 Final direct API call sent:', directApiMessage);
    } catch (error) {
      console.error('FreighterCrossOriginClient: Final API call failed:', error.message);
    }
  }

  // ===== Public API Methods (FreighterWalletAPI implementation) =====

  /**
   * Check if wallet is available
   */
  public isWalletAvailable(): boolean {
    return this.extensionDetected || this.safuDetected;
  }

  /**
   * Get available wallet types
   */
  public detectAvailableWallets(): WalletDetection {
    return {
      extensionAvailable: this.extensionDetected,
      safuAvailable: this.safuDetected,
      bothAvailable: this.extensionDetected && this.safuDetected
    };
  }

  /**
   * Connect to wallet with enhanced retry logic and debugging
   */
  public async connect(params?: ConnectParams): Promise<WalletConnection> {
    console.log('FreighterCrossOriginClient: Starting wallet connection process...');
    
    try {
      // Open popup with enhanced debugging
      const popup = await this.openSafuWalletPopup();
      
      // Enhanced wait with better timing - SAFU wallet PostMessage bridge needs time
      console.log('FreighterCrossOriginClient: Waiting for SAFU wallet PostMessage bridge to initialize...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Longer initial wait
      
      // Multiple retry attempts with different approaches
      let connectionSuccess = false;
      const maxConnectionAttempts = 3;
      
      for (let attempt = 1; attempt <= maxConnectionAttempts; attempt++) {
        console.log(`FreighterCrossOriginClient: Connection attempt ${attempt}/${maxConnectionAttempts}`);
        
        try {
          // Verify popup is still open
          if (popup.closed) {
            throw new Error('Popup window was closed');
          }
          
          // Try to establish API communication
          await this.testPopupCommunication(popup, attempt);
          
          // Get connection details with enhanced retry
          const publicKey = await this.getPublicKeyWithRetry();
          console.log('FreighterCrossOriginClient: Got public key:', publicKey?.substring(0, 8) + '...');
          
          const networkDetails = await this.getNetworkDetailsWithRetry();
          console.log('FreighterCrossOriginClient: Got network details:', networkDetails);
          
          this.connection = {
            isConnected: true,
            publicKey,
            address: publicKey,
            network: networkDetails.network,
            networkPassphrase: networkDetails.networkPassphrase,
            networkUrl: networkDetails.networkUrl
          };
          
          // Mark SAFU wallet as detected since we successfully connected
          this.safuDetected = true;
          this.discoveryComplete = true;
          connectionSuccess = true;
          
          console.log('🎉 FreighterCrossOriginClient: Successfully connected to SAFU wallet!');
          return this.connection;
          
        } catch (attemptError) {
          console.log(`FreighterCrossOriginClient: Attempt ${attempt} failed:`, attemptError.message);
          
          if (attempt < maxConnectionAttempts) {
            console.log(`FreighterCrossOriginClient: Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      if (!connectionSuccess) {
        throw new Error('Failed to establish communication with SAFU wallet after multiple attempts');
      }
      
    } catch (error) {
      console.error('FreighterCrossOriginClient: SAFU wallet connection failed:', error);
      
      // If SAFU connection fails, try browser extension as fallback
      if (this.extensionDetected) {
        console.log('FreighterCrossOriginClient: Falling back to browser extension...');
        const freighter = (window as any).freighter;
        
        const isConnected = await freighter.isConnected();
        if (!isConnected) {
          await freighter.getPublicKey(); // Trigger connection
        }
        
        const publicKey = await freighter.getPublicKey();
        const networkDetails = await freighter.getNetworkDetails();
        
        this.connection = {
          isConnected: true,
          publicKey,
          address: publicKey,
          network: networkDetails.network,  
          networkPassphrase: networkDetails.networkPassphrase,
          networkUrl: networkDetails.networkUrl
        };
        
        return this.connection;
      }
      
      throw new Error(`Failed to connect to wallet: ${error.message}. Please ensure SAFU wallet is running at ${this.safuWalletOrigin} and unlocked.`);
    }
  }

  /**
   * Test popup communication with enhanced debugging
   */
  private async testPopupCommunication(popup: Window, attempt: number): Promise<void> {
    console.log(`FreighterCrossOriginClient: Testing popup communication (attempt ${attempt})...`);
    
    return new Promise((resolve, reject) => {
      const testMessage = {
        type: 'FREIGHTER_API_REQUEST',
        method: 'isConnected',
        requestId: this.generateRequestId(),
        origin: window.location.origin,
        tokenLabPort: window.location.port,
        expectedOrigin: this.tokenLabOrigin,
        appName: 'Token Lab',
        timestamp: Date.now()
      };
      
      const timeout = setTimeout(() => {
        window.removeEventListener('message', responseListener);
        reject(new Error(`Communication test timeout (attempt ${attempt})`));
      }, 5000); // 5 second timeout per test
      
      const responseListener = (event: MessageEvent) => {
        if (event.origin === this.safuWalletOrigin && 
            event.data?.requestId === testMessage.requestId) {
          console.log(`✅ FreighterCrossOriginClient: Communication test ${attempt} successful:`, event.data);
          clearTimeout(timeout);
          window.removeEventListener('message', responseListener);
          resolve();
        }
      };
      
      window.addEventListener('message', responseListener);
      
      try {
        popup.postMessage(testMessage, this.safuWalletOrigin);
        console.log(`📤 Communication test message ${attempt} sent:`, testMessage);
      } catch (error) {
        clearTimeout(timeout);
        window.removeEventListener('message', responseListener);
        reject(new Error(`Failed to send test message: ${error.message}`));
      }
    });
  }

  /**
   * Get public key with retry logic
   */
  private async getPublicKeyWithRetry(): Promise<string> {
    const maxRetries = 3;
    
    for (let retry = 1; retry <= maxRetries; retry++) {
      try {
        console.log(`FreighterCrossOriginClient: Getting public key (attempt ${retry}/${maxRetries})...`);
        return await this.getPublicKey();
      } catch (error) {
        console.log(`FreighterCrossOriginClient: getPublicKey attempt ${retry} failed:`, error.message);
        
        if (retry < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Failed to get public key after retries');
  }

  /**
   * Get network details with retry logic
   */
  private async getNetworkDetailsWithRetry(): Promise<{
    network: string;
    networkPassphrase: string;
    networkUrl: string;
  }> {
    const maxRetries = 3;
    
    for (let retry = 1; retry <= maxRetries; retry++) {
      try {
        console.log(`FreighterCrossOriginClient: Getting network details (attempt ${retry}/${maxRetries})...`);
        return await this.getNetworkDetails();
      } catch (error) {
        console.log(`FreighterCrossOriginClient: getNetworkDetails attempt ${retry} failed:`, error.message);
        
        if (retry < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Failed to get network details after retries');
  }

  /**
   * Check if connected
   */ 
  public async isConnected(): Promise<boolean> {
    if (this.safuDetected) {
      try {
        const response = await this.sendCrossOriginMessage('isConnected');
        return response.connected || false;
      } catch (error) {
        console.log('FreighterCrossOriginClient: isConnected failed:', error);
        return false;
      }
    }
    
    if (this.extensionDetected) {
      const freighter = (window as any).freighter;
      return await freighter.isConnected();
    }
    
    return false;
  }

  /**
   * Get public key
   */
  public async getPublicKey(): Promise<string> {
    if (this.safuDetected) {
      const response = await this.sendCrossOriginMessage('getPublicKey');
      return response.publicKey;
    }
    
    if (this.extensionDetected) {
      const freighter = (window as any).freighter;
      return await freighter.getPublicKey();
    }
    
    throw new Error('No wallet available');
  }

  /**
   * Get network
   */
  public async getNetwork(): Promise<string> {
    if (this.safuDetected) {
      const response = await this.sendCrossOriginMessage('getNetwork');
      return response.network;
    }
    
    if (this.extensionDetected) {
      const freighter = (window as any).freighter;
      return await freighter.getNetwork();
    }
    
    throw new Error('No wallet available');
  }

  /**
   * Get network details
   */
  public async getNetworkDetails(): Promise<{
    network: string;
    networkPassphrase: string;
    networkUrl: string;
  }> {
    if (this.safuDetected) {
      const response = await this.sendCrossOriginMessage('getNetworkDetails');
      return {
        network: response.network,
        networkPassphrase: response.networkPassphrase,
        networkUrl: response.networkUrl
      };
    }
    
    if (this.extensionDetected) {
      const freighter = (window as any).freighter;
      return await freighter.getNetworkDetails();
    }
    
    throw new Error('No wallet available');
  }

  /**
   * Sign transaction
   */
  public async signTransaction(xdr: string, opts?: {
    network?: string;
    networkPassphrase?: string;
    accountToSign?: string;
  }): Promise<string> {
    if (this.safuDetected) {
      const response = await this.sendCrossOriginMessage('signTransaction', {
        xdr,
        options: opts
      });
      return response.signedXdr;
    }
    
    if (this.extensionDetected) {
      const freighter = (window as any).freighter;
      return await freighter.signTransaction(xdr, opts);
    }
    
    throw new Error('No wallet available');
  }

  /**
   * Sign auth entry
   */
  public async signAuthEntry(entryXdr: string, opts?: {
    accountToSign?: string;
  }): Promise<string> {
    if (this.safuDetected) {
      const response = await this.sendCrossOriginMessage('signAuthEntry', {
        entryXdr,
        options: opts
      });
      return response.signedEntry;
    }
    
    if (this.extensionDetected) {
      const freighter = (window as any).freighter;
      return await freighter.signAuthEntry(entryXdr, opts);
    }
    
    throw new Error('No wallet available');
  }

  /**
   * Get current connection
   */
  public getConnection(): WalletConnection | null {
    return this.connection;
  }

  /**
   * Disconnect wallet
   */
  public disconnect(): void {
    this.connection = null;
    
    // Close SAFU wallet popup if open
    if ((window as any).safuWalletPopup && !(window as any).safuWalletPopup.closed) {
      (window as any).safuWalletPopup.close();
      delete (window as any).safuWalletPopup;
    }
  }

  /**
   * Cleanup client
   */
  public cleanup(): void {
    this.messageHandlers.clear();
    this.disconnect();
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
    discoveryComplete: boolean;
  } {
    return {
      available: this.isWalletAvailable(),
      connected: !!this.connection?.isConnected,
      network: this.connection?.network,
      publicKey: this.connection?.publicKey,
      walletType: this.safuDetected ? 'safu' : this.extensionDetected ? 'extension' : 'unknown',
      detection: this.detectAvailableWallets(),
      discoveryComplete: this.discoveryComplete
    };
  }
}

// Global wallet instance
let crossOriginWalletInstance: FreighterCrossOriginClient | null = null;

/**
 * Get shared cross-origin wallet instance
 */
export function getCrossOriginWalletClient(): FreighterCrossOriginClient {
  if (!crossOriginWalletInstance) {
    crossOriginWalletInstance = new FreighterCrossOriginClient();
  }
  return crossOriginWalletInstance;
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}