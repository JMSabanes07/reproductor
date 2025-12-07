import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import {
  audioEvents,
  getPlayerPosition,
  initBot,
  pauseSong,
  playSong,
  resolvePlaylist,
  resolveTrack,
  resumeSong,
  seekSong,
  stopSong,
  updatePlayerState,
} from './bot'
import { deleteSong, getDB, initDB } from './db'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

app.use(cors())
app.use(express.json())

console.log('[SERVER] Starting Discord Music Player Server...')

interface GuildSession {
  playbackState: {
    status: string
    currentSong: any | null
    position: number
    duration: number
    isShuffle: boolean
    isRepeat: boolean
  }
  playbackHistory: number[]
  shuffledPlayedIndices: number[]
}

const guildSessions = new Map<string, GuildSession>()

function getGuildSession(guildId: string): GuildSession {
  if (!guildSessions.has(guildId)) {
    guildSessions.set(guildId, {
      playbackState: {
        status: 'idle',
        currentSong: null,
        position: 0,
        duration: 0,
        isShuffle: false,
        isRepeat: false,
      },
      playbackHistory: [],
      shuffledPlayedIndices: [],
    })
  }
  return guildSessions.get(guildId)!
}

function getNextSong(songs: any[], currentSongId: number | null, session: GuildSession): any | null {
  if (songs.length === 0) return null

  if (session.playbackState.isShuffle) {
    // Filter out played indices
    const availableIndices = songs.map((_, i) => i).filter(i => !session.shuffledPlayedIndices.includes(i))

    if (availableIndices.length === 0) {
      // All played.
      if (session.playbackState.isRepeat) {
        // Reset and pick random
        session.shuffledPlayedIndices = []
        const randomIndex = Math.floor(Math.random() * songs.length)
        session.shuffledPlayedIndices.push(randomIndex)
        return songs[randomIndex]
      } else {
        return null // Stop
      }
    }

    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
    session.shuffledPlayedIndices.push(randomIndex)
    return songs[randomIndex]
  } else {
    // Normal order
    const currentIndex = currentSongId ? songs.findIndex((s: any) => s.id === currentSongId) : -1
    if (currentIndex !== -1 && currentIndex < songs.length - 1) {
      return songs[currentIndex + 1]
    } else if (session.playbackState.isRepeat && songs.length > 0) {
      return songs[0] // Loop back
    }
    return null
  }
}

// Broadcast progress every 100ms for real-time updates
setInterval(() => {
  for (const [guildId, session] of guildSessions.entries()) {
    if (session.playbackState.status === 'playing' || session.playbackState.status === 'paused') {
      const position = getPlayerPosition(guildId)
      session.playbackState.position = position
      io.to(guildId).emit('player_update', {
        position: session.playbackState.position,
        duration: session.playbackState.duration,
        status: session.playbackState.status,
        isShuffle: session.playbackState.isShuffle,
        isRepeat: session.playbackState.isRepeat,
      })
    }
  }
}, 100)

// Initialize DB and Bot
;(async () => {
  try {
    console.log('[INIT] Initializing database...')
    await initDB()
    console.log('[INIT] Database initialized successfully')

    console.log('[INIT] Initializing Discord bot...')
    await initBot()
    console.log('[INIT] Discord bot initialized successfully')
  } catch (error) {
    console.error('[INIT ERROR] Initialization error:', error)
  }
})()

app.get('/', (req, res) => {
  console.log('[HTTP] Root endpoint accessed')
  res.send('Discord Music Player Server (Socket.io)')
})

