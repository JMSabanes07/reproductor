import { motion } from 'motion/react'
import { Menu as MenuIcon, Sun, Moon } from 'lucide-react'
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
        <h1 className={css.title}>Miku Player</h1>
      </div>
      <div className={css.headerRight}>
        <div className={`${css.statusIndicator} ${connected ? css.connected : css.disconnected}`} title={connected ? 'Connected' : 'Disconnected'} />
        <motion.button
          className={css.themeButton}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          whileHover={{ scale: 1.05, backgroundColor: 'var(--surface-hover)', color: 'var(--primary)' }}
          whileTap={{ scale: 0.95 }}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </motion.button>

        <motion.button
          className={css.menuButton}
          onClick={onMenuClick}
          title="Menu"
          whileHover={{ scale: 1.05, backgroundColor: 'var(--surface-hover)', color: 'var(--primary)' }}
          whileTap={{ scale: 0.95 }}
        >
          <MenuIcon size={20} />
        </motion.button>
      </div>
    </header>
  )
}
