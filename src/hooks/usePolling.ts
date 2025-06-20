'use client'

import { useEffect, useRef } from 'react'

interface PollingOptions {
  onData?: (data: any) => void
  interval?: number
  enabled?: boolean
}

export function usePolling(url: string, options: PollingOptions = {}) {
  const { 
    onData, 
    interval = 5000, 
    enabled = true 
  } = options
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!enabled) return

    const fetchData = async () => {
      try {
        const response = await fetch(`${url}?since=${lastFetchRef.current}`)
        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0) {
            lastFetchRef.current = Date.now()
            onData?.(data)
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }

    // Initial fetch
    fetchData()

    // Set up interval
    intervalRef.current = setInterval(fetchData, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [url, interval, enabled, onData])
}