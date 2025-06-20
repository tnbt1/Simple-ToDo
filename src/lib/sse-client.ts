'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface SSEOptions {
  onMessage?: (event: MessageEvent) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  reconnectDelay?: number
  maxReconnectDelay?: number
  maxReconnectAttempts?: number
}

export function useSSE(url: string, options: SSEOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectDelayRef = useRef(options.reconnectDelay || 1000)
  const reconnectAttemptsRef = useRef(0)
  const lastEventIdRef = useRef<string | null>(null)
  const isConnectingRef = useRef(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed' | 'error'>('closed')

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || !url) {
      return
    }
    
    isConnectingRef.current = true
    setConnectionState('connecting')
    console.log('SSE: Attempting to connect to', url)
    
    // Clean up existing connection
    if (eventSourceRef.current) {
      console.log('SSE: Closing existing connection')
      eventSourceRef.current.close()
    }

    try {
      // Build URL with last event ID if available
      const sseUrl = new URL(url, window.location.origin)
      if (lastEventIdRef.current) {
        sseUrl.searchParams.set('lastEventId', lastEventIdRef.current)
      }
      
      const eventSource = new EventSource(sseUrl.toString(), {
        withCredentials: true
      })
      eventSourceRef.current = eventSource
      console.log('SSE: EventSource created')

      eventSource.onopen = () => {
        console.log('SSE connection established')
        setConnectionState('open')
        isConnectingRef.current = false
        reconnectDelayRef.current = options.reconnectDelay || 1000
        reconnectAttemptsRef.current = 0
        options.onOpen?.()
      }

      eventSource.onmessage = (event) => {
        console.log('SSE message received:', event.data)
        
        // Store last event ID for reconnection
        if (event.lastEventId) {
          lastEventIdRef.current = event.lastEventId
        }
        
        try {
          const data = JSON.parse(event.data)
          
          // Handle different message types
          if (data.type === 'heartbeat') {
            console.log('SSE heartbeat received')
            return
          }
          
          if (data.type === 'connected') {
            console.log('SSE connected confirmation received')
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
        setConnectionState('error')
        isConnectingRef.current = false
        options.onError?.(error)
        
        // Close the connection
        eventSource.close()
        
        // Implement reconnection with exponential backoff
        const maxAttempts = options.maxReconnectAttempts || 10
        const maxDelay = options.maxReconnectDelay || 30000
        
        if (reconnectAttemptsRef.current < maxAttempts) {
          reconnectAttemptsRef.current++
          console.log(`SSE: Scheduling reconnect attempt ${reconnectAttemptsRef.current}/${maxAttempts} in ${reconnectDelayRef.current}ms`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            // Exponential backoff with jitter
            const jitter = Math.random() * 0.3 * reconnectDelayRef.current
            reconnectDelayRef.current = Math.min(
              reconnectDelayRef.current * 2 + jitter,
              maxDelay
            )
            connect()
          }, reconnectDelayRef.current)
        } else {
          console.error('SSE: Max reconnection attempts reached')
          setConnectionState('closed')
        }
      }
    } catch (error) {
      console.error('SSE: Failed to create EventSource:', error)
      setConnectionState('error')
      isConnectingRef.current = false
      options.onError?.(new Event('error'))
    }
  }, [url, options])

  useEffect(() => {
    if (!url) {
      console.log('SSE: No URL provided, skipping connection')
      return
    }
    
    connect()

    // Reconnect on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          eventSourceRef.current?.readyState === EventSource.CLOSED) {
        console.log('SSE: Page became visible, reconnecting...')
        connect()
      }
    }
    
    // Reconnect on online event
    const handleOnline = () => {
      if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
        console.log('SSE: Network came online, reconnecting...')
        connect()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
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
    setConnectionState('closed')
  }, [])

  const reconnect = useCallback(() => {
    close()
    reconnectAttemptsRef.current = 0
    reconnectDelayRef.current = options.reconnectDelay || 1000
    connect()
  }, [close, connect, options.reconnectDelay])

  return { close, reconnect, connectionState }
}