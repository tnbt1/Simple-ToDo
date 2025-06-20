// Store active connections
// Use global to persist across hot reloads in development
declare global {
  var sseClients: Map<string, ReadableStreamDefaultController> | undefined
  var sseTaskViewers: Map<string, Set<string>> | undefined // taskId -> Set of userIds
}

if (!global.sseClients) {
  global.sseClients = new Map<string, ReadableStreamDefaultController>()
}

if (!global.sseTaskViewers) {
  global.sseTaskViewers = new Map<string, Set<string>>()
}

const clients = global.sseClients
const taskViewers = global.sseTaskViewers

// Helper function to send events to specific users
export function sendEventToUser(userId: string, event: any) {
  console.log('sendEventToUser called:', { userId, event, clientCount: clients.size })
  const controller = clients.get(userId)
  if (controller) {
    const encoder = new TextEncoder()
    try {
      const message = `data: ${JSON.stringify(event)}\n\n`
      console.log('Sending SSE message:', message)
      controller.enqueue(encoder.encode(message))
      console.log('SSE message sent successfully')
    } catch (error) {
      console.error('Error sending SSE message:', error)
      // Client disconnected
      clients.delete(userId)
    }
  } else {
    console.log('No controller found for userId:', userId)
  }
}

// Helper function to broadcast events to all connected users
export function broadcastEvent(event: any) {
  const encoder = new TextEncoder()
  const message = encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
  
  for (const [userId, controller] of clients.entries()) {
    try {
      controller.enqueue(message)
    } catch (error) {
      // Client disconnected
      clients.delete(userId)
    }
  }
}

// Helper function to register a client
export function registerClient(userId: string, controller: ReadableStreamDefaultController) {
  console.log('Registering client:', userId)
  clients.set(userId, controller)
  console.log('Client registered. Total clients:', clients.size)
}

// Helper function to unregister a client
export function unregisterClient(userId: string) {
  console.log('Unregistering client:', userId)
  clients.delete(userId)
  
  // Also remove this user from all task viewer lists
  for (const [taskId, viewers] of taskViewers.entries()) {
    if (viewers.has(userId)) {
      viewers.delete(userId)
      if (viewers.size === 0) {
        taskViewers.delete(taskId)
      }
      console.log(`Removed ${userId} from viewers of task ${taskId}`)
    }
  }
  
  console.log('Client unregistered. Total clients:', clients.size)
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
  console.log(`User ${userId} is now viewing task ${taskId}`)
}

// Helper function to unregister a user from viewing a task
export function unregisterTaskViewer(taskId: string, userId: string) {
  const viewers = taskViewers.get(taskId)
  if (viewers) {
    viewers.delete(userId)
    if (viewers.size === 0) {
      taskViewers.delete(taskId)
    }
  }
  console.log(`User ${userId} stopped viewing task ${taskId}`)
}

// Helper function to send event to all users viewing a specific task
export function sendEventToTaskViewers(taskId: string, event: any) {
  const viewers = taskViewers.get(taskId)
  if (!viewers) {
    console.log(`No viewers for task ${taskId}`)
    return
  }
  
  console.log(`Broadcasting to ${viewers.size} viewers of task ${taskId}`)
  const encoder = new TextEncoder()
  const message = encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
  
  for (const userId of viewers) {
    const controller = clients.get(userId)
    if (controller) {
      try {
        controller.enqueue(message)
        console.log(`Event sent to user ${userId} viewing task ${taskId}`)
      } catch (error) {
        console.error(`Error sending to user ${userId}:`, error)
        // Client disconnected
        clients.delete(userId)
        viewers.delete(userId)
      }
    }
  }
}