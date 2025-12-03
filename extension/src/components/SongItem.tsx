import { motion } from 'motion/react'
import { DeleteIcon, ExternalLinkIcon } from 'raster-react'
import type { Song } from '../types'
import css from './SongItem.module.css'

interface SongItemProps {
  song: Song
  onPlay: () => void
  onDelete: (e: React.MouseEvent) => void
  isPlaying?: boolean
  disableAnimations?: boolean
}

export default function SongItem({
  song,
  onPlay,
  onDelete,
  isPlaying = false,
  disableAnimations = false,
}: SongItemProps) {
  const formatDuration = (ms: number | string) => {
    const milliseconds = typeof ms === 'string' ? parseInt(ms) : ms
    const totalSeconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      className={`${css.songItem} ${isPlaying ? css.isPlaying : ''}`}
      onClick={onPlay}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      layout={!disableAnimations}
    >
      <img
        className={css.thumbnail}
        src={song.thumbnail || 'https://via.placeholder.com/60'}
        alt="Thumbnail"
      />
      <div className={css.songDetails}>
        <h3 className={css.songTitle} title={song.title}>
          {song.title}
        </h3>
        <div className={css.songMeta}>
          <span className={css.songInfo}>
            {formatDuration(song.duration)} • {song.author}
          </span>
          <div className={css.songActions}>
            <a
              className={css.actionButton}
              href={song.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="Open in YouTube"
            >
              <ExternalLinkIcon size={14} />
            </a>
            <button
              className={`${css.actionButton} ${css.delete}`}
              onClick={onDelete}
              title="Delete"
            >
              <DeleteIcon size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
