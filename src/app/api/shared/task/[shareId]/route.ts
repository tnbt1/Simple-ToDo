import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 共有されたタスクを取得
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await context.params

    if (!shareId) {
      return NextResponse.json({ error: '共有IDが必要です' }, { status: 400 })
    }

    // 共有IDでタスクを検索
    const task = await prisma.task.findUnique({
      where: {
        shareId: shareId,
        isShared: true
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
    }

    // タスクデータを返す
    return NextResponse.json(task)
  } catch (error) {
    console.error('Get shared task error:', error)
    return NextResponse.json({ error: 'タスクの取得に失敗しました' }, { status: 500 })
  }
}