import { debug } from './debug'

// Store active connections
// Use global to persist across hot reloads in development
declare global {
  var sseClients: Map<string, Array<{ clientId: string, write: (data: string) => Promise<void>, close: () => void }>> | undefined
  var sseTaskViewers: Map<string, Set<string>> | undefined // taskId -> Set of userIds
}

if (!global.sseClients) {
  global.sseClients = new Map<string, Array<{ clientId: string, write: (data: string) => Promise<void>, close: () => void }>>()
}

if (!global.sseTaskViewers) {
  global.sseTaskViewers = new Map<string, Set<string>>()
}

const clients = global.sseClients
const taskViewers = global.sseTaskViewers

// Helper function to send events to specific users
export async function sendEventToUser(userId: string, event: any) {
  const eventSummary = {
    type: event.type,
    taskId: event.task?.id || event.taskId,
    category: event.task?.category,
    shareId: event.shareId
  }
  
  const userClients = clients.get(userId)
  debug.sse('sendEventToUser called:', { 
    userId, 
    eventSummary, 
    hasClient: !!userClients,
    clientCount: userClients?.length || 0,
    totalUsers: clients.size,
    allUserIds: Array.from(clients.keys())
  })
  
  if (userClients && userClients.length > 0) {
    const message = `data: ${JSON.stringify(event)}\n\n`
    debug.sse('Attempting to send message to', userClients.length, 'client(s) for user:', userId, 'Event type:', event.type)
    
    // Send to all clients for this user with timeout
    const disconnectedClients: string[] = []
    for (const client of userClients) {
      try {
        // タイムアウトを500msに設定
        const writePromise = client.write(message)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SSE write timeout')), 500)
        )
        
        await Promise.race([writePromise, timeoutPromise])
        debug.sse('Message sent successfully to client', client.clientId, 'for user:', userId)
      } catch (error: any) {
        if (error.message === 'SSE write timeout') {
          debug.error('[SSE] Write timeout for client', client.clientId, 'for user:', userId)
        } else {
          debug.error('[SSE] Error sending message to client', client.clientId, 'for user:', userId, 'Error:', error)
        }
        disconnectedClients.push(client.clientId)
      }
    }
    
    // Remove disconnected clients
    if (disconnectedClients.length > 0) {
      const remainingClients = userClients.filter(c => !disconnectedClients.includes(c.clientId))
      if (remainingClients.length > 0) {
        clients.set(userId, remainingClients)
        console.log('[SSE] Removed', disconnectedClients.length, 'disconnected client(s) for user:', userId, 'Remaining:', remainingClients.length)
      } else {
        clients.delete(userId)
        console.log('[SSE] All clients disconnected for user:', userId, 'Removing from clients map')
      }
    }
  } else {
    console.log('[SSE] No active client connections for userId:', userId, 'Active users:', Array.from(clients.keys()))
  }
}

// Helper function to broadcast events to all connected users
export async function broadcastEvent(event: any) {
  const message = `data: ${JSON.stringify(event)}\n\n`
  
  for (const [userId, userClients] of clients.entries()) {
    const disconnectedClients: string[] = []
    for (const client of userClients) {
      try {
        await client.write(message)
      } catch (_error) {
        disconnectedClients.push(client.clientId)
      }
    }
    
    // Remove disconnected clients
    if (disconnectedClients.length > 0) {
      const remainingClients = userClients.filter(c => !disconnectedClients.includes(c.clientId))
      if (remainingClients.length > 0) {
        clients.set(userId, remainingClients)
      } else {
        clients.delete(userId)
      }
    }
  }
}

// Helper function to register a client
export function registerClient(userId: string, client: { write: (data: string) => Promise<void>, close: () => void }) {
  console.log('[SSE] Registering client:', userId)
  
  // Generate a unique client ID
  const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // Get existing clients for this user or create new array
  let userClients = clients.get(userId) || []
  
  // Clean up old connections if too many (keep max 3 per user)
  if (userClients.length >= 3) {
    console.log('[SSE] Too many clients for user, cleaning up old connections:', userClients.length)
    const oldClients = userClients.slice(0, userClients.length - 2)
    for (const oldClient of oldClients) {
      try {
        oldClient.close()
      } catch (_error) {
        console.error('[SSE] Error closing old client:', _error)
      }
    }
    userClients = userClients.slice(-2)
  }
  
  // Add the new client
  userClients.push({
    clientId,
    write: client.write,
    close: client.close
  })
  
  clients.set(userId, userClients)
  console.log('[SSE] Client registered. Client ID:', clientId, 'Total clients for user:', userClients.length, 'Total users:', clients.size)
  
  return clientId
}

