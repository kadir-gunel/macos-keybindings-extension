#!/bin/bash
# macOS Keybindings Extension Installer
# Installs the extension and xremap configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}macOS Keybindings Extension Installer${NC}"
echo

# Check if running as the correct user
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Error: Do not run as root${NC}"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/macos-keybindings@kguenel.github.io"
CONFIG_DIR="$HOME/.config/xremap"
SYSTEMD_DIR="$HOME/.config/systemd/user"

echo "Extension directory: $EXTENSION_DIR"
echo "Config directory: $CONFIG_DIR"
echo

# Step 1: Install the extension
echo -e "${YELLOW}[1/7] Installing extension...${NC}"
mkdir -p "$EXTENSION_DIR/schemas"
cp "$SCRIPT_DIR/extension.js" "$SCRIPT_DIR/prefs.js" "$SCRIPT_DIR/metadata.json" "$EXTENSION_DIR/"
cp "$SCRIPT_DIR/schemas/"*.xml "$EXTENSION_DIR/schemas/"
glib-compile-schemas "$EXTENSION_DIR/schemas"
echo -e "${GREEN}✓ Extension installed${NC}"
echo

# Step 2: Install xremap if not present
echo -e "${YELLOW}[2/7] Checking for xremap...${NC}"
XREMAP_BINARY="/usr/bin/xremap"
if [ ! -f "$XREMAP_BINARY" ]; then
    echo -e "${YELLOW}xremap not found. Please install it for your distribution:${NC}"
    echo "  - Fedora: sudo dnf install xremap"
    echo "  - Debian/Ubuntu: sudo apt install xremap"
    echo "  - Arch: sudo pacman -S xremap"
    echo "  - Or download from: https://github.com/xremap/xremap"
    read -p "Press Enter when xremap is installed..."
else
    echo -e "${GREEN}✓ xremap found at $XREMAP_BINARY${NC}"
fi
echo

# Step 3: Check for xremap-gnome extension
echo -e "${YELLOW}[3/7] Checking for xremap-gnome extension...${NC}"
XREMAP_GNOME_UUID="xremap@k0kubun.com"
XREMAP_GNOME_DIR="$HOME/.local/share/gnome-shell/extensions/$XREMAP_GNOME_UUID"
if [ -d "$XREMAP_GNOME_DIR" ]; then
    echo -e "${GREEN}✓ xremap-gnome found${NC}"
else
    echo -e "${YELLOW}xremap-gnome not found. Please install from:${NC}"
    echo "  https://extensions.gnome.org/extension/5060/xremap/"
    read -p "Press Enter when xremap-gnome is installed..."
fi
echo

# Step 4: Setup xremap config
echo -e "${YELLOW}[4/7] Setting up xremap config...${NC}"
mkdir -p "$CONFIG_DIR"
cp "$SCRIPT_DIR/xremap-config.yml" "$CONFIG_DIR/config.yml"
echo

# Step 5: Setup systemd service
echo -e "${YELLOW}[5/7] Setting up systemd service...${NC}"
mkdir -p "$SYSTEMD_DIR"
cp "$SCRIPT_DIR/xremap.service" "$SYSTEMD_DIR/xremap.service"
systemctl --user daemon-reload
echo -e "${GREEN}✓ Service file installed${NC}"
echo

# Step 6: Service installed; the extension toggle controls it
echo -e "${YELLOW}[6/7] Service file ready...${NC}"
echo -e "${GREEN}✓ xremap.service installed (deliberately not auto-started)${NC}"
echo -e "  The extension's toggle switch starts and stops the service."
echo

# Step 7: Reload GNOME Shell extension
echo -e "${YELLOW}[7/7] Reloading GNOME Shell extensions...${NC}"
gnome-extensions reload macos-keybindings@kguenel.github.io 2>/dev/null || true
echo -e "${GREEN}✓ GNOME extensions reloaded${NC}"
echo

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo "Next steps:"
echo "1. Log out and back in for extensions to be registered"
echo "2. In GNOME Settings → Extensions, enable both extensions:"
echo "   - xremap@k0kubun.com"
echo "   - macos-keybindings@kguenel.github.io"
echo "3. Use the extension toggle switch to enable/disable macOS keybindings"
echo
echo "For more information, see: $SCRIPT_DIR/README.md"
