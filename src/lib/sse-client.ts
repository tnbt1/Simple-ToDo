'use client'

import { useEffect, useRef, useCallback } from 'react'

interface SSEOptions {
  onMessage?: (event: MessageEvent) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  reconnectDelay?: number
}

export function useSSE(url: string, options: SSEOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectDelayRef = useRef(options.reconnectDelay || 5000)

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('SSE connection established')
      reconnectDelayRef.current = options.reconnectDelay || 5000
      options.onOpen?.()
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // Ignore heartbeat messages
        if (data.type === 'heartbeat') return
        
        options.onMessage?.(event)
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      options.onError?.(error)
      
      // Reconnect with exponential backoff
      eventSource.close()
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...')
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 60000)
        connect()
      }, reconnectDelayRef.current)
    }
  }, [url, options])

  useEffect(() => {
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  return { close }
}