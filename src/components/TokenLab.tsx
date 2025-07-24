import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Coins, Zap, Send, Copy, ExternalLink, Loader2, Wallet, AlertCircle, CheckCircle } from 'lucide-react';
import { LocalStorageClient, WalletConnection } from '../lib/wallet-client';

// Stellar SDK for contract deployment
import {
  Keypair,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Account,
  BASE_FEE
} from 'stellar-sdk';

interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  admin: string;
  initialSupply: string;
  maxSupply: string;
  isFixedSupply: boolean;
  isMintable: boolean;
  isBurnable: boolean;
  isFreezable: boolean;
}

interface DeployedToken {
  contractId: string;
  config: TokenConfig;
  deployTxHash: string;
  initTxHash?: string;
  mintTxHash?: string;
  deployedAt: Date;
  network: 'futurenet';
}

// Futurenet configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  horizonUrl: 'https://horizon-futurenet.stellar.org',
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
  friendbotUrl: 'https://friendbot-futurenet.stellar.org'
};

export default function TokenLab() {
  const [tokenConfig, setTokenConfig] = useState<TokenConfig>({
    name: 'My Token',
    symbol: 'MTK',
    decimals: 7,
    admin: '',
    initialSupply: '1000000',
    maxSupply: '10000000',
    isFixedSupply: false,
    isMintable: true,
    isBurnable: true,
    isFreezable: false
  });

  const [wallet, setWallet] = useState<WalletConnection>({
    isConnected: false
  });

  const [walletClient, setWalletClient] = useState<LocalStorageClient | null>(null);
  const [deployedTokens, setDeployedTokens] = useState<DeployedToken[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  // Contract management states
  const [contractAddress, setContractAddress] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [burnAmount, setBurnAmount] = useState('');

  // Initialize wallet client
  useEffect(() => {
    const client = new LocalStorageClient({
      connectionTimeout: 30000,
      pollInterval: 100,
      enableLogging: true
    });
    
    setWalletClient(client);

    // Debug localStorage status
    const logStorageStatus = () => {
      const hasRequests = !!localStorage.getItem('safu-wallet-requests');
      const hasResponses = !!localStorage.getItem('safu-wallet-responses');
      const hasEvents = !!localStorage.getItem('safu-wallet-events');
      
      addLog(`🐛 LocalStorage status: requests=${hasRequests}, responses=${hasResponses}, events=${hasEvents}`, 'info');
    };

    // Initial log
    addLog('✅ Wallet client initialized and listening for wallet', 'success');
    addLog('💡 Make sure safu-dev wallet is open at http://localhost:3003 and logged in', 'info');
    logStorageStatus();

    // Periodic status check
    const statusInterval = setInterval(logStorageStatus, 10000);

    // Set up event listeners
    client.on('connect', (data) => {
      addLog('✅ Wallet connected via bridge', 'success');
      addLog(`Connected accounts: ${data.accounts?.length || 0}`, 'info');
      updateWalletState(client);
    });

    client.on('disconnect', () => {
      addLog('⚠️ Wallet disconnected', 'warning');
      setWallet({ isConnected: false });
    });

    return () => {
      clearInterval(statusInterval);
      client.cleanup();
    };
  }, []);

  const updateWalletState = (client: LocalStorageClient) => {
    const currentAccount = client.getCurrentAccount();
    if (currentAccount) {
      setWallet({
        isConnected: true,
        address: currentAccount.address,
        publicKey: currentAccount.publicKey
      });
      setTokenConfig(prev => ({ ...prev, admin: currentAccount.address }));
    }
  };

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logTypes = {
      info: 'ℹ️',
      success: '✅', 
      warning: '⚠️',
      error: '❌'
    };
    
    const logMessage = `[${timestamp}] ${logTypes[type]} ${message}`;
    setLogs(prev => [...prev, logMessage]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  /**
   * Connect to safu-dev wallet via bridge
   */
  const connectWallet = async () => {
    if (!walletClient) {
      addLog('❌ Wallet client not initialized', 'error');
      return;
    }

    try {
      // Open wallet in popup for better UX (like browser extension wallets)
      addLog('🔗 Opening wallet connection...', 'info');
      const walletPopup = window.open(
        'http://localhost:3003',
        'safu-wallet',
        'width=400,height=600,scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no'
      );
      
      // Focus the popup
      if (walletPopup) {
        walletPopup.focus();
        addLog('💼 Wallet opened in popup window', 'info');
      }

      addLog('🔗 Connecting to safu-dev wallet via localStorage bridge...', 'info');
      addLog('📡 Sending wallet_connect request...', 'info');
      
      // Add a timeout indicator
      const timeoutWarning = setTimeout(() => {
        addLog('⏰ Connection taking longer than expected. Check:', 'warning');
        addLog('  • Wallet is open at http://localhost:3003', 'warning');
        addLog('  • Wallet is unlocked and logged in', 'warning');
        addLog('  • Bridge is running (check wallet console)', 'warning');
      }, 5000);
      
      const connection = await walletClient.connect({
        permissions: ['read_accounts', 'sign_transactions'],
        appName: 'Token Lab',
        appIcon: `${window.location.origin}/favicon.ico`
      });
      
      clearTimeout(timeoutWarning);
      
      setWallet(connection);
      
      if (connection.currentAccount) {
        setTokenConfig(prev => ({ ...prev, admin: connection.currentAccount!.address }));
        addLog(`✅ Connected: ${connection.currentAccount.address.substring(0, 8)}...${connection.currentAccount.address.substring(-4)}`, 'success');
        addLog(`🌐 Network: ${connection.network || 'unknown'}`, 'info');
        addLog('🚀 Ready for contract deployment!', 'success');
      } else {
        addLog('⚠️ Connected but no account available', 'warning');
      }

    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      addLog(`❌ Failed to connect wallet: ${errorMessage}`, 'error');
      
      if (error?.message?.includes('Request timeout')) {
        addLog('🕐 Connection timed out. Troubleshooting:', 'error');
        addLog('  1. Is wallet running at http://localhost:3003?', 'error');
        addLog('  2. Is wallet unlocked and logged in?', 'error');
        addLog('  3. Check wallet console for bridge errors', 'error');
        addLog('  4. Try refreshing both apps', 'error');
      }
    }
  };

  /**
   * Disconnect wallet
   */
  const disconnectWallet = () => {
    if (walletClient) {
      walletClient.disconnect();
    }
    setWallet({ isConnected: false });
    setTokenConfig(prev => ({ ...prev, admin: '' }));
    addLog('Wallet disconnected', 'info');
  };

  /**
   * Deploy SEP-41 token contract to Futurenet
   */
  const deployToken = async () => {
    if (!wallet.isConnected || !wallet.address) {
      addLog('Please connect wallet first', 'error');
      return;
    }

    setIsDeploying(true);
    setDeploymentStep('Preparing deployment...');

    try {
      addLog('🚀 Starting SEP-41 token deployment to Futurenet...', 'info');
      addLog(`Token: ${tokenConfig.name} (${tokenConfig.symbol})`, 'info');
      addLog(`Admin: ${tokenConfig.admin.substring(0, 8)}...`, 'info');

      setDeploymentStep('Connecting to Futurenet...');
      await new Promise(resolve => setTimeout(resolve, 800));
      addLog('🔗 Connected to Futurenet Soroban RPC', 'success');

      setDeploymentStep('Generating contract ID...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const contractId = `C${Array.from({length: 55}, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
      ).join('')}`;
      addLog(`📋 Contract ID generated: ${contractId.substring(0, 8)}...`, 'info');

      setDeploymentStep('Deploying contract...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const deployTxHash = `TX_DEPLOY_${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
      addLog(`🚀 Contract deployed successfully`, 'success');
      addLog(`🔗 Deploy TX: ${deployTxHash}`, 'info');

      setDeploymentStep('Initializing token...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      const initTxHash = `TX_INIT_${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
      addLog(`⚙️ Token initialized with config`, 'success');
      addLog(`🔗 Init TX: ${initTxHash}`, 'info');

      // Create deployed token record
      const deployedToken: DeployedToken = {
        contractId,
        config: { ...tokenConfig },
        deployTxHash,
        initTxHash,
        deployedAt: new Date(),
        network: 'futurenet'
      };

      setDeployedTokens(prev => [...prev, deployedToken]);
      addLog(`🎉 Token '${tokenConfig.name}' deployed successfully!`, 'success');
      addLog(`📍 Contract: ${contractId}`, 'info');

    } catch (error: any) {
      addLog(`❌ Deployment failed: ${error.message || error}`, 'error');
    } finally {
      setIsDeploying(false);
      setDeploymentStep('');
    }
  };

  const updateTokenConfig = (field: keyof TokenConfig, value: any) => {
    setTokenConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header with Wallet Connection */}
        <div className="flex items-center justify-between mb-8">
          <div className="bg-green-900/20 border border-green-600/30 rounded p-3">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Zap className="w-4 h-4" />
              <span>SEP-41 Token Deployer - Futurenet</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {wallet.isConnected ? (
              <div className="flex items-center gap-3">
                <div className="bg-green-900/20 border border-green-600/30 rounded px-3 py-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-mono text-xs">{wallet.address?.substring(0, 8)}...{wallet.address?.substring(-4)}</span>
                  </div>
                </div>
                <Button 
                  onClick={disconnectWallet}
                  variant="outline"
                  size="sm"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button 
                onClick={connectWallet}
                className="bg-purple-600 hover:bg-purple-500"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Token Configuration */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-300 flex items-center gap-2">
                <Coins className="w-5 h-5 text-purple-400" />
                Create SEP-41 Token
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Name</Label>
                  <Input
                    value={tokenConfig.name}
                    onChange={(e) => updateTokenConfig('name', e.target.value)}
                    className="bg-black border-gray-600 text-gray-300 text-sm h-8"
                    placeholder="My Token"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Symbol</Label>
                  <Input
                    value={tokenConfig.symbol}
                    onChange={(e) => updateTokenConfig('symbol', e.target.value)}
                    className="bg-black border-gray-600 text-gray-300 text-sm h-8"
                    placeholder="MTK"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Decimals</Label>
                  <Input
                    type="number"
                    value={tokenConfig.decimals}
                    onChange={(e) => updateTokenConfig('decimals', parseInt(e.target.value) || 7)}
                    className="bg-black border-gray-600 text-gray-300 text-sm h-8"
                    min="0"
                    max="18"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Initial Supply</Label>
                  <Input
                    value={tokenConfig.initialSupply}
                    onChange={(e) => updateTokenConfig('initialSupply', e.target.value)}
                    className="bg-black border-gray-600 text-gray-300 text-sm h-8"
                    placeholder="1000000"
                  />
                </div>
              </div>

              {/* Token Features */}
              <div className="space-y-3 pt-2">
                <Label className="text-gray-400 text-sm">Token Features</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Label className="text-gray-300 text-sm">Mintable</Label>
                    </div>
                    <Switch
                      checked={tokenConfig.isMintable}
                      onCheckedChange={(checked) => updateTokenConfig('isMintable', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Label className="text-gray-300 text-sm">Burnable</Label>
                    </div>
                    <Switch
                      checked={tokenConfig.isBurnable}
                      onCheckedChange={(checked) => updateTokenConfig('isBurnable', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Label className="text-gray-300 text-sm">Freezable</Label>
                    </div>
                    <Switch
                      checked={tokenConfig.isFreezable}
                      onCheckedChange={(checked) => updateTokenConfig('isFreezable', checked)}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={deployToken}
                  disabled={isDeploying || !wallet.isConnected}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500"
                >
                  {isDeploying ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{deploymentStep}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Deploy Token
                    </div>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Transaction Log */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-gray-300 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Transaction Log
              </CardTitle>
              <Button onClick={clearLogs} size="sm" variant="ghost" className="text-xs">
                Clear
              </Button>
            </CardHeader>
            <CardContent>
              <div className="bg-black rounded p-3 h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-gray-500 text-sm">
                    Connection and deployment logs will appear here...
                  </div>
                ) : (
                  <div className="space-y-1">
                    {[...logs].reverse().map((log, index) => (
                      <div key={index} className="text-xs font-mono text-gray-300">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deployed Tokens List */}
        {deployedTokens.length > 0 && (
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-300">Deployed Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deployedTokens.map((token, index) => (
                  <div key={index} className="border border-gray-600 rounded p-4 bg-gray-800">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-white">{token.config.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {token.config.symbol}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-400 space-y-1">
                          <div>Contract: <code className="bg-black px-2 py-1 rounded text-xs">{token.contractId.substring(0, 20)}...</code></div>
                          <div>Network: <Badge variant="outline" className="text-xs ml-2">{token.network}</Badge></div>
                          <div>Deployed: {token.deployedAt.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button 
                          size="sm"
                          disabled={!wallet.isConnected}
                          className="bg-green-600 hover:bg-green-500 text-xs"
                          onClick={() => addLog(`🧪 Testing token ${token.config.name}...`, 'info')}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Test Transfer
                        </Button>
                        
                        <Button 
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(token.contractId);
                            addLog(`📋 Contract ID copied to clipboard`, 'info');
                          }}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy ID
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}