// Helper function to unregister a client
export function unregisterClient(userId: string, clientId?: string) {
  console.log('[SSE] Unregistering client:', userId, 'Client ID:', clientId || 'all')
  
  const userClients = clients.get(userId)
  if (!userClients) {
    console.log('[SSE] No clients found for user:', userId)
    return
  }
  
  if (clientId) {
    // Remove specific client
    const clientToRemove = userClients.find(c => c.clientId === clientId)
    if (clientToRemove) {
      try {
        clientToRemove.close()
      } catch (_error) {
        console.error('[SSE] Error closing client:', _error)
      }
    }
    
    const remainingClients = userClients.filter(c => c.clientId !== clientId)
    if (remainingClients.length > 0) {
      clients.set(userId, remainingClients)
      console.log('[SSE] Client unregistered. Remaining clients for user:', remainingClients.length)
    } else {
      clients.delete(userId)
      console.log('[SSE] All clients unregistered for user:', userId)
      
      // Also remove this user from all task viewer lists
      let removedFromTasks = 0
      for (const [taskId, viewers] of taskViewers.entries()) {
        if (viewers.has(userId)) {
          viewers.delete(userId)
          removedFromTasks++
          if (viewers.size === 0) {
            taskViewers.delete(taskId)
          }
        }
      }
      console.log('[SSE] Removed from tasks:', removedFromTasks)
    }
  } else {
    // Remove all clients for this user
    for (const client of userClients) {
      try {
        client.close()
      } catch (_error) {
        console.error('[SSE] Error closing client:', _error)
      }
    }
    clients.delete(userId)
    
    // Also remove this user from all task viewer lists
    let removedFromTasks = 0
    for (const [taskId, viewers] of taskViewers.entries()) {
      if (viewers.has(userId)) {
        viewers.delete(userId)
        removedFromTasks++
        if (viewers.size === 0) {
          taskViewers.delete(taskId)
        }
      }
    }
    
    console.log('[SSE] All clients unregistered. Total users:', clients.size, 'Removed from tasks:', removedFromTasks)
  }
}

// Helper function to get all connected clients
export function getConnectedClients() {
  return Array.from(clients.keys())
}

// Helper function to register a user viewing a task
export function registerTaskViewer(taskId: string, userId: string) {
  if (!taskViewers.has(taskId)) {
    taskViewers.set(taskId, new Set())
  }
  taskViewers.get(taskId)!.add(userId)
  console.log(`[SSE] User ${userId} is now viewing task ${taskId}. Total viewers:`, taskViewers.get(taskId)!.size)
}

// Helper function to unregister a user from viewing a task
export function unregisterTaskViewer(taskId: string, userId: string) {
  const viewers = taskViewers.get(taskId)
  if (viewers) {
    viewers.delete(userId)
    console.log(`[SSE] User ${userId} stopped viewing task ${taskId}. Remaining viewers:`, viewers.size)
    if (viewers.size === 0) {
      taskViewers.delete(taskId)
      console.log(`[SSE] No more viewers for task ${taskId}, removing from tracking`)
    }
  } else {
    console.log(`[SSE] No viewer list found for task ${taskId}`)
  }
}

// Helper function to send event to all users viewing a specific task
export async function sendEventToTaskViewers(taskId: string, event: any) {
  const viewers = taskViewers.get(taskId)
  if (!viewers || viewers.size === 0) {
    console.log(`[SSE] No viewers for task/share ${taskId}`)
    return
  }
  
  console.log(`[SSE] Broadcasting to ${viewers.size} viewers of ${taskId}. Event type: ${event.type}, Viewers:`, Array.from(viewers))
  const message = `data: ${JSON.stringify(event)}\n\n`
  
  let successCount = 0
  let failureCount = 0
  
  for (const userId of viewers) {
    const userClients = clients.get(userId)
    if (userClients && userClients.length > 0) {
      // Send to all clients for this user with timeout
      for (const client of userClients) {
        try {
          // タイムアウトを500msに設定
          const writePromise = client.write(message)
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('SSE write timeout')), 500)
          )
          
          await Promise.race([writePromise, timeoutPromise])
          successCount++
          console.log(`[SSE] Event sent to user ${userId} (client ${client.clientId}) viewing ${taskId}`)
        } catch (error: any) {
          failureCount++
          if (error.message === 'SSE write timeout') {
            console.error(`[SSE] Write timeout for user ${userId} (client ${client.clientId})`)
          } else {
            console.error(`[SSE] Error sending to user ${userId} (client ${client.clientId}):`, error)
          }
        }
      }
    } else {
      console.log(`[SSE] No active connections for viewer ${userId} of ${taskId}`)
      viewers.delete(userId)
    }
  }
  
  console.log(`[SSE] Broadcast complete for ${taskId}. Success: ${successCount}, Failed: ${failureCount}`)
  
  // If this was for a share: prefix, also log current state
  if (taskId.startsWith('share:')) {
    console.log(`[SSE] Current viewers for ${taskId}:`, viewers.size > 0 ? Array.from(viewers) : 'none')
  }
}