# Configuración Multi-Servidor

## Cambios Implementados

### 1. Base de Datos

- Se agregó la columna `guild_id` a la tabla `songs` para permitir playlists separadas por servidor

### 2. Backend (Server)

- Todas las funciones del bot ahora aceptan `guildId` como parámetro
- Se implementó un sistema de sesiones por servidor (guild sessions)
- Socket.IO usa "rooms" para separar las comunicaciones por servidor
- Cada servidor Discord tiene su propio estado de reproducción independiente

### 3. Frontend (Extension)

- Se agregó una pantalla inicial para ingresar el Discord Server ID
- El ID se guarda en `chrome.storage` y `localStorage`
- El content script (botones de YouTube) ahora también usa el guild_id guardado
- Socket se une automáticamente al "room" del servidor correcto

## Cómo Usar

### Primera Vez

1. Recarga la extensión después de hacer `npm run build`
2. Abre el popup de la extensión
3. Ingresa tu Discord Server ID (Guild ID)
4. Presiona Enter

### Obtener tu Discord Server ID

1. En Discord, activa el "Modo Desarrollador":
   - Settings → App Settings → Advanced → Developer Mode (ON)
2. Haz clic derecho en el icono de tu servidor
3. Click en "Copiar ID"
4. Pega ese ID en la extensión

### Cambiar de Servidor

1. Limpia el storage desde las DevTools de la extensión:
   ```javascript
   chrome.storage.local.clear()
   localStorage.clear()
   ```
2. Recarga la extensión
3. Ingresa el nuevo Server ID

## Arquitectura Técnica

### Flujo de Datos

```
Extension Popup (guildId)
    ↓ (chrome.storage)
Content Script (lee guildId)
    ↓ (socket.emit con room)
Server (mantiene sesiones por guildId)
    ↓ (io.to(guildId).emit)
Solo clientes del mismo servidor reciben updates
```

### Ventajas

- ✅ Múltiples servidores pueden usar el mismo bot simultáneamente
- ✅ Cada servidor tiene su propia playlist independiente
- ✅ No hay conflictos entre servidores
- ✅ El bot puede estar en múltiples canales de voz al mismo tiempo

### Lavalink y Concurrencia

- Lavalink maneja múltiples streams de audio simultáneamente
- Node.js gestiona eventos de forma asíncrona (no necesita threads)
- Cada servidor tiene su propio "player" de Shoukaku
- El estado de reproducción se mantiene separado por guild_id

## Solución de Problemas

### El content script no agrega canciones

- Verifica que hayas configurado el guild_id en el popup
- Abre las DevTools de la página de YouTube (F12)
- En Console, busca mensajes con `[CONTENT]`
- Verifica que `currentGuildId` no sea null

### El popup no se conecta

- Verifica que el servidor esté corriendo (`npm run dev` en `/server`)
- Verifica que Lavalink esté corriendo (`./run-lavalink.sh`)
- Verifica la URL del servidor en las variables de entorno

### Las canciones van al servidor equivocado

- Verifica el guild_id en chrome.storage:
  ```javascript
  chrome.storage.local.get(['discord_guild_id'], console.log)
  ```
