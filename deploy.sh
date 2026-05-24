#!/bin/bash
# ═══════════════════════════════════════════════════════
#  Deploy DiploIA to VPS
# ═══════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════"
echo "  Deploying MapAI..."
echo "═══════════════════════════════════════════════════"

# Ensure we are in the project directory
cd "$(dirname "$0")"

# Pull latest changes
git pull origin main

# Install dependencies
npm install --production

# Restart the server (Clean restart)
if command -v pm2 &> /dev/null; then
    echo "🔄 Cleaning old PM2 process..."
    pm2 delete mapai 2>/dev/null
    
    echo "🚀 Starting server..."
    pm2 start server.js --name mapai
    
    pm2 save
    echo "✅ Server started with PM2"
    
    echo "═══════════════════════════════════════════════════"
    echo "  LATEST LOGS (Review for errors):"
    echo "═══════════════════════════════════════════════════"
    pm2 logs diploia --lines 20 --no-daemon &
    LOG_PID=$!
    sleep 3
    kill $LOG_PID
else
    echo "❌ PM2 not found. Cannot perform clean deploy."
fi

echo "═══════════════════════════════════════════════════"
echo "  Deploy complete!"
echo "═══════════════════════════════════════════════════"
