import Adw from 'gi://Adw';

import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MacOSKeybindingsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const _ = this.gettext.bind(this);

        const page = new Adw.PreferencesPage({
            title: _('Preferences'),
            icon_name: 'preferences-desktop-keyboard-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: _('macOS Keybindings'),
            description: _('Toggle macOS-style keyboard shortcuts via xremap'),
        });

        const enabledRow = new Adw.SwitchRow({
            title: _('Enable macOS keybindings'),
            subtitle: _('Start or stop the xremap user service'),
            active: settings.get_boolean('enabled'),
        });
        enabledRow.connect('notify::active', row => {
            settings.set_boolean('enabled', row.active);
        });
        group.add(enabledRow);

        const toastRow = new Adw.SwitchRow({
            title: _('Show notifications'),
            subtitle: _('Show a desktop notification when toggling'),
            active: settings.get_boolean('show-toast'),
        });
        toastRow.connect('notify::active', row => {
            settings.set_boolean('show-toast', row.active);
        });
        group.add(toastRow);

        page.add(group);
        window.add(page);
    }
}
