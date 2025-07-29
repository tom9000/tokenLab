#!/usr/bin/env node

/**
 * Test sending tokens from the CLI-deployed SEP-41 contract using SAFU agent mode
 */

import {
  TransactionBuilder,
  Networks,
  Operation,
  rpc,
  BASE_FEE,
  Address,
  nativeToScVal,
  Contract,
  scValToNative
} from '@stellar/stellar-sdk';

// Configuration
const FUTURENET_CONFIG = {
  networkPassphrase: Networks.FUTURENET,
  sorobanRpcUrl: 'https://rpc-futurenet.stellar.org'
};

// CLI-deployed contract
const CONTRACT_ADDRESS = "CDKWQIEGXKAVO2EBCJECVC2P3F2XAVFWLULU2NDN6Q6SKH55GDMLPIBO";

// Get fresh SAFU authentication
async function getAuthToken() {
  console.log('🔐 Getting fresh SAFU wallet authentication...');
  
  const response = await fetch('http://localhost:3003/api/setup-wallet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      seedPhrase: "boost attract swear maple usual fix sentence march sustain disorder bundle reduce rebel area tide such maple exotic claw outdoor delay second lyrics swap",
      password: "password123",
      origin: "http://localhost:3005",
      appName: "Token Lab",
      mode: "agent"
    })
  });

  const result = await response.json();
  
  if (!response.ok || !result.success) {
    throw new Error(`Authentication failed: ${result.error}`);
  }

  console.log('✅ Fresh authentication obtained');
  return {
    accessToken: result.accessToken,
    sessionPassword: "password123",
    encryptedSeed: result.encryptedSeed,
    publicKey: result.publicKey
  };
}

class TokenSender {
  constructor(authData) {
    this.server = new rpc.Server(FUTURENET_CONFIG.sorobanRpcUrl);
    this.authData = authData;
    this.contract = new Contract(CONTRACT_ADDRESS);
  }

