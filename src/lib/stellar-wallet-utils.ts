/**
 * Stellar wallet utilities for consistent address derivation
 */

import { Keypair } from '@stellar/stellar-sdk';
import * as bip39 from 'bip39';
import * as ed25519 from 'ed25519-hd-key';

/**
 * Derive Stellar address from mnemonic using the standard path
 * This matches Freighter, CLI, and other standard Stellar wallets
 */
export function deriveAddressFromMnemonic(
  mnemonic: string, 
  accountIndex: number = 0
): { keypair: Keypair; address: string } {
  // Validate mnemonic
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  // Convert mnemonic to seed
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  
  // Use the extended BIP44 path that matches CLI and Freighter
  // m/44'/148'/0'/0' for account 0, m/44'/148'/0'/1' for account 1, etc.
  const derivationPath = `m/44'/148'/0'/${accountIndex}'`;
  
  try {
    // Derive the key using ed25519
    const derivedSeed = ed25519.derivePath(derivationPath, seed.toString('hex'));
    
    // Create Stellar keypair
    const keypair = Keypair.fromRawEd25519Seed(derivedSeed.key);
    const address = keypair.publicKey();
    
    return { keypair, address };
  } catch (error) {
    throw new Error(`Failed to derive address: ${error.message}`);
  }
}

/**
 * Verify that a mnemonic derives to the expected address
 */
export function verifyMnemonicAddress(
  mnemonic: string, 
  expectedAddress: string,
  accountIndex: number = 0
): boolean {
  try {
    const { address } = deriveAddressFromMnemonic(mnemonic, accountIndex);
    return address === expectedAddress;
  } catch {
    return false;
  }
}

/**
 * Get multiple addresses from a single mnemonic (for account selection)
 */
export function deriveMultipleAddresses(
  mnemonic: string,
  count: number = 5
): Array<{ index: number; address: string }> {
  const addresses = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const { address } = deriveAddressFromMnemonic(mnemonic, i);
      addresses.push({ index: i, address });
    } catch (error) {
      console.warn(`Failed to derive address for index ${i}:`, error);
    }
  }
  
  return addresses;
}

/**
 * Create a keypair from mnemonic for signing transactions
 */
export function createKeypairFromMnemonic(
  mnemonic: string,
  accountIndex: number = 0
): Keypair {
  const { keypair } = deriveAddressFromMnemonic(mnemonic, accountIndex);
  return keypair;
}