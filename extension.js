/*
 * Odoo Presence Monitor
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

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const ICON_LOADING = 'network-transmit-receive-symbolic';
const ICON_CHECKED_IN = 'avatar-default-symbolic';
const ICON_CHECKED_OUT = 'system-log-out-symbolic';

/**
 * Main indicator button class located in the top panel.
 * Handles the UI rendering, networking state, and user interaction.
 */
const OdooIndicator = GObject.registerClass(
class OdooIndicator extends PanelMenu.Button {
    
    /**
     * @param {Gio.Settings} settings - The extension settings instance injected from the main class.
     */
    _init(settings) {
        super._init(0.0, _('Odoo Status'));

        // Store settings reference locally to avoid schema path resolution issues
        this._settings = settings;

        this._httpSession = new Soup.Session();
        this._timerId = null;
        this._liveTimerId = null;
        
        // Configuration state
        this._baseUrl = '';
        this._token = '';
        this._pin = '';
        
        this._employeeData = {
            name: _('Loading...'),
            hoursToday: 0.0,
            lastCheckIn: null
        };

        // Initialize Status Icon
        this._icon = new St.Icon({
            icon_name: ICON_CHECKED_OUT,
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        // Build the popup menu
        this._buildMenuCard();

        // Input Handling
        this.connect('event', (actor, event) => {
            if (event.type() === Clutter.EventType.BUTTON_PRESS) {
                const button = event.get_button();
                if (button === 1) {
                    // Left Click: Toggle Status
                    this._toggleAttendance();
                    return Clutter.EVENT_STOP;
                } else if (button === 3) {
                    // Right Click: Open Menu
                    this.menu.toggle();
                    return Clutter.EVENT_STOP;
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Listen for configuration changes to reload connection details
        this._settingsChangedId = this._settings.connect('changed', () => this._loadConfigAndStart());
        
        // Start polling
        this._loadConfigAndStart();
    }

    /**
     * Constructs the popup menu layout (Employee Card).
     */
    _buildMenuCard() {
        this._cardBox = new St.BoxLayout({
            vertical: true,
            style_class: 'odoo-card-box' 
        });

        this._avatarIcon = new St.Icon({
            icon_name: 'avatar-default-symbolic',
            icon_size: 64,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'odoo-avatar'
        });
        this._cardBox.add_child(this._avatarIcon);

        this._nameLabel = new St.Label({
            text: _('Loading...'),
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'odoo-name-label'
        });
        this._cardBox.add_child(this._nameLabel);

        this._cardBox.add_child(new PopupMenu.PopupSeparatorMenuItem());

        this._timerLabel = new St.Label({
            text: '--:--:--',
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'odoo-timer-label'
        });
        this._cardBox.add_child(this._timerLabel);

        this._lastActionLabel = new St.Label({
            text: _('Waiting for connection...'),
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'odoo-status-label'
        });
        this._cardBox.add_child(this._lastActionLabel);

        const item = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        item.actor.add_child(this._cardBox);
        this.menu.addMenuItem(item);
    }

    /**
     * loads settings from Gio.Settings and initializes the network polling timer.
     */
    _loadConfigAndStart() {
        const kioskUrl = this._settings.get_string('kiosk-url');
        this._employeeId = this._settings.get_int('employee-id');
        this._updateFreq = this._settings.get_int('update-frequency');
        this._pin = this._settings.get_string('employee-pin');

        try {
            if (kioskUrl.includes('/hr_attendance/')) {
                const parts = kioskUrl.split('/hr_attendance/');
                // Sanitize URL: remove trailing slashes and locale paths
                this._baseUrl = parts[0].replace(/\/$/, "").replace('/en', ''); 
                this._token = parts[1];
            } else {
                throw new Error("Invalid Kiosk URL format");
            }
        } catch (e) {
            this._icon.icon_name = 'dialog-error-symbolic';
            return;
        }

        // Reset network timer
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
        
        if (this._updateFreq > 0) {
            this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._updateFreq, () => {
                this._checkStatus();
                return GLib.SOURCE_CONTINUE;
            });
        }
        
        // Perform immediate check
        this._checkStatus();
    }

    /**
     * Executes a check-in or check-out request against the Odoo API.
     */
    async _toggleAttendance() {
        if (!this._baseUrl || this._employeeId === 0) return;
        
        // Set loading state
        this._icon.icon_name = ICON_LOADING;
        
        const url = `${this._baseUrl}/hr_attendance/manual_selection`;
        const body = {
            "id": 6, "jsonrpc": "2.0", "method": "call",
            "params": { "token": this._token, "employee_id": this._employeeId, "pin_code": this._pin }
        };
        
        this._sendRequest(url, body, (json) => {
            if (json.result) {
                this._updateCardData(json.result);
                
                // Handle desktop notifications based on response state
                const state = json.result.attendance_state; 
                const fullName = json.result.employee_name || "User";
                const firstName = fullName.split(' ')[0]; 
                
                if (state === 'checked_in') {
                    const greeting = this._getGreeting(); 
                    const checkInTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    
                    this._sendNotification(
                        `${greeting} ${firstName}`,
                        _('✅ Check-in registered at %s.\nHave a nice day!').replace('%s', checkInTime)
                    );
                } else {
                    const hours = this._formatHours(json.result.hours_today);
                    const hoursVal = json.result.hours_today;
                    let extraMsg = "";

                    if (hoursVal > 8) extraMsg = _("Great effort today! 🚀");
                    else if (hoursVal < 4) extraMsg = _("Short shift? 👌");
                    else extraMsg = _("Good job. 👏");

                    this._sendNotification(
                        _('🏠 See you soon, %s').replace('%s', firstName),
                        _('You have worked a total of %s today.\n%s').replace('%s', hours).replace('%s', extraMsg)
                    );
                }
            }
        });
    }

    /**
     * Returns a localized greeting string based on current hour.
     */
    _getGreeting() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return _("☀️ Good morning,");
        if (hour >= 12 && hour < 20) return _("👋 Good afternoon,");
        return _("🌙 Good evening,");
    }

    _sendNotification(title, body) {
        Main.notify(title, body);
    }

    /**
     * Queries Odoo for the current status without modifying it.
     */
    async _checkStatus() {
        if (!this._baseUrl) return;
        const url = `${this._baseUrl}/hr_attendance/employees_infos`;
        const body = {
            "id": 3, "jsonrpc": "2.0", "method": "call",
            "params": { "token": this._token, "limit": 24, "offset": 0, "domain": [] }
        };

        this._sendRequest(url, body, (json) => {
            if (json.result && json.result.records) {
                const emp = json.result.records.find(r => r.id === this._employeeId);
                if (emp) this._updateCardData(emp);
            }
        });
    }

    /**
     * Async wrapper for LibSoup requests.
     * @param {string} url - API Endpoint
     * @param {object} payload - JSON Body
     * @param {function} callback - Handler for successful response
     */
    async _sendRequest(url, payload, callback) {
        const message = Soup.Message.new('POST', url);
        const encoder = new TextEncoder();
        const bodyBytes = new GLib.Bytes(encoder.encode(JSON.stringify(payload)));
        
        message.set_request_body_from_bytes('application/json', bodyBytes);
        
        try {
            const bytes = await this._httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            if (message.status_code === 200) {
                const decoder = new TextDecoder();
                const json = JSON.parse(decoder.decode(bytes.get_data()));
                callback(json);
            }
        } catch (e) {
            console.error("Odoo Presence: Network Error", e);
            this._icon.icon_name = 'network-offline-symbolic';
        } finally {
            // Ensure UI consistency after manual actions
            if (url.includes('manual_selection')) this._checkStatus(); 
        }
    }

    /**
     * Updates UI elements and manages the live timer state.
     */
    _updateCardData(data) {
        const isCheckedIn = (data.attendance_state === 'checked_in') || (data.status === 'checked_in');
        
        this._icon.icon_name = isCheckedIn ? ICON_CHECKED_IN : ICON_CHECKED_OUT;
        this._icon.style = isCheckedIn ? 'color: #2ecc71;' : 'color: #e74c3c;';

        this._employeeData.name = data.employee_name || data.display_name || _('Employee');
        if (data.hours_today !== undefined) {
            this._employeeData.hoursToday = data.hours_today;
        }
        
        const lastCheck = data.attendance ? data.attendance.check_in : data.last_check_in;
        if (lastCheck) {
            this._employeeData.lastCheckIn = new Date(lastCheck.replace(" ", "T") + "Z");
        }

        this._nameLabel.text = this._employeeData.name;
        
        if (isCheckedIn) {
            this._lastActionLabel.text = _('Check-in: %s').replace('%s', this._formatTime(this._employeeData.lastCheckIn));
            
            this._timerLabel.remove_style_class_name('odoo-status-out');
            this._timerLabel.add_style_class_name('odoo-status-in');

            this._startLiveTimer();
        } else {
            this._lastActionLabel.text = _('Check-out registered');
            
            this._timerLabel.remove_style_class_name('odoo-status-in');
            this._timerLabel.add_style_class_name('odoo-status-out');

            this._stopLiveTimer();
            this._timerLabel.text = this._formatHours(this._employeeData.hoursToday);
        }
    }

    _startLiveTimer() {
        this._stopLiveTimer();
        this._updateLiveLabel();
        this._liveTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._updateLiveLabel();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopLiveTimer() {
        if (this._liveTimerId) {
            GLib.source_remove(this._liveTimerId);
            this._liveTimerId = null;
        }
    }

    _updateLiveLabel() {
        if (!this._employeeData.lastCheckIn) return;
        const now = new Date();
        const diffHours = (now - this._employeeData.lastCheckIn) / (1000 * 60 * 60);
        this._timerLabel.text = this._formatHours(this._employeeData.hoursToday + diffHours);
    }

    _formatHours(h) {
        if (!h) h = 0;
        const hrs = Math.floor(h);
        const min = Math.floor((h - hrs) * 60);
        const sec = Math.floor(((h - hrs) * 60 - min) * 60);
        return `${hrs.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
    }

    _formatTime(d) {
        return d ? d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--';
    }

    destroy() {
        this._stopLiveTimer();
        if (this._timerId) GLib.source_remove(this._timerId);
        if (this._settingsChangedId) this._settings.disconnect(this._settingsChangedId);
        super.destroy();
    }
});

export default class OdooPresenceExtension extends Extension {
    enable() {
        this.initTranslations('com.perosiledao.OdooPresence');
        
        // Retrieve settings object from the extension instance
        const settings = this.getSettings();
        
        // Inject settings into the indicator
        this._indicator = new OdooIndicator(settings);
        
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}