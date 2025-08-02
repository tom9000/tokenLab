import React from 'react';
import { AlertCircle, ExternalLink, Info } from 'lucide-react';

export const FuturenetRpcNotice: React.FC = () => {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-green-800 mb-2">
            Futurenet Network Status - Horizon API Active
          </h3>
          <div className="text-green-700 text-sm space-y-2">
            <p>
              <strong>Current Status:</strong> Token Lab now uses Horizon API for all operations (RPC limitations resolved).
            </p>
            <p>
              ✅ Token deployment and transfers should work normally via Horizon API.
            </p>
            
            <div className="bg-green-100 rounded p-3 mt-3">
              <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Current Implementation:
              </h4>
              <ul className="space-y-1 text-xs">
                <li>• <strong>Horizon API:</strong> Primary method for all transactions</li>
                <li>• <strong>Account management:</strong> Fully supported via Horizon</li>
                <li>• <strong>Transaction submission:</strong> Direct to Horizon endpoints</li>
                <li>• <strong>Status monitoring:</strong> Real-time via Horizon transaction API</li>
              </ul>
            </div>
            
            <div className="pt-2">
              <a 
                href="https://horizon-futurenet.stellar.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 text-xs font-medium"
              >
                View Horizon API Status
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};