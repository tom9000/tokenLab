import React, { useState, useEffect, useCallback } from 'react';
import { SafuAgent2, TransactionStatus as TxStatus } from '../lib/wallet-agent2';

interface TransactionStatusProps {
  agent: SafuAgent2;
  transactionId: string;
  onComplete: (result: TxStatus) => void;
  onError: (error: string) => void;
  className?: string;
}

const STATUS_MESSAGES = {
  'pending_approval': '⏳ Please approve in SAFU wallet',
  'approved': '✅ Approved! Processing...',
  'signing': '📝 Wallet is signing transaction...',
  'transmitting': '🚀 Transmitting to network...',
  'transmitted': '🎉 Transaction successful!',
  'denied': '❌ Transaction denied by user',
  'expired': '⏰ Transaction expired',
  'failed': '💥 Transaction failed'
};

const STATUS_COLORS = {
  'pending_approval': '#f59e0b',
  'approved': '#10b981',
  'signing': '#3b82f6',
  'transmitting': '#8b5cf6',
  'transmitted': '#10b981',
  'denied': '#ef4444',
  'expired': '#6b7280',
  'failed': '#ef4444'
};

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  agent,
  transactionId,
  onComplete,
  onError,
  className = ''
}) => {
  const [status, setStatus] = useState<TxStatus | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const pollStatus = useCallback(async () => {
    if (!isPolling) return;

    try {
      const currentStatus = await agent.getTransactionStatus(transactionId);
      setStatus(currentStatus);

      // Log status changes
      if (!status || status.status !== currentStatus.status) {
        addLog(`Status: ${STATUS_MESSAGES[currentStatus.status as keyof typeof STATUS_MESSAGES] || currentStatus.status}`);
      }

      // Check if transaction is complete
      if (['transmitted', 'denied', 'expired', 'failed'].includes(currentStatus.status)) {
        setIsPolling(false);
        onComplete(currentStatus);
        
        if (currentStatus.status === 'transmitted') {
          addLog(`✅ Success! Transaction hash: ${currentStatus.networkTxHash}`);
        } else {
          addLog(`❌ Final status: ${currentStatus.status}${currentStatus.error ? ` - ${currentStatus.error}` : ''}`);
        }
      }
    } catch (error) {
      console.error('Failed to poll transaction status:', error);
      addLog(`⚠️ Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Don't stop polling for temporary errors, but notify parent of persistent errors
      if (elapsed > 60) { // After 1 minute of errors
        setIsPolling(false);
        onError(`Status polling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [agent, transactionId, isPolling, status, onComplete, onError, addLog, elapsed]);

  // Start polling when component mounts
  useEffect(() => {
    addLog('🔄 Starting transaction monitoring...');
    pollStatus();
    
    const pollInterval = setInterval(pollStatus, 2000); // Poll every 2 seconds
    const elapsedInterval = setInterval(() => setElapsed(prev => prev + 1), 1000); // Update elapsed time

    return () => {
      clearInterval(pollInterval);
      clearInterval(elapsedInterval);
    };
  }, [pollStatus]);

  const formatElapsedTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getProgressPercentage = (): number => {
    if (!status) return 0;
    
    const progressMap = {
      'pending_approval': 25,
      'approved': 50,
      'signing': 70,
      'transmitting': 90,
      'transmitted': 100,
      'denied': 0,
      'expired': 0,
      'failed': 0
    };
    
    return progressMap[status.status as keyof typeof progressMap] || 0;
  };

  const isErrorState = (): boolean => {
    return status ? ['denied', 'expired', 'failed'].includes(status.status) : false;
  };

  const isSuccessState = (): boolean => {
    return status?.status === 'transmitted';
  };

  if (!status) {
    return (
      <div className={`transaction-status loading ${className}`}>
        <div className="status-indicator">
          <div className="loading-spinner"></div>
          <span>🔄 Initializing transaction monitoring...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`transaction-status ${className}`}>
      <div className="status-header">
        <h4>📋 Transaction Progress</h4>
        <div className="elapsed-time">
          {formatElapsedTime(elapsed)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-container">
        <div 
          className={`progress-bar ${isSuccessState() ? 'success' : isErrorState() ? 'error' : 'active'}`}
          style={{ width: `${getProgressPercentage()}%` }}
        ></div>
      </div>

      {/* Current Status */}
      <div className="current-status">
        <div 
          className="status-indicator"
          style={{ color: STATUS_COLORS[status.status as keyof typeof STATUS_COLORS] || '#6b7280' }}
        >
          <span className="status-icon">
            {isPolling && !isErrorState() && !isSuccessState() ? '🔄' : ''}
          </span>
          <span className="status-text">
            {STATUS_MESSAGES[status.status as keyof typeof STATUS_MESSAGES] || status.status}
          </span>
        </div>
        
        {status.error && (
          <div className="error-details">
            <strong>Error:</strong> {status.error}
          </div>
        )}

        {status.networkTxHash && (
          <div className="transaction-hash">
            <strong>Transaction Hash:</strong> 
            <code>{status.networkTxHash}</code>
            <button 
              onClick={() => navigator.clipboard.writeText(status.networkTxHash!)}
              className="copy-button"
              title="Copy transaction hash"
            >
              📋
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {status.status === 'pending_approval' && (
        <div className="action-buttons">
          <button 
            onClick={() => window.open('http://localhost:3003', '_blank')}
            className="open-wallet-button"
          >
            🔗 Open SAFU Wallet
          </button>
        </div>
      )}

      {isErrorState() && (
        <div className="action-buttons">
          <button 
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            🔄 Retry Deployment
          </button>
        </div>
      )}

      {/* Transaction Logs */}
      <details className="transaction-logs">
        <summary>📜 Transaction Log ({logs.length} entries)</summary>
        <div className="logs-container">
          {logs.map((log, index) => (
            <div key={index} className="log-entry">
              {log}
            </div>
          ))}
        </div>
      </details>

      <style jsx>{`
        .transaction-status {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          background: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          max-width: 600px;
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .status-header h4 {
          margin: 0;
          color: #1f2937;
        }

        .elapsed-time {
          font-size: 12px;
          color: #6b7280;
          background: #f3f4f6;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .progress-container {
          width: 100%;
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          margin-bottom: 20px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: #3b82f6;
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .progress-bar.success {
          background: #10b981;
        }

        .progress-bar.error {
          background: #ef4444;
        }

        .progress-bar.active {
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .current-status {
          margin-bottom: 20px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .status-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .error-details {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 4px;
          padding: 8px;
          color: #b91c1c;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .transaction-hash {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 4px;
          padding: 8px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .transaction-hash code {
          background: #e0f2fe;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: 'SF Mono', Consolas, monospace;
          font-size: 12px;
          word-break: break-all;
          flex: 1;
          min-width: 200px;
        }

        .copy-button {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
        }

        .copy-button:hover {
          background: #2563eb;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .open-wallet-button, .retry-button {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .open-wallet-button:hover, .retry-button:hover {
          background: #2563eb;
        }

        .retry-button {
          background: #f59e0b;
        }

        .retry-button:hover {
          background: #d97706;
        }

        .transaction-logs {
          margin-top: 16px;
        }

        .transaction-logs summary {
          cursor: pointer;
          font-weight: 500;
          color: #374151;
          padding: 8px 0;
        }

        .transaction-logs summary:hover {
          color: #1f2937;
        }

        .logs-container {
          background: #1f2937;
          color: #e5e7eb;
          border-radius: 4px;
          padding: 12px;
          margin-top: 8px;
          max-height: 200px;
          overflow-y: auto;
          font-family: 'SF Mono', Consolas, monospace;
          font-size: 12px;
        }

        .log-entry {
          margin-bottom: 4px;
          word-break: break-word;
        }

        .loading {
          text-align: center;
        }

        .loading-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid #e5e7eb;
          border-top: 2px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 8px;
        }
      `}</style>
    </div>
  );
};