import { io } from 'socket.io-client'

console.log('[CONTENT] Discord Music Player Content Script Loaded')

// Connect to Socket.io server
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'
console.log('[CONTENT] Connecting to server:', SERVER_URL)
const socket = io(SERVER_URL)

let currentGuildId: string | null = null

// Load guild_id from chrome.storage
chrome.storage.local.get(['discord_guild_id'], result => {
  currentGuildId = (result.discord_guild_id as string) || null
  console.log('[CONTENT] Loaded guild_id from storage:', currentGuildId)

  // If already connected and have guild_id, join the room
  if (socket.connected && currentGuildId) {
    console.log('[CONTENT] Joining guild:', currentGuildId)
    socket.emit('join_guild', currentGuildId)
  }
})

// Listen for changes in guild_id
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.discord_guild_id) {
    currentGuildId = (changes.discord_guild_id.newValue as string) || null
    console.log('[CONTENT] Guild ID updated:', currentGuildId)

    // Join the new guild room if connected
    if (socket.connected && currentGuildId) {
      console.log('[CONTENT] Joining new guild:', currentGuildId)
      socket.emit('join_guild', currentGuildId)
    }
  }
})

socket.on('connect', () => {
  console.log('[CONTENT] Connected to Discord Music Player Server')
  console.log('[CONTENT] Socket ID:', socket.id)

  // Join guild room on connect if we have a guild_id
  if (currentGuildId) {
    console.log('[CONTENT] Joining guild on connect:', currentGuildId)
    socket.emit('join_guild', currentGuildId)
  }
})

socket.on('connect_error', error => {
  console.error('[CONTENT] Connection error:', error)
})

socket.on('disconnect', reason => {
  console.log('[CONTENT] Disconnected from server. Reason:', reason)
})

// SVG Icons
const PLUS_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
const LIST_PLUS_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`
const SPINNER_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`
const CHECK_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
const X_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`

type ButtonState = 'idle' | 'loading' | 'success' | 'error'

function createButton(icon: string, onClick: () => void, primary = true) {
  const btn = document.createElement('button')
  btn.innerHTML = icon
  btn.style.display = 'flex'
  btn.style.alignItems = 'center'
  btn.style.justifyContent = 'center'
  btn.style.padding = '0'
  btn.style.margin = '0 4px'
  btn.style.width = '36px'
  btn.style.height = '36px'
  btn.style.fontSize = '14px'
  btn.style.fontWeight = '500'
  btn.style.borderRadius = '50%'
  btn.style.border = 'none'
  btn.style.cursor = 'pointer'
  btn.style.fontFamily = 'Roboto, Arial, sans-serif'

  if (primary) {
    btn.style.backgroundColor = '#00d9d9' // Miku Blurple
    btn.style.color = 'white'
  } else {
    btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
    btn.style.color = 'white'
  }

  btn.onclick = onClick
  return btn
}

function updateButtonState(btn: HTMLButtonElement, state: ButtonState, originalIcon: string) {
  btn.disabled = state !== 'idle'

  if (state === 'loading') {
    btn.innerHTML = SPINNER_ICON
    btn.style.opacity = '0.7'
    // Add spinner animation
    const spinner = btn.querySelector('.spinner')
    if (spinner) {
      ;(spinner as HTMLElement).style.animation = 'spin 1s linear infinite'
    }
  } else if (state === 'success') {
    btn.innerHTML = CHECK_ICON
    btn.style.backgroundColor = '#43B581' // Green
    btn.style.opacity = '1'
  } else if (state === 'error') {
    btn.innerHTML = X_ICON
    btn.style.backgroundColor = '#ED4245' // Red
    btn.style.opacity = '1'
  } else {
    btn.innerHTML = originalIcon
    btn.style.opacity = '1'
    btn.style.backgroundColor = originalIcon === PLUS_ICON ? '#00d9d9' : 'rgba(255, 255, 255, 0.1)'
  }
}

function addToDiscord(btn: HTMLButtonElement, originalIcon: string, isPlaylist = false) {
  console.log('[CONTENT] addToDiscord called. isPlaylist:', isPlaylist)

  const title = document.title.replace(' - YouTube', '')
  const url = window.location.href
  const urlParams = new URLSearchParams(window.location.search)
  const videoId = urlParams.get('v')
  const listId = urlParams.get('list')
  const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ''

  console.log('[CONTENT] Extracted data:', { title, url, videoId, listId, thumbnail })

  if (!videoId && !isPlaylist) {
    console.error('[CONTENT] Not a video URL')
    return
  }

  const payload = {
    title: isPlaylist ? 'Playlist' : title,
    url: isPlaylist && listId ? `https://www.youtube.com/playlist?list=${listId}` : url,
    thumbnail,
    duration: '0:00',
    added_by: 'User',
    isPlaylist,
  }

  console.log('[CONTENT] Payload to send:', JSON.stringify(payload, null, 2))
  console.log('[CONTENT] Socket connected:', socket.connected)
  console.log('[CONTENT] Current guild_id:', currentGuildId)

  if (!socket.connected) {
    console.error('[CONTENT] Socket not connected!')
    updateButtonState(btn, 'error', originalIcon)
    setTimeout(() => {
      updateButtonState(btn, 'idle', originalIcon)
    }, 3000)
    return
  }

  if (!currentGuildId) {
    console.error('[CONTENT] No guild_id set! Please set Discord Server ID in the extension popup.')
    alert('Please set your Discord Server ID in the extension popup first!')
    return
  }

  updateButtonState(btn, 'loading', originalIcon)

  if (isPlaylist) {
    console.log('[CONTENT] Emitting import_playlist event')
    socket.emit('import_playlist', payload)
  } else {
    console.log('[CONTENT] Emitting add_song event')
    socket.emit('add_song', payload)
  }

  // Show success state after 1 second
  setTimeout(() => {
    updateButtonState(btn, 'success', originalIcon)
    // Reset to idle after 3 seconds
    setTimeout(() => {
      updateButtonState(btn, 'idle', originalIcon)
    }, 3000)
  }, 1000)

  console.log('[CONTENT] Event emitted successfully')
}

// Add spinner keyframes
const style = document.createElement('style')
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`
document.head.appendChild(style)

function injectButtons() {
  const actions = document.querySelector('#actions #top-level-buttons-computed')
  if (actions && !document.getElementById('discord-music-btn')) {
    console.log('[CONTENT] Injecting buttons into YouTube UI')
    const container = document.createElement('div')
    container.id = 'discord-music-btn'
    container.style.display = 'flex'
    container.style.alignItems = 'center'
    container.style.gap = '4px'

    const addSongBtn = createButton(
      PLUS_ICON,
      () => addToDiscord(addSongBtn, PLUS_ICON, false),
      true
    )
    addSongBtn.title = 'Add Song to Discord Player'
    container.appendChild(addSongBtn)

    if (new URLSearchParams(window.location.search).get('list')) {
      console.log('[CONTENT] Playlist detected, adding playlist button')
      const addPlaylistBtn = createButton(
        LIST_PLUS_ICON,
        () => addToDiscord(addPlaylistBtn, LIST_PLUS_ICON, true),
        false
      )
      addPlaylistBtn.title = 'Add Playlist to Discord Player'
      container.appendChild(addPlaylistBtn)
    }

    actions.insertBefore(container, actions.firstChild)
    console.log('[CONTENT] Buttons injected successfully')
  }
}

// Observer to handle dynamic loading
const observer = new MutationObserver(() => {
  injectButtons()
})

observer.observe(document.body, { childList: true, subtree: true })
console.log('[CONTENT] MutationObserver started')

// Initial check
injectButtons()
