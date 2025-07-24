# SEP-41 Token Smart Contract

This directory contains the SEP-41 compliant token smart contract for the Token Lab project.

## Features

### Core SEP-41 Functions
- ✅ `initialize()` - Initialize token with metadata and configuration
- ✅ `transfer()` - Transfer tokens between accounts
- ✅ `transfer_from()` - Transfer using allowance
- ✅ `approve()` - Approve spending allowance
- ✅ `allowance()` - Get current allowance
- ✅ `balance()` - Get account balance
- ✅ `name()`, `symbol()`, `decimals()` - Token metadata
- ✅ `total_supply()` - Get total token supply

### Admin Functions
- ✅ `mint()` - Mint new tokens (admin only)
- ✅ `burn()` - Burn existing tokens (admin only)
- ✅ `freeze()` / `unfreeze()` - Freeze/unfreeze specific accounts
- ✅ `set_frozen()` - Global freeze toggle
- ✅ `set_admin()` - Transfer admin rights
- ✅ `admin()` - Get current admin address

### Advanced Features
- ✅ **Max Supply Control** - Optional maximum supply cap
- ✅ **Mintable/Burnable Flags** - Configurable mint/burn permissions
- ✅ **Freezing System** - Account-level and global freezing
- ✅ **Admin Management** - Transferable admin rights
- ✅ **Event Emissions** - All operations emit events

## Project Structure

```
contracts/
├── sep41_token/           # Main contract directory
│   ├── src/
│   │   ├── lib.rs         # Main library entry
│   │   ├── contract.rs    # Core contract implementation
│   │   ├── admin.rs       # Admin functions and state
│   │   ├── balance.rs     # Balance management
│   │   ├── allowance.rs   # Allowance system
│   │   ├── metadata.rs    # Token metadata
│   │   ├── storage_types.rs # Storage type definitions
│   │   ├── test.rs        # Unit tests
│   │   └── bin/main.rs    # Binary entry point
│   └── Cargo.toml         # Rust dependencies
├── build.sh               # Build script
├── deploy.js              # Deployment script
└── README.md              # This file
```

## Building the Contract

### Prerequisites

1. **Rust & Cargo** - Install from [rustup.rs](https://rustup.rs/)
2. **wasm32 target** - Added automatically by build script
3. **Stellar CLI** (optional) - For contract optimization

### Build Commands

```bash
# Build the contract
./build.sh

# Or manually:
cd sep41_token
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM will be at: `target/wasm32-unknown-unknown/release/sep41_token.wasm`

## Testing

```bash
cd sep41_token
cargo test
```

Test coverage includes:
- ✅ Contract initialization
- ✅ Token minting and burning  
- ✅ Transfer operations
- ✅ Allowance system
- ✅ Freeze functionality
- ✅ Admin controls
- ✅ Error conditions

## Deployment

### Using the Deployment Script

```javascript
import { SEP41TokenDeployer } from './deploy.js';

const config = {
  name: 'My Token',
  symbol: 'MTK',
  decimals: 7,
  initialSupply: '1000000',
  maxSupply: '10000000',
  isFixedSupply: false,
  isMintable: true,
  isBurnable: true,
  isFreezable: false,
};

const sourceSecret = 'YOUR_STELLAR_SECRET_KEY';
const result = await SEP41TokenDeployer.deployFromTokenLabConfig(config, sourceSecret);
console.log('Contract deployed:', result.contractId);
```

### Manual Deployment Steps

1. **Upload WASM**: Upload contract bytecode to Stellar
2. **Create Instance**: Deploy contract instance
3. **Initialize**: Call `initialize()` with token parameters
4. **Mint Initial Supply**: Optional initial token minting

## Integration with Token Lab

The contract is designed to integrate seamlessly with the Token Lab frontend:

```typescript
// In RealTokenDeployer.tsx
import { SEP41TokenDeployer } from '../contracts/deploy.js';

const deployToken = async () => {
  const deployer = new SEP41TokenDeployer(keypair);
  const result = await deployer.deployContract(tokenConfig);
  
  // Update UI with real contract ID
  setDeployedTokens(prev => [...prev, {
    contractId: result.contractId,
    config: tokenConfig,
    deployTxHash: result.deployTxHash,
    // ... other fields
  }]);
};
```

## Security Features

### Access Control
- 🔐 **Admin-only functions** protected by `check_admin()`
- 🔐 **Authorization required** for all user operations
- 🔐 **Allowance system** for secure delegated transfers

### Economic Security
- 💰 **Max supply enforcement** prevents infinite inflation
- 💰 **Balance overflow protection** via checked arithmetic
- 💰 **Allowance expiration** prevents stale approvals

### Operational Security  
- ❄️ **Emergency freeze** capability for incident response
- ❄️ **Account-level freezing** for compliance
- 🔄 **Admin transfer** for key rotation
- 📊 **Event emissions** for transparent operations

## Token Configuration Examples

### Fixed Supply Token
```rust
// Non-mintable token with fixed supply
max_supply: Some(1_000_000),
is_mintable: false,
is_burnable: true,
is_freezable: false
```

### Unlimited Mintable Token
```rust
// Unlimited supply, mintable by admin
max_supply: None,
is_mintable: true,
is_burnable: true,
is_freezable: false
```

### Regulated Token
```rust
// Compliance-ready with freeze capabilities
max_supply: Some(10_000_000),
is_mintable: true,
is_burnable: true,
is_freezable: true
```

## Network Support

- ✅ **Stellar Testnet** - For development and testing
- ✅ **Stellar Futurenet** - For experimental features  
- ✅ **Stellar Mainnet** - For production deployment

## Standards Compliance

This contract implements:
- 📋 **SEP-41** - Stellar Asset Contract standard
- 📋 **Soroban SDK 21.0.0** - Latest Soroban development kit
- 📋 **Event Standards** - Standardized event emissions
- 📋 **Error Handling** - Comprehensive error messages

## License

MIT License - See project root for details.