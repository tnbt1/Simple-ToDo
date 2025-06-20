// Store active connections
// Use global to persist across hot reloads in development
declare global {
  var sseClients: Map<string, { write: (data: string) => Promise<void>, close: () => void }> | undefined
  var sseTaskViewers: Map<string, Set<string>> | undefined // taskId -> Set of userIds
}

if (!global.sseClients) {
  global.sseClients = new Map<string, { write: (data: string) => Promise<void>, close: () => void }>()
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
  console.log('[SSE] sendEventToUser called:', { 
    userId, 
    eventSummary, 
    hasClient: clients.has(userId),
    totalClients: clients.size 
  })
  
  const client = clients.get(userId)
  if (client) {
    try {
      const message = `data: ${JSON.stringify(event)}\n\n`
      console.log('[SSE] Sending message to user:', userId, 'Event type:', event.type)
      await client.write(message)
      console.log('[SSE] Message sent successfully to user:', userId)
    } catch (error) {
      console.error('[SSE] Error sending message to user:', userId, error)
      // Client disconnected
      clients.delete(userId)
      console.log('[SSE] Removed disconnected client:', userId)
    }
  } else {
    console.log('[SSE] No active client connection for userId:', userId)
  }
}

// Helper function to broadcast events to all connected users
export async function broadcastEvent(event: any) {
  const message = `data: ${JSON.stringify(event)}\n\n`
  
  for (const [userId, client] of clients.entries()) {
    try {
      await client.write(message)
    } catch (error) {
      // Client disconnected
      clients.delete(userId)
    }
  }
}

// Helper function to register a client
export function registerClient(userId: string, client: { write: (data: string) => Promise<void>, close: () => void }) {
  console.log('[SSE] Registering client:', userId)
  
  // Clean up any existing client for this user
  if (clients.has(userId)) {
    console.log('[SSE] Existing client found for user, cleaning up old connection:', userId)
    unregisterClient(userId)
  }
  
  clients.set(userId, client)
  console.log('[SSE] Client registered. Total clients:', clients.size, 'Active users:', Array.from(clients.keys()))
}

// Helper function to unregister a client
export function unregisterClient(userId: string) {
  console.log('[SSE] Unregistering client:', userId)
  const client = clients.get(userId)
  if (client) {
    try {
      client.close()
    } catch (error) {
      console.error('[SSE] Error closing client:', error)
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
  
  console.log('[SSE] Client unregistered. Total clients:', clients.size, 'Removed from tasks:', removedFromTasks)
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
    console.log(`[SSE] No viewers for task ${taskId}`)
    return
  }
  
  console.log(`[SSE] Broadcasting to ${viewers.size} viewers of task ${taskId}. Event type:`, event.type)
  const message = `data: ${JSON.stringify(event)}\n\n`
  
  let successCount = 0
  let failureCount = 0
  
  for (const userId of viewers) {
    const client = clients.get(userId)
    if (client) {
      try {
        await client.write(message)
        successCount++
        console.log(`[SSE] Event sent to user ${userId} viewing task ${taskId}`)
      } catch (error) {
        failureCount++
        console.error(`[SSE] Error sending to user ${userId}:`, error)
        // Client disconnected
        clients.delete(userId)
        viewers.delete(userId)
      }
    } else {
      console.log(`[SSE] No active connection for viewer ${userId} of task ${taskId}`)
      viewers.delete(userId)
    }
  }
  
  console.log(`[SSE] Broadcast complete for task ${taskId}. Success: ${successCount}, Failed: ${failureCount}`)
}