import { motion } from 'motion/react'
import { useState, useRef, useEffect } from 'react'
import Header from './components/Header'
import PlayerControls from './components/PlayerControls'
import ProgressBar from './components/ProgressBar'
import Menu from './components/Menu'
import ConfirmModal from './components/ConfirmModal'
import { ThemeProvider } from './contexts/ThemeContext'
import { useSocket } from './hooks/useSocket'
import { usePlayback } from './hooks/usePlayback'
import { useSeek } from './hooks/useSeek'
import type { PlaybackState } from './types'
import css from './App.module.css'

console.log('[APP] Discord Music Player Extension starting...')

function AppContent() {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    status: 'idle',
    currentSong: null,
    position: 0,
    duration: 0,
  })

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

  const { socketRef, connected, playlist, ignoreUpdatesUntilRef, setPlaylist } = useSocket(isSeekingRef, setPlaybackState)

  const showConfirm = (title: string, message: string, confirmText: string, cancelText: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, confirmText, cancelText, onConfirm })
  }

  const playbackActions = usePlayback(socketRef, setPlaybackState, ignoreUpdatesUntilRef, showConfirm)
  const seekControls = useSeek(socketRef, playbackState, ignoreUpdatesUntilRef, setPlaybackState)

  // Sync isSeeking state to ref for socket updates
  useEffect(() => {
    isSeekingRef.current = seekControls.isSeeking
  }, [seekControls.isSeeking])

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
          showConfirm('Limpiar Playlist', '¿Estas seguro de borrar toda la playlist?', 'Limpiar', 'Cancelar', () => {
            socketRef.current?.emit('clear_playlist')
          })
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
