// Wallet client adapter for popup mode signing
// Bridges the gap between ContractDeploymentService expectations and popup signing functions

import { signTransactionWithPopup, PopupSigningOptions } from './wallet-simple';

export interface WalletClient {
  getPublicKey(): Promise<string>;
  signTransaction(transactionXdr: string, options?: any): Promise<string>;
}

export class PopupWalletAdapter implements WalletClient {
  private publicKey: string | null = null;

  constructor(publicKey?: string) {
    this.publicKey = publicKey || null;
  }

  async getPublicKey(): Promise<string> {
    if (this.publicKey) {
      return this.publicKey;
    }

    // For popup mode, we need to trigger a connection first to get public key
    // This is typically done during the wallet connection phase
    throw new Error('Public key not available. Please connect wallet first.');
  }

  async signTransaction(transactionXdr: string, options: any = {}): Promise<string> {
    const popupOptions: PopupSigningOptions = {
      description: options.description || 'Sign Transaction',
      networkPassphrase: options.networkPassphrase,
      network: options.network || 'futurenet',
      appName: options.appName || 'Token Lab',
      timeout: options.timeout || 300000,
      keepPopupOpen: options.keepPopupOpen || false
    };

    const result = await signTransactionWithPopup(transactionXdr, popupOptions);
    
    if (result.signedTransactionXdr) {
      return result.signedTransactionXdr;
    } else {
      throw new Error('Transaction signing failed');
    }
  }

  // Set public key after wallet connection
  setPublicKey(publicKey: string) {
    this.publicKey = publicKey;
  }
}