import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { sendEventToUser } from '../../../lib/sse-manager'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const body = await request.json()
  
  // Send test event
  sendEventToUser(userId, {
    type: 'test',
    message: body.message || 'Test SSE event',
    timestamp: new Date().toISOString()
  })

  return NextResponse.json({ 
    success: true, 
    message: 'Test event sent',
    userId 
  })
}