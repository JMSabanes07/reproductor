export interface Song {
  id: number
  title: string
  url: string
  thumbnail: string
  duration: string
  added_by: string
  author?: string
  is_stream?: boolean
  source_name?: string
  identifier?: string
  uri?: string
}

export interface PlaybackState {
  status: 'playing' | 'paused' | 'idle'
  currentSong?: Song | null
  position?: number
  duration?: number
  isShuffle?: boolean
  isRepeat?: boolean
}
