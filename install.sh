#!/bin/bash

# Elephant Fact Sheet Template Installer
# This script clones the repository, builds it, and sets up the command globally

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default installation directory
INSTALL_DIR="${HOME}/.elephant-fact-sheet"
BIN_DIR="${HOME}/.local/bin"

echo -e "${BLUE}🐘 Elephant Fact Sheet Template Installer${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ is required. Current version: $(node -v)${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) and npm $(npm -v) detected${NC}"
echo ""

# Remove existing installation if present
if [ -d "$INSTALL_DIR" ]; then
    echo "Removing existing installation..."
    rm -rf "$INSTALL_DIR"
fi

# Clone the repository
echo "Cloning repository..."
git clone https://github.com/elephant-xyz/fact-sheet-template.git "$INSTALL_DIR"

# Navigate to installation directory
cd "$INSTALL_DIR"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Build the project
echo ""
echo "Building project..."
npm run build

# Create bin directory if it doesn't exist
mkdir -p "$BIN_DIR"

# Create symlink for global command
echo ""
echo "Setting up global command..."
ln -sf "$INSTALL_DIR/bin/fact-sheet.js" "$BIN_DIR/fact-sheet"

# Make the script executable
chmod +x "$INSTALL_DIR/bin/fact-sheet.js"

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo ""
    echo -e "${BLUE}ℹ️  Add the following line to your shell configuration file (.bashrc, .zshrc, etc.):${NC}"
    echo ""
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    echo "Then reload your shell configuration:"
    echo "    source ~/.bashrc  # or source ~/.zshrc"
    echo ""
else
    echo -e "${GREEN}✓ $BIN_DIR is already in your PATH${NC}"
fi

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "You can now use the fact-sheet command:"
echo "    fact-sheet generate --input ./data --output ./websites"
echo ""
echo "For help:"
echo "    fact-sheet --help"
echo ""
echo "To uninstall, run:"
echo "    rm -rf $INSTALL_DIR"
echo "    rm $BIN_DIR/fact-sheet"