import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { PlaybackState, Song } from '../types'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'

interface UseSocketReturn {
  socketRef: React.MutableRefObject<Socket | null>
  connected: boolean
  playlist: Song[]
  ignoreUpdatesUntilRef: React.MutableRefObject<number>
  setPlaylist: React.Dispatch<React.SetStateAction<Song[]>>
}

export function useSocket(
  guildId: string | null,
  isSeekingRef: React.MutableRefObject<boolean>,
  setPlaybackState: React.Dispatch<React.SetStateAction<PlaybackState>>
): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [playlist, setPlaylist] = useState<Song[]>([])
  const ignoreUpdatesUntilRef = useRef<number>(0)

  useEffect(() => {
    if (!guildId) return

    console.log('[APP] Initializing Socket.io connection...')
    const newSocket = io(SERVER_URL)
    socketRef.current = newSocket

    newSocket.on('connect', () => {
      console.log('[APP] Connected to server')
      console.log('[APP] Socket ID:', newSocket.id)
      setConnected(true)
      console.log(`[APP] Joining guild: ${guildId}`)
      newSocket.emit('join_guild', guildId)
    })

    newSocket.on('connect_error', error => {
      console.error('[APP] Connection error:', error)
    })

    newSocket.on('disconnect', () => {
      console.log('[APP] Disconnected from server')
      setConnected(false)
    })

    newSocket.on('playlist_updated', (songs: Song[]) => {
      console.log('[APP] Received playlist_updated event with', songs.length, 'songs')
      setPlaylist(songs)
    })

    newSocket.on('song_added', (song: Song) => {
      console.log('[APP] Received song_added event:', song)
      setPlaylist(prev => [...prev, song])
    })

    newSocket.on('playback_state', (state: PlaybackState) => {
      console.log('[APP] Received playback_state:', state)
      setPlaybackState(prev => ({ ...prev, ...state }))
    })

    newSocket.on(
      'player_update',
      (update: { position: number; duration: number; status: string }) => {
        // Ignore updates if we recently seeked (grace period)
        if (Date.now() < ignoreUpdatesUntilRef.current) return

        if (!isSeekingRef.current) {
          setPlaybackState(prev => {
            // Optimization: Don't update if values haven't changed (or changed very little)
            if (
              prev.position === update.position &&
              prev.duration === update.duration &&
              prev.status === update.status
            ) {
              return prev
            }

            return {
              ...prev,
              position: update.position,
              duration: update.duration,
              status: update.status as 'playing' | 'paused' | 'idle',
            }
          })
        }
      }
    )

    newSocket.on('song_deleted', (id: number) => {
      console.log('[APP] Received song_deleted event for ID:', id)
      setPlaylist(prev => prev.filter(song => song.id !== id))
    })

    return () => {
      console.log('[APP] Cleaning up socket connection')
      newSocket.close()
    }
  }, [setPlaybackState, guildId])

  return {
    socketRef,
    connected,
    playlist,
    ignoreUpdatesUntilRef,
    setPlaylist,
  }
}
