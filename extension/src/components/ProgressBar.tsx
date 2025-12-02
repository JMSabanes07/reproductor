import { formatTime } from '../utils/formatTime'
import css from './ProgressBar.module.css'

interface ProgressBarProps {
  currentPosition: number
  totalDuration: number
  disabled: boolean
  onSeekChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSeekMouseUp: () => void
}

export default function ProgressBar({ currentPosition, totalDuration, disabled, onSeekChange, onSeekMouseUp }: ProgressBarProps) {
  const progress = totalDuration > 0 ? (currentPosition / totalDuration) * 100 : 0

  return (
    <div className={css.container}>
      <div className={css.sliderWrapper}>
        <div className={css.progressFill} style={{ width: `${progress}%` }} />
        <input
          className={css.slider}
          type="range"
          min="0"
          max={totalDuration}
          value={currentPosition}
          onChange={onSeekChange}
          onMouseUp={onSeekMouseUp}
          disabled={disabled}
        />
      </div>
      <div className={css.timeDisplay}>
        <span>{formatTime(currentPosition)}</span>
        <span>{formatTime(totalDuration)}</span>
      </div>
    </div>
  )
}
