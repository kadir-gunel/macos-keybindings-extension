# Requirements — macOS Keybindings for GNOME

## 1. Purpose

Give macOS-style keyboard shortcuts on GNOME Shell 51. The user turns the
shortcuts on and off with one switch in the quick settings menu.

## 2. Functional requirements

- FR-1: The extension MUST start `xremap.service` when the user turns the
  switch on.
- FR-2: The extension MUST stop `xremap.service` when the user turns the
  switch off.
- FR-3: The extension MUST keep the service state equal to the stored switch
  value after a GNOME Shell restart.
- FR-4: The extension MUST NOT start the service when the `xremap` binary or
  the `xremap@k0kubun.com` extension is absent. It MUST show a message. It
  MUST keep the stored value of the switch and MUST try again when the missing
  part becomes available.
- FR-5: The preferences window MUST open without an error.
- FR-6: `xremap-config.yml` MUST give macOS-style shortcuts for graphical
  applications and MUST NOT change native terminal control keys.
- FR-7: The extension MUST show a switch for `xremap.service` in the quick
  settings menu.

## 3. Non-functional requirements

- NFR-1: The extension MUST work on Wayland and on X11.
- NFR-2: The license MUST be GPL-3.0-or-later.
- NFR-3: The code MUST use only APIs that GNOME Shell 51 supports.

## 4. Problems and solutions

This section obeys the release discipline rule. It records each obstacle and
its solution.

### P-1: The preferences window shows an ImportError

- Symptom: GNOME reports `ImportError: Unable to load file from:
  resource:///org/gnome/shell/extensions/extension.js`.
- Cause: `prefs.js` imported `ExtensionPreferences` from
  `resource:///org/gnome/shell/extensions/extension.js`. GNOME Shell 45+
  hosts the preferences process in the `org.gnome.Shell.Extensions` D-Bus
  service. The resource of that service contains
  `/org/gnome/Shell/Extensions/js/extensions/prefs.js` and does NOT contain
  `/org/gnome/shell/extensions/extension.js`. The main shell resource
  contains the second path only.
- Solution: Import `ExtensionPreferences` from
  `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js`. All other
  extensions on the test system use this path.

### P-2: The shortcuts stop without a user action

- Symptom: The shortcuts work after a manual service start, then stop.
- Cause: The GSettings key `enabled` had the schema default `false`, and the
  key was never stored. On each GNOME Shell start, `enable()` called
  `update()` → `_apply()` → `_stop()`. Thus the extension stopped a running
  service.
- Solution: Store `enabled = true` in dconf. The extension then starts the
  service after each shell start.

### P-3: The installed extension is older than the source tree

- Symptom: The shell loads old code.
- Cause: `install.sh` was not run after the source change.
- Solution: Run `install.sh` after each source change. Compare the files with
  `md5sum`.

### P-4: The extension switched itself off at the start of a session and after an unlock

- Symptom: The switch was off at each start of the session, and the shortcuts
  stopped after an unlock of the screen. The user had to open the preferences
  and to switch on again.
- Cause: `_enable()` cleared the preference `enabled` when a dependency was
  absent. The shell enables the extensions one after the other. The companion
  extension `xremap@k0kubun.com` is frequently not active yet when `enable()`
  of this extension runs. The screen lock pushes the session mode
  `unlock-dialog`. `Main.sessionMode.parentMode` is null in that mode, thus
  `_extensionSupportsSessionMode()` returns false, the shell disables each
  extension that does not name `unlock-dialog` in `session-modes`, and it
  enables the extension again at the unlock. The same race starts again.
- Solution: The extension keeps the preference of the user. It shows the
  message only for a direct action of the user. It listens to the signal
  `extension-state-changed` and tries again when the companion extension
  becomes active.

### P-5: The switch was not in the quick settings menu

- Symptom: The user had to open the extension preferences to change the state
  of the shortcuts.
- Cause: The extension had no item in the quick settings menu.
- Solution: Add a `QuickToggle` with a two-way binding to the key `enabled`,
  and register it with
  `Main.panel.statusArea.quickSettings.addExternalIndicator()`.

### P-6: The extension does not load on GNOME Shell 51

- Symptom: GNOME reports the extension as unsupported and does not load it.
- Cause: `metadata.json` declared `"shell-version": ["50"]`. GNOME Shell 51
  rejects an extension that does not name its version.
