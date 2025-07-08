import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getConnectedClients } from '@/lib/sse-manager'

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Allow in development mode or with special header
  if (process.env.NODE_ENV === 'production' && _request.headers.get('x-debug-key') !== 'debug-sse-2024') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const connectedClients = getConnectedClients()
  
  // Get viewer data (we'll need to export this from sse-manager)
  const taskViewers = (global as { sseTaskViewers?: Map<string, Set<string>> }).sseTaskViewers || new Map()
  const viewerData: Record<string, string[]> = {}
  
  for (const [taskId, viewers] of taskViewers.entries()) {
    viewerData[taskId] = Array.from(viewers)
  }

  return NextResponse.json({
    connectedClients,
    activeConnections: connectedClients.length,
    taskViewers: viewerData,
    currentUserId: session.user.id
  })
}