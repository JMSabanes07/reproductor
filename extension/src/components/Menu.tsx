import { motion, AnimatePresence } from 'motion/react'
import { X, Trash2 } from 'lucide-react'
import SongList from './SongList'
import type { Song } from '../types'
import css from './Menu.module.css'

interface MenuProps {
  isOpen: boolean
  onClose: () => void
  songs: Song[]
  onPlay: (song: Song) => void
  onDelete: (e: React.MouseEvent, id: number) => void
  onReorder: (songs: Song[]) => void
  currentSongId?: number | null
  onClearPlaylist: () => void
}

export default function Menu({ isOpen, onClose, songs, onPlay, onDelete, onReorder, currentSongId, onClearPlaylist }: MenuProps) {
  const handlePlay = (song: Song) => {
    onPlay(song)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className={css.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className={css.drawer}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={css.drawerHeader}>
              <h2 className={css.drawerTitle}>Playlist</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <motion.button
                  className={css.closeButton}
                  onClick={onClearPlaylist}
                  title="Clear Playlist"
                  whileHover={{ scale: 1.05, backgroundColor: 'var(--surface-hover)', color: 'var(--secondary)' }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Trash2 size={20} />
                </motion.button>
                <motion.button
                  className={css.closeButton}
                  onClick={onClose}
                  whileHover={{ scale: 1.05, backgroundColor: 'var(--surface-hover)', color: 'var(--primary)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={20} />
                </motion.button>
              </div>
            </div>

            <div className={css.drawerContent}>
              <SongList songs={songs} onPlay={handlePlay} onDelete={onDelete} onReorder={onReorder} currentSongId={currentSongId} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
