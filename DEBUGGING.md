# Guía de Depuración - Discord Music Player

## Problema Actual

Los botones no aparecen en YouTube después del build.

## Pasos para Depurar

### 1. Verificar que la extensión esté cargada

1. Abre Chrome y ve a `chrome://extensions/`
2. Asegúrate de que "Modo de desarrollador" esté activado
3. Busca "Discord Music Player Extension"
4. Si no está, haz clic en "Cargar extensión sin empaquetar" y selecciona `extension/dist/`
5. Si ya está cargada, haz clic en el botón de recarga (ícono circular)

### 2. Verificar errores en la consola del content script

1. Abre YouTube en una nueva pestaña
2. Presiona F12 para abrir DevTools
3. Ve a la pestaña "Console"
4. Busca mensajes que empiecen con `[CONTENT]`
5. **Deberías ver:**
   ```
   [CONTENT] Discord Music Player Content Script Loaded
   [CONTENT] Connecting to server: http://localhost:3000
   [CONTENT] MutationObserver started
   ```
6. **Si ves errores**, cópialos y compártelos

### 3. Verificar que el servidor esté corriendo

1. En la terminal donde corre `npm run dev`, deberías ver:
   ```
   [SERVER] Server running on port 3000
   [SERVER] Socket.io ready for connections
   ```
2. Cuando abras YouTube, deberías ver:
   ```
   [SOCKET] New client connected: <socket-id>
   ```

### 4. Verificar archivos en dist/

Ejecuta en la terminal:

```bash
cd extension
ls -la dist/src/
cat dist/manifest.json
```

Deberías ver:

- `content.js` (debe existir)
- `background.js` (debe existir)
- `popup.js` (debe existir)

### 5. Verificar que Socket.io se cargue

En la consola de YouTube (F12), ejecuta:

```javascript
console.log(window.io)
```

Si devuelve `undefined`, significa que Socket.io no se cargó correctamente.

### 6. Verificar el manifest

El archivo `dist/manifest.json` debe tener:

```json
"content_scripts": [
  {
    "matches": ["*://*.youtube.com/*"],
    "js": ["src/content.js"]
  }
]
```

## Posibles Soluciones

### Si el content script no se carga:

1. Recarga la extensión en `chrome://extensions/`
2. Cierra y vuelve a abrir la pestaña de YouTube
3. Verifica que no haya errores de permisos en la consola

### Si Socket.io no se conecta:

1. Verifica que el servidor esté corriendo (`npm run dev` en `server/`)
2. Verifica que el puerto sea 3000
3. Revisa los logs del servidor para ver si hay errores

### Si los botones no aparecen pero no hay errores:

1. Inspecciona el elemento en YouTube donde deberían aparecer los botones
2. Busca el selector `#actions #top-level-buttons-computed`
3. Verifica que ese elemento exista en la página

## Logs Esperados

### En el servidor:

```
[SERVER] Starting Discord Music Player Server...
[INIT] Initializing database...
[INIT] Database initialized successfully
[INIT] Initializing Discord bot...
[INIT] Discord bot initialized successfully
[SERVER] Server running on port 3000
[SERVER] Socket.io ready for connections
```

### En YouTube (consola):

```
[CONTENT] Discord Music Player Content Script Loaded
[CONTENT] Connecting to server: http://localhost:3000
[CONTENT] MutationObserver started
[CONTENT] Connected to Discord Music Player Server
[CONTENT] Socket ID: <id>
[CONTENT] Injecting buttons into YouTube UI
[CONTENT] Buttons injected successfully
```

### En el popup de la extensión:

```
[APP] Discord Music Player Extension starting...
[APP] Server URL: http://localhost:3000
[APP] Initializing Socket.io connection...
[APP] Connected to server
[APP] Socket ID: <id>
[APP] Requesting playlist...
[APP] Received playlist_updated event with X songs
```
