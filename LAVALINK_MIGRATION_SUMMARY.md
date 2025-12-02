# Resumen: Migración a Lavalink y Sistema de Reproducción

## Fecha: 2025-12-02

## Objetivo Principal

Migrar el bot de Discord de reproducción directa de audio a **Lavalink** con **Shoukaku v4**, implementando un sistema de cola (queue) y barra de progreso en tiempo real.

---

## Problemas Resueltos

### 1. **Integración con Lavalink**

- **Problema inicial**: `RestError: Bad Request` al llamar `player.playTrack`
- **Causa**: Estructura incorrecta del argumento. Shoukaku v4 espera `{ track: { encoded: string } }` en lugar de `{ track: string }`
- **Solución**: Actualizar llamada a `player.playTrack({ track: { encoded: track.encoded } })`

### 2. **Error "Please sign in" de YouTube**

- **Problema**: Lavalink devolvía error al intentar reproducir videos de YouTube
- **Causa**: El cliente WEB de YouTube bloqueaba las solicitudes
- **Solución**:
  - Agregar plugin `dev.lavalink.youtube:youtube-plugin:1.16.0` en `application.yml`
  - Configurar clientes alternativos: `ANDROID_VR`, `MUSIC`, `ANDROID_TESTSUITE`
  - Deshabilitar fuente YouTube nativa (`youtube: false`)

### 3. **ScriptExtractionException**

- **Problema**: Error al parsear el script del player de YouTube
- **Solución**: Usar cliente `ANDROID_VR` como primario, que es más estable

### 4. **Reproducción de Playlist en lugar de Video Específico**

- **Problema**: URLs con `&list=...` reproducían siempre el primer video de la playlist
- **Causa**: Lavalink resolvía toda la playlist y tomábamos `tracks[0]`
- **Solución**: Sanitizar URLs para extraer solo el parámetro `v` (video ID)

```typescript
let cleanUrl = url
if (url.includes('youtube.com') || url.includes('youtu.be')) {
  const urlObj = new URL(url)
  if (urlObj.searchParams.has('v')) {
    cleanUrl = `https://www.youtube.com/watch?v=${urlObj.searchParams.get('v')}`
  }
}
```

### 5. **Sistema de Cola (Queue)**

- **Implementación**:
  - Orden FIFO (First In, First Out) con `ORDER BY id ASC`
  - Auto-reproducción al terminar una canción
  - Detección de razón de finalización (`trackEnd` event con `reason`)
  - Ignorar auto-queue cuando `reason === 'replaced'` (cambio manual)

### 6. **Conexión Duplicada al Cambiar Canciones**

- **Problema**: Error "This guild already have an existing connection"
- **Solución**: Reutilizar el player existente en lugar de crear uno nuevo

```typescript
let player = existingPlayer
if (!player) {
  player = await shoukaku.joinVoiceChannel({ ... })
  // Solo adjuntar listeners en nuevo player
}
```

### 7. **Barra de Progreso en Tiempo Real**

- **Problema inicial**: La barra se actualizaba cada 5 segundos
- **Causa**: `player.position` en Shoukaku **NO se actualiza automáticamente**
- **Solución**: Implementar tracking manual de posición con timestamps

```typescript
let lastKnownPosition = 0
let lastUpdateTime = Date.now()
let isPlaying = false

export function getPlayerPosition() {
  if (isPlaying) {
    const elapsed = Date.now() - lastUpdateTime
    return lastKnownPosition + elapsed
  }
  return lastKnownPosition
}

