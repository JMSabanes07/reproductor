import { Play, Pause, SkipForward, SkipBack, Repeat, Shuffle } from 'lucide-react'
import { motion } from 'motion/react'
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

export default function PlayerControls({ playbackState, onPause, onResume, onSkip, onPrevious, onShuffle, onRepeat, children }: PlayerControlsProps) {
  return (
    <div className={css.container}>
      {children}

      <div className={css.controls}>
        <motion.button
          className={css.controlButtonv2}
          onClick={onRepeat}
          title="Repeat"
          whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-hover)', color: 'var(--primary)' }}
          whileTap={{ scale: 0.95 }}
          style={{ color: playbackState.isRepeat ? 'var(--primary)' : 'var(--text-secondary)' }}
        >
          <Repeat size={18} />
        </motion.button>
        <motion.button
          className={css.controlButtonv2}
          onClick={onPrevious}
          title="Previous"
          whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-hover)', color: 'var(--primary)' }}
          whileTap={{ scale: 0.95 }}
        >
          <SkipBack size={18} />
        </motion.button>
        {playbackState.status === 'playing' ? (
          <motion.button
            className={`${css.controlButton} ${css.primary}`}
            onClick={onPause}
            title="Pause"
            whileHover={{ scale: 1.15, backgroundColor: 'var(--primary-light)' }}
            whileTap={{ scale: 0.95 }}
          >
            <Pause size={24} />
          </motion.button>
        ) : (
          <motion.button
            className={`${css.controlButton} ${css.primary}`}
            onClick={onResume}
            title="Play/Resume"
            whileHover={{ scale: 1.15, backgroundColor: 'var(--primary-light)' }}
            whileTap={{ scale: 0.95 }}
          >
            <Play size={24} />
          </motion.button>
        )}
        <motion.button
          className={css.controlButtonv2}
          onClick={onSkip}
          title="Skip"
          whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-hover)', color: 'var(--primary)' }}
          whileTap={{ scale: 0.95 }}
        >
          <SkipForward size={18} />
        </motion.button>
        <motion.button
          className={css.controlButtonv2}
          onClick={onShuffle}
          title="Shuffle"
          whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-hover)', color: 'var(--primary)' }}
          whileTap={{ scale: 0.95 }}
          style={{ color: playbackState.isShuffle ? 'var(--primary)' : undefined }}
        >
          <Shuffle size={18} />
        </motion.button>
      </div>
    </div>
  )
}
