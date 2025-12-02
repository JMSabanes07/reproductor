import { ExternalLink, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import type { Song } from '../types'
import css from './SongItem.module.css'

interface SongItemProps {
  song: Song
  onPlay: () => void
  onDelete: (e: React.MouseEvent) => void
  isPlaying?: boolean
  disableAnimations?: boolean
}

export default function SongItem({ song, onPlay, onDelete, isPlaying = false, disableAnimations = false }: SongItemProps) {
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
      whileHover={{
        y: -2,
        backgroundColor: 'var(--surface-hover)',
        borderColor: 'var(--primary)',
        boxShadow: 'var(--shadow-md)',
      }}
      whileTap={{ y: 0 }}
      layout={!disableAnimations}
    >
      <motion.img className={css.thumbnail} src={song.thumbnail || 'https://via.placeholder.com/60'} alt="Thumbnail" whileHover={{ scale: 1.05 }} />
      <div className={css.songDetails}>
        <h3 className={css.songTitle} title={song.title}>
          {song.title}
        </h3>
        <div className={css.songMeta}>
          <span className={css.songInfo}>
            {formatDuration(song.duration)} • {song.author}
          </span>
          <div className={css.songActions}>
            <motion.a
              className={css.actionButton}
              href={song.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="Open in YouTube"
              whileHover={{ scale: 1.1, color: 'var(--primary)', backgroundColor: 'var(--background-secondary)' }}
              whileTap={{ scale: 0.9 }}
            >
              <ExternalLink size={14} />
            </motion.a>
            <motion.button
              className={`${css.actionButton} ${css.delete}`}
              onClick={onDelete}
              title="Delete"
              whileHover={{ scale: 1.1, color: 'var(--secondary)', backgroundColor: 'var(--background-secondary)' }}
              whileTap={{ scale: 0.9 }}
            >
              <Trash2 size={14} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
