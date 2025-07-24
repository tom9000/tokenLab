# Token Lab

SEP-41 Token Development & Testing Environment

## Overview

Token Lab is a standalone Vite React application for developing and testing Stellar SEP-41 tokens on Futurenet. It communicates with the safu-dev wallet via localStorage bridge for wallet operations.

## Features

- 🪙 **SEP-41 Token Creation** - Deploy standard tokens with custom configurations
- 🔗 **Wallet Bridge Integration** - Connects to safu-dev wallet for transaction signing
- 🧪 **Testing Environment** - Test token functionality on Futurenet
- 📊 **Real-time Logging** - Monitor deployment and transaction status
- 🎨 **Modern UI** - Clean, responsive interface with Tailwind CSS

## Quick Start

1. **Start Token Lab:**
   ```bash
   ./start.sh
   ```
   
2. **Start safu-dev wallet** (in separate terminal):
   ```bash
   # Navigate to safu-dev project
   cd /Users/mac/code/-scdev/safu-dev/frontend
   npm run dev
   ```

3. **Access the applications:**
   - Token Lab: http://localhost:3004
   - Safu-dev Wallet: http://localhost:3003

4. **Connect & Test:**
   - Click "Connect Wallet" in Token Lab
   - Approve connection in safu-dev wallet
   - Configure and deploy tokens

## Technology Stack

- **Framework:** Vite + React + TypeScript
- **Styling:** Tailwind CSS + Custom UI Components
- **Blockchain:** Stellar SDK for Soroban interactions
- **Wallet Bridge:** localStorage-based cross-origin communication

## Project Structure

```
tokenLab/
├── src/
│   ├── components/
│   │   ├── ui/           # Reusable UI components
│   │   └── TokenLab.tsx  # Main application component
│   ├── lib/
│   │   └── wallet-client.ts  # Wallet bridge client
│   └── main.tsx
├── package.json
├── vite.config.ts
└── start.sh
```

## Configuration

- **Port:** 3004 (configured in vite.config.ts)
- **Network:** Futurenet (Stellar testnet)
- **Wallet Bridge:** localStorage polling at 100ms intervals
- **Connection Timeout:** 30 seconds

## Development

### Prerequisites
- Node.js 18+
- safu-dev wallet running on port 3003

### Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Debugging
- Check browser console for wallet bridge logs
- Monitor localStorage keys: `safu-wallet-requests`, `safu-wallet-responses`
- Use the real-time log panel in the UI

## Wallet Bridge Communication

Token Lab communicates with the safu-dev wallet using:

1. **Requests:** Written to `localStorage['safu-wallet-requests']`
2. **Responses:** Read from `localStorage['safu-wallet-responses']`
3. **Events:** Wallet state changes via `localStorage['safu-wallet-events']`

The bridge enables:
- Account connection/disconnection
- Transaction signing
- Network switching
- Real-time wallet state updates

## Troubleshooting

### Connection Issues
1. Ensure safu-dev wallet is running on port 3003
2. Make sure wallet is unlocked and logged in
3. Check browser console for bridge errors
4. Try refreshing both applications

### Build Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Future Enhancements

- [ ] Real contract deployment (currently simulated)
- [ ] Multi-token management interface
- [ ] Advanced token features (governance, vesting)
- [ ] Integration with Stellar testnet
- [ ] Automated testing suite