  async signWithSAFU(transactionXdr, description) {
    console.log(`🔐 Signing: ${description}`);
    
    const response = await fetch('http://localhost:3003/api/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionXdr,
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
        network: 'futurenet',
        description,
        appName: 'Token Lab',
        mode: 'agent',
        origin: 'http://localhost:3005',
        accessToken: this.authData.accessToken,
        sessionPassword: this.authData.sessionPassword,
        encryptedSeed: this.authData.encryptedSeed
      })
    });

    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(`SAFU signing failed: ${result.error}`);
    }

    console.log('✅ Signed by SAFU wallet');
    return result.signedTransactionXdr;
  }

  async checkContractStatus() {
    console.log('📋 Checking contract status...');
    
    try {
      // Check if contract is initialized by trying to get name
      const sourceAccount = await this.server.getAccount(this.authData.publicKey);
      
      const nameOp = this.contract.call('name');
      let nameTx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
      })
      .addOperation(nameOp)
      .setTimeout(60)
      .build();

      nameTx = await this.server.prepareTransaction(nameTx);
      const signedXdr = await this.signWithSAFU(nameTx.toXDR(), 'Check Token Name');
      const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
      
      let nameResult = await this.server.sendTransaction(signedTx);
      
      if (nameResult.status === 'SUCCESS' && nameResult.returnValue) {
        const name = scValToNative(nameResult.returnValue);
        console.log(`📛 Token Name: ${name}`);
        return { initialized: true, name };
      } else {
        console.log('❌ Contract appears uninitialized');
        return { initialized: false };
      }
      
    } catch (error) {
      console.log('❌ Contract status check failed:', error.message);
      return { initialized: false, error: error.message };
    }
  }

  async initializeContract() {
    console.log('⚙️ Initializing contract with SAFU as admin...');
    
    const sourceAccount = await this.server.getAccount(this.authData.publicKey);

    const initOp = this.contract.call(
      'initialize',
      nativeToScVal(Address.fromString(this.authData.publicKey), { type: 'address' }), // admin = SAFU
      nativeToScVal(7, { type: 'u32' }), // decimals
      nativeToScVal('SAFU Token', { type: 'string' }), // name
      nativeToScVal('SAFU', { type: 'string' }) // symbol
    );

    let initTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 10000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(initOp)
    .setTimeout(60)
    .build();

    initTx = await this.server.prepareTransaction(initTx);
    const signedXdr = await this.signWithSAFU(initTx.toXDR(), 'Initialize Token (SAFU as Admin)');
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    
    let initResult = await this.server.sendTransaction(signedTx);
    console.log(`📊 Initialize result: ${initResult.status}`);

    if (initResult.status === 'SUCCESS') {
      console.log('✅ Contract initialized with SAFU as admin');
      return true;
    } else {
      console.log('❌ Contract initialization failed:', initResult);
      return false;
    }
  }

  async mintTokens(amount) {
    console.log(`💰 Minting ${amount} tokens to SAFU wallet...`);
    
    const sourceAccount = await this.server.getAccount(this.authData.publicKey);

    const mintOp = this.contract.call(
      'mint',
      nativeToScVal(Address.fromString(this.authData.publicKey), { type: 'address' }), // to = SAFU
      nativeToScVal(amount, { type: 'i128' }) // amount
    );

    let mintTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 10000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(mintOp)
    .setTimeout(60)
    .build();

    mintTx = await this.server.prepareTransaction(mintTx);
    const signedXdr = await this.signWithSAFU(mintTx.toXDR(), `Mint ${amount} SAFU tokens`);
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    
    let mintResult = await this.server.sendTransaction(signedTx);
    console.log(`📊 Mint result: ${mintResult.status}`);

    if (mintResult.status === 'SUCCESS') {
      console.log('✅ Tokens minted successfully');
      return true;
    } else {
      console.log('❌ Token minting failed:', mintResult);
      return false;
    }
  }

  async checkBalance(address = null) {
    const targetAddress = address || this.authData.publicKey;
    console.log(`💳 Checking balance for: ${targetAddress}`);
    
    const sourceAccount = await this.server.getAccount(this.authData.publicKey);

    const balanceOp = this.contract.call(
      'balance',
      nativeToScVal(Address.fromString(targetAddress), { type: 'address' })
    );

    let balanceTx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(balanceOp)
    .setTimeout(60)
    .build();

    balanceTx = await this.server.prepareTransaction(balanceTx);
    const signedXdr = await this.signWithSAFU(balanceTx.toXDR(), 'Check Token Balance');
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    
    let balanceResult = await this.server.sendTransaction(signedTx);

    if (balanceResult.status === 'SUCCESS' && balanceResult.returnValue) {
      const balance = scValToNative(balanceResult.returnValue);
      console.log(`💰 Balance: ${balance} tokens`);
      return balance;
    } else {
      console.log('❌ Balance check failed');
      return 0;
    }
  }

  async sendTokens(toAddress, amount) {
    console.log(`🚀 Sending ${amount} tokens to: ${toAddress}`);
    
    const sourceAccount = await this.server.getAccount(this.authData.publicKey);

    const transferOp = this.contract.call(
      'transfer',
      nativeToScVal(Address.fromString(this.authData.publicKey), { type: 'address' }), // from = SAFU
      nativeToScVal(Address.fromString(toAddress), { type: 'address' }), // to
      nativeToScVal(amount, { type: 'i128' }) // amount
    );

    let transferTx = new TransactionBuilder(sourceAccount, {
      fee: (BASE_FEE * 10000).toString(),
      networkPassphrase: FUTURENET_CONFIG.networkPassphrase,
    })
    .addOperation(transferOp)
    .setTimeout(60)
    .build();

    transferTx = await this.server.prepareTransaction(transferTx);
    const signedXdr = await this.signWithSAFU(transferTx.toXDR(), `Send ${amount} tokens to ${toAddress.substring(0, 8)}...`);
    const signedTx = TransactionBuilder.fromXDR(signedXdr, FUTURENET_CONFIG.networkPassphrase);
    
    let transferResult = await this.server.sendTransaction(signedTx);
    console.log(`📊 Transfer result: ${transferResult.status}`);

    if (transferResult.status === 'SUCCESS') {
      console.log('✅ Tokens sent successfully!');
      return { success: true, txHash: transferResult.txHash };
    } else {
      console.log('❌ Token transfer failed:', transferResult);
      return { success: false, error: transferResult };
    }
  }

  async testFullTokenFlow() {
    console.log('🧪 Testing Complete Token Flow via SAFU Agent Mode\n');
    console.log(`🏠 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`🔑 SAFU Address: ${this.authData.publicKey}\n`);

    try {
      // Step 1: Check contract status
      console.log('📋 Step 1: Check contract status');
      const status = await this.checkContractStatus();
      
      // Step 2: Initialize if needed
      if (!status.initialized) {
        console.log('\n⚙️ Step 2: Initialize contract');
        const initialized = await this.initializeContract();
        if (!initialized) {
          throw new Error('Contract initialization failed');
        }
      } else {
        console.log('\n✅ Contract already initialized');
      }

      // Step 3: Mint tokens
      console.log('\n💰 Step 3: Mint tokens');
      const minted = await this.mintTokens('10000000'); // 10M tokens
      if (!minted) {
        throw new Error('Token minting failed');
      }

      // Step 4: Check balance
      console.log('\n💳 Step 4: Check SAFU balance');
      const balance = await this.checkBalance();

      // Step 5: Send tokens to test address
      const testRecipient = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"; // Test address
      console.log('\n🚀 Step 5: Send tokens');
      const sendResult = await this.sendTokens(testRecipient, '1000000'); // Send 1M tokens

      if (sendResult.success) {
        // Step 6: Check balances after transfer
        console.log('\n💳 Step 6: Check balances after transfer');
        await this.checkBalance(); // SAFU balance
        await this.checkBalance(testRecipient); // Recipient balance

        console.log('\n🎉 COMPLETE SUCCESS!');
        console.log('='.repeat(60));
        console.log('✅ Contract deployed via CLI');
        console.log('✅ Contract initialized via SAFU agent mode');
        console.log('✅ Tokens minted via SAFU agent mode');
        console.log('✅ Tokens sent via SAFU agent mode');
        console.log(`🔗 Explorer: https://futurenet.steexp.com/contract/${CONTRACT_ADDRESS}`);
        console.log(`🔗 TX Hash: ${sendResult.txHash}`);
        
        return {
          success: true,
          contract: CONTRACT_ADDRESS,
          adminWallet: this.authData.publicKey,
          operations: ['initialize', 'mint', 'transfer'],
          txHash: sendResult.txHash
        };
      } else {
        throw new Error('Token transfer failed');
      }

    } catch (error) {
      console.error('\n❌ Token flow test failed:', error);
      throw error;
    }
  }
}

// Run the complete token flow test
async function runTokenSendTest() {
  console.log('🚀 Complete SEP-41 Token Send Test via SAFU Agent Mode\n');

  try {
    // Get fresh authentication
    const authData = await getAuthToken();
    
    // Run the complete test
    const sender = new TokenSender(authData);
    const result = await sender.testFullTokenFlow();
    
    console.log('\n🏆 MISSION ACCOMPLISHED!');
    console.log('✅ SEP-41 tokens successfully sent using SAFU agent mode!');
    console.log('🚀 Full deployment and operation workflow confirmed!');
    
    return result;
    
  } catch (error) {
    console.error('\n❌ Token send test failed:', error);
    throw error;
  }
}

// Execute the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runTokenSendTest()
    .then(result => {
      console.log('\n🎊 SUCCESS: Token sending works via SAFU agent mode!');
      console.log('✅ End-to-end SEP-41 workflow is fully operational!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Token send test failed');
      process.exit(1);
    });
}

export { TokenSender };