#!/bin/bash

# Token Lab Startup Script
echo "🧪 Starting Token Lab..."

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the development server
echo "🚀 Starting development server on port 3005..."
npm run dev