// Handle Track End (Auto-play next)
audioEvents.on('trackEnd', async ({ guildId, reason }) => {
  console.log(`[QUEUE] Track ended in guild ${guildId} with reason:`, reason)

  const session = getGuildSession(guildId)
  const endReason = typeof reason === 'object' ? (reason as any).reason : reason

  if (endReason === 'replaced' || endReason === 'REPLACED') {
    console.log('[QUEUE] Track was replaced manually. Skipping auto-queue.')
    return
  }

  console.log('[QUEUE] Finding next song...')
  try {
    const db = getDB()
    // Get all songs ordered by order_index ASC (FIFO) for this guild
    const songs = await db.all('SELECT * FROM songs WHERE guild_id = ? ORDER BY order_index ASC', guildId)

    if (songs.length === 0) {
      console.log('[QUEUE] Playlist empty.')
      session.playbackState = {
        ...session.playbackState,
        status: 'idle',
        currentSong: null,
        position: 0,
        duration: 0,
      }
      io.to(guildId).emit('playback_state', session.playbackState)
      return
    }

    const nextSong = getNextSong(songs, session.playbackState.currentSong?.id, session)

    if (nextSong) {
      console.log('[QUEUE] Playing next song:', nextSong.title)
      const trackInfo = await playSong(nextSong.url, guildId)
      const duration = (trackInfo as any)?.info?.length || 0

      // Add previous song to history if it exists
      if (session.playbackState.currentSong) {
        session.playbackHistory.push(session.playbackState.currentSong.id)
      }

      session.playbackState = {
        ...session.playbackState,
        status: 'playing',
        currentSong: nextSong,
        position: 0,
        duration,
      }
      io.to(guildId).emit('playback_state', session.playbackState)
    } else {
      console.log('[QUEUE] No next song found.')
      session.playbackState = {
        ...session.playbackState,
        status: 'idle',
        currentSong: null,
        position: 0,
        duration: 0,
      }
      io.to(guildId).emit('playback_state', session.playbackState)
    }
  } catch (error) {
    console.error('[QUEUE ERROR] Failed to play next song:', error)
  }
})

// Handle when all users leave the voice channel
audioEvents.on('allUsersLeft', guildId => {
  console.log(`[BOT] All users left voice channel in guild ${guildId}. Stopping playback...`)

  const session = getGuildSession(guildId)

  // Stop current playback
  stopSong(guildId)

  // Reset playback state
  session.playbackState = {
    status: 'idle',
    currentSong: null,
    position: 0,
    duration: 0,
    isShuffle: session.playbackState.isShuffle,
    isRepeat: session.playbackState.isRepeat,
  }

  // Broadcast updated state to all clients
  io.to(guildId).emit('playback_state', session.playbackState)
  console.log('[BOT] Playback stopped and state reset')
})

