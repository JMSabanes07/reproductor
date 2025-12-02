# Discord Music Player

Un reproductor de música compartido para Discord que permite agregar canciones desde YouTube mediante una extensión de Chrome.

## Estructura del Proyecto

```
reproductor/
├── server/          # Backend Node.js
└── extension/       # Chrome Extension (React)
```

## Configuración

### Backend (server/)

1. Instalar dependencias:

   ```bash
   cd server
   npm install
   ```

2. Crear archivo `.env` basado en `.env.example`:

   ```bash
   cp .env.example .env
   ```

3. Configurar el token de Discord en `.env`:

   ```
   DISCORD_TOKEN=tu_token_aqui
   ```

4. Iniciar el servidor:
   ```bash
   npm run dev
   ```

### Frontend (extension/)

1. Instalar dependencias:

   ```bash
   cd extension
   npm install
   ```

2. Compilar la extensión:

   ```bash
   npm run build
   ```

3. Cargar la extensión en Chrome:
   - Abrir `chrome://extensions`
   - Activar "Modo de desarrollador"
   - Clic en "Cargar extensión sin empaquetar"
   - Seleccionar la carpeta `extension/dist`

## Uso

1. Asegúrate de que el servidor esté corriendo (`npm run dev` en `server/`)
2. Abre YouTube y navega a un video
3. Verás un botón "Add to Discord" en la esquina inferior derecha
4. Haz clic para agregar la canción a la playlist
5. Abre el popup de la extensión para ver la playlist compartida

## Tecnologías

- **Backend**: Node.js, Express, Socket.io, SQLite, Discord.js
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Extension**: Chrome Extension Manifest V3
