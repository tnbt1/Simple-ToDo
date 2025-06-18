import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { nanoid } from 'nanoid'
import { withLogging, getRequestId, createPrismaContext } from '@/lib/api-wrapper'
import { logSharingEvent } from '@/lib/logger'
import { sendEventToUser } from '../../../../../lib/sse-manager'

// スレッドメッセージを取得
export const GET = withLogging(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as any) as Session | null
  const requestId = getRequestId(request)
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

    const { id: taskId } = await context.params

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      ...createPrismaContext(requestId)
    })

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // タスクの存在確認とアクセス権限確認
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId: user.id },
          { sharedWith: { some: { sharedWithId: user.id } } },
          { isShared: true }
        ]
      },
      ...createPrismaContext(requestId)
    })

    if (!task) {
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
    }

    // スレッドメッセージを取得
    const messages = await prisma.threadMessage.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            image: true
          }
        },
        images: true
      },
      orderBy: { createdAt: 'asc' },
      ...createPrismaContext(requestId)
    })

    return NextResponse.json(messages)
}, { requireAuth: true, logAuth: true })

// スレッドにメッセージを投稿
export const POST = withLogging(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as any) as Session | null
  const requestId = getRequestId(request)
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

    const { id: taskId } = await context.params

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      ...createPrismaContext(requestId)
    })

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // タスクの存在確認とアクセス権限確認
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId: user.id },
          { sharedWith: { some: { sharedWithId: user.id } } },
          { isShared: true }
        ]
      },
      ...createPrismaContext(requestId)
    })

    if (!task) {
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
    }

    // FormDataからデータを取得
    const formData = await request.formData()
    const content = formData.get('content') as string
    
    // 画像処理（簡易実装）
    const images = formData.getAll('images') as File[]
    console.log(`[Thread] Received ${images.length} images for upload`)

    // メッセージまたは画像のいずれかが必要
    if (!content?.trim() && images.length === 0) {
      return NextResponse.json({ error: 'メッセージまたは画像が必要です' }, { status: 400 })
    }

    // メッセージを作成
    const message = await prisma.threadMessage.create({
      data: {
        taskId,
        userId: user.id,
        content: content?.trim() || ''
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            image: true
          }
        },
        images: true
      },
      ...createPrismaContext(requestId)
    })

    // Log thread activity
    logSharingEvent('thread_message_posted', 'task', taskId, user.id, requestId, {
      messageId: message.id,
      hasImages: images.length > 0
    })
    if (images.length > 0) {
      try {
        // 実際の実装では、S3やCloudinaryなどのクラウドストレージを使用することを推奨
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'thread')
        await mkdir(uploadDir, { recursive: true })

        const imagePromises = images.map(async (image, index) => {
          console.log(`[Thread] Processing image ${index + 1}/${images.length}: ${image.name} (${image.size} bytes, ${image.type})`)
          
          // ファイルサイズチェック（5MB制限）
          if (image.size > 5 * 1024 * 1024) {
            console.error(`[Thread] Image too large: ${image.name} (${image.size} bytes)`)
            return null
          }
          
          // MIMEタイプチェック
          if (!image.type.startsWith('image/')) {
            console.error(`[Thread] Invalid file type: ${image.name} (${image.type})`)
            return null
          }
          
          const filename = `${nanoid()}_${image.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          const filepath = join(uploadDir, filename)
          
          try {
            console.log(`[Thread] Converting image to buffer: ${image.name}`)
            const bytes = await image.arrayBuffer()
            const buffer = Buffer.from(bytes)
            
            console.log(`[Thread] Writing file to: ${filepath}`)
            await writeFile(filepath, buffer)
            console.log(`[Thread] File written successfully: ${filename}`)
            
            const threadImage = await prisma.threadImage.create({
              data: {
                messageId: message.id,
                url: `/api/uploads/thread/${filename}`,
                filename: image.name,
                size: image.size,
                mimeType: image.type
              },
              ...createPrismaContext(requestId)
            })
            console.log(`[Thread] Database record created for: ${filename}`)
            
            return threadImage
          } catch (error) {
            console.error('[Thread] Error uploading image:', image.name, error)
            console.error('[Thread] Upload directory:', uploadDir)
            console.error('[Thread] File path:', filepath)
            console.error('[Thread] Error details:', error instanceof Error ? error.message : 'Unknown error')
            return null
          }
        })

        const uploadedImages = (await Promise.all(imagePromises)).filter(img => img !== null)
        message.images = uploadedImages
      } catch (error) {
        console.error('Error processing images:', error)
        // Continue without images if upload fails
      }
    }

    // Send real-time update to task owner
    sendEventToUser(task.userId, {
      type: 'thread-message',
      taskId,
      message
    })

    // If shared, send to all shared users
    if (task.isShared) {
      const sharedWith = await prisma.sharedTask.findMany({
        where: { taskId },
        select: { sharedWithId: true },
        ...createPrismaContext(requestId)
      })
      
      for (const share of sharedWith) {
        sendEventToUser(share.sharedWithId, {
          type: 'thread-message',
          taskId,
          message
        })
      }
    }

    return NextResponse.json(message)
}, { requireAuth: true, logAuth: true })