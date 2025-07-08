import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { withLogging, getRequestId, createPrismaContext } from '@/lib/api-wrapper'
import { logSharingEvent } from '@/lib/logger'

// タスクの共有URLを生成
export const POST = withLogging(async (request: NextRequest) => {
  const session = await getServerSession(authOptions) as Session | null
  const requestId = getRequestId(request)
  
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
      },
      ...createPrismaContext(requestId)
    })

    if (!task) {
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
    }

    // インポートされたタスクは再共有できない
    if (task.importedFromTaskId) {
      return NextResponse.json({ 
        error: 'インポートされたタスクは共有できません。元のタスクを共有してください。' 
      }, { status: 400 })
    }

    // 既に共有URLがある場合はそれを返す
    if (task.shareId) {
      // Get the proper base URL from request headers
      const forwardedHost = request.headers.get('x-forwarded-host')
      const forwardedProto = request.headers.get('x-forwarded-proto')
      const _host = request.headers.get('host')
      
      const baseUrl = forwardedHost
        ? `${forwardedProto || 'https'}://${forwardedHost}`
        : `${request.url.split('/').slice(0, 3).join('/')}`
      
      const shareUrl = `${baseUrl}/shared/task/${task.shareId}`
      return NextResponse.json({ shareUrl, shareId: task.shareId })
    }

    // 新しい共有IDを生成
    const shareId = nanoid(10)

    // タスクを共有可能に更新
    const _updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        shareId,
        isShared: true
      },
      ...createPrismaContext(requestId)
    })

    // Log sharing event
    logSharingEvent('task_shared', 'task', taskId, session.user.id!, requestId, {
      shareId,
      permission
    })

    // Get the proper base URL from request headers
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const _host = request.headers.get('host')
    
    const baseUrl = forwardedHost
      ? `${forwardedProto || 'https'}://${forwardedHost}`
      : `${request.url.split('/').slice(0, 3).join('/')}`
    
    const shareUrl = `${baseUrl}/shared/task/${shareId}`

    return NextResponse.json({
      shareUrl,
      shareId,
      message: 'タスクの共有URLが生成されました'
    })
}, { requireAuth: true, logAuth: true })

// 共有を解除
export const DELETE = withLogging(async (request: NextRequest) => {
  const session = await getServerSession(authOptions) as Session | null
  const requestId = getRequestId(request)
  
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
      },
      ...createPrismaContext(requestId)
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
      },
      ...createPrismaContext(requestId)
    })

    // 関連する共有情報も削除
    await prisma.sharedTask.deleteMany({
      where: { taskId },
      ...createPrismaContext(requestId)
    })

    await prisma.taskPermission.deleteMany({
      where: { taskId },
      ...createPrismaContext(requestId)
    })

    // Log unsharing event
    logSharingEvent('task_unshared', 'task', taskId, session.user.id!, requestId)

    return NextResponse.json({ message: 'タスクの共有が解除されました' })
}, { requireAuth: true, logAuth: true })