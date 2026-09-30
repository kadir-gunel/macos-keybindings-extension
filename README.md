# macOS Keybindings for GNOME

A GNOME Shell extension plus xremap setup that gives you macOS-style
keyboard shortcuts on GNOME (Wayland or X11).

The extension adds a toggle switch. Turn it on to apply macOS shortcuts, turn
it off to return to stock GNOME behavior.

## Architecture

Two GNOME Shell extensions plus one system service are involved:

| Component | Role |
| --- | --- |
| `macos-keybindings@kguenel.github.io` | This project. Toggle switch + dependency check + service control. |
| `xremap@k0kubun.com` | Upstream xremap companion. Lets xremap read the focused window via D-Bus. |
| `xremap.service` (user unit) | Runs the remapper daemon. |

xremap works at the kernel `evdev`/`uinput` level, so it does not care whether
you run Wayland or X11. The companion extension is needed only for
application-specific rules.

## Requirements

1. `xremap` binary built with GNOME support (Arch: `xremap-gnome-bin`).
   Verify with: `xremap --list-desktops` -> `This variant of xremap supports: GNOME`
2. GNOME Shell 50.
3. Your user in the `input` group, and write access to `/dev/uinput`.

## Install

### 1. System permissions (requires root)

```sh
sudo bash setup-system.sh
```

This adds you to the `input` group and installs a udev rule for
`/dev/uinput`. **Log out and back in** afterwards - group membership is only
picked up on a fresh session. A reboot also works.

### 2. The extensions

```sh
./install.sh
```

This copies the extension, compiles its GSettings schema, installs the xremap
config and the user service, then reloads systemd. The service is deliberately
**not** auto-started or enabled: the extension's toggle switch owns its
lifecycle.

If the `xremap@k0kubun.com` companion extension is missing, clone it:

```sh
git clone https://github.com/xremap/xremap-gnome \
  ~/.local/share/gnome-shell/extensions/xremap@k0kubun.com
```

The directory name must equal the `uuid` in its `metadata.json`. The upstream
README suggests a different directory name; use the UUID.

### 3. Enable

After logging back in:

```sh
gnome-extensions enable xremap@k0kubun.com
gnome-extensions enable macos-keybindings@kguenel.github.io
```

GNOME Shell only scans the extensions directory at session start, so newly
copied extensions do not exist until you log out and back in once.

### 4. Turn it on

Open the extension preferences and switch on **Enable macOS keybindings**.
The toggle checks that the binary and the companion extension are present,
then starts `xremap.service`.

## Keyboard note

The shipped `config.yml` deliberately has **no `modmap` section**.

An Apple Magic Keyboard already sends `Command` as `Super_L` and `Option` as
`Alt_L`. Swapping them - as you would for a Windows-layout keyboard - would
invert the keys and break Command.

If you use a **Windows-layout keyboard** and want the key next to the spacebar
to act as Command, add:

```yaml
modmap:
  - name: macOS modifier positions
    device:
      only: "YOUR_KEYBOARD_NAME"
    remap:
      Alt_L: Super_L
      Super_L: Alt_L
      Alt_R: Super_R
      Super_R: Alt_R
```

Get the name from `xremap --list-devices`. Do not apply this on a Mac-layout
keyboard.

## Shortcuts

`Cmd` is the physical Command key (`Super` on Linux). `Option` is `Alt`.

| Shortcut | Behavior |
| --- | --- |
| Cmd+C / V / X / A | Copy / paste / cut / select all |
| Cmd+Z / Shift+Cmd+Z | Undo / redo |
| Cmd+S / F / N / O / P | Save / find / new / open / print |
| Cmd+T / W / L / R | New tab / close tab / address field / reload |
| Cmd+Left / Right | Line start / end |
| Cmd+Up / Down | Document start / end |
| Option+Left / Right | Word navigation |
| Cmd+Shift+3 | Screenshot, full screen |
| Cmd+Shift+4 | Screenshot, area selection |
| Cmd+click | Open link in a new background tab |
| Cmd+Shift+click | Open link in a new foreground tab |
| Cmd+Q | Quit application |
| Cmd+Tab / Cmd+H | GNOME app switch / minimize (native) |

In GNOME Files: Cmd+Down opens, Cmd+Up goes to the parent, Cmd+Backspace
deletes, Cmd+Shift+G opens the path bar.

In terminals: Cmd+C / V use Ctrl+Shift+C / V, because plain Ctrl+C is SIGINT.

Physical `Ctrl` keeps its native behavior everywhere, including terminal
Ctrl+C.

## Troubleshooting

```sh
systemctl --user status xremap.service
journalctl --user -u xremap.service -b
xremap --list-devices            # empty output = missing 'input' group
```

| Symptom | Cause |
| --- | --- |
| `No input devices ... lack the required permissions` | Not in `input` group, or `/dev/uinput` not writable. Run `setup-system.sh` and re-login. |
| `socket directory not found` | You passed `--desktop=socket`. Use `--desktop=gnome` (D-Bus) instead. |
| Service restarts every second | The companion extension is not enabled. `ExecStartPre` gates on it. |
| Toggle flips off immediately | Dependency check failed; the notification names the missing piece. |

Stop and disable:

```sh
systemctl --user disable --now xremap.service
```
