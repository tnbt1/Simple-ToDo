import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import type { Session } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import { withLogging, getRequestId, createPrismaContext } from "../../../lib/api-wrapper"
import { logDatabaseQuery } from "../../../lib/logger"
import { sendEventToUser, sendEventToTaskViewers } from "../../../lib/sse-manager"

export const GET = withLogging(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as any) as Session | null
  const requestId = getRequestId(request)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id
    },
    orderBy: [
      { position: 'asc' },
      { createdAt: 'desc' }
    ],
    include: {
      _count: {
        select: {
          threadMessages: true
        }
      },
      importedFromUser: {
        select: {
          name: true,
          email: true
        }
      },
      sharedWith: {
        select: {
          sharedWithId: true,
          sharedBy: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    },
    ...createPrismaContext(requestId)
  })

  return NextResponse.json(tasks)
}, { requireAuth: true, logAuth: true })

export const POST = withLogging(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as any) as Session | null
  const requestId = getRequestId(request)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, dueDate, priority, status, tags, category, importedFromTaskId, importedFromUserId, originalUniqueId } = body

  console.log('Creating task with originalUniqueId:', originalUniqueId)
  console.log('Full request body:', JSON.stringify(body, null, 2))

  // Validate required fields
  if (!title || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  // Validate priority
  if (priority && !['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
    return NextResponse.json({ error: "Invalid priority value" }, { status: 400 })
  }

  // Validate status
  if (status && !['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
  }

  // Validate and parse dueDate
  let parsedDueDate = null
  if (dueDate) {
    parsedDueDate = new Date(dueDate)
    if (isNaN(parsedDueDate.getTime())) {
      return NextResponse.json({ error: "Invalid due date format" }, { status: 400 })
    }
  }

  // インポート時の重複チェック
  if (originalUniqueId) {
    const existingTask = await prisma.task.findFirst({
      where: {
        userId: session.user.id,
        originalUniqueId: originalUniqueId
      },
      ...createPrismaContext(requestId)
    })

    if (existingTask) {
      console.log('Duplicate task found:', existingTask.id, existingTask.title)
      return NextResponse.json({ 
        error: "このタスクは既にインポートされています", 
        existingTask 
      }, { status: 409 })
    }
  }

  // タイトルとカテゴリーでの追加重複チェック（インポート時のみ）
  if (importedFromTaskId && title && category) {
    const duplicateByTitle = await prisma.task.findFirst({
      where: {
        userId: session.user.id,
        title: title.trim(),
        category: category.trim(),
        importedFromTaskId: { not: null }
      },
      ...createPrismaContext(requestId)
    })

    if (duplicateByTitle) {
      console.log('Duplicate by title/category found:', duplicateByTitle.id)
      return NextResponse.json({ 
        error: "同じタイトルとカテゴリーのタスクが既に存在します", 
        existingTask: duplicateByTitle 
      }, { status: 409 })
    }
  }

  // 共有元ユーザーのIDを取得（メールアドレスから）
  let importedFromUserIdResolved = null
  if (importedFromUserId) {
    const importedUser = await prisma.user.findUnique({
      where: { email: importedFromUserId },
      select: { id: true },
      ...createPrismaContext(requestId)
    })
    if (importedUser) {
      importedFromUserIdResolved = importedUser.id
    }
  }

  // カテゴリーの管理
  if (category && category.trim()) {
    // カテゴリーが存在しない場合は作成
    await prisma.category.upsert({
      where: {
        name_userId: {
          name: category.trim(),
          userId: session.user.id
        }
      },
      update: {},
      create: {
        name: category.trim(),
        userId: session.user.id
      },
      ...createPrismaContext(requestId)
    })
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description ? description.trim() : null,
      dueDate: parsedDueDate,
      priority: priority || 'MEDIUM',
      status: status || 'PENDING',
      tags: Array.isArray(tags) ? tags : [],
      category: category && category.trim() ? category.trim() : null,
      userId: session.user.id,
      importedFromTaskId: importedFromTaskId || null,
      importedFromUserId: importedFromUserIdResolved,
      originalUniqueId: originalUniqueId || null,
    },
    include: {
      _count: {
        select: {
          threadMessages: true
        }
      },
      importedFromUser: {
        select: {
          name: true,
          email: true
        }
      },
      sharedWith: {
        select: {
          sharedWithId: true,
          sharedBy: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    },
    ...createPrismaContext(requestId)
  })

  // Send real-time update
  console.log('Sending task-created event for user:', session.user.id)
  await sendEventToUser(session.user.id, {
    type: 'task-created',
    task
  })
  console.log('Task-created event sent')

  // Send update to all users viewing tasks in this category
  if (task.category) {
    console.log('Sending updates to category viewers for category:', task.category)
    await sendEventToTaskViewers(`category:${task.category}`, {
      type: 'task-created',
      task
    })
  }

  // Check if this category is shared and notify shared users
  if (task.category) {
    const sharedCategories = await prisma.sharedCategory.findMany({
      where: {
        category: task.category,
        ownerId: session.user.id
      },
      select: {
        shareId: true,
        sharedWithId: true
      },
      ...createPrismaContext(requestId)
    })

    console.log(`Sending shared-category-task-created to ${sharedCategories.length} category viewers`)
    // Notify all users who have this category shared with them
    for (const share of sharedCategories) {
      await sendEventToUser(share.sharedWithId, {
        type: 'shared-category-task-created',
        task
      })

      // Also send category-task-added event with shareId for the shared category page
      await sendEventToUser(share.sharedWithId, {
        type: 'category-task-added',
        shareId: share.shareId,
        task
      })
    }
  }

  return NextResponse.json(task, { status: 201 })
}, { requireAuth: true, logAuth: true })