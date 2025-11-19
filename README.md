![GNOME Shell 46+](https://img.shields.io/badge/GNOME%20Shell-46%2B-blue?style=flat-square&logo=gnome)
![License GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square)

# Odoo Presence Monitor for GNOME Shell

A native GNOME Shell extension to monitor your Odoo HR Presence status, track worked hours, and check-in/check-out directly from the top bar.


## ✨ Features

* **Real-time Status:** Visual indicator in the top bar showing if you are checked in (Green) or checked out (Red).
* **Smart Card Menu:** Click the icon to view a summary card with:
    * Employee Name.
    * **Live Timer:** Shows seconds ticking while you work.
    * Exact time of last Check-In or Check-Out.
* **Native Notifications:** Get greeted ("Good morning") when you sign in and see a summary of your hours when you sign out.
* **User Selection:** Easy setup in Preferences to load and select your user from your Odoo instance.
* **Security:** Supports Employee PIN codes.
* **Configurable:** Customizable refresh intervals.

## ✅ Compatibility

This extension is built using modern **ESM (ECMAScript Modules)** standards.

| GNOME Shell Version | Status | Notes |
| :--- | :---: | :--- |
| **49** | ✅ | **Tested & Supported** |
| **48** | ✅ | **Tested & Supported** |
| **46 - 47** | ⚠️ | *Untested* (Should work, but not verified) |
| **< 45** | ❌ | Not supported (Legacy imports) |

**Note:** Requires `libadwaita` and `gtk4` installed on your system for the Preferences window.

## 🚀 Installation

### From Source
1.  Download or clone this repository into your local extensions folder:
    ```bash
    cd ~/.local/share/gnome-shell/extensions/
    git clone [https://github.com/perosiledao/OdooPresence](https://github.com/perosiledao/OdooPresence) com.perosiledao.OdooPresence
    ```
2.  Compile the schemas:
    ```bash
    cd com.perosiledao.OdooPresence
    glib-compile-schemas schemas/
    ```
3.  Compile translations (optional but recommended):
    ```bash
    msgfmt locale/es/LC_MESSAGES/com.perosiledao.OdooPresence.po -o locale/es/LC_MESSAGES/com.perosiledao.OdooPresence.mo
    ```
4.  Restart GNOME Shell (`Alt`+`F2`, type `r`, `Enter` on X11, or Logout/Login on Wayland).
5.  Enable the extension using **Extension Manager** or the **Extensions** app.

## ⚙️ Configuration

To make this extension work, you need your **Odoo Kiosk URL**.

1.  Open the extension **Preferences**.
2.  **Kiosk URL**: Go to your Odoo instance -> *Attendance* -> *Kiosk Mode*. Copy the full URL from your browser address bar.
    * It should look like: `https://your-company.odoo.com/hr_attendance/TOKEN12345`
3.  **Load Employees**: Click the "Load employee list" button.
4.  **Select User**: Choose your name from the dropdown list.
5.  **PIN**: If your user requires a PIN code to sign in, enter it in the Security section.

## 🌍 Contributing Translations

Help us translate Odoo Presence Monitor into your language!

We use the standard GNU `gettext` system.

### How to add a new language
1.  **Install a PO Editor:** We recommend [Poedit](https://poedit.net/), which is free and easy to use.
2.  **Open the Template:** Download the file `locale/com.perosiledao.OdooPresence.pot` from this repository.
3.  **Create Translation:** Open the `.pot` file in Poedit and click "Create new translation". Select your language (e.g., French).
4.  **Translate:** Fill in the strings.
5.  **Save:** Save the file as `com.perosiledao.OdooPresence.po`.
6.  **Submit:** Create a Pull Request with your new file placed in:
    `locale/YOUR_LANG_CODE/LC_MESSAGES/com.perosiledao.OdooPresence.po`

    *Example for French:* `locale/fr/LC_MESSAGES/com.perosiledao.OdooPresence.po`

### How to update an existing language
1.  Open the existing `.po` file for your language.
2.  In Poedit, go to **Translation** -> **Update from POT file...**
3.  Select the latest `com.perosiledao.OdooPresence.pot` from the repo.
4.  Translate any new strings and submit a Pull Request.


## 📄 License

Distributed under the GPL-3.0 License. See `LICENSE` for more information.

---
**Note:** This extension is not affiliated with Odoo S.A.