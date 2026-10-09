import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { ServiceManager } from './serviceManager.js';

const COMPANION_UUID = 'xremap@k0kubun.com';

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

        this._indicator.destroy();
        this._indicator = null;
        this._serviceManager.destroy();
        this._serviceManager = null;
        this._settings = null;
    }
}
