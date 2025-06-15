import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { nanoid } from 'nanoid'

// カテゴリーの共有URLを生成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { category, permission = 'VIEW' } = body

    if (!category) {
      return NextResponse.json({ error: 'カテゴリー名が必要です' }, { status: 400 })
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // 既存の共有設定を確認
    const existingShare = await prisma.sharedCategory.findFirst({
      where: {
        category,
        ownerId: user.id
      }
    })

    if (existingShare) {
      const shareUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3100'}/shared/category/${existingShare.shareId}`
      return NextResponse.json({ shareUrl, shareId: existingShare.shareId })
    }

    // 新しい共有IDを生成
    const shareId = nanoid(10)

    // カテゴリー共有情報を作成
    const sharedCategory = await prisma.sharedCategory.create({
      data: {
        category,
        ownerId: user.id,
        sharedWithId: user.id, // 初期値として自分自身を設定
        permission,
        shareId
      }
    })

    // カテゴリー内のすべてのタスクを共有可能にする
    await prisma.task.updateMany({
      where: {
        category,
        userId: user.id
      },
      data: {
        isShared: true
      }
    })

    const shareUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3100'}/shared/category/${shareId}`

    return NextResponse.json({
      shareUrl,
      shareId,
      message: 'カテゴリーの共有URLが生成されました'
    })
  } catch (error) {
    console.error('Share category error:', error)
    return NextResponse.json({ error: '共有URLの生成に失敗しました' }, { status: 500 })
  }
}

// カテゴリーの共有を解除
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    if (!category) {
      return NextResponse.json({ error: 'カテゴリー名が必要です' }, { status: 400 })
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // 共有設定を削除
    await prisma.sharedCategory.deleteMany({
      where: {
        category,
        ownerId: user.id
      }
    })

    // カテゴリー内のタスクの共有を解除
    await prisma.task.updateMany({
      where: {
        category,
        userId: user.id
      },
      data: {
        isShared: false
      }
    })

    return NextResponse.json({ message: 'カテゴリーの共有が解除されました' })
  } catch (error) {
    console.error('Unshare category error:', error)
    return NextResponse.json({ error: '共有の解除に失敗しました' }, { status: 500 })
  }
}