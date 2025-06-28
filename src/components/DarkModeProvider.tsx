'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface DarkModeContextType {
  darkMode: boolean
  setDarkMode: (value: boolean) => void
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined)

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  // LocalStorageから初期値を読み込む
  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved) {
      const isDark = JSON.parse(saved)
      setDarkMode(isDark)
      if (isDark) {
        document.documentElement.classList.add('dark')
      }
    }
    setMounted(true)
  }, [])

  // ダークモードの変更を反映
  useEffect(() => {
    if (!mounted) return
    
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode, mounted])

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  )
}

export function useDarkMode() {
  const context = useContext(DarkModeContext)
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider')
  }
  return context
}