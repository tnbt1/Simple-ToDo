import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

// カテゴリー共有の作成
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { category } = await params
    const decodedCategory = decodeURIComponent(category)

    // ユーザーがこのカテゴリーのタスクを持っているか確認
    const tasksInCategory = await prisma.task.count({
      where: {
        userId: session.user.id,
        category: decodedCategory
      }
    })

    if (tasksInCategory === 0) {
      return NextResponse.json({ error: 'このカテゴリーにタスクが存在しません' }, { status: 404 })
    }

    // カテゴリーのuniqueIdを取得
    const categoryData = await prisma.category.findFirst({
      where: {
        name: decodedCategory,
        userId: session.user.id
      }
    })

    if (!categoryData) {
      return NextResponse.json({ error: 'カテゴリーが見つかりません' }, { status: 404 })
    }

    // 既存の共有を確認
    const existingShare = await prisma.sharedCategory.findFirst({
      where: {
        category: decodedCategory,
        ownerId: session.user.id
      }
    })

    if (existingShare) {
      return NextResponse.json({ shareUrl: `/shared/category/${existingShare.shareId}` })
    }

    // 新しい共有を作成
    const shareId = nanoid(10)
    await prisma.sharedCategory.create({
      data: {
        category: decodedCategory,
        categoryUniqueId: categoryData.uniqueId,
        ownerId: session.user.id,
        sharedWithId: session.user.id, // 最初は自分自身と共有
        shareId
      }
    })

    return NextResponse.json({ shareUrl: `/shared/category/${shareId}` })
  } catch (error) {
    console.error('Error creating category share:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// カテゴリー共有の取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { category } = await params
    const decodedCategory = decodeURIComponent(category)

    const sharedCategory = await prisma.sharedCategory.findFirst({
      where: {
        category: decodedCategory,
        ownerId: session.user.id
      }
    })

    if (!sharedCategory) {
      return NextResponse.json({ shared: false })
    }

    return NextResponse.json({ 
      shared: true,
      shareUrl: `/shared/category/${sharedCategory.shareId}`
    })
  } catch (error) {
    console.error('Error fetching category share:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}