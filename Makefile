SHELL = /bin/sh

UUID = com.perosiledao.OdooPresence
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

# Archivos limpios que queremos instalar
SOURCES = extension.js \
          prefs.js \
          metadata.json \
          stylesheet.css \
          icon.svg \
          LICENSE

.PHONY: help install uninstall enable disable prefs zip clean

help:
	@echo "Commands:"
	@echo "  install    - Installs the extension (skips translations if gettext is missing)"
	@echo "  uninstall  - Uninstalls the extension"
	@echo "  enable     - Enables the extension"
	@echo "  disable    - Disables the extension"
	@echo "  prefs      - Opens the extension preferences"
	@echo "  zip        - Creates a clean zip file for distribution"

install:
	@echo "Installing extension..."
	
	# 1. Limpiar instalación anterior
	@rm -rf $(INSTALL_DIR)
	@mkdir -p $(INSTALL_DIR)
	
	# 2. Copiar código fuente limpio
	@cp $(SOURCES) $(INSTALL_DIR)
	
	# 3. Copiar y compilar Esquemas
	@mkdir -p $(INSTALL_DIR)/schemas
	@cp schemas/*.xml $(INSTALL_DIR)/schemas/
	@glib-compile-schemas $(INSTALL_DIR)/schemas
	
	# 4. Intentar compilar Traducciones (Solo si existe msgfmt)
	@mkdir -p $(INSTALL_DIR)/locale/es/LC_MESSAGES
	@if command -v msgfmt >/dev/null 2>&1; then \
		echo "Translating to Spanish..."; \
		msgfmt locale/es/LC_MESSAGES/$(UUID).po -o $(INSTALL_DIR)/locale/es/LC_MESSAGES/$(UUID).mo; \
	else \
		echo "⚠️  'msgfmt' not found. Skipping translations (English only)."; \
		echo "   (Install 'gettext' package to enable Spanish)"; \
	fi
	
	@echo "✅ Installation complete. Restart GNOME Shell (Alt+F2, 'r') if needed."

uninstall:
	@echo "Uninstalling extension..."
	@rm -rf $(INSTALL_DIR)
	@echo "Uninstallation complete."

enable:
	@gnome-extensions enable $(UUID)

disable:
	@gnome-extensions disable $(UUID)

prefs:
	@gnome-extensions prefs $(UUID)

zip:
	@echo "Packing extension..."
	@rm -f $(UUID).zip
	@zip -r $(UUID).zip . -x "*.git*" -x "images/*" -x "*.po" -x "*.pot" -x "*.zip" -x ".vscode/*"
	@echo "📦 Zip created: $(UUID).zip"

clean:
	@rm -f $(UUID).zip
	@rm -f schemas/gschemas.compiled
	@rm -f locale/es/LC_MESSAGES/*.mo