These instructions are to give you context and background information. Maybe just refreshing the context.

Token Lab is a SEP-41 Token smart contract deployment and management dapp.

We are using devnet for testing. the main solana CLI account is G4u8UUXGJpCMQA2M6kVxpzX2xcvhj2Jg3Bsr9nrDVein, it has plenty of devnet sol. wallet configs are at /Users/mac/.config/solana/cli/config.yml
Default Keypair (Wallet): /Users/mac/.config/solana/id.json

The project including the docs folder is in /Users/Mac/code/-scdev/tokenLab/. The folder /Users/Mac/code/-scdev/safu-dev/ is the project of the wallet that we will use to connect to this Token Lab.

The github project is https://github.com/tom9000/tokenLab

Lets use port :3005 or higher for the vite server. Other ports are in use by other projects.

To avoid server cannot start issues please:
1. Kill existing processes first to avoid conflicts
2. Always use & operator when starting Vite dev servers
2. Look for GET / 200 in the output to confirm it's actually working

Please don't run individual commands to kill and start the server. This script is much more quick and efficient ~/restart-tokenlab.sh
