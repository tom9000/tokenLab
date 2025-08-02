# CRUSH.md - Token Lab Development Guide

Token Lab is a SEP-41 Token smart contract deployment and management dapp for Stellar Soroban. We are using the Futurenet network in the testing phase. The explorer is here https://futurenet.stellarchain.io

## Build & Test Commands
```bash
npm run dev -- --port 3005        # Start dev server
npm run build                     # Production build
npm run lint                      # ESLint check
npm run typecheck                 # TypeScript check
npm test                          # Run all Playwright tests
npm run test:headed               # Run tests with browser visible
npm run test:ui                   # Interactive test runner
npm run test:target tests/tokenlab-target-persistent.spec.ts  # Single test
```

## Code Style Guidelines
- **TypeScript**: Strict mode enabled, no `any` types
- **Imports**: React hooks first, then components, then utils
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Components**: Functional components with TypeScript interfaces
- **Styling**: Tailwind CSS classes, no inline styles
- **Error handling**: Try/catch with specific error messages
- **Wallet bridge**: Use LocalStorageClient for safu-dev wallet communication

## Development Setup
- Use port :3005 for the vite server
- Use ~/restart-tokenlab.sh to restart the server efficiently
- Use ~/restart-wallet.sh to restart the wallet which runs authentication
- Look for GET / 200 in output to confirm server is working

## Project Structure
- `/src` - Main source code
- `/tests` - Playwright tests
- `/contracts` - Smart contracts
- `/freighter` - Freighter wallet source code for reference

## Testing
- Run individual tests with `npm run test:target <test-file>`
- Use `npm run test:headed` for debugging
- Persistent browser tests available with `npm run browser:create`


