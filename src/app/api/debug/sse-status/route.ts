import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getConnectedClients } from '@/lib/sse-manager'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions as any) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const connectedClients = getConnectedClients()
  
  // Get viewer data (we'll need to export this from sse-manager)
  const taskViewers = (global as any).sseTaskViewers || new Map()
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