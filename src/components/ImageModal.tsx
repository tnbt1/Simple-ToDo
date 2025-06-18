'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { useState, useEffect } from 'react'

interface ImageModalProps {
  isOpen: boolean
  imageUrl: string
  imageAlt: string
  onClose: () => void
}

export default function ImageModal({ isOpen, imageUrl, imageAlt, onClose }: ImageModalProps) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={handleBackdropClick}
        >
          {/* コントロールボタン */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-full hover:bg-opacity-30 transition-colors"
              aria-label="ズームアウト"
            >
              <ZoomOut className="h-5 w-5 text-white" />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-full hover:bg-opacity-30 transition-colors"
              aria-label="ズームイン"
            >
              <ZoomIn className="h-5 w-5 text-white" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-full hover:bg-opacity-30 transition-colors"
              aria-label="閉じる"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* 画像コンテナ */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative max-w-[90vw] max-h-[90vh] overflow-auto"
          >
            <img
              src={imageUrl}
              alt={imageAlt}
              className="block"
              style={{
                transform: `scale(${scale})`,
                transition: 'transform 0.2s ease-in-out',
                transformOrigin: 'center',
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain'
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}