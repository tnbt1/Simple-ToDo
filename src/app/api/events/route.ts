import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { registerClient, unregisterClient } from '../../../lib/sse-manager'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  console.log('SSE endpoint called')
  const session = await getServerSession(authOptions as any) as Session | null
  
  if (!session?.user?.id) {
    console.log('SSE endpoint: Unauthorized')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const userId = session.user.id
  console.log('SSE endpoint: User authenticated:', userId)
  
  // Create a TransformStream for proper streaming
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  
  // Track if the connection is still active
  let isActive = true
  let heartbeatInterval: NodeJS.Timeout | null = null
  let isClosed = false
  
  // Clean up function
  const cleanup = () => {
    if (isClosed) return // Prevent double cleanup
    isClosed = true
    
    console.log('SSE cleanup for user:', userId)
    isActive = false
    
    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    
    // Unregister client
    unregisterClient(userId)
    
    // Close writer only if not already closed
    if (writer.desiredSize !== null) {
      writer.close().catch((error) => {
        // Ignore ERR_INVALID_STATE errors which occur when already closed
        if (error?.code !== 'ERR_INVALID_STATE') {
          console.error('Error closing writer:', error)
        }
      })
    }
  }
  
  // Handle client disconnect
  request.signal.addEventListener('abort', cleanup, { once: true })
  
  // Start the SSE stream
  ;(async () => {
    try {
      // Register the writer for this client
      registerClient(userId, {
        write: async (data: string) => {
          if (!isActive) {
            console.log('Skipping write to inactive connection:', userId)
            return
          }
          
          try {
            await writer.write(encoder.encode(data))
          } catch (error) {
            console.error('Error writing to SSE stream:', error)
            cleanup()
            throw error // Re-throw to trigger cleanup
          }
        },
        close: cleanup
      } as any)
      
      // Send initial connection message
      if (isActive) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`))
        console.log('SSE connection established for user:', userId)
      }
      
      // Keep connection alive with heartbeat
      heartbeatInterval = setInterval(async () => {
        if (!isActive) {
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            heartbeatInterval = null
          }
          return
        }
        
        try {
          await writer.write(encoder.encode(`: heartbeat ${Date.now()}\n\n`))
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`))
        } catch (error) {
          console.error('Heartbeat error for user:', userId, error)
          cleanup()
        }
      }, 15000) // Send heartbeat every 15 seconds
      
      // Keep the connection open until aborted
      await new Promise<void>((resolve) => {
        const abortHandler = () => {
          console.log('SSE connection aborted for user:', userId)
          resolve()
        }
        
        if (request.signal.aborted) {
          resolve()
        } else {
          request.signal.addEventListener('abort', abortHandler, { once: true })
        }
      })
      
    } catch (error) {
      console.error('SSE stream error for user:', userId, error)
    } finally {
      cleanup()
    }
  })()
  
  // Return the response with proper SSE headers
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Transfer-Encoding': 'chunked',
    },
  })
}