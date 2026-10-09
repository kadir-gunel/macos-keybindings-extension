import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ExtensionUtils from 'resource:///org/gnome/shell/misc/extensionUtils.js';

import { SystemdUnit } from './systemdUnit.js';

const XREMAP_BINARY = '/usr/bin/xremap';
const COMPANION_UUID = 'xremap@k0kubun.com';
const UNIT = 'xremap.service';

/** Keep the actual state of the xremap service equal to the stored preference. */
export class ServiceManager {
    constructor(settings, gettext) {
        this._settings = settings;
        this._gettext = gettext;
        this._service = new SystemdUnit(UNIT);
        this._chain = Promise.resolve();
    }

    /** Serialize toggles so rapid switching cannot interleave service calls. */
    update(notifyUser = false) {
        this._chain = this._chain
            .then(() => this._apply(notifyUser))
            .catch(e => console.error(`macOS Keybindings: ${e.message ?? e}`));
        return this._chain;
    }

    destroy() {
        this._service.destroy();
        this._service = null;
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

        if (await this._service.isActive())
            return;

        try {
            await this._service.start();
        } catch (e) {
            this._notify(this._gettext('Failed to start xremap: ') + e.message);
            return;
        }

        if (await this._service.isActive())
            this._notify(this._gettext('macOS keybindings enabled'));
        else
            this._notify(this._gettext('xremap did not start. Check: journalctl --user -u xremap.service'));
    }

    async _stop() {
        try {
            await this._service.stop();
        } catch (e) {
            this._notify(this._gettext('Failed to stop xremap: ') + e.message);
        }
    }

    _companionActive() {
        const extension = Main.extensionManager.lookup(COMPANION_UUID);
        return !!extension && extension.state === ExtensionUtils.ExtensionState.ACTIVE;
    }

    _notify(message) {
        if (!this._settings.get_boolean('show-toast'))
            return;
        Main.notify(this._gettext('macOS Keybindings'), message);
    }
}
