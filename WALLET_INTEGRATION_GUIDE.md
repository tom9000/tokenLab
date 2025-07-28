# Token Lab - Wallet Integration Guide

This project provides **two wallet integration approaches** for different use cases:

## 🚀 Simple Popup Integration (MetaMask-style)
**Perfect for:** Token deployment, one-time transactions, simple dApps
- **File:** `src/lib/wallet-simple.ts`
- **Usage:** Fire-and-forget transaction signing
- **Flow:** Build TX → Popup → Sign → Submit → Done

```javascript
import { signTransactionWithPopup } from './lib/wallet-simple';

const signedTx = await signTransactionWithPopup(transactionXdr, {
  description: 'Deploy SEP-41 Token'
});
```

## 🏗️ Advanced Connection System (Full Freighter API)
**Perfect for:** DEX, DeFi platforms, gaming, multi-step workflows
- **File:** `src/lib/freighter-cross-origin-client.ts`
- **Usage:** Persistent wallet connection with full API
- **Flow:** Connect → Multiple API calls → Manage state

```javascript
import { getCrossOriginWalletClient } from './lib/freighter-cross-origin-client';

const client = getCrossOriginWalletClient();
await client.connect();
const publicKey = await client.getPublicKey();
const signedTx = await client.signTransaction(tx);
```

## 📁 File Organization

```
src/lib/
├── wallet-simple.ts              # Simple popup approach (NEW)
├── freighter-cross-origin-client.ts  # Advanced connection system
└── freighter-client.ts           # Legacy file (can be removed)

src/components/
├── SimpleTokenDeployer.tsx       # Uses simple popup approach (NEW)
└── RealTokenDeployer.tsx         # Uses advanced connection system
```

## 🎯 When to Use Which?

| Feature | Simple Popup | Advanced Connection |
|---------|-------------|-------------------|
| Token Deployment | ✅ Perfect | ⚠️ Overkill |
| One-time Transactions | ✅ Perfect | ⚠️ Overkill |
| DEX Trading | ❌ Limited | ✅ Perfect |
| Multi-step Workflows | ❌ Limited | ✅ Perfect |
| Gaming/Sessions | ❌ Limited | ✅ Perfect |
| Portfolio Dashboards | ❌ Limited | ✅ Perfect |

Choose the **Simple Popup** for straightforward transaction signing.
Choose the **Advanced Connection** for complex dApps requiring persistent wallet state.