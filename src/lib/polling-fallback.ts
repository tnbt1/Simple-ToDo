'use client'

import { useEffect, useRef, useCallback } from 'react'

interface PollingOptions {
  interval?: number
  enabled?: boolean
  onData?: (data: any) => void
  onError?: (error: Error) => void
}

export function usePolling(
  fetchFn: () => Promise<any>,
  options: PollingOptions = {}
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastDataRef = useRef<string>('')
  
  const startPolling = useCallback(() => {
    if (!options.enabled || intervalRef.current) {
      return
    }
    
    const poll = async () => {
      try {
        const data = await fetchFn()
        const dataStr = JSON.stringify(data)
        
        // Only trigger callback if data has changed
        if (dataStr !== lastDataRef.current) {
          lastDataRef.current = dataStr
          options.onData?.(data)
        }
      } catch (error) {
        console.error('Polling error:', error)
        options.onError?.(error as Error)
      }
    }
    
    // Initial poll
    poll()
    
    // Set up interval
    intervalRef.current = setInterval(poll, options.interval || 5000)
  }, [fetchFn, options])
  
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])
  
  useEffect(() => {
    if (options.enabled) {
      startPolling()
    } else {
      stopPolling()
    }
    
    return stopPolling
  }, [options.enabled, startPolling, stopPolling])
  
  return { startPolling, stopPolling }
}