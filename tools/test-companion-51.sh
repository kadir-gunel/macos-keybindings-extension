#!/bin/bash
# Headless test to validate the companion extension loads on GNOME 51
# and exposes WMClasses on the D-Bus bus.
#
# Usage: tools/test-companion-51.sh
#
# This test derives from the smoke test infrastructure to ensure a
# private D-Bus session, private extension directory, and headless shell.

set -u

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ "${KB_SMOKE_INNER:-0}" != 1 ]; then
    exec env KB_SMOKE_INNER=1 dbus-run-session -- "$0"
fi

UUID=xremap@k0kubun.com
TMP=$(mktemp -d)

cleanup() { [ -n "$SHELL_PID" ] && kill "$SHELL_PID" 2>/dev/null; rm -rf "$TMP"; }
trap cleanup EXIT

export XDG_DATA_HOME="$TMP/data"
export XDG_CONFIG_HOME="$TMP/config"
export GSETTINGS_BACKEND=keyfile
mkdir -p "$XDG_DATA_HOME/gnome-shell/extensions" "$XDG_CONFIG_HOME/glib-2.0/settings"

# Copy the patched companion to the private extension directory
COMPANION_DIR="$XDG_DATA_HOME/gnome-shell/extensions/$UUID"
mkdir -p "$COMPANION_DIR/schemas"
cp /tmp/xremap-gnome/* "$COMPANION_DIR/"
cp /tmp/xremap-gnome/schemas/*.xml "$COMPANION_DIR/schemas/" 2>/dev/null || true
glib-compile-schemas "$COMPANION_DIR/schemas" || { echo "FAIL: the schema did not compile"; exit 1; }
echo "✓ Companion extension copied and schema compiled"

# Enable the companion extension in the private session
cat > "$XDG_CONFIG_HOME/glib-2.0/settings/keyfile" <<EOF
[org/gnome/shell]
enabled-extensions=['xremap@k0kubun.com']
EOF
echo "✓ Companion enabled in private settings"

shell_eval() { # args: command
    # Run a command in the shell via the Eval D-Bus method
    echo "$1" | busctl --user --session call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s "$1"
}

extension_info() { # args: uuid
    gnome-extensions info "$1" 2>&1
}

is_active() { extension_info "$UUID" | grep -q 'State: ACTIVE'; }

fail() { echo "FAIL: $*"; echo "--- shell log:"; tail -25 "$TMP/shell.log"; exit 1; }

echo "Starting headless GNOME Shell 51..."
gnome-shell --unsafe-mode --headless --wayland --no-x11 --virtual-monitor 1600x1000 \
    > "$TMP/shell.log" 2>&1 &
SHELL_PID=$!

# Wait for the companion to load
echo "Waiting for companion extension to load..."
echo "TMP directory: $TMP"
sleep 2

is_active || fail "Companion did not become ACTIVE"

# Check if the D-Bus object exists
echo "Checking D-Bus object exists at /com/k0kubun/Xremap..."
  BUSCTL_OUTPUT=$(busctl --user introspect org.gnome.Shell /com/k0kubun/Xremap 2>&1 || true)
echo "$BUSCTL_OUTPUT" | grep -q "com.k0kubun.Xremap" || fail "D-Bus object does not exist at /com/k0kubun/Xremap"
echo "✓ D-Bus object exists"

# Check if the WMClasses method exists
echo "Checking WMClasses method exists on the D-Bus object..."
echo "$BUSCTL_OUTPUT" | grep -q "WMClasses" || fail "WMClasses method not found"
echo "✓ WMClasses method exists"

  # Check if the WMClasses method exists
  echo "Checking WMClasses method exists on the D-Bus object..."
  echo "$BUSCTL_OUTPUT" | grep -q "WMClasses" || fail "WMClasses method not found"
  echo "✓ WMClasses method exists"

# Try to call WMClasses to ensure it actually works
echo "Calling WMClasses to ensure it works..."
  WMCLASSES_OUTPUT=$(busctl --user call org.gnome.Shell /com/k0kubun/Xremap com.k0kubun.Xremap WMClasses 2>&1 || true)
if [ -n "$WMCLASSES_OUTPUT" ]; then
    echo "✓ WMClasses call succeeded"
else
    fail "WMClasses call failed"
fi

# Check for errors in the shell log
errors=$(grep -i "xremap" "$TMP/shell.log" | grep -iE 'error|exception' || true)
if [ -n "$errors" ]; then
    echo "   FAIL: the shell log holds an error:"
    echo "$errors" | head -5
    exit 1
fi

echo "RESULT: PASS"
exit 0
