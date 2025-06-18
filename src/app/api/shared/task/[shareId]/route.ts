import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 共有されたタスクを取得
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await context.params

    console.log('Fetching shared task with shareId:', shareId)

    if (!shareId) {
      return NextResponse.json({ error: '共有IDが必要です' }, { status: 400 })
    }

    // 共有IDでタスクを検索 - shareIdがユニークであるためfindFirstを使用
    const task = await prisma.task.findFirst({
      where: {
        shareId: shareId,
        isShared: true
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
        uniqueId: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    console.log('Found task:', task ? 'Yes' : 'No')

    if (!task) {
      // Try to find any task with this shareId for debugging
      const anyTask = await prisma.task.findFirst({
        where: {
          shareId: shareId
        }
      })
      console.log('Task exists but not shared:', anyTask ? 'Yes' : 'No')
      
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
    }

    // タスクデータを返す
    return NextResponse.json(task)
  } catch (error) {
    console.error('Get shared task error:', error)
    return NextResponse.json({ error: 'タスクの取得に失敗しました' }, { status: 500 })
  }
}