import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { nanoid } from 'nanoid'

// スレッドメッセージを取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id: taskId } = params

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
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
      }
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
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Get thread messages error:', error)
    return NextResponse.json({ error: 'メッセージの取得に失敗しました' }, { status: 500 })
  }
}

// スレッドにメッセージを投稿
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id: taskId } = params

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
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
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 })
    }

    // FormDataからデータを取得
    const formData = await request.formData()
    const content = formData.get('content') as string

    if (!content?.trim()) {
      return NextResponse.json({ error: 'メッセージ内容が必要です' }, { status: 400 })
    }

    // メッセージを作成
    const message = await prisma.threadMessage.create({
      data: {
        taskId,
        userId: user.id,
        content: content.trim()
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
      }
    })

    // 画像処理（簡易実装）
    const images = formData.getAll('images') as File[]
    if (images.length > 0) {
      // 実際の実装では、S3やCloudinaryなどのクラウドストレージを使用することを推奨
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'thread')
      await mkdir(uploadDir, { recursive: true })

      const imagePromises = images.map(async (image) => {
        const bytes = await image.arrayBuffer()
        const buffer = Buffer.from(bytes)
        
        const filename = `${nanoid()}_${image.name}`
        const filepath = join(uploadDir, filename)
        
        await writeFile(filepath, buffer)
        
        return prisma.threadImage.create({
          data: {
            messageId: message.id,
            url: `/uploads/thread/${filename}`,
            filename: image.name,
            size: image.size,
            mimeType: image.type
          }
        })
      })

      const uploadedImages = await Promise.all(imagePromises)
      message.images = uploadedImages
    }

    return NextResponse.json(message)
  } catch (error) {
    console.error('Post thread message error:', error)
    return NextResponse.json({ error: 'メッセージの投稿に失敗しました' }, { status: 500 })
  }
}