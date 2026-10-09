#!/bin/bash
# Smoke test for this extension in a private, headless GNOME Shell.
#
# Usage: tools/smoke-test.sh [extension-source-dir]
#
# The test does not change the session of the user:
#  - the shell runs in a private D-Bus session, headless,
#  - the shell uses a private extension directory (XDG_DATA_HOME), so the
#    companion extension xremap@k0kubun.com is absent,
#  - the shell uses a private keyfile GSettings backend.
#
# Because the companion extension is absent, the extension stops at the
# dependency check and never starts or stops the unit over the systemd D-Bus
# API. The service of the user is therefore untouched.
#
# The test covers the two faults of issue 1.0.2:
#  - the extension cleared the preference 'enabled' when the companion
#    extension was not active yet (start of a session, unlock of the screen),
#  - the switch of the extension was not in the quick settings menu.
set -u

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SRC="${1:-$root}"

if [ "${KB_SMOKE_INNER:-0}" != 1 ]; then
    exec env KB_SMOKE_INNER=1 dbus-run-session -- "$0" "$SRC"
fi

UUID=macos-keybindings@kguenel.github.io
TMP=$(mktemp -d)
SHELL_PID=""

cleanup() { [ -n "$SHELL_PID" ] && kill "$SHELL_PID" 2>/dev/null; rm -rf "$TMP"; }
trap cleanup EXIT

export XDG_DATA_HOME="$TMP/data"
export XDG_CONFIG_HOME="$TMP/config"
export GSETTINGS_BACKEND=keyfile
mkdir -p "$XDG_DATA_HOME/gnome-shell/extensions" "$XDG_CONFIG_HOME/glib-2.0/settings"

EXT="$XDG_DATA_HOME/gnome-shell/extensions/$UUID"
mkdir -p "$EXT/schemas"
cp "$SRC"/*.js "$SRC/metadata.json" "$EXT/"
cp "$SRC"/schemas/*.xml "$EXT/schemas/"
glib-compile-schemas "$EXT/schemas" || { echo "FAIL: the schema did not compile"; exit 1; }

# The preference is true, as a user sets it once. The test checks that the
# extension keeps it.
cat > "$XDG_CONFIG_HOME/glib-2.0/settings/keyfile" <<EOF
[org/gnome/shell]
enabled-extensions=['$UUID']

[org/gnome/shell/extensions/macos-keybindings]
enabled=true
show-toast=true
EOF

shell_eval() {
    local reply
    if ! reply=$(gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
        --method org.gnome.Shell.Eval "$1" 2>&1); then
        echo "  the shell did not answer the Eval call: $reply" >&2
        return 1
    fi
    case "$reply" in
        "(true,"*) ;;
        *) echo "  the shell refused the Eval call: $reply" >&2; return 1 ;;
    esac
    printf '%s\n' "$reply" | sed -e "s/^(true, '//" -e "s/')$//" -e 's/^"//' -e 's/"$//'
}

extension_info() {
    gdbus call --session --dest org.gnome.Shell.Extensions \
        --object-path /org/gnome/Shell/Extensions \
        --method org.gnome.Shell.Extensions.GetExtensionInfo "$UUID" 2>/dev/null
}

is_active() { extension_info | grep -q 'state.*1\.0'; }

enabled_value() {
    shell_eval "const o = Main.extensionManager.lookup('$UUID').stateObj;
                o ? String(o._settings.get_boolean('enabled')) : 'no-stateobj'"
}

switch_count() {
    shell_eval "const qs = Main.panel.statusArea.quickSettings;
                const grid = qs._grid ?? qs.menu?._grid;
                grid ? String(grid.get_children()
                    .filter(c => c.title === 'macOS Keybindings').length) : 'no-grid'"
}

fail() { echo "FAIL: $*"; echo "--- shell log:"; tail -25 "$TMP/shell.log"; exit 1; }

gnome-shell --unsafe-mode --headless --wayland --no-x11 --virtual-monitor 1600x1000 \
    > "$TMP/shell.log" 2>&1 &
SHELL_PID=$!

for _ in $(seq 1 45); do
    sleep 2
    kill -0 "$SHELL_PID" 2>/dev/null || fail "the shell stopped"
    is_active && break
done
is_active || fail "$UUID did not become ACTIVE"
echo "1. the extension is ACTIVE after the start"

rc=0
value=$(enabled_value || echo "eval-failed")
echo "2. the preference 'enabled' after the start: $value"
if [ "$value" != "true" ]; then echo "   FAIL: the extension cleared the preference"; rc=1; fi

count=$(switch_count || echo "eval-failed")
echo "3. the switches with the title 'macOS Keybindings' in the quick settings: $count"
if [ "$count" != "1" ]; then echo "   FAIL: the switch is not in the quick settings menu"; rc=1; fi

info=$(extension_info)
echo "$info" | grep -q "'error': <''>" || { echo "   FAIL: the shell reports an error: $info"; rc=1; }

# The screen lock pushes the session mode 'unlock-dialog' and disables the
# extensions that do not support it. The unlock pops the mode and enables them
# again. This is the sequence that cleared the preference before.
echo "4. lock: push the session mode 'unlock-dialog'"
shell_eval "Main.sessionMode.pushMode('unlock-dialog'); Main.sessionMode.currentMode" > /dev/null
sleep 3
echo "5. unlock: pop the session mode 'unlock-dialog'"
shell_eval "Main.sessionMode.popMode('unlock-dialog'); Main.sessionMode.currentMode" > /dev/null
for _ in $(seq 1 15); do sleep 2; is_active && break; done
is_active || { echo "   FAIL: the extension is not ACTIVE after the unlock"; rc=1; }

value=$(enabled_value || echo "eval-failed")
echo "6. the preference 'enabled' after the unlock: $value"
if [ "$value" != "true" ]; then echo "   FAIL: the unlock cleared the preference"; rc=1; fi

errors=$(grep -i 'macos-keybindings' "$TMP/shell.log" | grep -iE 'error|exception' || true)
if [ -n "$errors" ]; then echo "   FAIL: the shell log holds an error:"; echo "$errors" | head -5; rc=1; fi

if [ "$rc" = 0 ]; then echo "RESULT: PASS"; else echo "RESULT: FAIL"; fi
exit "$rc"
