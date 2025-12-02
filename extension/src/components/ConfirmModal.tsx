import { motion, AnimatePresence } from 'motion/react'
import css from './ConfirmModal.module.css'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className={css.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
          <motion.div
            className={css.modal}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className={css.title}>{title}</h2>
            <p className={css.message}>{message}</p>
            <div className={css.actions}>
              <motion.button
                className={css.cancelButton}
                onClick={onCancel}
                whileHover={{ scale: 1.05, backgroundColor: 'var(--surface-hover)' }}
                whileTap={{ scale: 0.95 }}
              >
                {cancelText}
              </motion.button>
              <motion.button
                className={css.confirmButton}
                onClick={onConfirm}
                whileHover={{ scale: 1.05, backgroundColor: 'var(--secondary-dark)' }}
                whileTap={{ scale: 0.95 }}
              >
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
