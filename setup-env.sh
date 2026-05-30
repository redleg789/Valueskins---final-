#!/bin/bash

# ValueSkins Environment Setup Script
# This script creates .env.local with Google OAuth credentials

set -e

echo "======================================"
echo "  ValueSkins Environment Setup"
echo "======================================"
echo ""

# Check if .env.local already exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists."
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting without changes."
        exit 0
    fi
fi

echo "To get your Google OAuth credentials:"
echo "1. Go to https://console.cloud.google.com/"
echo "2. Select your project"
echo "3. Go to APIs & Services → Credentials"
echo "4. Click 'Create Credentials' → 'OAuth 2.0 Client ID'"
echo "5. Choose 'Web application'"
echo "6. Add 'http://localhost:3000/api/auth/callback/google' as redirect URI"
echo "7. Copy your Client ID and Client Secret"
echo ""

# Prompt for Google OAuth credentials
read -p "Enter your Google Client ID: " CLIENT_ID
if [ -z "$CLIENT_ID" ]; then
    echo "❌ Client ID is required."
    exit 1
fi

read -sp "Enter your Google Client Secret: " CLIENT_SECRET
echo
if [ -z "$CLIENT_SECRET" ]; then
    echo "❌ Client Secret is required."
    exit 1
fi

# Generate NEXTAUTH_SECRET
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Create .env.local
cat > .env.local << EOF
# Google OAuth (from Google Cloud Console)
NEXT_PUBLIC_GOOGLE_CLIENT_ID="$CLIENT_ID"
GOOGLE_CLIENT_SECRET="$CLIENT_SECRET"
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NEXTAUTH_URL="http://localhost:3000"

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dmZrcmRpZGlwcmR6ZGhucXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjEwNDYsImV4cCI6MjA4NzIzNzA0Nn0.8pGVastvjFP8B_ThlaGcnS_zU_JbiLoa7GqQ7VsUo_A"
NEXT_PUBLIC_SUPABASE_URL="https://dyvfkrdidiprdzdhnqpj.supabase.co"
EOF

echo ""
echo "✅ .env.local created successfully!"
echo ""
echo "Next steps:"
echo "1. Make sure you added 'http://localhost:3000/api/auth/callback/google' to Google Console"
echo "2. Run: cd marketplace && npm install && npm run dev"
echo "3. Go to http://localhost:3000 and test login"
echo ""
echo "For more info, see: ENV_SETUP.md"
