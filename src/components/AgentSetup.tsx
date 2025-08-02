import React, { useState, useEffect } from 'react';
import { SafuAgent2, Agent2Config, WalletConnection } from '../lib/wallet-agent2';

interface AgentSetupProps {
  onConnection: (connection: WalletConnection) => void;
  onError: (error: string) => void;
  className?: string;
}

interface StoredAgentConfig {
  keyId: string;
  publicKey: string;
  network: string;
  savedAt: string;
}

export const AgentSetup: React.FC<AgentSetupProps> = ({ onConnection, onError, className = '' }) => {
  const [apiKey, setApiKey] = useState('');
  const [keyId, setKeyId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<StoredAgentConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');

  useEffect(() => {
    loadSavedConfigs();
  }, []);

  const loadSavedConfigs = () => {
    try {
      const saved = localStorage.getItem('safu_agent_configs');
      if (saved) {
        const configs = JSON.parse(saved);
        setSavedConfigs(Array.isArray(configs) ? configs : []);
      }
    } catch (error) {
      console.warn('Failed to load saved agent configurations:', error);
    }
  };

  const saveConfig = (config: Agent2Config, publicKey: string, network: string) => {
    if (!config.keyId) return;

    try {
      const newConfig: StoredAgentConfig = {
        keyId: config.keyId,
        publicKey,
        network,
        savedAt: new Date().toISOString()
      };

      const existing = savedConfigs.filter(c => c.keyId !== config.keyId);
      const updated = [...existing, newConfig];
      
      localStorage.setItem('safu_agent_configs', JSON.stringify(updated));
      setSavedConfigs(updated);
    } catch (error) {
      console.warn('Failed to save agent configuration:', error);
    }
  };

  const handleConnect = async () => {
    if (!apiKey.trim() || !keyId.trim()) {
      onError('Please enter both API Key and Key ID');
      return;
    }

    setIsConnecting(true);

    try {
      const config: Agent2Config = {
        apiKey: apiKey.trim(),
        keyId: keyId.trim(),
        walletUrl: 'http://localhost:3003',
        origin: window.location.origin
      };

      const agent = new SafuAgent2(config);
      const sessionToken = await agent.authenticate();
      
      const publicKey = await agent.getPublicKey();
      const network = await agent.getNetwork();

      const connection: WalletConnection = {
        type: 'agent2',
        sessionToken,
        publicKey,
        network,
        agent
      };

      // Save this configuration for future use
      saveConfig(config, publicKey, network);

      // Clear the form
      setApiKey('');
      setKeyId('');

      onConnection(connection);
    } catch (error) {
      onError(`Agent connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleQuickConnect = async (configId: string) => {
    const apiKey = prompt('Enter your API Key for this saved configuration:');
    if (!apiKey) return;

    setIsConnecting(true);

    try {
      const config: Agent2Config = {
        apiKey: apiKey.trim(),
        keyId: configId,
        walletUrl: 'http://localhost:3003',
        origin: window.location.origin
      };

      const agent = new SafuAgent2(config);
      const sessionToken = await agent.authenticate();
      
      const publicKey = await agent.getPublicKey();
      const network = await agent.getNetwork();

      const connection: WalletConnection = {
        type: 'agent2',
        sessionToken,
        publicKey,
        network,
        agent
      };

      onConnection(connection);
    } catch (error) {
      onError(`Quick connect failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const removeConfig = (keyId: string) => {
    const updated = savedConfigs.filter(c => c.keyId !== keyId);
    localStorage.setItem('safu_agent_configs', JSON.stringify(updated));
    setSavedConfigs(updated);
  };

  return (
    <div className={`agent-setup ${className}`}>
      <div className="agent-setup-header">
        <h3>🤖 Connect SAFU Wallet (Agent Mode)</h3>
        <button 
          type="button"
          onClick={() => setShowInstructions(!showInstructions)}
          className="instructions-toggle"
        >
          {showInstructions ? '🔽 Hide Instructions' : '📋 Show Instructions'}
        </button>
      </div>

      {showInstructions && (
        <div className="setup-instructions">
          <h4>How to Set Up Agent Mode:</h4>
          <ol>
            <li>Open SAFU wallet at <code>http://localhost:3003</code></li>
            <li>Go to <strong>Addresses</strong> page</li>
            <li>Click <strong>"Create API Key"</strong> next to your desired address</li>
            <li>Enter name: <code>Token Lab Agent</code></li>
            <li>Copy the generated <strong>API Key</strong> and <strong>Key ID</strong></li>
            <li>Paste them below and click "Connect Agent"</li>
          </ol>
          <div className="security-note">
            <strong>🔒 Security:</strong> API keys are never stored permanently. You'll need to re-enter them each session.
          </div>
        </div>
      )}

      {/* Saved Configurations */}
      {savedConfigs.length > 0 && (
        <div className="saved-configs">
          <h4>🔗 Quick Connect (Saved Configurations)</h4>
          {savedConfigs.map((config) => (
            <div key={config.keyId} className="saved-config-item">
              <div className="config-info">
                <div className="config-address">
                  <strong>{config.publicKey.slice(0, 8)}...{config.publicKey.slice(-8)}</strong>
                  <span className="config-network">({config.network})</span>
                </div>
                <div className="config-details">
                  Key ID: <code>{config.keyId}</code> • Saved: {new Date(config.savedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="config-actions">
                <button 
                  onClick={() => handleQuickConnect(config.keyId)}
                  disabled={isConnecting}
                  className="quick-connect-btn"
                >
                  Quick Connect
                </button>
                <button 
                  onClick={() => removeConfig(config.keyId)}
                  className="remove-config-btn"
                  title="Remove saved configuration"
                >
                  ✖
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Configuration Form */}
      <div className="new-config-form">
        <h4>➕ Add New Configuration</h4>
        
        <div className="form-group">
          <label htmlFor="keyId">Key ID (UUID):</label>
          <input 
            id="keyId"
            type="text" 
            placeholder="e.g., 550e8400-e29b-41d4-a716-446655440000"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            disabled={isConnecting}
            className="form-input"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="apiKey">API Key:</label>
          <input 
            id="apiKey"
            type="password" 
            placeholder="64-character API key from SAFU wallet"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={isConnecting}
            className="form-input"
            maxLength={64}
          />
          {apiKey && (
            <div className="key-length-indicator">
              {apiKey.length}/64 characters
            </div>
          )}
        </div>
        
        <button 
          onClick={handleConnect}
          disabled={isConnecting || !apiKey.trim() || !keyId.trim()}
          className="connect-button"
        >
          {isConnecting ? '🔄 Connecting...' : '🚀 Connect Agent'}
        </button>
      </div>

      <style jsx>{`
        .agent-setup {
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          padding: 20px;
          background: #fafbfc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .agent-setup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .agent-setup-header h3 {
          margin: 0;
          color: #1f2937;
        }

        .instructions-toggle {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
        }

        .instructions-toggle:hover {
          background: #e5e7eb;
        }

        .setup-instructions {
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .setup-instructions h4 {
          margin: 0 0 12px 0;
          color: #0c4a6e;
        }

        .setup-instructions ol {
          margin: 0 0 12px 0;
          padding-left: 20px;
        }

        .setup-instructions li {
          margin-bottom: 4px;
        }

        .setup-instructions code {
          background: #dbeafe;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: 'SF Mono', Consolas, monospace;
        }

        .security-note {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 4px;
          padding: 8px;
          font-size: 13px;
          color: #92400e;
        }

        .saved-configs {
          margin-bottom: 24px;
        }

        .saved-configs h4 {
          margin: 0 0 12px 0;
          color: #1f2937;
        }

        .saved-config-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 8px;
        }

        .config-info {
          flex: 1;
        }

        .config-address {
          font-size: 14px;
          margin-bottom: 4px;
        }

        .config-network {
          color: #6b7280;
          font-size: 12px;
          margin-left: 8px;
        }

        .config-details {
          font-size: 11px;
          color: #9ca3af;
        }

        .config-details code {
          background: #f3f4f6;
          padding: 1px 3px;
          border-radius: 2px;
        }

        .config-actions {
          display: flex;
          gap: 8px;
        }

        .quick-connect-btn {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 12px;
        }

        .quick-connect-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .quick-connect-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .remove-config-btn {
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 8px;
          cursor: pointer;
          font-size: 10px;
        }

        .remove-config-btn:hover {
          background: #dc2626;
        }

        .new-config-form h4 {
          margin: 0 0 16px 0;
          color: #1f2937;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 4px;
          font-weight: 500;
          color: #374151;
          font-size: 14px;
        }

        .form-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
          font-family: 'SF Mono', Consolas, monospace;
        }

        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-input:disabled {
          background: #f9fafb;
          color: #9ca3af;
        }

        .key-length-indicator {
          font-size: 11px;
          color: #6b7280;
          margin-top: 4px;
          text-align: right;
        }

        .connect-button {
          width: 100%;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .connect-button:hover:not(:disabled) {
          background: #059669;
        }

        .connect-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};