io.on('connection', socket => {
  console.log('[SOCKET] New client connected:', socket.id)
  let currentGuildId: string | null = null

  socket.on('join_guild', async (guildId: string) => {
    console.log(`[SOCKET] Client ${socket.id} joining guild ${guildId}`)
    currentGuildId = guildId
    socket.join(guildId)

    const session = getGuildSession(guildId)

    // Send current playlist on connection
    const sendPlaylist = async () => {
      try {
        console.log('[SOCKET] Fetching playlist for client:', socket.id)
        const db = getDB()
        // FIFO Order
        const songs = await db.all('SELECT * FROM songs WHERE guild_id = ? ORDER BY order_index ASC', guildId)
        console.log('[SOCKET] Sending', songs.length, 'songs to client:', socket.id)
        socket.emit('playlist_updated', songs)

        // Send current playback state
        console.log('[SOCKET] Sending current playback state:', session.playbackState)
        socket.emit('playback_state', session.playbackState)
      } catch (error) {
        console.error('[SOCKET ERROR] Failed to fetch playlist:', error)
      }
    }
    sendPlaylist()
  })

  socket.on('get_playlist', () => {
    if (!currentGuildId) return
    console.log('[SOCKET] Client', socket.id, 'requested playlist')
    // Re-trigger sendPlaylist logic (duplicated for now, or extract function)
    const sendPlaylist = async () => {
      try {
        const db = getDB()
        const songs = await db.all('SELECT * FROM songs WHERE guild_id = ? ORDER BY order_index ASC', currentGuildId)
        socket.emit('playlist_updated', songs)
      } catch (error) {
        console.error('[SOCKET ERROR] Failed to fetch playlist:', error)
      }
    }
    sendPlaylist()
  })

  socket.on('add_song', async data => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received add_song event from', socket.id)
    console.log('[SOCKET] Song data:', JSON.stringify(data, null, 2))

    const { title, url, thumbnail, duration, added_by } = data

    if (!title || !url) {
      console.error('[SOCKET ERROR] Missing title or url:', { title, url })
      return
    }

    try {
      // Resolve full track info from Lavalink
      console.log('[BOT] Resolving full track info for:', url)
      const track = await resolveTrack(url)

      let finalTitle = title
      let finalDuration = duration
      let finalThumbnail = thumbnail
      let author = null
      let isStream = false
      let sourceName = null
      let identifier = null
      let uri = url

      if (track && (track as any).info) {
        const info = (track as any).info
        console.log('[BOT] Resolved track info:', info)
        finalTitle = info.title || title
        finalDuration = info.length || duration
        author = info.author
        isStream = info.isStream
        sourceName = info.sourceName
        identifier = info.identifier
        uri = info.uri || url
        // Lavalink might not return thumbnail directly in info, but sometimes in pluginInfo or we keep the one from frontend
        if (info.artworkUrl) {
          finalThumbnail = info.artworkUrl
        }
      } else {
        console.warn('[BOT] Could not resolve track info, using provided data.')
      }

      console.log('[DB] Inserting song into database...')
      const db = getDB()
      // Get max order_index
      const maxOrderResult = await db.get('SELECT MAX(order_index) as maxOrder FROM songs WHERE guild_id = ?', currentGuildId)
      const nextOrderIndex = (maxOrderResult?.maxOrder || 0) + 1

      const result = await db.run(
        'INSERT INTO songs (title, url, thumbnail, duration, added_by, author, is_stream, source_name, identifier, uri, order_index, guild_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [finalTitle, uri, finalThumbnail, finalDuration, added_by, author, isStream, sourceName, identifier, uri, nextOrderIndex, currentGuildId]
      )

      const newSong = {
        id: result.lastID,
        title: finalTitle,
        url: uri,
        thumbnail: finalThumbnail,
        duration: finalDuration,
        added_by,
        author,
        is_stream: isStream,
        source_name: sourceName,
        identifier,
        uri,
        order_index: nextOrderIndex,
        guild_id: currentGuildId,
      }

      console.log('[DB] Song inserted successfully with ID:', result.lastID)
      console.log('[SOCKET] Broadcasting song_added event to all clients in guild')
      io.to(currentGuildId).emit('song_added', newSong)

      const session = getGuildSession(currentGuildId)

      // Only play if idle
      if (session.playbackState.status === 'idle') {
        console.log('[PLAYBACK] System is idle, playing new song:', uri)
        const trackInfo = await playSong(uri, currentGuildId)
        const trackDuration = (trackInfo as any)?.info?.length || 0
        session.playbackState = {
          ...session.playbackState,
          status: 'playing',
          currentSong: newSong,
          position: 0,
          duration: trackDuration,
        }
        io.to(currentGuildId).emit('playback_state', session.playbackState)
      } else {
        console.log('[PLAYBACK] System is playing, added to queue.')
      }

      console.log('[SOCKET] add_song completed successfully')
    } catch (error) {
      console.error('[SOCKET ERROR] Failed to add song:', error)
      console.error('[SOCKET ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    }
  })

  socket.on('import_playlist', async data => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received import_playlist event from', socket.id)
    console.log('[SOCKET] Playlist data:', JSON.stringify(data, null, 2))

    const { url, added_by } = data

    if (!url) {
      console.error('[SOCKET ERROR] Missing playlist URL')
      return
    }

    try {
      // Use Lavalink to resolve the playlist
      const playlistResult = await resolvePlaylist(url)

      if (!playlistResult || !playlistResult.tracks || playlistResult.tracks.length === 0) {
        console.error('[SOCKET ERROR] Failed to resolve playlist or playlist is empty')
        return
      }

      console.log('[PLAYLIST] Processing playlist:', playlistResult.name, '- Tracks:', playlistResult.tracks.length)

      const db = getDB()
      let currentOrderIndex = (await db.get('SELECT MAX(order_index) as maxOrder FROM songs WHERE guild_id = ?', currentGuildId))?.maxOrder || 0

      let successCount = 0
      let failCount = 0

      // Process each track from the playlist
      for (const track of playlistResult.tracks) {
        try {
          currentOrderIndex++

          const info = (track as any).info
          if (!info) {
            console.warn('[PLAYLIST] Track has no info, skipping')
            failCount++
            continue
          }

          const finalTitle = info.title || 'Unknown Title'
          const finalDuration = info.length || 0
          const finalThumbnail = info.artworkUrl || ''
          const author = info.author || null
          const isStream = info.isStream || false
          const sourceName = info.sourceName || null
          const identifier = info.identifier || null
          const uri = info.uri || ''

          console.log('[PLAYLIST] Adding song:', finalTitle)

          // Insert enriched song data
          const result = await db.run(
            'INSERT INTO songs (title, url, thumbnail, duration, added_by, author, is_stream, source_name, identifier, uri, order_index, guild_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              finalTitle,
              uri,
              finalThumbnail,
              finalDuration,
              added_by,
              author,
              isStream,
              sourceName,
              identifier,
              uri,
              currentOrderIndex,
              currentGuildId,
            ]
          )

          const newSong = {
            id: result.lastID,
            title: finalTitle,
            url: uri,
            thumbnail: finalThumbnail,
            duration: finalDuration,
            added_by,
            author,
            is_stream: isStream,
            source_name: sourceName,
            identifier,
            uri,
            order_index: currentOrderIndex,
            guild_id: currentGuildId,
          }

          io.to(currentGuildId).emit('song_added', newSong)
          successCount++
        } catch (songError) {
          console.error('[PLAYLIST ERROR] Failed to process track:', songError)
          failCount++
          // Continue with next song even if one fails
        }
      }

      console.log(`[SOCKET] import_playlist completed - Success: ${successCount}, Failed: ${failCount}`)
    } catch (error) {
      console.error('[SOCKET ERROR] Playlist import error:', error)
      console.error('[SOCKET ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    }
  })

  socket.on('play_song', async (song: any) => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received play_song event for:', song.title)
    try {
      const trackInfo = await playSong(song.url, currentGuildId)
      const duration = (trackInfo as any)?.info?.length || 0
      const session = getGuildSession(currentGuildId)
      session.playbackState = {
        ...session.playbackState,
        status: 'playing',
        currentSong: song,
        position: 0,
        duration,
      }
      io.to(currentGuildId).emit('playback_state', session.playbackState)
    } catch (error) {
      console.error('[SOCKET ERROR] Failed to play song:', error)
    }
  })

  socket.on('pause_song', () => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received pause_song event')
    const currentPosition = getPlayerPosition(currentGuildId)
    pauseSong(currentGuildId)
    updatePlayerState(currentGuildId, false, currentPosition)
    const session = getGuildSession(currentGuildId)
    session.playbackState = { ...session.playbackState, status: 'paused' }
    io.to(currentGuildId).emit('playback_state', session.playbackState)
  })

  socket.on('resume_song', async () => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received resume_song event')
    const session = getGuildSession(currentGuildId)
    if (session.playbackState.status === 'idle') {
      // If idle, play the first song in the queue
      try {
        const db = getDB()
        const songs = await db.all('SELECT * FROM songs WHERE guild_id = ? ORDER BY order_index ASC LIMIT 1', currentGuildId)
        if (songs.length > 0) {
          const firstSong = songs[0]
          console.log('[PLAYBACK] Idle resume, playing first song:', firstSong.title)
          const trackInfo = await playSong(firstSong.url, currentGuildId)
          const duration = (trackInfo as any)?.info?.length || 0
          session.playbackState = {
            ...session.playbackState,
            status: 'playing',
            currentSong: firstSong,
            position: 0,
            duration,
          }
          io.to(currentGuildId).emit('playback_state', session.playbackState)
        } else {
          console.log('[PLAYBACK] Queue empty, cannot resume.')
        }
      } catch (e) {
        console.error('[SOCKET ERROR] Failed to resume from idle:', e)
      }
    } else {
      resumeSong(currentGuildId)
      updatePlayerState(currentGuildId, true)
      session.playbackState = { ...session.playbackState, status: 'playing' }
      io.to(currentGuildId).emit('playback_state', session.playbackState)
    }
  })

  socket.on('skip_song', async () => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received skip_song event')
    // Manual skip should behave like track end
    stopSong(currentGuildId)
  })

  socket.on('previous_song', async () => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received previous_song event')
    const session = getGuildSession(currentGuildId)
    if (session.playbackHistory.length === 0) {
      console.log('[PLAYBACK] No history to go back to.')
      return
    }

    const previousSongId = session.playbackHistory.pop()
    if (!previousSongId) return

    try {
      const db = getDB()
      const song = await db.get('SELECT * FROM songs WHERE id = ?', previousSongId)
      if (song) {
        console.log('[PLAYBACK] Playing previous song:', song.title)
        const trackInfo = await playSong(song.url, currentGuildId)
        const duration = (trackInfo as any)?.info?.length || 0
        session.playbackState = {
          ...session.playbackState,
          status: 'playing',
          currentSong: song,
          position: 0,
          duration,
        }
        io.to(currentGuildId).emit('playback_state', session.playbackState)
      }
    } catch (error) {
      console.error('[PLAYBACK ERROR] Failed to play previous song:', error)
    }
  })

  socket.on('toggle_shuffle', () => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received toggle_shuffle event')
    const session = getGuildSession(currentGuildId)
    session.playbackState.isShuffle = !session.playbackState.isShuffle
    if (session.playbackState.isShuffle) {
      session.shuffledPlayedIndices = [] // Reset shuffle history on enable
    }
    io.to(currentGuildId).emit('playback_state', session.playbackState)
  })

  socket.on('toggle_repeat', () => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received toggle_repeat event')
    const session = getGuildSession(currentGuildId)
    session.playbackState.isRepeat = !session.playbackState.isRepeat
    io.to(currentGuildId).emit('playback_state', session.playbackState)
  })

  socket.on('seek_song', async (position: number) => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received seek_song event:', position)
    const isPaused = await seekSong(currentGuildId, position)
    console.log(`[DEBUG] seekSong returned isPaused: ${isPaused}`)

    const session = getGuildSession(currentGuildId)
    session.playbackState.position = position
    // Update status based on seek result
    session.playbackState.status = isPaused ? 'paused' : 'playing'
    console.log(`[DEBUG] Updated session status to: ${session.playbackState.status}`)

    // Immediate update to all clients to reflect seek
    io.to(currentGuildId).emit('player_update', {
      position: session.playbackState.position,
      duration: session.playbackState.duration,
      status: session.playbackState.status,
      isShuffle: session.playbackState.isShuffle,
      isRepeat: session.playbackState.isRepeat,
    })
    console.log('[DEBUG] Emitted player_update')

    // Also emit full playback state to ensure UI sync
    io.to(currentGuildId).emit('playback_state', session.playbackState)
    console.log('[DEBUG] Emitted playback_state')
  })

  socket.on('delete_song', async (id: number) => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received delete_song event for ID:', id)
    try {
      await deleteSong(id)
      console.log('[DB] Song deleted successfully')
      io.to(currentGuildId).emit('song_deleted', id)

      // Refresh playlist for everyone
      const db = getDB()
      const songs = await db.all('SELECT * FROM songs WHERE guild_id = ? ORDER BY order_index ASC', currentGuildId)
      io.to(currentGuildId).emit('playlist_updated', songs)
    } catch (error) {
      console.error('[SOCKET ERROR] Failed to delete song:', error)
    }
  })

  socket.on('reorder_playlist', async (orderedIds: number[]) => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received reorder_playlist event')
    try {
      const db = getDB()
      await db.exec('BEGIN TRANSACTION')
      const stmt = await db.prepare('UPDATE songs SET order_index = ? WHERE id = ?')

      for (let i = 0; i < orderedIds.length; i++) {
        await stmt.run(i, orderedIds[i])
      }

      await stmt.finalize()
      await db.exec('COMMIT')

      console.log('[DB] Playlist reordered successfully')

      // Broadcast new order
      const songs = await db.all('SELECT * FROM songs WHERE guild_id = ? ORDER BY order_index ASC', currentGuildId)
      io.to(currentGuildId).emit('playlist_updated', songs)
    } catch (error) {
      console.error('[SOCKET ERROR] Failed to reorder playlist:', error)
      const db = getDB()
      await db.exec('ROLLBACK')
    }
  })

  socket.on('clear_playlist', async () => {
    if (!currentGuildId) return
    console.log('[SOCKET] Received clear_playlist event')
    try {
      const db = getDB()
      await db.run('DELETE FROM songs WHERE guild_id = ?', currentGuildId)
      console.log('[DB] All songs deleted')

      // Stop playback if playing
      stopSong(currentGuildId)
      const session = getGuildSession(currentGuildId)
      session.playbackState = {
        ...session.playbackState,
        status: 'idle',
        currentSong: null,
        position: 0,
        duration: 0,
      }

      // Broadcast empty playlist
      io.to(currentGuildId).emit('playlist_updated', [])
      io.to(currentGuildId).emit('playback_state', session.playbackState)
    } catch (error) {
      console.error('[SOCKET ERROR] Failed to clear playlist:', error)
    }
  })

  socket.on('disconnect', () => {
    console.log('[SOCKET] Client disconnected:', socket.id)
  })
})

console.log('process.env.PORT', process.env.PORT)
const PORT = process.env.PORT

httpServer.listen(PORT, () => {
  console.log(`[SERVER] Server running on port ${PORT}`)
  console.log(`[SERVER] Socket.io ready for connections`)
})
