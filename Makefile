SHELL = /bin/sh

UUID = odoo-presence@perosiledao.com
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

# Archivos base
SOURCES = extension.js \
          prefs.js \
          metadata.json \
          stylesheet.css \
          icon.svg \
          LICENSE

.PHONY: install zip clean

install:
	@echo "🔍 Iniciando instalación..."
	
	# 1. Limpiar y crear directorios
	@rm -rf $(INSTALL_DIR)
	@mkdir -p $(INSTALL_DIR)/schemas
	@mkdir -p $(INSTALL_DIR)/locale/es/LC_MESSAGES
	
	# 2. Copiar archivos fuente
	@echo "📂 Copiando archivos base..."
	@cp $(SOURCES) $(INSTALL_DIR)
	
	# 3. GESTIÓN DE ESQUEMAS
	@echo "⚙️  Compilando esquemas..."
	@cp schemas/*.xml $(INSTALL_DIR)/schemas/
	@glib-compile-schemas $(INSTALL_DIR)/schemas
	
	# 4. TRADUCCIONES (Generar POT y Compilar MO)
	@if command -v xgettext >/dev/null 2>&1; then \
		echo "📝 Actualizando plantilla de traducción (.pot)..."; \
		xgettext --language=JavaScript --keyword=_ --from-code=UTF-8 --output=locale/$(UUID).pot extension.js prefs.js; \
		\
		echo "🌍 Compilando traducción al español (.mo)..."; \
		msgfmt locale/es/LC_MESSAGES/$(UUID).po -o $(INSTALL_DIR)/locale/es/LC_MESSAGES/$(UUID).mo; \
	else \
		echo "⚠️  Herramientas 'gettext' no encontradas. Saltando traducciones."; \
	fi
	
	@echo "✅ Instalación completada."
	@echo "⚠️  IMPORTANTE: Reinicia GNOME ahora (Alt+F2, pulsa 'r', Enter)."

zip:
	@echo "📦 Creando ZIP..."
	@rm -f $(UUID).zip
	@zip -r $(UUID).zip . -x "*.git*" -x "images/*" -x "Makefile" -x "*.po" -x "*.pot" -x "*.zip" -x ".vscode/*"

clean:
	@rm -f $(UUID).zip