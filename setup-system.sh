#!/bin/bash
# Privileged setup for xremap (macOS-style keybindings on GNOME).
# Run as root:  sudo bash setup-system.sh
#
# Grants your user read access to input devices and write access to
# /dev/uinput so xremap can capture keys and emit remapped ones.

set -euo pipefail

TARGET_USER="${1:-${SUDO_USER:-}}"
if [ -z "$TARGET_USER" ]; then
    echo "Usage: sudo bash setup-system.sh <username>" >&2
    echo "   or: sudo bash setup-system.sh          (uses \$SUDO_USER)" >&2
    exit 1
fi

if [ "$EUID" -ne 0 ]; then
    echo "Error: run this script with sudo." >&2
    exit 1
fi

echo "[1/4] Adding '$TARGET_USER' to the 'input' group..."
getent group input >/dev/null || groupadd input
gpasswd -a "$TARGET_USER" input

echo "[2/4] Installing udev rule for /dev/uinput..."
cat > /etc/udev/rules.d/99-xremap-uinput.rules <<'EOF'
KERNEL=="uinput", GROUP="input", TAG+="uaccess", MODE:="0660", OPTIONS+="static_node=uinput"
EOF

echo "[3/4] Ensuring the uinput module loads at boot..."
cat > /etc/modules-load.d/uinput.conf <<'EOF'
uinput
EOF
modprobe uinput || true

echo "[4/4] Reloading udev rules..."
udevadm control --reload-rules
udevadm trigger

echo
echo "System setup complete."
echo "Log out and back in (or reboot) so the new group membership applies."
echo "Then run:  systemctl --user start xremap.service"
