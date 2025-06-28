'use client'

import { SessionProvider } from "next-auth/react"
import { DarkModeProvider } from "./DarkModeProvider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DarkModeProvider>
        {children}
      </DarkModeProvider>
    </SessionProvider>
  )
}