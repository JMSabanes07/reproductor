import { useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { PlaybackState } from '../types'

interface UseSeekReturn {
  isSeeking: boolean
  seekValue: number
  currentPosition: number
  handleSeekChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSeekMouseUp: () => void
}

export function useSeek(
  socketRef: React.MutableRefObject<Socket | null>,
  playbackState: PlaybackState,
  setPlaybackState: React.Dispatch<React.SetStateAction<PlaybackState>>
): UseSeekReturn {
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeekValue(Number(e.target.value))
    setIsSeeking(true)
  }

  const handleSeekMouseUp = () => {
    if (socketRef.current) {
      socketRef.current.emit('seek_song', seekValue)

      // Optimistic update
      setPlaybackState(prev => ({ ...prev, position: seekValue }))
    }
    setIsSeeking(false)
  }

  const currentPosition = isSeeking ? seekValue : playbackState.position || 0

  return {
    isSeeking,
    seekValue,
    currentPosition,
    handleSeekChange,
    handleSeekMouseUp,
  }
}
