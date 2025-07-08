import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { registerTaskViewer, unregisterTaskViewer } from '@/lib/sse-manager'

// Register user as viewing a shared category
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ shareId: string }> }
) {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { shareId } = await context.params
  // Register viewer with share:{shareId} as the viewer ID
  registerTaskViewer(`share:${shareId}`, session.user.id)
  console.log(`[Category View] User ${session.user.id} is now viewing shared category ${shareId}`)
  
  return NextResponse.json({ success: true })
}

// Unregister user from viewing a shared category
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ shareId: string }> }
) {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { shareId } = await context.params
  unregisterTaskViewer(`share:${shareId}`, session.user.id)
  console.log(`[Category View] User ${session.user.id} stopped viewing shared category ${shareId}`)
  
  return NextResponse.json({ success: true })
}