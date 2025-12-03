import { AnimatePresence, motion } from 'motion/react'
import { DeleteIcon, XIcon } from 'raster-react'
import type { Song } from '../types'
import css from './Menu.module.css'
import SongList from './SongList'

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

export default function Menu({
  isOpen,
  onClose,
  songs,
  onPlay,
  onDelete,
  onReorder,
  currentSongId,
  onClearPlaylist,
}: MenuProps) {
  const handlePlay = (song: Song) => {
    onPlay(song)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={css.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
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
                <button
                  className={css.closeButton}
                  onClick={onClearPlaylist}
                  title="Clear Playlist"
                >
                  <DeleteIcon size={24} />
                </button>
                <button className={css.closeButton} onClick={onClose}>
                  <XIcon size={24} />
                </button>
              </div>
            </div>

            <div className={css.drawerContent}>
              <SongList
                songs={songs}
                onPlay={handlePlay}
                onDelete={onDelete}
                onReorder={onReorder}
                currentSongId={currentSongId}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
