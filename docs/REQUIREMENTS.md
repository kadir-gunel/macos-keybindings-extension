# Requirements — macOS Keybindings for GNOME

## 1. Purpose

Give macOS-style keyboard shortcuts on GNOME Shell 45–50. The user turns the
shortcuts on and off with one switch in the extension preferences.

## 2. Functional requirements

- FR-1: The extension MUST start `xremap.service` when the user turns the
  switch on.
- FR-2: The extension MUST stop `xremap.service` when the user turns the
  switch off.
- FR-3: The extension MUST keep the service state equal to the stored switch
  value after a GNOME Shell restart.
- FR-4: The extension MUST refuse to start the service when the `xremap`
  binary or the `xremap@k0kubun.com` extension is absent. It MUST show a
  message and set the switch to off.
- FR-5: The preferences window MUST open without an error.
- FR-6: `xremap-config.yml` MUST give macOS-style shortcuts for graphical
  applications and MUST NOT change native terminal control keys.

## 3. Non-functional requirements

- NFR-1: The extension MUST work on Wayland and on X11.
- NFR-2: The license MUST be GPL-3.0-or-later.
- NFR-3: The code MUST use only GNOME Shell 45+ APIs.

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

## 5. Verified environment

- GNOME Shell 50.5 on Wayland: the extension loads (`State: ACTIVE`), the
  preferences window opens without an error, and `Ctrl+A` / `Ctrl+E` give
  line navigation. The user reported this result. A synthetic input device
  reproduced it.

## 6. Missing information

- MI-1: GNOME Shell 50.5 is verified. GNOME Shell 45–49 are declared in
  `metadata.json` but are not tested.
- MI-2: The behaviour on X11 is not tested.
- MI-3: No automated test exists. All tests are manual.
- MI-4: The behaviour of a Bluetooth keyboard after a reconnect is not
  tested completely.
