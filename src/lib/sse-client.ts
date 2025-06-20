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
    console.log('SSE: Attempting to connect to', url)
    
    // Clean up existing connection
    if (eventSourceRef.current) {
      console.log('SSE: Closing existing connection')
      eventSourceRef.current.close()
    }

    try {
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource
      console.log('SSE: EventSource created')

      eventSource.onopen = () => {
        console.log('SSE connection established')
        reconnectDelayRef.current = options.reconnectDelay || 5000
        options.onOpen?.()
      }

    eventSource.onmessage = (event) => {
      console.log('SSE message received:', event.data)
      try {
        const data = JSON.parse(event.data)
        
        // Ignore heartbeat messages
        if (data.type === 'heartbeat') {
          console.log('SSE heartbeat received')
          return
        }
        
        console.log('SSE data:', data)
        options.onMessage?.(event)
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      console.error('SSE readyState:', eventSource.readyState)
      options.onError?.(error)
      
      // Reconnect with exponential backoff
      eventSource.close()
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('SSE: Attempting to reconnect...')
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 60000)
        connect()
      }, reconnectDelayRef.current)
    }
    } catch (error) {
      console.error('SSE: Failed to create EventSource:', error)
      options.onError?.(new Event('error'))
    }
  }, [url, options])

  useEffect(() => {
    if (!url) {
      console.log('SSE: No URL provided, skipping connection')
      return
    }
    
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect, url])

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