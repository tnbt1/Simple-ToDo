import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const session = await getServerSession(authOptions as any) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { shareId } = await params

    // 共有カテゴリー情報を取得
    const sharedCategory = await prisma.sharedCategory.findUnique({
      where: { shareId },
      include: {
        owner: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!sharedCategory) {
      return NextResponse.json({ error: 'カテゴリーが見つかりません' }, { status: 404 })
    }

    // カテゴリーに属するタスクを取得
    const tasks = await prisma.task.findMany({
      where: {
        userId: sharedCategory.ownerId,
        category: sharedCategory.category
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        priority: true,
        status: true,
        completed: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            threadMessages: true
          }
        }
      },
      orderBy: [
        { completed: 'asc' },
        { dueDate: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({
      category: sharedCategory.category,
      owner: sharedCategory.owner,
      tasks
    })
  } catch (error) {
    console.error('Error fetching shared category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}