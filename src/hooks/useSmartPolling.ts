import { useEffect, useRef, useCallback } from 'react'

interface UseSmartPollingOptions {
  enabled: boolean
  interval: number
  onUpdate?: (data: any) => void
  taskIds?: string[]
  categories?: string[]
}

export function useSmartPolling({ 
  enabled, 
  interval, 
  onUpdate,
  taskIds = [],
  categories = []
}: UseSmartPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<string | null>(null)

  const checkForUpdates = useCallback(async () => {
    if (!enabled || (taskIds.length === 0 && categories.length === 0)) {
      return
    }

    try {
      const response = await fetch('/api/updates/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskIds, categories })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Only trigger update if timestamp has changed
        if (data.timestamp !== lastUpdateRef.current) {
          lastUpdateRef.current = data.timestamp
          onUpdate?.(data)
          console.log('[SmartPolling] Updates detected:', data.tasks.length, 'tasks')
        }
      }
    } catch (error) {
      console.error('[SmartPolling] Error checking for updates:', error)
    }
  }, [enabled, taskIds, categories, onUpdate])

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Check immediately
    checkForUpdates()

    // Set up interval
    intervalRef.current = setInterval(checkForUpdates, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, interval, checkForUpdates])

  return { checkForUpdates }
}