export function updatePlayerState(playing: boolean, position?: number) {
  isPlaying = playing
  if (position !== undefined) {
    lastKnownPosition = position
  }
  lastUpdateTime = Date.now()
}
```

### 8. **Seek (Salto de Posición)**

- **Problema**: Al hacer seek, la barra volvía a la posición anterior
- **Solución**: Actualizar `lastKnownPosition` inmediatamente después del seek

```typescript
export async function seekSong(position: number) {
  await player.update({ position })
  updatePlayerState(isPlaying, position) // Actualizar tracking
}
```

### 9. **Pausa Reiniciaba la Barra**

- **Problema**: Al pausar, la barra volvía a 0
- **Solución**: Preservar la posición actual antes de pausar

```typescript
socket.on('pause_song', () => {
  const currentPosition = getPlayerPosition()
  pauseSong()
  updatePlayerState(false, currentPosition) // Preservar posición
})
```

### 10. **Frecuencia de Actualización**

- **Configuración final**: Servidor emite `player_update` cada **100ms** para actualizaciones en tiempo real
- **Frontend**: Muestra directamente las actualizaciones del servidor (sin interpolación local)
- **Seek grace period**: 2 segundos de ignorar actualizaciones del servidor después de un seek para evitar "saltos"

---

## Arquitectura Final

### Backend (`server/src/`)

#### `bot.ts`

- Inicialización de Shoukaku con Lavalink
- Funciones: `playSong`, `pauseSong`, `resumeSong`, `stopSong`, `seekSong`
- **Tracking manual de posición**: `getPlayerPosition()`, `updatePlayerState()`
- Event listeners: `start`, `end`, `exception`
- Sanitización de URLs de YouTube

#### `index.ts`

- Socket.io para comunicación en tiempo real
- Intervalo de 100ms para emitir `player_update` a todos los clientes
- Manejo de eventos: `play_song`, `pause_song`, `resume_song`, `skip_song`, `seek_song`
- Sistema de cola automático con listener `audioEvents.on('trackEnd')`
- Preservación de posición en pause/resume

#### `lavalink/application.yml`

```yaml
plugins:
  youtube:
    enabled: true
    clients:
      - ANDROID_VR
      - WEB
lavalink:
  plugins:
    - dependency: 'dev.lavalink.youtube:youtube-plugin:1.16.0'
  server:
    sources:
      youtube: false # Deshabilitar fuente nativa
```

### Frontend (`extension/src/`)

#### `App.tsx`

- Socket.io client conectado al servidor
- Listener `player_update` para actualizaciones en tiempo real (cada 100ms)
- Barra de progreso (`<input type="range">`) con seek
- Grace period de 2s después de seek (`ignoreUpdatesUntilRef`)
- Formateo de tiempo: `mm:ss`

---

## Comandos Importantes

### Servidor

```bash
cd server
npm run dev                    # Desarrollo con nodemon
./run-lavalink.sh             # Iniciar Lavalink (puerto 2333)
```

### Extensión

```bash
cd extension
npm run build                  # Build para producción
```

---

## Configuración de Entorno

### `.env` (server)

```
DISCORD_TOKEN=tu_token_aqui
PORT=3000
```

### Lavalink

- **Puerto**: 2333
- **Password**: `youshallnotpass` (hardcoded, pendiente mover a .env)
- **Guild ID**: `645090017609252875` (hardcoded en bot.ts)

---

## Pendientes / Mejoras Futuras

1. **Seguridad**: Mover password de Lavalink y Guild ID a variables de entorno
2. **poToken**: Implementar si YouTube bloquea los clientes actuales
3. **Error Handling**: Mejorar manejo de errores en track exceptions
4. **Multi-guild**: Soportar múltiples servidores de Discord
5. **Persistencia**: Guardar estado de reproducción en caso de reinicio

---

## Lecciones Aprendidas

1. **Shoukaku v4 API**: `player.position` NO se actualiza automáticamente, requiere tracking manual
2. **Lavalink YouTube**: Requiere plugin externo y configuración de clientes específicos
3. **Real-time Updates**: Socket.io con intervalos de 100ms funciona bien para sincronización
4. **Seek Handling**: Necesita grace period para evitar conflictos con actualizaciones del servidor
5. **Event Reasons**: Usar `reason` del evento `trackEnd` para distinguir entre finalización natural y cambio manual

---

## Recursos

- [Shoukaku Documentation](https://github.com/Deivu/Shoukaku)
- [Lavalink YouTube Plugin](https://github.com/lavalink-devs/youtube-source)
- [Lavalink v4 Documentation](https://lavalink.dev/)
