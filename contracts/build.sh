#!/bin/bash

set -e

echo "🔨 Building SEP-41 Token Contract..."

# Navigate to contract directory
cd "$(dirname "$0")/sep41_token"

# Check if Rust and Cargo are installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo not found. Please install Rust: https://rustup.rs/"
    exit 1
fi

# Add wasm32 target if not present
rustup target add wasm32-unknown-unknown

# Build the contract
echo "📦 Compiling contract to WASM..."
cargo build --target wasm32-unknown-unknown --release

# Check if stellar CLI is available for optimizing
if command -v stellar &> /dev/null; then
    echo "⚡ Optimizing WASM with Stellar CLI..."
    stellar contract optimize \
        --wasm target/wasm32-unknown-unknown/release/sep41_token.wasm
else
    echo "⚠️  Stellar CLI not found. Using unoptimized WASM."
    echo "💡 Install Stellar CLI for smaller contract size:"
    echo "   curl -L https://github.com/stellar/stellar-cli/releases/latest/download/stellar-cli-universal-apple-darwin.tar.gz | tar -xz"
fi

echo "✅ Contract build complete!"
echo "📄 WASM file: target/wasm32-unknown-unknown/release/sep41_token.wasm"

# Copy WASM to parent directory for easy access
cp target/wasm32-unknown-unknown/release/sep41_token.wasm ../sep41_token.wasm
echo "📄 Contract copied to: contracts/sep41_token.wasm"