import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { getConnectedClients } from '../../../../lib/sse-manager'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions as any) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connectedClients = getConnectedClients()
  const isCurrentUserConnected = connectedClients.includes(session.user.id)
  
  return NextResponse.json({
    totalConnections: connectedClients.length,
    currentUserConnected: isCurrentUserConnected,
    currentUserId: session.user.id,
    connectedUserIds: process.env.NODE_ENV === 'development' ? connectedClients : undefined,
    timestamp: new Date().toISOString()
  })
}