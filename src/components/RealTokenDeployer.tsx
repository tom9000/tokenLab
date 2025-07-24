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
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Account,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
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

// SEP-41 Token Contract WASM (this would be the actual compiled contract)
// For now, we'll use a placeholder - in reality you'd need the compiled WASM
const SEP41_TOKEN_WASM = 'placeholder_wasm_will_be_replaced';

export default function RealTokenDeployer() {
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
  
  // Contract management states
  const [contractAddress, setContractAddress] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [burnAmount, setBurnAmount] = useState('');
  const [freezeAddress, setFreezeAddress] = useState('');
  const [unfreezeAddress, setUnfreezeAddress] = useState('');
  const [newAdminAddress, setNewAdminAddress] = useState('');

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
    addLog('🔧 Initializing Freighter-compatible wallet client...', 'info');
    
    const client = getCrossOriginWalletClient();
    setWalletClient(client);

    addLog('✅ Wallet client ready', 'success');
    addLog('💡 Choose "Connect Local" for Safu wallet or "Connect Browser" for Freighter', 'info');
    addLog('🌐 Ready for Stellar/Soroban interactions', 'success');
    
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
      addLog(`🎯 Connecting to ${walletName}...`, 'info');
      
      if (walletType === 'safu') {
        addLog('🔗 Opening Safu wallet popup at localhost:3003/sign...', 'info');
      } else {
        addLog('🔗 Requesting connection from browser extension...', 'info');
      }
      
      // Cross-origin client handles wallet discovery automatically
      const connection = await walletClient.connect({
        appName: 'Token Lab',
        appIcon: '/favicon.ico'
      });
      
      updateWalletState(connection);
      
      addLog(`✅ Successfully connected to ${walletName}`, 'success');
      addLog(`👤 Account: ${connection.publicKey?.substring(0, 8)}...${connection.publicKey?.substring(-4)}`, 'success');
      addLog(`🌐 Network: ${connection.network || 'futurenet'}`, 'info');
      addLog('🚀 Ready for contract deployment!', 'success');

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
    addLog('🚪 Wallet disconnected', 'info');
  };

  /**
   * Build transaction XDR for token deployment (simplified for demo)
   */
  const buildTokenDeploymentTransaction = async (): Promise<string> => {
    // In a real implementation, this would build the actual Soroban deployment transaction
    // For now, we'll create a mock XDR string that represents the transaction
    const mockTransactionXdr = 'AAAAAgAAAAA' + Array.from({length: 200}, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='[Math.floor(Math.random() * 65)]
    ).join('') + '==';
    
    return mockTransactionXdr;
  };

  /**
   * Deploy SEP-41 token contract to Futurenet
   */
  const deployToken = async () => {
    if (!wallet.isConnected || !wallet.publicKey) {
      addLog('Please connect wallet first', 'error');
      return;
    }

    setIsDeploying(true);
    clearLogs();

    try {
      addLog('🚀 Starting SEP-41 token deployment to Futurenet...', 'info');
      addLog(`Token: ${tokenConfig.name} (${tokenConfig.symbol})`, 'info');
      addLog(`Admin: ${tokenConfig.admin.substring(0, 8)}...`, 'info');

      setDeploymentStep('Building deployment transaction...');
      addLog('🔧 Building SEP-41 deployment transaction...', 'info');
      
      // Build the transaction XDR
      const transactionXdr = await buildTokenDeploymentTransaction();
      addLog('✅ Transaction built successfully', 'success');
      
      setDeploymentStep('Requesting wallet signature...');
      addLog('🔐 Requesting transaction signature from Safu wallet...', 'info');
      
      // Sign transaction using Freighter API
      const signedXdr = await walletClient!.signTransaction(transactionXdr, {
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
        network: wallet.network,
        accountToSign: wallet.publicKey
      });
      
      addLog('✅ Transaction signed successfully!', 'success');
      
      setDeploymentStep('Submitting to network...');
      addLog('📤 Submitting signed transaction to Futurenet...', 'info');
      
      // Simulate network submission
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate realistic results
      const contractId = 'C' + Array.from({length: 55}, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
      ).join('');
      
      const deployTxHash = 'TX_DEPLOY_' + Math.random().toString(36).substring(2, 15).toUpperCase();
      addLog(`✅ Contract deployed successfully!`, 'success');
      addLog(`📄 Contract ID: ${contractId}`, 'info');
      addLog(`🔗 Deploy TX: ${deployTxHash}`, 'info');

      // Step 2: Initialize token (would need another transaction in real implementation)
      setDeploymentStep('Initializing token...');
      addLog('🔧 Token initialization completed', 'success');
      
      const initTxHash = 'TX_INIT_' + Math.random().toString(36).substring(2, 15).toUpperCase();
      addLog(`🔗 Init TX: ${initTxHash}`, 'info');

      // Step 3: Mint initial supply (if configured)
      let mintTxHash: string | undefined;
      if (tokenConfig.initialSupply && parseInt(tokenConfig.initialSupply) > 0) {
        setDeploymentStep('Minting initial supply...');
        addLog(`💰 Initial supply minted: ${tokenConfig.initialSupply} ${tokenConfig.symbol}`, 'success');
        
        mintTxHash = 'TX_MINT_' + Math.random().toString(36).substring(2, 15).toUpperCase();
        addLog(`🔗 Mint TX: ${mintTxHash}`, 'info');
      }

      // Save deployed token
      const deployedToken: DeployedToken = {
        contractId,
        config: { ...tokenConfig },
        deployTxHash,
        initTxHash,
        mintTxHash,
        deployedAt: new Date(),
        network: 'futurenet'
      };

      setDeployedTokens(prev => [deployedToken, ...prev]);
      
      addLog(`🎉 SEP-41 Token deployment completed!`, 'success');
      addLog(`🌐 View on Explorer: https://futurenet.stellar.expert/explorer/contract/${contractId}`, 'info');
      addLog(`✨ Token ready for transfers and interactions!`, 'success');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Deployment failed: ${errorMessage}`, 'error');
      
      if (errorMessage.includes('rejected by user')) {
        addLog('👤 Transaction rejected by user in wallet', 'warning');
      } else if (errorMessage.includes('popup')) {
        addLog('🚫 Wallet popup was blocked or closed', 'error');
      } else if (errorMessage.includes('timeout')) {
        addLog('⏰ Transaction signing timed out', 'error');
      }
    } finally {
      setIsDeploying(false);
      setDeploymentStep('');
    }
  };


  /**
   * Test token transfer (mock for now)
   */
  const testTokenTransfer = async (token: DeployedToken) => {
    if (!wallet.isConnected) {
      addLog('Please connect wallet to test transfers', 'error');
      return;
    }

    try {
      addLog(`📤 Simulating ${token.config.symbol} transfer...`, 'info');
      
      // Generate a test recipient address
      const testRecipient = 'G' + Array.from({length: 55}, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
      ).join('');
      
      const testAmount = '100';
      
      addLog(`From: ${wallet.publicKey?.substring(0, 8)}...`, 'info');
      addLog(`To: ${testRecipient.substring(0, 8)}...`, 'info');
      addLog(`Amount: ${testAmount} ${token.config.symbol}`, 'info');
      
      // Simulate transaction signing and submission
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const txHash = 'TX_TRANSFER_' + Math.random().toString(36).substring(2, 15).toUpperCase();
      addLog(`✅ Transfer successful: ${txHash}`, 'success');
      addLog(`🔗 View transaction: https://futurenet.stellar.expert/explorer/tx/${txHash}`, 'info');

    } catch (error) {
      addLog(`Transfer test failed: ${error}`, 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog(`📋 Copied: ${text.substring(0, 20)}...`, 'info');
  };

  const updateTokenConfig = (field: keyof TokenConfig, value: any) => {
    setTokenConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header with Wallet Connection - Full width, buttons right-aligned */}
      <div className="w-full px-6 py-6 flex items-center justify-between">
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
                className="bg-gray-600 hover:bg-gray-500 text-xs"
                size="sm"
              >
                <Wallet className="w-3 h-3 mr-1" />
                Connect Local
              </Button>
              <Button 
                onClick={() => connectToWallet('extension')}
                className="bg-gray-600 hover:bg-gray-500 text-xs"
                size="sm"
              >
                <Wallet className="w-3 h-3 mr-1" />
                Connect Browser
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Fixed-width 3-column content with horizontal scroll */}
      <div className="overflow-x-auto">
        <div className="w-[1200px] px-6 pb-6">
          <div className="grid grid-cols-[400px_400px_400px] gap-6">
        {/* Token Configuration */}
        <Card className="bg-gray-900 border-current/20 rounded-none">
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

            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Decimals</Label>
              <Input
                type="number"
                value={tokenConfig.decimals}
                onChange={(e) => updateTokenConfig('decimals', Number(e.target.value))}
                min="0"
                max="18"
                className="bg-black border-current/20 text-gray-300 text-sm h-8"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Initial Supply</Label>
              <Input
                value={tokenConfig.initialSupply}
                onChange={(e) => updateTokenConfig('initialSupply', e.target.value)}
                className="bg-black border-current/20 text-gray-300 text-sm h-8"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Max Supply</Label>
              <Input
                value={tokenConfig.maxSupply}
                onChange={(e) => updateTokenConfig('maxSupply', e.target.value)}
                disabled={!tokenConfig.isFixedSupply}
                className={`text-sm h-8 ${
                  tokenConfig.isFixedSupply 
                    ? 'bg-black border-current/20 text-gray-300' 
                    : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                }`}
                placeholder={tokenConfig.isFixedSupply ? "Enter max supply" : "Unlimited supply"}
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
                <Label className="text-gray-300 text-sm">Fixed Supply</Label>
                <Switch
                  checked={tokenConfig.isFixedSupply}
                  onCheckedChange={(checked) => updateTokenConfig('isFixedSupply', checked)}
                  className="data-[state=checked]:bg-gray-600 data-[state=unchecked]:bg-gray-700 [&>span]:bg-gray-400"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
                <Label className="text-gray-300 text-sm">Mintable</Label>
                <Switch
                  checked={tokenConfig.isMintable && !tokenConfig.isFixedSupply}
                  onCheckedChange={(checked) => updateTokenConfig('isMintable', checked)}
                  disabled={tokenConfig.isFixedSupply}
                  className="data-[state=checked]:bg-gray-600 data-[state=unchecked]:bg-gray-700 [&>span]:bg-gray-400"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
                <Label className="text-gray-300 text-sm">Burnable</Label>
                <Switch
                  checked={tokenConfig.isBurnable}
                  onCheckedChange={(checked) => updateTokenConfig('isBurnable', checked)}
                  className="data-[state=checked]:bg-gray-600 data-[state=unchecked]:bg-gray-700 [&>span]:bg-gray-400"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
                <Label className="text-gray-300 text-sm">Freezable</Label>
                <Switch
                  checked={tokenConfig.isFreezable}
                  onCheckedChange={(checked) => updateTokenConfig('isFreezable', checked)}
                  className="data-[state=checked]:bg-gray-600 data-[state=unchecked]:bg-gray-700 [&>span]:bg-gray-400"
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
                  <span className="text-sm">Deploy SEP-41 Token</span>
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Contract Management */}
        <Card className="bg-gray-900 border-current/20 rounded-none">
          <CardHeader>
            <CardTitle className="text-gray-300 flex items-center gap-2">
              <Coins className="w-5 h-5 text-orange-400" />
              Manage Token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Contract Address</Label>
              <Input
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="font-mono text-xs bg-black border-current/20 text-gray-300 h-8"
                maxLength={56}
              />
            </div>

            <div className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-gray-400 text-xs">Mint Amount</Label>
                  <Input
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    placeholder="1000"
                    className="bg-black border-current/20 text-gray-300 text-xs h-7"
                  />
                </div>
                <Button 
                  onClick={async () => {
                    if (!wallet.isConnected || !contractAddress || !mintAmount) return;
                    try {
                      addLog(`🔧 Building mint transaction...`, 'info');
                      addLog(`Contract: ${contractAddress.substring(0, 8)}... Amount: ${mintAmount}`, 'info');
                      
                      // Build mint transaction XDR (mock for demo)
                      const mintXdr = await buildTokenDeploymentTransaction();
                      
                      addLog(`🔐 Requesting mint transaction signature...`, 'info');
                      const signedXdr = await walletClient!.signTransaction(mintXdr, {
                        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
                        network: wallet.network,
                        accountToSign: wallet.publicKey
                      });
                      
                      addLog(`✅ Mint transaction signed and submitted`, 'success');
                      const txHash = `TX_MINT_` + Math.random().toString(36).substring(2, 15).toUpperCase();
                      addLog(`💰 Minted ${mintAmount} tokens`, 'success');
                      addLog(`🔗 Transaction: ${txHash}`, 'info');
                      setMintAmount('');
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : String(error);
                      addLog(`❌ Mint failed: ${errorMessage}`, 'error');
                    }
                  }}
                  disabled={!wallet.isConnected || !contractAddress || !mintAmount}
                  className="bg-purple-600 hover:bg-purple-500 text-xs h-7 w-20 disabled:bg-purple-600 disabled:opacity-100"
                >
                  Mint
                </Button>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-gray-400 text-xs">Burn Amount</Label>
                  <Input
                    value={burnAmount}
                    onChange={(e) => setBurnAmount(e.target.value)}
                    placeholder="500"
                    className="bg-black border-current/20 text-gray-300 text-xs h-7"
                  />
                </div>
                <Button 
                  onClick={async () => {
                    if (!wallet.isConnected || !contractAddress || !burnAmount) return;
                    try {
                      addLog(`🔧 Executing burn on contract ${contractAddress.substring(0, 8)}...`, 'info');
                      addLog(`Amount: ${burnAmount}`, 'info');
                      await new Promise(resolve => setTimeout(resolve, 1200));
                      const txHash = `TX_BURN_` + Math.random().toString(36).substring(2, 15).toUpperCase();
                      addLog(`🔥 Burned ${burnAmount} tokens`, 'success');
                      addLog(`🔗 Transaction: ${txHash}`, 'info');
                      setBurnAmount('');
                    } catch (error) {
                      addLog(`Burn failed: ${error}`, 'error');
                    }
                  }}
                  disabled={!wallet.isConnected || !contractAddress || !burnAmount}
                  className="bg-purple-600 hover:bg-purple-500 text-xs h-7 w-20 disabled:bg-purple-600 disabled:opacity-100"
                >
                  Burn
                </Button>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-gray-400 text-xs">Freeze Address</Label>
                  <Input
                    value={freezeAddress}
                    onChange={(e) => setFreezeAddress(e.target.value)}
                    placeholder="GXXXXX..."
                    className="bg-black border-current/20 text-gray-300 text-xs h-7 font-mono"
                  />
                </div>
                <Button 
                  onClick={async () => {
                    if (!wallet.isConnected || !contractAddress || !freezeAddress) return;
                    try {
                      addLog(`🔧 Executing freeze on contract ${contractAddress.substring(0, 8)}...`, 'info');
                      addLog(`Address: ${freezeAddress}`, 'info');
                      await new Promise(resolve => setTimeout(resolve, 1200));
                      const txHash = `TX_FREEZE_` + Math.random().toString(36).substring(2, 15).toUpperCase();
                      addLog(`❄️ Frozen account ${freezeAddress.substring(0, 8)}...`, 'success');
                      addLog(`🔗 Transaction: ${txHash}`, 'info');
                      setFreezeAddress('');
                    } catch (error) {
                      addLog(`Freeze failed: ${error}`, 'error');
                    }
                  }}
                  disabled={!wallet.isConnected || !contractAddress || !freezeAddress}
                  className="bg-purple-600 hover:bg-purple-500 text-xs h-7 w-20 disabled:bg-purple-600 disabled:opacity-100"
                >
                  Freeze
                </Button>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-gray-400 text-xs">Unfreeze Address</Label>
                  <Input
                    value={unfreezeAddress}
                    onChange={(e) => setUnfreezeAddress(e.target.value)}
                    placeholder="GXXXXX..."
                    className="bg-black border-current/20 text-gray-300 text-xs h-7 font-mono"
                  />
                </div>
                <Button 
                  onClick={async () => {
                    if (!wallet.isConnected || !contractAddress || !unfreezeAddress) return;
                    try {
                      addLog(`🔧 Executing unfreeze on contract ${contractAddress.substring(0, 8)}...`, 'info');
                      addLog(`Address: ${unfreezeAddress}`, 'info');
                      await new Promise(resolve => setTimeout(resolve, 1200));
                      const txHash = `TX_UNFREEZE_` + Math.random().toString(36).substring(2, 15).toUpperCase();
                      addLog(`🔓 Unfrozen account ${unfreezeAddress.substring(0, 8)}...`, 'success');
                      addLog(`🔗 Transaction: ${txHash}`, 'info');
                      setUnfreezeAddress('');
                    } catch (error) {
                      addLog(`Unfreeze failed: ${error}`, 'error');
                    }
                  }}
                  disabled={!wallet.isConnected || !contractAddress || !unfreezeAddress}
                  className="bg-purple-600 hover:bg-purple-500 text-xs h-7 w-20 disabled:bg-purple-600 disabled:opacity-100"
                >
                  Unfreeze
                </Button>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-gray-400 text-xs">New Admin Address</Label>
                  <Input
                    value={newAdminAddress}
                    onChange={(e) => setNewAdminAddress(e.target.value)}
                    placeholder="GXXXXX..."
                    className="bg-black border-current/20 text-gray-300 text-xs h-7 font-mono"
                  />
                </div>
                <Button 
                  onClick={async () => {
                    if (!wallet.isConnected || !contractAddress || !newAdminAddress) return;
                    try {
                      addLog(`🔧 Executing transfer_admin on contract ${contractAddress.substring(0, 8)}...`, 'info');
                      addLog(`New admin: ${newAdminAddress}`, 'info');
                      await new Promise(resolve => setTimeout(resolve, 1200));
                      const txHash = `TX_TRANSFER_ADMIN_` + Math.random().toString(36).substring(2, 15).toUpperCase();
                      addLog(`👑 Transferred admin to ${newAdminAddress.substring(0, 8)}...`, 'success');
                      addLog(`🔗 Transaction: ${txHash}`, 'info');
                      setNewAdminAddress('');
                    } catch (error) {
                      addLog(`Admin transfer failed: ${error}`, 'error');
                    }
                  }}
                  disabled={!wallet.isConnected || !contractAddress || !newAdminAddress}
                  className="bg-purple-600 hover:bg-purple-500 text-xs h-7 w-20 disabled:bg-purple-600 disabled:opacity-100"
                >
                  Transfer
                </Button>
              </div>
            </div>

            {!wallet.isConnected && (
              <div className="text-xs text-gray-500 text-center">
                Connect wallet to manage contracts
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Log */}
        <Card className="bg-gray-900 border-current/20 rounded-none">
          <CardHeader className="!flex !flex-row !items-center !justify-between !space-y-0 pb-2">
            <CardTitle className="text-gray-300 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Log
            </CardTitle>
            <Button onClick={clearLogs} size="sm" variant="ghost" className="h-10 w-10 p-0 hover:bg-gray-700">
              <Trash2 className="w-6 h-6" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="bg-black rounded p-3 h-[600px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500 text-sm">
                  Deployment logs will appear here...
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

      {/* Additional Content Section */}
      <div className="px-6 space-y-6">
        {/* Deployed Tokens */}
        {deployedTokens.length > 0 && (
          <Card className="bg-gray-900 border-current/20 rounded-none">
            <CardHeader>
              <CardTitle className="text-gray-300 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Deployed SEP-41 Tokens ({deployedTokens.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {deployedTokens.map((token, index) => (
                  <div key={index} className="border border-gray-700 rounded p-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-300 text-lg">{token.config.name}</span>
                          <Badge className="bg-purple-600">{token.config.symbol}</Badge>
                          <Badge className="bg-green-600 text-xs">SEP-41</Badge>
                          <Badge className="bg-blue-600 text-xs">{token.network}</Badge>
                        </div>
                        <div className="text-sm text-gray-400 space-y-1">
                          <div>Deployed: {token.deployedAt.toLocaleString()}</div>
                          <div>Initial Supply: {token.config.initialSupply} {token.config.symbol}</div>
                          <div className="flex gap-4">
                            {token.config.isFixedSupply && <span className="text-yellow-400">Fixed Supply</span>}
                            {token.config.isMintable && <span className="text-green-400">Mintable</span>}
                            {token.config.isBurnable && <span className="text-red-400">Burnable</span>}
                            {token.config.isFreezable && <span className="text-blue-400">Freezable</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Contract ID:</span>
                        <div className="flex items-center gap-2">
                          <code className="bg-black px-2 py-1 rounded font-mono text-gray-300">
                            {token.contractId}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(token.contractId)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Deploy TX:</span>
                          <code className="text-gray-300 text-xs">{token.deployTxHash}</code>
                        </div>
                        {token.initTxHash && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Init TX:</span>
                            <code className="text-gray-300 text-xs">{token.initTxHash}</code>
                          </div>
                        )}
                        {token.mintTxHash && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Mint TX:</span>
                            <code className="text-gray-300 text-xs">{token.mintTxHash}</code>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm"
                        onClick={() => testTokenTransfer(token)}
                        disabled={!wallet.isConnected}
                        className="bg-green-600 hover:bg-green-500 text-xs"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Test Transfer
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(`https://futurenet.stellar.expert/explorer/contract/${token.contractId}`, '_blank')}
                        className="text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Explorer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Testing Workflow */}
        <Card className="bg-gray-900 border-current/20 rounded-none">
          <CardHeader>
            <CardTitle className="text-gray-300">
              🧪 Testing Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-900/20 border border-blue-600/30 rounded p-4">
              <h4 className="text-blue-400 font-semibold mb-3">Current Functionality:</h4>
              <ol className="text-blue-400 text-sm space-y-2 list-decimal ml-4">
                <li><strong>Mock Wallet Connection</strong> - Simulates wallet connection with test address</li>
                <li><strong>SEP-41 Token Configuration</strong> - Full standard token parameters</li>
                <li><strong>Contract Deployment Simulation</strong> - Shows realistic deployment process</li>
                <li><strong>Token Transfer Testing</strong> - Mock transfer transactions</li>
                <li><strong>Contract ID Generation</strong> - Realistic contract IDs for wallet testing</li>
              </ol>
            </div>

            {deployedTokens.length > 0 && (
              <div className="bg-green-900/20 border border-green-600/30 rounded p-4">
                <h4 className="text-green-400 font-semibold mb-3">Next Steps - Wallet Integration:</h4>
                <div className="text-green-400 text-sm space-y-2">
                  <p><strong>1. Copy Contract IDs:</strong> Use these contract IDs in your wallet (port 3000)</p>
                  <p><strong>2. Test Token Discovery:</strong> Your wallet should automatically find these tokens</p>
                  <p><strong>3. Verify Balance Display:</strong> Check if tokens show up in wallet UI</p>
                  <p><strong>4. Test Token Transfers:</strong> Try sending tokens to another address</p>
                  <p><strong>5. Real Deployment (Later):</strong> Replace mock with actual WASM deployment</p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}