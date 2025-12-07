import { io, Socket } from 'socket.io-client'

console.log('[BACKGROUND] Service worker started')

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'
console.log('[BACKGROUND] Connecting to server:', SERVER_URL)

let socket: Socket | null = null
let currentGuildId: string | null = null

function connectSocket() {
  if (socket?.connected) return

  socket = io(SERVER_URL, {
    transports: ['websocket'], // Force websocket to avoid polling issues in SW
    reconnection: true,
  })

  socket.on('connect', () => {
    console.log('[BACKGROUND] Connected to server', socket?.id)
    if (currentGuildId) {
      console.log('[BACKGROUND] Joining guild:', currentGuildId)
      socket?.emit('join_guild', currentGuildId)
    }
  })

  socket.on('disconnect', reason => {
    console.log('[BACKGROUND] Disconnected:', reason)
  })

  socket.on('connect_error', error => {
    console.error('[BACKGROUND] Connection error:', error)
  })
}

// Initialize connection
connectSocket()

// Load guild_id
chrome.storage.local.get(['discord_guild_id'], result => {
  currentGuildId = (result.discord_guild_id as string) || null
  console.log('[BACKGROUND] Loaded guild_id:', currentGuildId)
  if (socket?.connected && currentGuildId) {
    socket.emit('join_guild', currentGuildId)
  }
})

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.discord_guild_id) {
    currentGuildId = (changes.discord_guild_id.newValue as string) || null
    console.log('[BACKGROUND] Guild ID updated:', currentGuildId)
    if (socket?.connected && currentGuildId) {
      socket.emit('join_guild', currentGuildId)
    }
  }
})

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('[BACKGROUND] Received message:', request)

  if (!socket?.connected) {
    console.error('[BACKGROUND] Socket not connected')
    sendResponse({ success: false, error: 'Not connected to server' })
    return true
  }

  if (!currentGuildId) {
    console.error('[BACKGROUND] No guild ID')
    sendResponse({ success: false, error: 'No Guild ID set' })
    return true
  }

  switch (request.type) {
    case 'ADD_SONG':
      socket.emit('add_song', request.payload)
      sendResponse({ success: true })
      break
    case 'IMPORT_PLAYLIST':
      socket.emit('import_playlist', request.payload)
      sendResponse({ success: true })
      break
    default:
      console.warn('[BACKGROUND] Unknown message type:', request.type)
      sendResponse({ success: false, error: 'Unknown message type' })
  }

  return true
})
