'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Coins, Zap, Send, Copy, ExternalLink, Loader2, Wallet, AlertCircle, CheckCircle, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { UnifiedWalletClient, WalletConnection, Agent2Config } from '../lib/wallet-agent2';
import { AgentSetup } from './AgentSetup';
import { TransactionStatus } from './TransactionStatus';

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
  Operation,
  Asset,
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
  deployedAt: Date;
  txHash: string;
  network: string;
}

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}

export function TokenDeployerAgent2() {
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [walletClient] = useState(() => new UnifiedWalletClient());
  const [isDeploying, setIsDeploying] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deployedTokens, setDeployedTokens] = useState<DeployedToken[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
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

  // Load deployed tokens from localStorage on component mount
  useEffect(() => {
    const savedTokens = localStorage.getItem('deployed-tokens-agent2');
    if (savedTokens) {
      try {
        const parsed = JSON.parse(savedTokens);
        setDeployedTokens(parsed.map((token: any) => ({
          ...token,
          deployedAt: new Date(token.deployedAt)
        })));
      } catch (e) {
        console.warn('Failed to load deployed tokens:', e);
      }
    }
  }, []);

  // Save deployed tokens to localStorage whenever the list changes
  useEffect(() => {
    if (deployedTokens.length > 0) {
      localStorage.setItem('deployed-tokens-agent2', JSON.stringify(deployedTokens));
    }
  }, [deployedTokens]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      message,
      type,
      timestamp: new Date()
    };
    setLogs(prev => [...prev.slice(-99), newLog]); // Keep last 100 logs
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleAgentConnection = (connection: WalletConnection) => {
    setWallet(connection);
    setTokenConfig(prev => ({ ...prev, admin: connection.publicKey }));
    setConnectionError(null);
    
    addLog(`🤖 Successfully connected to SAFU wallet (${connection.type.toUpperCase()})`, 'success');
    addLog(`📍 Address: ${connection.publicKey.slice(0, 8)}...${connection.publicKey.slice(-8)}`, 'info');
    addLog(`🌐 Network: ${connection.network}`, 'info');
    addLog('🚀 Ready for automated deployment!', 'success');
  };

  const handleConnectionError = (error: string) => {
    setConnectionError(error);
    addLog(`❌ Connection failed: ${error}`, 'error');
  };

  const disconnectWallet = () => {
    setWallet(null);
    setTokenConfig(prev => ({ ...prev, admin: '' }));
    setConnectionError(null);
    addLog('🔌 Disconnected from wallet', 'info');
  };

  const buildDeploymentTransaction = async (config: TokenConfig): Promise<any> => {
    if (!wallet) throw new Error('Wallet not connected');

    // This is a simplified version - in reality you'd need the actual contract WASM
    // For now, we'll create the transaction structure that Agent 2.0 expects
    const contractData = {
      wasmHash: 'placeholder_wasm_hash', // This would come from your contract build
      initArgs: [
        nativeToScVal(config.name, { type: 'string' }),
        nativeToScVal(config.symbol, { type: 'string' }),
        nativeToScVal(config.decimals, { type: 'u32' }),
        nativeToScVal(Address.fromString(config.admin), { type: 'address' }),
        nativeToScVal(BigInt(config.initialSupply), { type: 'u128' }),
        nativeToScVal(BigInt(config.maxSupply), { type: 'u128' }),
        nativeToScVal(config.isMintable, { type: 'bool' }),
        nativeToScVal(config.isBurnable, { type: 'bool' }),
        nativeToScVal(config.isFreezable, { type: 'bool' })
      ],
      network: 'futurenet'
    };

    return contractData;
  };

  const deployToken = async () => {
    if (!wallet || !wallet.agent) {
      addLog('❌ Wallet not connected or not in agent mode', 'error');
      return;
    }

    setIsDeploying(true);
    setCurrentTransactionId(null);

    try {
      addLog(`🚀 Starting deployment of ${tokenConfig.name} (${tokenConfig.symbol})...`, 'info');
      
      // Build the contract deployment data
      const contractData = await buildDeploymentTransaction(tokenConfig);
      
      addLog('📋 Submitting transaction for approval...', 'info');
      
      // Submit transaction using Agent 2.0 approve-then-transmit flow
      const submitResponse = await wallet.agent.submitTransaction({
        transactionType: 'deploy',
        details: contractData,
        description: `Deploy SEP-41 Token: ${tokenConfig.name} (${tokenConfig.symbol})`,
        network: 'futurenet',
        transmitAfterApproval: true
      });

      setCurrentTransactionId(submitResponse.transactionId);
      
      if (submitResponse.status === 'auto_approved') {
        addLog('✅ Auto-approved! Wallet is processing...', 'success');
      } else {
        addLog('⏳ Transaction submitted! Please approve in SAFU wallet.', 'info');
      }

    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      addLog(`❌ Deployment failed: ${errorMessage}`, 'error');
      setIsDeploying(false);
      setCurrentTransactionId(null);
    }
  };

  const handleTransactionComplete = (result: any) => {
    setIsDeploying(false);
    setCurrentTransactionId(null);

    if (result.status === 'transmitted' && result.networkTxHash) {
      // Add to deployed tokens list
      const newToken: DeployedToken = {
        contractId: `CONTRACT_${Date.now()}`, // In reality, extract from transaction result
        config: { ...tokenConfig },
        deployedAt: new Date(),
        txHash: result.networkTxHash,
        network: wallet?.network || 'futurenet'
      };

      setDeployedTokens(prev => [newToken, ...prev]);
      addLog(`🎉 Token deployed successfully!`, 'success');
      addLog(`📄 Contract ID: ${newToken.contractId}`, 'info');
      addLog(`🔗 Transaction: ${result.networkTxHash}`, 'info');
    } else {
      addLog(`❌ Deployment failed: ${result.error || result.status}`, 'error');
    }
  };

  const handleTransactionError = (error: string) => {
    setIsDeploying(false);
    setCurrentTransactionId(null);
    addLog(`❌ Transaction monitoring failed: ${error}`, 'error');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog('📋 Copied to clipboard', 'info');
  };

  const deleteToken = (contractId: string) => {
    setDeployedTokens(prev => prev.filter(token => token.contractId !== contractId));
    addLog(`🗑️ Removed token from list`, 'info');
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Coins className="h-8 w-8 text-blue-600" />
            Token Lab Agent 2.0
          </h1>
          <p className="text-muted-foreground mt-1">
            Deploy SEP-41 tokens using SAFU Wallet Connect Agent 2.0
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!wallet ? (
            <div className="space-y-4">
              {connectionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Connection Error</span>
                  </div>
                  <p className="text-red-700 mt-1">{connectionError}</p>
                </div>
              )}
              <AgentSetup 
                onConnection={handleAgentConnection}
                onError={handleConnectionError}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-800">
                      Connected ({wallet.type.toUpperCase()})
                    </div>
                    <div className="text-sm text-green-600">
                      {wallet.publicKey.slice(0, 12)}...{wallet.publicKey.slice(-12)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{wallet.network}</Badge>
                  {wallet.type === 'agent2' && (
                    <Badge variant="default" className="bg-blue-600">
                      🤖 AGENT 2.0
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" onClick={disconnectWallet}>
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Configuration */}
      {wallet && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Token Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Token Name</Label>
                <Input
                  id="name"
                  value={tokenConfig.name}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Awesome Token"
                />
              </div>
              <div>
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  value={tokenConfig.symbol}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                  placeholder="MAT"
                />
              </div>
              <div>
                <Label htmlFor="decimals">Decimals</Label>
                <Input
                  id="decimals"
                  type="number"
                  min="0"
                  max="18"
                  value={tokenConfig.decimals}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, decimals: parseInt(e.target.value) || 7 }))}
                />
              </div>
              <div>
                <Label htmlFor="admin">Admin Address</Label>
                <Input
                  id="admin"
                  value={tokenConfig.admin}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, admin: e.target.value }))}
                  placeholder="Connected wallet address"
                />
              </div>
              <div>
                <Label htmlFor="initialSupply">Initial Supply</Label>
                <Input
                  id="initialSupply"
                  value={tokenConfig.initialSupply}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, initialSupply: e.target.value }))}
                  placeholder="1000000"
                />
              </div>
              <div>
                <Label htmlFor="maxSupply">Max Supply</Label>
                <Input
                  id="maxSupply"
                  value={tokenConfig.maxSupply}
                  onChange={(e) => setTokenConfig(prev => ({ ...prev, maxSupply: e.target.value }))}
                  placeholder="10000000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="mintable"
                  checked={tokenConfig.isMintable}
                  onCheckedChange={(checked) => setTokenConfig(prev => ({ ...prev, isMintable: checked }))}
                />
                <Label htmlFor="mintable">Mintable</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="burnable"
                  checked={tokenConfig.isBurnable}
                  onCheckedChange={(checked) => setTokenConfig(prev => ({ ...prev, isBurnable: checked }))}
                />
                <Label htmlFor="burnable">Burnable</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="freezable"
                  checked={tokenConfig.isFreezable}
                  onCheckedChange={(checked) => setTokenConfig(prev => ({ ...prev, isFreezable: checked }))}
                />
                <Label htmlFor="freezable">Freezable</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="fixedSupply"
                  checked={tokenConfig.isFixedSupply}
                  onCheckedChange={(checked) => setTokenConfig(prev => ({ 
                    ...prev, 
                    isFixedSupply: checked,
                    isMintable: !checked // Fixed supply tokens can't be mintable
                  }))}
                />
                <Label htmlFor="fixedSupply">Fixed Supply</Label>
              </div>
            </div>

            <Button 
              onClick={deployToken} 
              disabled={isDeploying || !wallet.agent}
              className="w-full"
              size="lg"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying Token...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Deploy Token with Agent 2.0
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transaction Status */}
      {currentTransactionId && wallet?.agent && (
        <Card>
          <CardHeader>
            <CardTitle>🔄 Transaction Status</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionStatus
              agent={wallet.agent}
              transactionId={currentTransactionId}
              onComplete={handleTransactionComplete}
              onError={handleTransactionError}
            />
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      {isExpanded && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              📋 Activity Log
            </CardTitle>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <div className="bg-black rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-400">No activity yet...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={`mb-1 ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'warning' ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}>
                    <span className="text-gray-500">[{formatTimestamp(log.timestamp)}]</span> {log.message}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deployed Tokens */}
      {deployedTokens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Deployed Tokens ({deployedTokens.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deployedTokens.map((token, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{token.config.name} ({token.config.symbol})</h3>
                      <p className="text-sm text-muted-foreground">
                        Deployed on {token.deployedAt.toLocaleString()} • {token.network}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(token.contractId)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://futurenet.stellarchain.io/transactions/${token.txHash}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteToken(token.contractId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Contract ID:</span>
                      <p className="font-mono text-xs break-all">{token.contractId}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Initial Supply:</span>
                      <p>{parseInt(token.config.initialSupply).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Decimals:</span>
                      <p>{token.config.decimals}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Features:</span>
                      <div className="flex gap-1 mt-1">
                        {token.config.isMintable && <Badge variant="secondary" className="text-xs">Mintable</Badge>}
                        {token.config.isBurnable && <Badge variant="secondary" className="text-xs">Burnable</Badge>}
                        {token.config.isFreezable && <Badge variant="secondary" className="text-xs">Freezable</Badge>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}