These instructions are to give you context and background information. Maybe just refreshing the context.

Token Lab is a SEP-41 Token smart contract deployment and management dapp for Stellar Soroban. We are using the Futurenet network in the testing phase. The explorer is here https://futurenet.stellarchain.io

The project including the docs folder is in /Users/Mac/code/-scdev/tokenLab/.

The github project is https://github.com/tom9000/tokenLab

Lets use port :3005 or higher for the vite server. Other ports are in use by other projects.

To avoid server cannot start issues please:
1. Kill existing processes first to avoid conflicts
2. Always use & operator when starting Vite dev servers
2. Look for GET / 200 in the output to confirm it's actually working

Don't run individual commands to kill and start the server. Use this script instead ~/restart-tokenlab.sh

We can use Playwright MCP so agents can browse pages, test functionality, take screen shots etc.
When we need this, please see docs/upw.md for notes including how to navigate the pages.

The folder /Users/Mac/code/-scdev/safu-dev/ is the project of the wallet that we will use to connect to this Token Lab.