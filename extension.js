// Imprescindible para definir una extensión
import {Extension} from 'resource:///org/gnome/shell/extensions/main.js';

// Librerías para la Interfaz de Usuario (UI)
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as GObject from 'gi://GObject';
import * as St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

// Librerías para la petición de red (HTTP)
import * as Soup from 'gi://Soup?version=3.0';
import * as GLib from 'gi://GLib';

// --- CONFIGURACIÓN ---
// ¡¡CAMBIA ESTOS VALORES POR LOS TUYOS!!
const YOUR_EMPLOYEE_ID = 1;       // Reemplaza con tu ID de empleado
const YOUR_PIN = '1234';          // Reemplaza con tu PIN
const ODOO_TOKEN = 'fd6a2868-c5ee-4faf-9fca-6581dfa7662b';
const ODOO_URL = 'https://worldsatnet.odoo.com/en/hr_attendance/' + ODOO_TOKEN;

// Iconos que usaremos (son nombres de iconos estándar de GNOME)
const ICON_CHECKED_IN = 'presence-available-symbolic'; // Un círculo verde/disponible
const ICON_CHECKED_OUT = 'presence-offline-symbolic'; // Un círculo rojo/desconectado

// Creamos un nuevo "botón" para la barra de tareas
const OdooIndicator = GObject.registerClass(
class OdooIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Odoo Fichador', false);

        // 1. Creamos el icono
        this._icon = new St.Icon({
            icon_name: ICON_CHECKED_OUT, // Empezamos en rojo (se corregirá al instante)
            style_class: 'system-status-icon',
        });
        
        this.add_child(this._icon);

        // 2. Conectamos la señal de "clic" a nuestra función de FICHAR
        this.connect('button-press-event', () => this._checkInOrOut());
        
        // Preparamos la sesión de red
        this._httpSession = Soup.Session.new();

        // --- NUEVO ---
        // 3. Al iniciar, comprobamos el estado actual
        this._fetchInitialState();
    }

    // --- NUEVA FUNCIÓN ---
    // Petición para saber el estado INICIAL al cargar la extensión
    _fetchInitialState() {
        // Preparamos los datos de la petición (la que nos diste)
        const params = {
            token: ODOO_TOKEN,
            limit: 24,
            offset: 0,
            domain: [],
        };

        const payload = {
            id: Math.floor(Math.random() * 10000), // ID aleatorio
            jsonrpc: '2.0',
            method: 'call',
            params: params,
        };

        // Creamos el mensaje HTTP
        const message = Soup.Message.new_request(
            'POST',
            GLib.Uri.parse(ODOO_URL, GLib.UriFlags.NONE)
        );

        const jsonPayload = JSON.stringify(payload);
        const bytes = GLib.Bytes.new(jsonPayload, jsonPayload.length);

        message.set_request_body_from_bytes(bytes);
        message.get_request_headers().append('Content-Type', 'application/json');

        console.log('OdooApplet: Enviando petición de estado inicial...');

        // 4. Enviamos la petición de forma asíncrona
        this._httpSession.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            null, // CancellationToken
            (session, result) => {
                // Esta es la función "callback", se ejecuta cuando Odoo responde
                try {
                    if (message.get_status() === Soup.Status.OK) {
                        const responseBytes = session.send_and_read_finish(result);
                        this._handleInitialStateResponse(responseBytes); // Llamamos al NUEVO manejador
                    } else {
                        console.error('OdooApplet: Error HTTP (estado inicial): ' + message.get_status());
                        this._updateIcon('error');
                    }
                } catch (e) {
                    console.error('OdooApplet: Error al procesar respuesta inicial: ' + e);
                    this._updateIcon('error');
                }
            }
        );
    }
    
    // --- NUEVA FUNCIÓN ---
    // Procesamos la respuesta INICIAL
    _handleInitialStateResponse(responseBytes) {
        const responseText = new TextDecoder().decode(responseBytes.get_data());
        const responseJson = JSON.parse(responseText);

        if (responseJson.result && responseJson.result.records) {
            const records = responseJson.result.records;
            
            // Buscamos nuestro empleado en la lista de resultados
            const myRecord = records.find(record => record.id === YOUR_EMPLOYEE_ID);

            if (myRecord) {
                // Usamos el campo "status" que nos da esta respuesta
                const status = myRecord.status; 
                console.log('OdooApplet: Estado inicial obtenido: ' + status);
                this._updateIcon(status); // 'checked_in' o 'checked_out'
            } else {
                console.error(`OdooApplet: No se encontró el empleado con ID ${YOUR_EMPLOYEE_ID} en la respuesta inicial.`);
                this._updateIcon('error');
            }
        } else if (responseJson.error) {
            console.error('OdooApplet: Error de Odoo (estado inicial): ' + responseJson.error.message);
            this._updateIcon('error');
        }
    }


    // -------------------------------------------------------------------
    // --- LÓGICA DE CLIC (FICHAR/SALIR) - ESTO NO CAMBIA ---
    // -------------------------------------------------------------------

    // Esta función se llama al hacer CLIC (usa el PIN)
    _checkInOrOut() {
        // Preparamos los datos de la petición (tu JSON)
        const params = {
            token: ODOO_TOKEN,
            employee_id: YOUR_EMPLOYEE_ID,
            pin_code: YOUR_PIN,
            latitude: 28.1083904,
            longitude: -15.4402816,
        };

        const payload = {
            id: Math.floor(Math.random() * 10000), 
            jsonrpc: '2.0',
            method: 'call',
            params: params,
        };

        const message = Soup.Message.new_request(
            'POST',
            GLib.Uri.parse(ODOO_URL, GLib.UriFlags.NONE)
        );

        const jsonPayload = JSON.stringify(payload);
        const bytes = GLib.Bytes.new(jsonPayload, jsonPayload.length);

        message.set_request_body_from_bytes(bytes);
        message.get_request_headers().append('Content-Type', 'application/json');

        console.log('OdooApplet: Enviando a Odoo (clic)...');

        this._httpSession.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            null,
            (session, result) => {
                try {
                    if (message.get_status() === Soup.Status.OK) {
                        const responseBytes = session.send_and_read_finish(result);
                        this._handleCheckInOutResponse(responseBytes); // Manejador de la respuesta de CLIC
                    } else {
                        console.error('OdooApplet: Error HTTP (clic): ' + message.get_status());
                        this._updateIcon('error');
                    }
                } catch (e) {
                    console.error('OdooApplet: Error al procesar la respuesta de Odoo (clic): ' + e);
                    this._updateIcon('error');
                }
            }
        );
    }

    // Procesamos la respuesta del CLIC
    _handleCheckInOutResponse(responseBytes) {
        const responseText = new TextDecoder().decode(responseBytes.get_data());
        const responseJson = JSON.parse(responseText);

        if (responseJson.result) {
            // Usamos el campo "attendance_state" que da esta respuesta
            const state = responseJson.result.attendance_state;
            console.log('OdooApplet: Respuesta de Odoo (clic): ' + state);
            this._updateIcon(state);
        } else if (responseJson.error) {
            console.error('OdooApplet: Error de Odoo (clic): ' + responseJson.error.message);
            this._updateIcon('error');
        }
    }

    // 6. Actualizamos el icono según el estado
    // (Esta función ahora sirve para AMBAS respuestas)
    _updateIcon(state) {
        if (state === 'checked_in') {
            this._icon.icon_name = ICON_CHECKED_IN;
        } else {
            // 'checked_out' o cualquier error
            this._icon.icon_name = ICON_CHECKED_OUT;
        }
    }

    // Función de limpieza
    stop() {
        if (this._httpSession) {
            this._httpSession.abort();
            this._httpSession = null;
        }
    }
});


// --- Clase principal de la Extensión ---
export default class OdooPresenceExtension extends Extension {
    enable() {
        this._indicator = new OdooIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.stop();
        this._indicator.destroy();
        this._indicator = null;
    }
}