# AGENTS.md - Token Lab Development Guide

## Build & Test Commands
```bash
npm run dev -- --port 3005        # Start dev server
npm run build                     # Production build
npm run lint                      # ESLint check
npm test                          # Run all Playwright tests
npm run test:headed               # Run tests with browser visible
npm run test:ui                   # Interactive test runner
npm run test:target tests/tokenlab-target-persistent.spec.ts  # Single test
```

## Code Style
- **TypeScript**: Strict mode enabled, no `any` types
- **Imports**: React hooks first, then components, then utils
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Components**: Functional components with TypeScript interfaces
- **Styling**: Tailwind CSS classes, no inline styles
- **Error handling**: Try/catch with specific error messages
- **Wallet bridge**: Use LocalStorageClient for safu-dev wallet communication

The github project is https://github.com/tom9000/tokenLab

Lets use port :3005 for the vite server. Other ports are in use by other projects.

To avoid server cannot start issues please:
1. Kill existing processes first to avoid conflicts
2. Always use & operator when starting Vite dev servers
2. Look for GET / 200 in the output to confirm it's actually working

Please don't run individual commands to kill and start the server. This script is much more quick and efficient ~/restart-tokenlab.sh
