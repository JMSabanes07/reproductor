import {
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SkipBackIcon,
  SkipForwardIcon,
  TrendingUpDownIcon,
} from 'raster-react'
import type { PlaybackState } from '../types'
import css from './PlayerControls.module.css'

interface PlayerControlsProps {
  playbackState: PlaybackState
  onPause: () => void
  onResume: () => void
  onSkip: () => void
  onPrevious: () => void
  onShuffle: () => void
  onRepeat: () => void
  children?: React.ReactNode
}

export default function PlayerControls({
  playbackState,
  onPause,
  onResume,
  onSkip,
  onPrevious,
  onShuffle,
  onRepeat,
  children,
}: PlayerControlsProps) {
  return (
    <div className={css.container}>
      {children}

      <div className={css.controls}>
        <button
          className={css.controlButtonv2}
          onClick={onRepeat}
          title="Repeat"
          style={{ color: playbackState.isRepeat ? 'var(--primary)' : 'var(--text-secondary)' }}
        >
          <RepeatIcon size={24} />
        </button>
        <button className={css.controlButtonv2} onClick={onPrevious} title="Previous">
          <SkipBackIcon size={24} />
        </button>
        {playbackState.status === 'playing' ? (
          <button className={`${css.controlButton} ${css.playing}`} onClick={onPause} title="Pause">
            <PauseIcon size={32} />
          </button>
        ) : (
          <button className={`${css.controlButton}`} onClick={onResume} title="Play/Resume">
            <PlayIcon size={32} />
          </button>
        )}
        <button className={css.controlButtonv2} onClick={onSkip} title="Skip">
          <SkipForwardIcon size={24} />
        </button>
        <button
          className={css.controlButtonv2}
          onClick={onShuffle}
          title="Shuffle"
          style={{ color: playbackState.isShuffle ? 'var(--primary)' : undefined }}
        >
          <TrendingUpDownIcon size={24} />
        </button>
      </div>
    </div>
  )
}