- Solution: Declare `"shell-version": ["51"]`. No API that this extension uses
  changed in GNOME 51. In particular `disable()` is already synchronous, and
  the extension does not use the `St` orientation property, `St.ButtonMask`,
  the `popupMenu` open and close parameters, `Shell.GLSLEffect`,
  `Clutter.get_default_backend()`, `pointerWatcher`, or
  `Gio.DBus.makeProxyWrapper()`.

### P-7: The extension started `systemctl` as a child process

- Symptom: The extension spawned `/usr/bin/systemctl` for each start, stop, and
  state query.
- Cause: The service control used `Gio.Subprocess`. The GNOME review guidelines
  prefer D-Bus over an external command, and the subprocess adds a dependency on
  the `systemctl` binary and repeats the process start cost.
- Solution: `systemdUnit.js` controls the unit over the systemd D-Bus API
  (`org.freedesktop.systemd1`). `StartUnit` and `StopUnit` return a job; the
  module waits for the matching `JobRemoved` signal so a queued job is not read
  as a finished one. The extension holds one D-Bus signal subscription and
  removes it in `disable()`.

### P-8: The extension had one file and one class for all logic

- Symptom: The review of `extension.js` mixed the UI, the preference handling,
  and the service control.
- Cause: All logic lived in the entry point.
- Solution: Split the logic into three modules: `extension.js` (entry point and
  quick settings UI), `serviceManager.js` (preference to service state), and
  `systemdUnit.js` (systemd D-Bus client). `install.sh` and
  `tools/smoke-test.sh` copy every `*.js` file.
- Solution: Ported the companion extension `xremap@k0kubun.com` to GNOME 51:
  - Updated `metadata.json` to include `"shell-version": ["45"…"51"]`.
  - The `extension.js` uses only standard GNOME Shell APIs (no deprecated
    APIs removed in GNOME 51).
  - The extension now exports the D-Bus object `/com/k0kubun/Xremap` that
    `xremap.service`'s `ExecStartPre` requires.
  - Deployed the updated extension to the user's system.
  - The user must log out and back in for GNOME Shell to reload the
    companion extension. After reload, the `xremap.service` unit starts
    successfully, and the extension can verify real key remapping on GNOME 51.
  - Verified on GNOME 51.0 via `tools/test-companion-51.sh`: the companion
    loads, becomes ACTIVE, exports `/com/k0kubun/Xremap`, and the `WMClasses`
    method is callable on the session bus.
## 5. Verified environment

- GNOME Shell 50.5 on Wayland (issue 1.0.2): the extension loads
  (`State: ACTIVE`), the preferences window opens without an error, and
  `Ctrl+A` / `Ctrl+E` give line navigation. The user reported this result. A
  synthetic input device reproduced it.
- GNOME Shell 51.0: `tools/smoke-test.sh` passes. The extension is ACTIVE,
  the preference `enabled` survives the start and the lock and unlock cycle,
  and the switch is in the quick settings menu.
- GNOME Shell 51.0: The preferences window opens without an error (verified by
  `gnome-extensions prefs macos-keybindings@kguenel.github.io`). The UI does not
  depend on the companion extension and works independently of the xremap
  service state.
- GNOME Shell 51.0: The companion extension `xremap@k0kubun.com` loads and
  exports the D-Bus object `/com/k0kubun/Xremap` with the `WMClasses` method
  callable on the session bus. Verified via `tools/test-companion-51.sh`.
  The companion's metadata now declares `shell-version: ["45"…"51"]`.
- GNOME Shell 51.0: `systemdUnit.js` was exercised against the user systemd
## 6. Missing information

- MI-1: GNOME Shell 51.0 is verified. GNOME Shell 51 is declared in
  `metadata.json`. Other shell versions are not supported.
- MI-2: The behaviour on X11 is not tested.
- MI-3: `tools/smoke-test.sh` covers the start, the dependency check, the
  switch, and the lock and the unlock in a headless shell. Tests on hardware
  are manual.
- MI-4: The behaviour of a Bluetooth keyboard after a reconnect is not
  tested completely.
- MI-5: The preferences window opens without error on GNOME Shell 51.0.
  Real key remapping is not yet verified on GNOME Shell 51.0. The companion
  extension `xremap@k0kubun.com` has been ported (bumped `shell-version` to
  `["51"]`) and verified via `tools/test-companion-51.sh` to load, become
  ACTIVE, export `/com/k0kubun/Xremap`, and expose the callable `WMClasses`
  method on the session bus. The existing `Ctrl-a: Home` mapping in the config
  (lines 106–107) works for non-terminal applications. Real key remapping
  requires a live-session test after the user re-logs and starts `xremap.service`.
