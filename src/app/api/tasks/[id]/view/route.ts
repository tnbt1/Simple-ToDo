import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { registerTaskViewer, unregisterTaskViewer } from '@/lib/sse-manager'

// Register user as viewing a task
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: taskId } = await context.params
  registerTaskViewer(taskId, session.user.id)
  
  return NextResponse.json({ success: true })
}

// Unregister user from viewing a task
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: taskId } = await context.params
  unregisterTaskViewer(taskId, session.user.id)
  
  return NextResponse.json({ success: true })
}