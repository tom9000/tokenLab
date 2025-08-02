'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Coins, Zap, Send, Copy, ExternalLink, Loader2, Wallet, AlertCircle, CheckCircle, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { 
  signTransactionWithPopup, 
  signTransactionAgent,
  isPopupWalletAvailable, 
  getPopupWalletInfo,
  PopupSigningResult 
} from '../lib/wallet-simple';

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
  deployTxHash: string;
  initTxHash?: string;
  mintTxHash?: string;
  deployedAt: Date;
  network: 'futurenet';
}

// Futurenet configuration with fallback endpoints
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  horizonUrl: 'https://horizon-futurenet.stellar.org',
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
  fallbackRpcUrl: 'https://stellar.liquify.com/api=41EEWAH79Y5OCGI7/futurenet',
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

  const [wallet, setWallet] = useState<{
    isConnected: boolean;
    publicKey?: string;
    network?: string;
    mode?: 'popup' | 'agent';
    sessionData?: {
      accessToken: string;
      sessionPassword: string;
      encryptedSeed: string;
      sessionKey?: string;
    };
  }>({
    isConnected: false
  });

  const [logs, setLogs] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState('');
  const [deployedTokens, setDeployedTokens] = useState<DeployedToken[]>([]);
  const [selectedTokenForTransfer, setSelectedTokenForTransfer] = useState<DeployedToken | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [isLogsPopout, setIsLogsPopout] = useState(false);

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    setLogs(prev => [...prev, `[${timestamp}] ${emoji} ${message}`]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog(`Copied: ${text.substring(0, 20)}...`, 'info');
  };

  const updateTokenConfig = (field: keyof TokenConfig, value: any) => {
    setTokenConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header with Wallet Connection - Full width, buttons right-aligned */}
      <div className="w-full px-6 py-6 flex justify-center">
        <div className="w-full max-w-[900px] flex items-center justify-between">
          <div className="bg-green-900/20 border border-green-600/30 rounded p-3">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Zap className="w-4 h-4" />
              <span className="font-semibold">SEP-41 Token Deployer</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => addLog('Connect functionality not implemented yet', 'info')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-6 pb-6 flex justify-center">
        <div className="w-full max-w-[900px] space-y-6">
          {/* Token Configuration Form */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Create SEP-41 Token
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-gray-300">Token Name</Label>
                  <Input
                    id="name"
                    value={tokenConfig.name}
                    onChange={(e) => updateTokenConfig('name', e.target.value)}
                    placeholder="My Token"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="symbol" className="text-gray-300">Symbol</Label>
                  <Input
                    id="symbol"
                    value={tokenConfig.symbol}
                    onChange={(e) => updateTokenConfig('symbol', e.target.value)}
                    placeholder="MTK"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>
              
              <Button 
                onClick={() => addLog('Deploy functionality not implemented yet', 'info')}
                disabled={isDeploying}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {deploymentStep || 'Deploying...'}
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4 mr-2" />
                    Deploy SEP-41 Token
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Transaction Log */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Transaction Log</CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={clearLogs} 
                  size="sm" 
                  variant="ghost" 
                  className="text-gray-400 hover:text-white"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={() => setIsLogsPopout(true)} 
                  size="sm" 
                  variant="ghost" 
                  className="text-gray-400 hover:text-white"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-black rounded p-4 h-64 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-gray-500 text-sm">
                    Activity logs will appear here...
                  </div>
                ) : (
                  <div className="space-y-1">
                    {[...logs].reverse().map((log, index) => (
                      <div key={index} className="text-sm font-mono text-gray-300">
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

      {/* Logs Popout Modal */}
      {isLogsPopout && (
        <>
          <div className="fixed inset-0 bg-black/80 z-50" onClick={() => setIsLogsPopout(false)} />
          <div className="fixed inset-4 bg-gray-900 border border-gray-700 rounded-lg z-50 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <h2 className="text-gray-300 text-lg font-semibold">Activity Logs</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  onClick={clearLogs} 
                  size="sm" 
                  variant="ghost" 
                  className="h-10 w-10 p-0 hover:bg-gray-700"
                  title="Clear logs"
                >
                  <Trash2 className="w-6 h-6" />
                </Button>
                <Button 
                  onClick={() => setIsLogsPopout(false)} 
                  size="sm" 
                  variant="ghost" 
                  className="h-10 w-10 p-0 hover:bg-gray-700"
                  title="Close full screen"
                >
                  <Minimize2 className="w-6 h-6" />
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4 min-h-0">
              <div className="bg-black rounded p-4 h-full overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-gray-500 text-sm">
                    Activity logs will appear here...
                  </div>
                ) : (
                  <div className="space-y-1">
                    {[...logs].reverse().map((log, index) => (
                      <div key={index} className="text-sm font-mono text-gray-300">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}