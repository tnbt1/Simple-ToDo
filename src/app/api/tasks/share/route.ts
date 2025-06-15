import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

// タスクの共有URLを生成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as Session | null
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { taskId, permission = 'VIEW' } = body

    if (!taskId) {
      return NextResponse.json({ error: 'タスクIDが必要です' }, { status: 400 })
    }

    // タスクの存在確認と所有者確認
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        user: { email: session.user.email }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
    }

    // 既に共有URLがある場合はそれを返す
    if (task.shareId) {
      const shareUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3100'}/shared/task/${task.shareId}`
      return NextResponse.json({ shareUrl, shareId: task.shareId })
    }

    // 新しい共有IDを生成
    const shareId = nanoid(10)

    // タスクを共有可能に更新
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        shareId,
        isShared: true
      }
    })

    const shareUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3100'}/shared/task/${shareId}`

    return NextResponse.json({
      shareUrl,
      shareId,
      message: 'タスクの共有URLが生成されました'
    })
  } catch (error) {
    console.error('Share task error:', error)
    return NextResponse.json({ error: '共有URLの生成に失敗しました' }, { status: 500 })
  }
}

// 共有を解除
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as Session | null
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'タスクIDが必要です' }, { status: 400 })
    }

    // タスクの存在確認と所有者確認
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        user: { email: session.user.email }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
    }

    // 共有を解除
    await prisma.task.update({
      where: { id: taskId },
      data: {
        shareId: null,
        isShared: false
      }
    })

    // 関連する共有情報も削除
    await prisma.sharedTask.deleteMany({
      where: { taskId }
    })

    await prisma.taskPermission.deleteMany({
      where: { taskId }
    })

    return NextResponse.json({ message: 'タスクの共有が解除されました' })
  } catch (error) {
    console.error('Unshare task error:', error)
    return NextResponse.json({ error: '共有の解除に失敗しました' }, { status: 500 })
  }
}