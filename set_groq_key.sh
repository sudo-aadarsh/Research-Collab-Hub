#!/bin/bash
# ==============================================================================
# Helper script to quickly inject your Groq API key and restart the backend
# Usage: ./set_groq_key.sh YOUR_GROQ_API_KEY
# ==============================================================================

KEY=$1

if [ -z "$KEY" ]; then
    echo "❌ Error: No API key provided."
    echo "Usage: ./set_groq_key.sh gsk_your_groq_api_key_here..."
    echo ""
    echo "👉 Get a free key at: https://console.groq.com/keys"
    exit 1
fi

echo "🔄 Updating .env file with your Groq API key..."

# Use sed to replace the placeholder or existing key
if grep -q "GROQ_API_KEY=" .env; then
    # Cross-platform sed for in-place edit
    sed -i.bak "s/^GROQ_API_KEY=.*/GROQ_API_KEY=$KEY/" .env
    rm -f .env.bak
else
    echo "GROQ_API_KEY=$KEY" >> .env
fi

# Ensure the provider is set to groq
if grep -q "^AI_PROVIDER=" .env; then
    sed -i.bak "s/^AI_PROVIDER=.*/AI_PROVIDER=groq/" .env
    rm -f .env.bak
else
    echo "AI_PROVIDER=groq" >> .env
fi

echo "✅ .env updated successfully."
echo "🔄 Restarting backend container to apply changes..."

# Restart just the backend service
docker compose up -d --force-recreate backend

echo ""
echo "🎉 Done! The AI is now powered by Groq Llama 3 (Extremely Fast, High Limits)."
echo "   Test it out in the application!"
