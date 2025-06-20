import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Debug endpoint to check current task viewers (development only)
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }
  
  const session = await getServerSession(authOptions as any) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Access the global task viewers map
  const taskViewers = global.sseTaskViewers || new Map()
  const connectedClients = global.sseClients || new Map()
  
  const viewers: Record<string, string[]> = {}
  for (const [taskId, userSet] of taskViewers.entries()) {
    viewers[taskId] = Array.from(userSet)
  }
  
  return NextResponse.json({
    taskViewers: viewers,
    connectedClients: Array.from(connectedClients.keys()),
    totalTasks: taskViewers.size,
    totalClients: connectedClients.size
  })
}