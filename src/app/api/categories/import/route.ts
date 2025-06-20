import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEventToUser } from '@/lib/sse-manager'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions as any) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { shareId, newCategoryName } = body

    if (!shareId) {
      return NextResponse.json({ error: '共有IDが必要です' }, { status: 400 })
    }

    // 共有カテゴリー情報を取得
    const sharedCategory = await prisma.sharedCategory.findUnique({
      where: { shareId },
      include: {
        owner: true
      }
    })

    if (!sharedCategory) {
      return NextResponse.json({ error: 'カテゴリーが見つかりません' }, { status: 404 })
    }

    // 使用するカテゴリー名（新しい名前が指定されていればそれを使用）
    const categoryName = newCategoryName || sharedCategory.category

    // カテゴリーが存在しない場合は作成
    const category = await prisma.category.upsert({
      where: {
        name_userId: {
          name: categoryName,
          userId: session.user.id
        }
      },
      update: {},
      create: {
        name: categoryName,
        userId: session.user.id
      }
    })

    // 元のカテゴリーのタスクを取得
    const originalTasks = await prisma.task.findMany({
      where: {
        userId: sharedCategory.ownerId,
        category: sharedCategory.category
      }
    })

    // タスクをインポート（複製）- 重複チェックあり
    const importedTasks = await Promise.all(
      originalTasks.map(async (task) => {
        // 既にインポート済みかチェック
        const existingTask = await prisma.task.findFirst({
          where: {
            userId: session.user.id,
            originalUniqueId: task.uniqueId
          }
        })

        if (existingTask) {
          return existingTask // 既存のタスクを返す
        }

        return prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            priority: task.priority,
            status: 'PENDING', // 新しいタスクは未着手から開始
            completed: false,
            tags: task.tags,
            category: categoryName,
            userId: session.user.id,
            importedFromTaskId: task.id,
            importedFromUserId: sharedCategory.ownerId,
            originalUniqueId: task.uniqueId
          }
        })
      })
    )

    // インポート履歴を記録（SharedCategoryへの新規追加は行わない）
    // shareIdはユニーク制約があるため、同じshareIdで複数のレコードを作成できない
    // インポートの記録は、タスクの importedFromUserId と importedFromTaskId で管理する

    // リアルタイム通知
    importedTasks.forEach(task => {
      sendEventToUser(session.user.id, {
        type: 'task-created',
        task
      })
    })

    return NextResponse.json({ 
      success: true,
      importedCount: importedTasks.length,
      category: categoryName
    })
  } catch (error) {
    console.error('Error importing category:', error)
    
    // Prismaエラーの詳細を返す
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json({ 
          error: 'このカテゴリーは既にインポート済みです',
          success: false 
        }, { status: 409 })
      }
      
      return NextResponse.json({ 
        error: error.message || 'カテゴリーのインポート中にエラーが発生しました',
        success: false 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      error: 'カテゴリーのインポート中にエラーが発生しました',
      success: false 
    }, { status: 500 })
  }
}