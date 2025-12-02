import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import SongItem from './SongItem'
import type { Song } from '../types'
import css from './SongList.module.css'

interface SongListProps {
  songs: Song[]
  onPlay: (song: Song) => void
  onDelete: (e: React.MouseEvent, id: number) => void
  onReorder: (songs: Song[]) => void
  currentSongId?: number | null
}

export default function SongList({ songs, onPlay, onDelete, onReorder, currentSongId }: SongListProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = () => {
    setIsDragging(true)
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      setIsDragging(false)
      return
    }

    const items = Array.from(songs)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    onReorder(items)

    // Delay re-enabling animations to prevent "flying" effect
    setTimeout(() => {
      setIsDragging(false)
    }, 50)
  }

  if (songs.length === 0) {
    return (
      <div className={css.container}>
        <div className={css.emptyState}>
          <p className={css.emptyStateText}>No hay Miku canciones.</p>
          <p className={css.emptyStateSubtext}>Agregá Miku canciones desde youtube.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${css.container} custom-scrollbar`}>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Droppable droppableId="playlist">
          {provided => (
            <div className={css.songList} ref={provided.innerRef} {...provided.droppableProps}>
              <AnimatePresence mode="popLayout">
                {songs.map((song, index) => (
                  <Draggable key={song.id} draggableId={song.id.toString()} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          ...provided.draggableProps.style,
                          opacity: snapshot.isDragging ? 0.8 : 1,
                        }}
                      >
                        <SongItem
                          song={song}
                          onPlay={() => onPlay(song)}
                          onDelete={e => onDelete(e, song.id)}
                          isPlaying={currentSongId === song.id}
                          disableAnimations={isDragging}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
              </AnimatePresence>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}
