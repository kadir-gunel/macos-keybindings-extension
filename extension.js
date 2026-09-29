import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ExtensionUtils from 'resource:///org/gnome/shell/misc/extensionUtils.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const XREMAP_BINARY = '/usr/bin/xremap';
const COMPANION_UUID = 'xremap@k0kubun.com';
const UNIT = 'xremap.service';

class ServiceManager {
    constructor(settings, gettext) {
        this._settings = settings;
        this._gettext = gettext;
        this._chain = Promise.resolve();
    }

    /** Serialize toggles so rapid switching cannot interleave systemctl calls. */
    update() {
        this._chain = this._chain
            .then(() => this._apply())
            .catch(e => console.error(`macOS Keybindings: ${e.message ?? e}`));
        return this._chain;
    }

    async _apply() {
        if (this._settings.get_boolean('enabled'))
            await this._enable();
        else
            await this._stop();
    }

    async _enable() {
        const missing = [];
        if (!GLib.file_test(XREMAP_BINARY, GLib.FileTest.EXISTS))
            missing.push(this._gettext('xremap binary (/usr/bin/xremap)'));
        if (!this._companionActive())
            missing.push(this._gettext(`the ${COMPANION_UUID} extension`));

        if (missing.length > 0) {
            this._settings.set_boolean('enabled', false);
            await this._stop();
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

export default class MacOSKeybindingsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._serviceManager = new ServiceManager(this._settings, this.gettext.bind(this));
        this._handlerId = this._settings.connect('changed::enabled', () => {
            this._serviceManager.update();
        });
        // Reconcile actual service state with the stored preference.
        this._serviceManager.update();
    }

    disable() {
        if (this._handlerId) {
            this._settings.disconnect(this._handlerId);
            this._handlerId = null;
        }
        this._serviceManager = null;
        this._settings = null;
    }
}
