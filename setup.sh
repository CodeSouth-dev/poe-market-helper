#!/bin/bash

# Path of Exile Market Helper - Setup Instructions
echo "=== Path of Exile Market Helper Setup ==="
echo ""

# Check Node.js installation
if command -v node &> /dev/null; then
    echo "✅ Node.js found: $(node --version)"
else
    echo "❌ Node.js not found. Please install Node.js 16+ from https://nodejs.org"
    exit 1
fi

if command -v npm &> /dev/null; then
    echo "✅ npm found: $(npm --version)"
else
    echo "❌ npm not found. Please install npm"
    exit 1
fi

echo ""
echo "🔧 Installing dependencies..."

# Install dependencies
npm install electron typescript axios fs-extra
npm install --save-dev @types/node

echo ""
echo "🏗️ Building TypeScript..."

# Compile TypeScript
npx tsc

echo ""
echo "🚀 Starting application..."

# Run the app
npm start
