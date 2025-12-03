import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import css from './App.module.css'
import ConfirmModal from './components/ConfirmModal'
import Header from './components/Header'
import Menu from './components/Menu'
import PlayerControls from './components/PlayerControls'
import ProgressBar from './components/ProgressBar'
import { ThemeProvider } from './contexts/ThemeContext'
import { usePlayback } from './hooks/usePlayback'
import { useSeek } from './hooks/useSeek'
import { useSocket } from './hooks/useSocket'
import type { PlaybackState } from './types'

console.log('[APP] Discord Music Player Extension starting...')

function AppContent() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    status: 'idle',
    currentSong: null,
    position: 0,
    duration: 0,
  })

  // Load guild_id on mount
  useEffect(() => {
    chrome.storage.local.get(['discord_guild_id'], result => {
      const storedGuildId =
        (result.discord_guild_id as string) || localStorage.getItem('discord_guild_id')
      if (storedGuildId) {
        setGuildId(storedGuildId)
        // Sync to both storages
        localStorage.setItem('discord_guild_id', storedGuildId)
        chrome.storage.local.set({ discord_guild_id: storedGuildId })
      }
    })
  }, [])

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    cancelText: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
  })
  const isSeekingRef = useRef(false)

  const { socketRef, connected, playlist, ignoreUpdatesUntilRef, setPlaylist } = useSocket(
    guildId,
    isSeekingRef,
    setPlaybackState
  )

  const showConfirm = (
    title: string,
    message: string,
    confirmText: string,
    cancelText: string,
    onConfirm: () => void
  ) => {
    setConfirmModal({ isOpen: true, title, message, confirmText, cancelText, onConfirm })
  }

  const playbackActions = usePlayback(
    socketRef,
    setPlaybackState,
    ignoreUpdatesUntilRef,
    showConfirm
  )
  const seekControls = useSeek(socketRef, playbackState, ignoreUpdatesUntilRef, setPlaybackState)

  // Sync isSeeking state to ref for socket updates
  useEffect(() => {
    isSeekingRef.current = seekControls.isSeeking
  }, [seekControls.isSeeking])

  if (!guildId) {
    return (
      <div
        className={css.container}
        style={{ justifyContent: 'center', alignItems: 'center', gap: '1rem' }}
      >
        <h2 style={{ color: 'white' }}>Enter Discord Server ID</h2>
        <input
          type="text"
          placeholder="Guild ID"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const val = e.currentTarget.value
              if (val) {
                localStorage.setItem('discord_guild_id', val)
                chrome.storage.local.set({ discord_guild_id: val })
                setGuildId(val)
              }
            }
          }}
          style={{
            padding: '10px',
            borderRadius: '5px',
            border: 'none',
            width: '80%',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
          }}
        />
        <p style={{ color: '#aaa', fontSize: '0.8rem' }}>Press Enter to save</p>
      </div>
    )
  }

  return (
    <div className={css.container}>
      <Header connected={connected} onMenuClick={() => setIsMenuOpen(true)} />

      {/* Song Preview */}
      <div className={css.songPreview}>
        {playbackState.currentSong ? (
          <>
            <motion.img
              className={css.songThumbnail}
              src={playbackState.currentSong.thumbnail || 'https://via.placeholder.com/200'}
              alt={playbackState.currentSong.title}
              whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' }}
            />
            <div className={css.songInfo}>
              <h2 className={css.songTitle}>{playbackState.currentSong.title}</h2>
              <h3 className={css.songSubtitle}>{playbackState.currentSong.author}</h3>
            </div>
          </>
        ) : (
          <>
            <div className={css.songThumbnailPlaceholder} />
            <h2 className={css.songTitle}>No song playing</h2>
          </>
        )}
      </div>

      {/* Player Controls at bottom */}
      <div className={css.playerControlsWrapper}>
        <PlayerControls
          playbackState={playbackState}
          onPause={playbackActions.handlePause}
          onResume={playbackActions.handleResume}
          onSkip={playbackActions.handleSkip}
          onPrevious={playbackActions.handlePrevious}
          onShuffle={playbackActions.handleShuffle}
          onRepeat={playbackActions.handleRepeat}
        >
          <ProgressBar
            currentPosition={seekControls.currentPosition}
            totalDuration={playbackState.duration || 0}
            disabled={playbackState.status === 'idle'}
            onSeekChange={seekControls.handleSeekChange}
            onSeekMouseUp={seekControls.handleSeekMouseUp}
          />
        </PlayerControls>
      </div>

      <Menu
        onClearPlaylist={() => {
          showConfirm(
            'Limpiar Playlist',
            '¿Estas seguro de borrar toda la playlist?',
            'Limpiar',
            'Cancelar',
            () => {
              socketRef.current?.emit('clear_playlist')
            }
          )
        }}
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        songs={playlist}
        onPlay={playbackActions.handlePlay}
        onDelete={playbackActions.handleDelete}
        onReorder={newOrder => {
          // Optimistic update: immediately update the UI
          setPlaylist(newOrder)
          // Then send to server
          const orderedIds = newOrder.map(s => s.id)
          socketRef.current?.emit('reorder_playlist', orderedIds)
        }}
        currentSongId={playbackState.currentSong?.id || null}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        onConfirm={() => {
          confirmModal.onConfirm()
          setConfirmModal({ ...confirmModal, isOpen: false })
        }}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App
