import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  Address,
  Keypair,
} from '@stellar/stellar-sdk';
import fs from 'fs';

// Configuration for deployment
const config = {
  rpcUrl: 'https://soroban-testnet.stellar.org:443',
  networkPassphrase: Networks.TESTNET,
  contractWasmPath: './sep41_token.wasm',
};

export class SEP41TokenDeployer {
  constructor(sourceKeypair) {
    this.source = sourceKeypair;
    this.server = new SorobanRpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith('http://'),
    });
  }

  async deployContract(tokenConfig) {
    console.log('🚀 Starting SEP-41 token deployment...');
    console.log(`📋 Token: ${tokenConfig.name} (${tokenConfig.symbol})`);

    try {
      // Step 1: Upload contract WASM
      const contractWasm = fs.readFileSync(config.contractWasmPath);
      console.log('📤 Uploading contract WASM...');
      
      const uploadContractOp = this.server.uploadContractWasm(contractWasm);
      const uploadTx = new TransactionBuilder(
        await this.server.getAccount(this.source.publicKey()),
        {
          fee: BASE_FEE,
          networkPassphrase: config.networkPassphrase,
        }
      )
        .addOperation(uploadContractOp)
        .setTimeout(30)
        .build();

      uploadTx.sign(this.source);
      const uploadResult = await this.server.sendTransaction(uploadTx);
      console.log('✅ Contract WASM uploaded');

      // Step 2: Deploy contract instance
      console.log('🏗️  Creating contract instance...');
      const deployContractOp = this.server.createContractOp(
        this.source,
        uploadResult.hash
      );

      const deployTx = new TransactionBuilder(
        await this.server.getAccount(this.source.publicKey()),
        {
          fee: BASE_FEE,
          networkPassphrase: config.networkPassphrase,
        }
      )
        .addOperation(deployContractOp)
        .setTimeout(30)
        .build();

      deployTx.sign(this.source);
      const deployResult = await this.server.sendTransaction(deployTx);
      const contractId = deployResult.returnValue;
      console.log(`✅ Contract deployed: ${contractId}`);

      // Step 3: Initialize the token
      console.log('⚙️  Initializing token...');
      const contract = new Contract(contractId);
      
      const initializeTx = new TransactionBuilder(
        await this.server.getAccount(this.source.publicKey()),
        {
          fee: BASE_FEE,
          networkPassphrase: config.networkPassphrase,
        }
      )
        .addOperation(
          contract.call(
            'initialize',
            Address.fromString(this.source.publicKey()), // admin
            nativeToScVal(tokenConfig.decimals, { type: 'u32' }),
            nativeToScVal(tokenConfig.name, { type: 'string' }),
            nativeToScVal(tokenConfig.symbol, { type: 'string' }),
            tokenConfig.maxSupply ? 
              nativeToScVal(tokenConfig.maxSupply, { type: 'i128' }) : 
              nativeToScVal(null, { type: 'option' }),
            nativeToScVal(tokenConfig.isMintable, { type: 'bool' }),
            nativeToScVal(tokenConfig.isBurnable, { type: 'bool' }),
            nativeToScVal(tokenConfig.isFreezable, { type: 'bool' })
          )
        )
        .setTimeout(30)
        .build();

      initializeTx.sign(this.source);
      const initResult = await this.server.sendTransaction(initializeTx);
      console.log('✅ Token initialized');

      // Step 4: Mint initial supply if specified
      if (tokenConfig.initialSupply && parseInt(tokenConfig.initialSupply) > 0) {
        console.log(`💰 Minting initial supply: ${tokenConfig.initialSupply}`);
        
        const mintTx = new TransactionBuilder(
          await this.server.getAccount(this.source.publicKey()),
          {
            fee: BASE_FEE,
            networkPassphrase: config.networkPassphrase,
          }
        )
          .addOperation(
            contract.call(
              'mint',
              Address.fromString(this.source.publicKey()), // to
              nativeToScVal(tokenConfig.initialSupply, { type: 'i128' })
            )
          )
          .setTimeout(30)
          .build();

        mintTx.sign(this.source);
        const mintResult = await this.server.sendTransaction(mintTx);
        console.log('✅ Initial supply minted');
      }

      const deploymentInfo = {
        contractId,
        deployTxHash: deployResult.hash,
        initTxHash: initResult.hash,
        mintTxHash: tokenConfig.initialSupply ? mintResult?.hash : null,
        config: tokenConfig,
        network: 'testnet',
        deployedAt: new Date(),
      };

      console.log('🎉 Deployment completed successfully!');
      console.log(`📄 Contract ID: ${contractId}`);
      console.log(`🔗 View on Explorer: https://testnet.steexp.com/contract/${contractId}`);

      return deploymentInfo;

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  // Helper method to create token from Token Lab configuration
  static async deployFromTokenLabConfig(config, sourceSecret) {
    const keypair = Keypair.fromSecret(sourceSecret);
    const deployer = new SEP41TokenDeployer(keypair);
    
    return await deployer.deployContract({
      name: config.name,
      symbol: config.symbol,
      decimals: config.decimals,
      initialSupply: config.initialSupply,
      maxSupply: config.isFixedSupply ? config.maxSupply : null,
      isMintable: config.isMintable && !config.isFixedSupply,
      isBurnable: config.isBurnable,
      isFreezable: config.isFreezable,
    });
  }
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  // Example deployment
  const exampleConfig = {
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 7,
    initialSupply: '1000000',
    maxSupply: '10000000',
    isFixedSupply: false,
    isMintable: true,
    isBurnable: true,
    isFreezable: false,
  };

  // You would replace this with your actual secret key
  const sourceSecret = 'YOUR_SECRET_KEY_HERE';
  
  if (sourceSecret === 'YOUR_SECRET_KEY_HERE') {
    console.log('❌ Please set your Stellar secret key');
    console.log('💡 For testnet, you can create one at: https://laboratory.stellar.org/#account-creator');
    process.exit(1);
  }

  SEP41TokenDeployer.deployFromTokenLabConfig(exampleConfig, sourceSecret)
    .then(result => {
      console.log('Deployment result:', result);
    })
    .catch(error => {
      console.error('Deployment failed:', error);
      process.exit(1);
    });
}