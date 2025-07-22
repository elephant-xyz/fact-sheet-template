#!/bin/bash

# Elephant Fact Sheet Template Updater
# This script updates an existing installation to the latest version

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Installation directory
INSTALL_DIR="${HOME}/.elephant-fact-sheet"

echo -e "${BLUE}🐘 Elephant Fact Sheet Template Updater${NC}"
echo ""

# Check if installation exists
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${RED}❌ No installation found at $INSTALL_DIR${NC}"
    echo ""
    echo "Please run the installer first:"
    echo "    curl -fsSL https://raw.githubusercontent.com/elephant-xyz/fact-sheet-template/main/install.sh | bash"
    exit 1
fi

# Navigate to installation directory
cd "$INSTALL_DIR"

# Fetch latest changes
echo "Fetching latest changes..."
git fetch origin

# Check if there are updates
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}✓ Already up to date!${NC}"
    exit 0
fi

# Show what will be updated
echo ""
echo "Updates available:"
git log --oneline HEAD..origin/main
echo ""

# Pull latest changes
echo "Updating to latest version..."
git pull origin main

# Install dependencies (in case there are new ones)
echo ""
echo "Installing dependencies..."
npm install

# Rebuild the project
echo ""
echo "Building project..."
npm run build

echo ""
echo -e "${GREEN}✅ Update complete!${NC}"
echo ""
echo "You can now use the updated fact-sheet command."