#!/bin/bash

# Elephant Fact Sheet Template Installer
# This script clones the repository, builds it, and sets up the command globally

# Elephant Fact Sheet Template Installer (Silent)
set -e  # Exit on any error

INSTALL_DIR="${HOME}/.elephant-fact-sheet"
BIN_DIR="${HOME}/.local/bin"

# Check Node.js version
if ! command -v node &> /dev/null; then
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    exit 1
fi

# Clean up any existing installation
rm -rf "$INSTALL_DIR"

# Clone repo silently
git clone --quiet https://github.com/elephant-xyz/fact-sheet-template.git "$INSTALL_DIR"

cd "$INSTALL_DIR"

# Silent npm install and build
npm install --silent --no-audit --no-fund > /dev/null 2>&1
npm run build --silent > /dev/null 2>&1

# Setup directories
mkdir -p "$BIN_DIR"

# Link and make executable
ln -sf "$INSTALL_DIR/bin/fact-sheet.js" "$BIN_DIR/fact-sheet"
chmod +x "$INSTALL_DIR/bin/fact-sheet.js"