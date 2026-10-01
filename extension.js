import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as ExtensionUtils from 'resource:///org/gnome/shell/misc/extensionUtils.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const XREMAP_BINARY = '/usr/bin/xremap';
const COMPANION_UUID = 'xremap@k0kubun.com';
const UNIT = 'xremap.service';

/** Start, stop, and report one user service. */
class ServiceManager {
    constructor(settings, gettext) {
        this._settings = settings;
        this._gettext = gettext;
        this._chain = Promise.resolve();
    }

    /** Serialize toggles so rapid switching cannot interleave systemctl calls. */
    update(notifyUser = false) {
        this._chain = this._chain
            .then(() => this._apply(notifyUser))
            .catch(e => console.error(`macOS Keybindings: ${e.message ?? e}`));
        return this._chain;
    }

    async _apply(notifyUser) {
        if (this._settings.get_boolean('enabled'))
            await this._enable(notifyUser);
        else
            await this._stop();
    }

    /** The parts that a start of the service needs. */
    _missingDependencies() {
        const missing = [];

        if (!GLib.file_test(XREMAP_BINARY, GLib.FileTest.EXISTS))
            missing.push(this._gettext('xremap binary (/usr/bin/xremap)'));
        if (!this._companionActive())
            missing.push(this._gettext(`the ${COMPANION_UUID} extension`));

        return missing;
    }

    async _enable(notifyUser) {
        const missing = this._missingDependencies();

        if (missing.length > 0) {
            /* The shell enables the extensions one after the other. At the
               start of a session and after the unlock of the screen the
               companion extension can be not active yet. The preference of the
               user stays set, and the signal 'extension-state-changed' gives
               the next attempt when the companion extension becomes active. */
            if (notifyUser)
                this._notify(this._gettext('Cannot enable. Missing: ') + missing.join(', '));
            return;
        }

        if (await this._isActive())
            return;

        try {
            await this._run(['systemctl', '--user', 'start', UNIT]);
        } catch (e) {
            this._notify(this._gettext('Failed to start xremap: ') + e.message);
            return;
        }

        if (await this._isActive())
            this._notify(this._gettext('macOS keybindings enabled'));
        else
            this._notify(this._gettext('xremap did not start. Check: journalctl --user -u xremap.service'));
    }

    async _stop() {
        try {
            await this._run(['systemctl', '--user', 'stop', UNIT]);
        } catch (e) {
            this._notify(this._gettext('Failed to stop xremap: ') + e.message);
        }
    }

    async _isActive() {
        try {
            const out = await this._run(['systemctl', '--user', '--no-pager', 'is-active', UNIT]);
            return out.trim() === 'active';
        } catch (e) {
            // `is-active` exits non-zero when the unit is not active.
            return false;
        }
    }

    _companionActive() {
        try {
            const ext = Main.extensionManager.lookup(COMPANION_UUID);
            return !!ext && ext.state === ExtensionUtils.ExtensionState.ACTIVE;
        } catch (e) {
            return false;
        }
    }

    _run(argv) {
        return new Promise((resolve, reject) => {
            const proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    const [, stdout, stderr] = p.communicate_utf8_finish(res);
                    if (p.get_successful())
                        resolve(stdout ?? '');
                    else
                        reject(new Error((stderr ?? '').trim() || `exit status ${p.get_exit_status()}`));
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    _notify(message) {
        if (!this._settings.get_boolean('show-toast'))
            return;
        try {
            Main.notify(this._gettext('macOS Keybindings'), message);
        } catch (e) {
            // A notification failure must never affect the toggle.
            console.error(`macOS Keybindings: notify failed: ${e.message ?? e}`);
        }
    }
}

/** The switch of this extension in the grid of the quick settings menu. */
const KeybindingsToggle = GObject.registerClass(
class KeybindingsToggle extends QuickSettings.QuickToggle {
    _init(settings) {
        super._init({
            title: 'macOS Keybindings',
            iconName: 'input-keyboard-symbolic',
            toggleMode: true,
        });

        this._settings = settings;
        /* Two-way: a click on the switch writes the preference, and a change of
           the preference moves the switch. */
        this._settings.bind('enabled', this, 'checked', Gio.SettingsBindFlags.DEFAULT);
    }
});

/** The panel part and the switch of the extension. */
const KeybindingsIndicator = GObject.registerClass(
class KeybindingsIndicator extends QuickSettings.SystemIndicator {
    _init(settings) {
        super._init();

        this.quickSettingsItems.push(new KeybindingsToggle(settings));
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        this.quickSettingsItems = [];
        super.destroy();
    }
});

export default class MacOSKeybindingsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._serviceManager = new ServiceManager(this._settings, this.gettext.bind(this));

        this._settingsId = this._settings.connect('changed::enabled',
            () => this._serviceManager.update(true));
        this._stateId = Main.extensionManager.connect('extension-state-changed',
            (_manager, extension) => {
                if (extension.uuid === COMPANION_UUID)
                    this._serviceManager.update(false);
            });

        this._indicator = new KeybindingsIndicator(this._settings);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

        /* Reconcile the actual state of the service with the stored preference. */
        this._serviceManager.update(false);
    }

    disable() {
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
        if (this._stateId) {
            Main.extensionManager.disconnect(this._stateId);
            this._stateId = null;
        }

        this._indicator?.destroy();
        this._indicator = null;
        this._serviceManager = null;
        this._settings = null;
    }
}
