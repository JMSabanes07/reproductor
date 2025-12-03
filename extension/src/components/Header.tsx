import { MenuIcon, MoonIcon, SunDimIcon } from 'raster-react'
import { useTheme } from '../contexts/ThemeContext'
import css from './Header.module.css'

interface HeaderProps {
  connected: boolean
  onMenuClick: () => void
}

export default function Header({ connected, onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className={css.header}>
      <div className={css.headerLeft}>
        <img src="/mikuicon.png" alt="Miku Icon" />
        <h1 className={css.title}>Miku Player</h1>
      </div>
      <div className={css.headerRight}>
        <div
          className={`${css.statusIndicator} ${connected ? css.connected : css.disconnected}`}
          title={connected ? 'Connected' : 'Disconnected'}
        />
        <button
          className={css.themeButton}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <MoonIcon size={24} /> : <SunDimIcon size={24} />}
        </button>

        <button className={css.menuButton} onClick={onMenuClick} title="Menu">
          <MenuIcon size={24} />
        </button>
      </div>
    </header>
  )
}
