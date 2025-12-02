import type { Socket } from 'socket.io-client'
import type { Song, PlaybackState } from '../types'

interface UsePlaybackReturn {
  handlePlay: (song: Song) => void
  handlePause: () => void
  handleResume: () => void
  handleSkip: () => void
  handleDelete: (e: React.MouseEvent, id: number) => void
  handlePrevious: () => void
  handleShuffle: () => void
  handleRepeat: () => void
}

export function usePlayback(
  socketRef: React.MutableRefObject<Socket | null>,
  setPlaybackState: React.Dispatch<React.SetStateAction<PlaybackState>>,
  ignoreUpdatesUntilRef: React.MutableRefObject<number>,
  showConfirm: (title: string, message: string, confirmText: string, cancelText: string, onConfirm: () => void) => void
): UsePlaybackReturn {
  const handlePlay = (song: Song) => {
    if (socketRef.current) {
      socketRef.current.emit('play_song', song)
    }
  }

  const handlePause = () => {
    if (socketRef.current) {
      socketRef.current.emit('pause_song')

      // Optimistic update
      setPlaybackState(prev => ({ ...prev, status: 'paused' }))
      // Ignore server updates for 500ms to prevent flickering
      ignoreUpdatesUntilRef.current = Date.now() + 500
    }
  }

  const handleResume = () => {
    if (socketRef.current) {
      socketRef.current.emit('resume_song')

      // Optimistic update
      setPlaybackState(prev => ({ ...prev, status: 'playing' }))
    }
  }

  const handleSkip = () => {
    if (socketRef.current) {
      socketRef.current.emit('skip_song')
    }
  }

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (socketRef.current) {
      showConfirm('Borrar Cancion', '¿Estas seguro de borrar esta cancion?', 'Borrar', 'Cancelar', () => {
        socketRef.current?.emit('delete_song', id)
      })
    }
  }

  const handlePrevious = () => {
    if (socketRef.current) {
      socketRef.current.emit('previous_song')
    }
  }

  const handleShuffle = () => {
    if (socketRef.current) {
      socketRef.current.emit('toggle_shuffle')
    }
  }

  const handleRepeat = () => {
    if (socketRef.current) {
      socketRef.current.emit('toggle_repeat')
    }
  }

  return {
    handlePlay,
    handlePause,
    handleResume,
    handleSkip,
    handleDelete,
    handlePrevious,
    handleShuffle,
    handleRepeat,
  }
}
