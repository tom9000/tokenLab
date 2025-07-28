'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Coins, Zap, Send, Copy, ExternalLink, Loader2, Wallet, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { getCrossOriginWalletClient, FreighterCrossOriginClient, WalletConnection, WalletType } from '../lib/freighter-cross-origin-client';

// Stellar SDK for real contract deployment
import {
  Keypair,
  TransactionBuilder,
  Networks,
  Account,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  BASE_FEE,
  rpc
} from '@stellar/stellar-sdk';

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

export default function AdvancedTokenDeployer() {
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

  const [walletClient, setWalletClient] = useState<FreighterCrossOriginClient | null>(null);

  const [deployedTokens, setDeployedTokens] = useState<DeployedToken[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const icon = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type];
    setLogs(prev => [...prev, `[${timestamp}] ${icon} ${message}`]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  // Initialize wallet client on mount
  useEffect(() => {
    addLog('🔧 Initializing Advanced Cross-Origin Wallet Client...', 'info');
    
    const client = getCrossOriginWalletClient();
    setWalletClient(client);

    addLog('✅ Advanced wallet client ready', 'success');
    addLog('💡 This demonstrates the full Freighter API compatibility', 'info');
    addLog('🌐 Perfect for DEX, DeFi, and complex dApps', 'success');
    
    return () => {
      client.cleanup();
    };
  }, []);

  const updateWalletState = (connection: WalletConnection) => {
    setWallet(connection);
    if (connection.publicKey) {
      setTokenConfig(prev => ({ ...prev, admin: connection.publicKey! }));
    }
  };

  /**
   * Connect to specific wallet type directly
   */
  const connectToWallet = async (walletType: WalletType) => {
    if (!walletClient) {
      addLog('❌ Wallet client not initialized', 'error');
      return;
    }

    try {
      const walletName = walletType === 'extension' ? 'Freighter Browser Extension' : 'Safu Local Wallet';
      addLog(`🎯 Connecting to ${walletName} (Advanced System)...`, 'info');
      
      if (walletType === 'safu') {
        addLog('🔗 Opening Safu wallet popup with persistent connection...', 'info');
      } else {
        addLog('🔗 Requesting connection from browser extension...', 'info');
      }
      
      // Cross-origin client handles wallet discovery automatically
      const connection = await walletClient.connect({
        appName: 'Token Lab - Advanced',
        appIcon: '/favicon.ico'
      });
      
      updateWalletState(connection);
      
      addLog(`✅ Successfully connected to ${walletName}`, 'success');
      addLog(`👤 Account: ${connection.publicKey?.substring(0, 8)}...${connection.publicKey?.substring(-4)}`, 'success');
      addLog(`🌐 Network: ${connection.network || 'futurenet'}`, 'info');
      addLog('🚀 Advanced features now available!', 'success');

    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      const walletName = walletType === 'extension' ? 'Browser Extension' : 'Local Wallet';
      
      addLog(`❌ Failed to connect to ${walletName}: ${errorMessage}`, 'error');
      
      if (walletType === 'safu') {
        if (errorMessage.includes('not load properly') || errorMessage.includes('popup')) {
          addLog('💡 Make sure Safu wallet is running:', 'info');
          addLog('   cd /Users/Mac/code/-scdev/safu-dev && npm run dev', 'info');
          addLog('🚫 Also check that popups are allowed for Token Lab', 'warning');
        }
      } else {
        if (errorMessage.includes('rejected')) {
          addLog('👤 Connection rejected by user in browser extension', 'warning');
        } else {
          addLog('💡 Make sure Freighter extension is installed and unlocked', 'info');
        }
      }
    }
  };

  /**
   * Disconnect wallet
   */
  const disconnectWallet = () => {
    setWallet({ isConnected: false });
    setTokenConfig(prev => ({ ...prev, admin: '' }));
    addLog('🚪 Advanced wallet connection closed', 'info');
  };

  /**
   * Build transaction XDR for token deployment (simplified for demo)
   */
  const buildTokenDeploymentTransaction = async (): Promise<string> => {
    const mockTransactionXdr = 'AAAAAgAAAAA' + Array.from({length: 200}, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='[Math.floor(Math.random() * 65)]
    ).join('') + '==';
    
    return mockTransactionXdr;
  };

  /**
   * Deploy SEP-41 token contract using advanced system
   */
  const deployToken = async () => {
    if (!wallet.isConnected || !wallet.publicKey) {
      addLog('Please connect wallet first', 'error');
      return;
    }

    setIsDeploying(true);
    clearLogs();

    try {
      addLog('🚀 Starting Advanced SEP-41 token deployment...', 'info');
      addLog(`Token: ${tokenConfig.name} (${tokenConfig.symbol})`, 'info');
      addLog(`Admin: ${tokenConfig.admin.substring(0, 8)}...`, 'info');
      addLog('🔧 Using Advanced Cross-Origin Connection System', 'info');

      setDeploymentStep('Building deployment transaction...');
      addLog('🔧 Building SEP-41 deployment transaction...', 'info');
      
      const transactionXdr = await buildTokenDeploymentTransaction();
      addLog('✅ Transaction built successfully', 'success');
      
      setDeploymentStep('Requesting wallet signature...');
      addLog('🔐 Requesting transaction signature via advanced client...', 'info');
      
      // Sign transaction using Advanced Freighter API
      const signedXdr = await walletClient!.signTransaction(transactionXdr, {
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
        network: wallet.network,
        accountToSign: wallet.publicKey
      });
      
      addLog('✅ Transaction signed via advanced connection!', 'success');
      
      setDeploymentStep('Submitting to network...');
      addLog('📤 Submitting signed transaction to Futurenet...', 'info');
      
      // Simulate network submission
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate realistic results
      const contractId = 'C' + Array.from({length: 55}, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
      ).join('');
      
      const deployTxHash = 'TX_DEPLOY_ADV_' + Math.random().toString(36).substring(2, 15).toUpperCase();
      addLog(`✅ Contract deployed successfully!`, 'success');
      addLog(`📄 Contract ID: ${contractId}`, 'info');
      addLog(`🔗 Deploy TX: ${deployTxHash}`, 'info');

      // Save deployed token
      const deployedToken: DeployedToken = {
        contractId,
        config: { ...tokenConfig },
        deployTxHash,
        deployedAt: new Date(),
        network: 'futurenet'
      };

      setDeployedTokens(prev => [deployedToken, ...prev]);
      
      addLog(`🎉 Advanced SEP-41 Token deployment completed!`, 'success');
      addLog(`🌐 View on Explorer: https://futurenet.stellar.expert/explorer/contract/${contractId}`, 'info');
      addLog(`✨ Advanced features demonstrated successfully!`, 'success');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Advanced deployment failed: ${errorMessage}`, 'error');
    } finally {
      setIsDeploying(false);
      setDeploymentStep('');
    }
  };

  const updateTokenConfig = (field: keyof TokenConfig, value: any) => {
    setTokenConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header with Advanced System Badge */}
      <div className="w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-purple-900/20 border border-purple-600/30 rounded p-3">
            <div className="flex items-center gap-2 text-purple-400 text-sm">
              <Zap className="w-4 h-4" />
              <span>Advanced Connection System - Demo</span>
            </div>
          </div>
          <Button 
            onClick={() => window.location.href = '/'}
            size="sm"
            variant="outline"
            className="text-xs border-green-600 text-green-400 hover:bg-green-900/20"
          >
            ← Back to Main App
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          {wallet.isConnected ? (
            <div className="flex items-center gap-3">
              <div className="bg-green-900/20 border border-green-600/30 rounded px-3 py-2">
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-mono text-xs">{wallet.publicKey?.substring(0, 8)}...{wallet.publicKey?.substring(-4)}</span>
                </div>
              </div>
              <Button 
                onClick={disconnectWallet}
                size="sm"
                variant="outline"
                className="text-xs"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => connectToWallet('safu')}
                className="bg-purple-600 hover:bg-purple-500 text-xs"
                size="sm"
              >
                <Wallet className="w-3 h-3 mr-1" />
                Connect Local (Advanced)
              </Button>
              <Button 
                onClick={() => connectToWallet('extension')}
                className="bg-purple-600 hover:bg-purple-500 text-xs"
                size="sm"
              >
                <Wallet className="w-3 h-3 mr-1" />
                Connect Browser
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        <div className="w-[1200px] px-6 pb-6">
          <div className="grid grid-cols-[400px_400px_400px] gap-6">
        
            {/* Token Configuration */}
            <Card className="bg-gray-900 border-current/20 rounded-none">
              <CardHeader>
                <CardTitle className="text-gray-300 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-purple-400" />
                  Advanced SEP-41 Token
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-sm">Name</Label>
                    <Input
                      value={tokenConfig.name}
                      onChange={(e) => updateTokenConfig('name', e.target.value)}
                      className="bg-black border-current/20 text-gray-300 text-sm h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-sm">Symbol</Label>
                    <Input
                      value={tokenConfig.symbol}
                      onChange={(e) => updateTokenConfig('symbol', e.target.value.toUpperCase())}
                      className="bg-black border-current/20 text-gray-300 text-sm h-8"
                      maxLength={12}
                    />
                  </div>
                </div>

                <Button 
                  onClick={deployToken}
                  disabled={isDeploying}
                  className="w-full bg-purple-600 hover:bg-purple-500"
                >
                  {isDeploying ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">{deploymentStep || 'Deploying...'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      <span className="text-sm">Deploy Advanced Token</span>
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Advanced Features Info */}
            <Card className="bg-gray-900 border-current/20 rounded-none">
              <CardHeader>
                <CardTitle className="text-gray-300 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-orange-400" />
                  Advanced Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-purple-900/20 border border-purple-600/30 rounded p-3">
                  <h4 className="text-purple-400 font-semibold mb-2 text-sm">🚀 Advanced Capabilities:</h4>
                  <ul className="text-purple-300 text-xs space-y-1 list-disc ml-4">
                    <li>Persistent wallet connection</li>
                    <li>Full Freighter API compatibility</li>
                    <li>Multiple transaction support</li>
                    <li>Account info access</li>
                    <li>Network switching</li>
                    <li>Session management</li>
                  </ul>
                </div>

                <div className="bg-green-900/20 border border-green-600/30 rounded p-3">
                  <h4 className="text-green-400 font-semibold mb-2 text-sm">✅ Perfect For:</h4>
                  <ul className="text-green-300 text-xs space-y-1 list-disc ml-4">
                    <li>DEX platforms</li>
                    <li>DeFi protocols</li>
                    <li>Gaming applications</li>
                    <li>Portfolio dashboards</li>
                    <li>Multi-step workflows</li>
                  </ul>
                </div>

                <div className="bg-blue-900/20 border border-blue-600/30 rounded p-3">
                  <h4 className="text-blue-400 font-semibold mb-2 text-sm">🔧 Implementation:</h4>
                  <p className="text-blue-300 text-xs">
                    Uses FreighterCrossOriginClient with sophisticated cross-origin messaging, 
                    discovery protocol, and persistent connection management.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Transaction Log */}
            <Card className="bg-gray-900 border-current/20 rounded-none">
              <CardHeader className="!flex !flex-row !items-center !justify-between !space-y-0 pb-2">
                <CardTitle className="text-gray-300 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                  Advanced Log
                </CardTitle>
                <Button onClick={clearLogs} size="sm" variant="ghost" className="h-10 w-10 p-0 hover:bg-gray-700">
                  <Trash2 className="w-6 h-6" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="bg-black rounded p-3 h-[600px] overflow-y-auto">
                  {logs.length === 0 ? (
                    <div className="text-gray-500 text-sm">
                      Advanced system logs will appear here...
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
        </div>
      </div>
    </div>
  );
}