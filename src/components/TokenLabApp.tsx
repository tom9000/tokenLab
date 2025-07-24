'use client';

// Token Lab Application - Standalone dApp for testing wallet bridge

import { useState, useEffect } from 'react';
import RealTokenDeployer from './RealTokenDeployer';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Zap } from 'lucide-react';

export default function TokenLabApp() {
  const [walletOrigin, setWalletOrigin] = useState<string>('');

  useEffect(() => {
    // Detect the wallet origin for display
    setWalletOrigin('http://localhost:3003');
  }, []);

  return (
    <div className="min-h-screen bg-background">

      {/* Token Deployer Component */}
      <RealTokenDeployer />
      
    </div>
  );
}