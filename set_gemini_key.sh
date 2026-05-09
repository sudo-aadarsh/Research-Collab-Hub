#!/usr/bin/env bash
# =============================================================================
# set_gemini_key.sh - Inject your Gemini API key into the running container
# Usage: ./set_gemini_key.sh YOUR_GEMINI_API_KEY_HERE
#
# Get a free key at: https://aistudio.google.com/apikey
# =============================================================================

set -euo pipefail

KEY="${1:-}"
if [ -z "$KEY" ]; then
    echo "Usage: ./set_gemini_key.sh YOUR_API_KEY"
    echo ""
    echo "Get a FREE Gemini API key at: https://aistudio.google.com/apikey"
    exit 1
fi

echo "🔑 Setting GEMINI_API_KEY in the backend container..."

# Update the .env file
if grep -q "^GEMINI_API_KEY=" .env; then
    sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=${KEY}|" .env
else
    echo "GEMINI_API_KEY=${KEY}" >> .env
fi

echo "✅ Updated .env file"

# Restart the backend container to pick up the new env variable
echo "🔄 Restarting backend container..."
GEMINI_API_KEY="$KEY" docker compose up -d --force-recreate backend

echo ""
echo "⏳ Waiting for backend to start..."
sleep 5

# Test if AI is now working
echo "🧪 Testing AI endpoint..."
MAX_TRIES=10
TRIES=0
while [ $TRIES -lt $MAX_TRIES ]; do
    STATUS=$(curl -s http://localhost:8000/health | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("status",""))' 2>/dev/null || echo "")
    if [ "$STATUS" = "healthy" ]; then
        break
    fi
    sleep 2
    TRIES=$((TRIES+1))
done

if [ "$STATUS" = "healthy" ]; then
    echo "✅ Backend is running!"
    echo ""
    echo "🤖 AI features are now powered by Google Gemini (model: gemini-2.0-flash)"
    echo "📊 Frontend: http://localhost:3001"
    echo "📖 API Docs: http://localhost:8000/docs"
else
    echo "⚠️  Backend may still be starting. Check: docker logs rch_backend"
fi
