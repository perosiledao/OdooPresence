/*
 * Odoo Presence Monitor Preferences
 *
 * Copyright (C) 2025 Marcos Garcia
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0'; 
import GLib from 'gi://GLib';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class OdooPresencePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this.initTranslations('org.gnome.shell.extensions.odoo-presence');        
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        // --- Connection Settings Group ---
        const groupConnection = new Adw.PreferencesGroup({
            title: _('Odoo Connection'),
            description: _('Configure Kiosk URL and select user.'),
        });
        page.add(groupConnection);

        // Kiosk URL Input
        const rowKioskUrl = new Adw.ActionRow({ title: _('Kiosk URL (Full)') });
        groupConnection.add(rowKioskUrl);
        
        const entryKioskUrl = new Gtk.Entry({
            valign: Gtk.Align.CENTER,
            hexpand: true,
            text: settings.get_string('kiosk-url'),
            placeholder_text: 'https://.../hr_attendance/TOKEN'
        });
        rowKioskUrl.add_suffix(entryKioskUrl);
        settings.bind('kiosk-url', entryKioskUrl, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Employee Dropdown
        const rowEmployee = new Adw.ComboRow({
            title: _('Select Employee'),
            subtitle: _('Current ID: ') + settings.get_int('employee-id'),
            model: new Gtk.StringList()
        });
        groupConnection.add(rowEmployee);

        // Map to store Odoo IDs correlated with the dropdown index
        let employeeMap = []; 

        // Fetch Button
        const btnLoad = new Gtk.Button({
            label: _('Load employee list'),
            valign: Gtk.Align.CENTER,
            margin_top: 10,
            margin_bottom: 10
        });
        groupConnection.add(btnLoad);

        // Logic to fetch employees from Odoo API
        btnLoad.connect('clicked', async () => {
            btnLoad.sensitive = false;
            btnLoad.label = _('Loading...');
            
            try {
                const kioskUrl = entryKioskUrl.text;
                
                // Basic validation
                if (!kioskUrl || !kioskUrl.includes('/hr_attendance/')) {
                    throw new Error("Invalid URL (missing /hr_attendance/)");
                }
                
                // Extract Base URL and Token
                const parts = kioskUrl.split('/hr_attendance/');
                const baseUrl = parts[0].replace(/\/$/, "").replace('/en', '');
                const token = parts[1];
                const apiUrl = `${baseUrl}/hr_attendance/employees_infos`;

                // Prepare Network Request
                const session = new Soup.Session();
                const msg = Soup.Message.new('POST', apiUrl);
                
                const body = {
                    "id": 1, 
                    "jsonrpc": "2.0", 
                    "method": "call", 
                    "params": { "token": token, "limit": 100, "offset": 0, "domain": [] }
                };
                
                // Encode JSON body to bytes
                const encoder = new TextEncoder();
                const bodyBytes = new GLib.Bytes(encoder.encode(JSON.stringify(body)));
                msg.set_request_body_from_bytes('application/json', bodyBytes);
                
                // Execute Request (Wrapped in Promise for async/await compatibility in GJS)
                const bytes = await new Promise((resolve, reject) => {
                    session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                            try {
                                if (msg.status_code === 200) {
                                    resolve(session.send_and_read_finish(result));
                                } else {
                                    reject(new Error(`HTTP Error ${msg.status_code}`));
                                }
                            } catch (err) { reject(err); }
                        }
                    );
                });
                
                // Parse Response
                const decoder = new TextDecoder();
                const json = JSON.parse(decoder.decode(bytes.get_data()));

                if (json.result && json.result.records) {
                    const stringList = new Gtk.StringList();
                    employeeMap = [];

                    // Populate Dropdown
                    json.result.records.forEach((emp) => {
                        const name = emp.display_name || emp.employee_name || _("Unknown");
                        stringList.append(name);
                        employeeMap.push(emp.id);
                    });

                    rowEmployee.model = stringList;
                    // TRANSLATORS: %d is the number of employees loaded
                    rowEmployee.subtitle = _('%d employees loaded.').replace('%d', json.result.records.length);
                } else {
                    throw new Error("Empty response from Odoo");
                }

            } catch (e) {
                console.error(e);
                rowEmployee.subtitle = _('Error: ') + e.message;
            } finally {
                btnLoad.sensitive = true;
                btnLoad.label = _('Load employee list');
            }
        });

        // Handle User Selection
        rowEmployee.connect('notify::selected', () => {
            const index = rowEmployee.selected;
            if (index >= 0 && index < employeeMap.length) {
                const odooId = employeeMap[index];
                settings.set_int('employee-id', odooId);
                rowEmployee.subtitle = _('Selected ID: ') + odooId;
            }
        });

        // --- Security Group ---
        const groupAuth = new Adw.PreferencesGroup({ title: _('Security') });
        page.add(groupAuth);
        
        const rowPin = new Adw.ActionRow({ title: _('Employee PIN') });
        groupAuth.add(rowPin);
        
        const entryPin = new Gtk.PasswordEntry({
            valign: Gtk.Align.CENTER,
            hexpand: true,
            text: settings.get_string('employee-pin')
        });
        rowPin.add_suffix(entryPin);
        settings.bind('employee-pin', entryPin, 'text', Gio.SettingsBindFlags.DEFAULT);
        
        // --- Synchronization Group ---
        const groupSync = new Adw.PreferencesGroup({ title: _('Synchronization') });
        page.add(groupSync);
        
        const rowFreq = new Adw.ActionRow({ title: _('Frequency (seconds)') });
        groupSync.add(rowFreq);
        
        const spinFreq = new Gtk.SpinButton({
            valign: Gtk.Align.CENTER,
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 3600, step_increment: 10 }),
            value: settings.get_int('update-frequency')
        });
        rowFreq.add_suffix(spinFreq);
        settings.bind('update-frequency', spinFreq, 'value', Gio.SettingsBindFlags.DEFAULT);
    }
}