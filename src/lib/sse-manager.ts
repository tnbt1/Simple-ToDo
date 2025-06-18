// Store active connections
const clients = new Map<string, ReadableStreamDefaultController>()

// Helper function to send events to specific users
export function sendEventToUser(userId: string, event: any) {
  const controller = clients.get(userId)
  if (controller) {
    const encoder = new TextEncoder()
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
    } catch (error) {
      // Client disconnected
      clients.delete(userId)
    }
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
  clients.set(userId, controller)
}

// Helper function to unregister a client
export function unregisterClient(userId: string) {
  clients.delete(userId)
}

// Helper function to get all connected clients
export function getConnectedClients() {
  return Array.from(clients.keys())
}