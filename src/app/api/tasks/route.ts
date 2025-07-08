import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import type { Session } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import { withLogging, getRequestId, createPrismaContext } from "../../../lib/api-wrapper"
import { sendEventToUser, sendEventToTaskViewers } from "../../../lib/sse-manager"
import { PRIORITY, TASK_STATUS } from "../../../constants"
import { debug } from "../../../lib/debug"
import { createAuthErrorResponse } from "../../../lib/error-handler"

export const GET = withLogging(async (request: NextRequest) => {
  const session = await getServerSession(authOptions) as Session | null
  const requestId = getRequestId(request)
  
  if (!session?.user?.id) {
    return createAuthErrorResponse('認証が必要です', requestId)
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
  const session = await getServerSession(authOptions) as Session | null
  const requestId = getRequestId(request)
  
  if (!session?.user?.id) {
    return createAuthErrorResponse('認証が必要です', requestId)
  }

  // Verify user exists in database
  debug.auth('Session user ID:', session.user.id)
  const userExists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
    ...createPrismaContext(requestId)
  })

  if (!userExists) {
    debug.error('User not found in database:', session.user.id)
    return NextResponse.json({ error: "Invalid session - user not found" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, dueDate, priority, status, tags, category, importedFromTaskId, importedFromUserId, originalUniqueId } = body

  debug.api('POST', '/api/tasks', 'Creating task with originalUniqueId:', originalUniqueId)
  debug.api('POST', '/api/tasks', 'Full request body:', JSON.stringify(body, null, 2))
  debug.api('POST', '/api/tasks', 'User ID for task creation:', session.user.id)

  // Validate required fields
  if (!title || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  // Validate priority
  if (priority && !Object.values(PRIORITY).includes(priority)) {
    return NextResponse.json({ error: "Invalid priority value" }, { status: 400 })
  }

  // Validate status
  if (status && !Object.values(TASK_STATUS).includes(status)) {
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
      debug.db('Duplicate task found:', existingTask.id, existingTask.title)
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
      debug.db('Duplicate by title/category found:', duplicateByTitle.id)
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
    try {
      // カテゴリーが存在しない場合は作成
      debug.db('Upserting category:', category.trim(), 'for user:', session.user.id)
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
      debug.db('Category upserted successfully')
    } catch (error) {
      debug.error('Error upserting category:', error)
      debug.error('Category:', category.trim())
      debug.error('User ID:', session.user.id)
      return NextResponse.json({ 
        error: "Failed to create/update category", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }, { status: 500 })
    }
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description ? description.trim() : null,
      dueDate: parsedDueDate,
      priority: priority || PRIORITY.MEDIUM,
      status: status || TASK_STATUS.PENDING,
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
  debug.sse('[Task Create] Sending task-created event to owner:', session.user.id)
  await sendEventToUser(session.user.id, {
    type: 'task-created',
    task
  })
  debug.sse('[Task Create] Task-created event sent to owner successfully')

  // Send update to all users viewing tasks in this category
  if (task.category) {
    debug.sse('[Task Create] Sending updates to category viewers for category:', task.category)
    await sendEventToTaskViewers(`category:${task.category}`, {
      type: 'task-created',
      task
    })
    debug.sse('[Task Create] Updates sent to category viewers')
  }

  // Check if this category is shared and notify shared users
  if (task.category) {
    debug.sse(`[Task Create] Checking shared categories for category '${task.category}' owned by user ${session.user.id}`)
    
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

    debug.sse(`[Task Create] Found ${sharedCategories.length} shared category entries for category '${task.category}'`)
    sharedCategories.forEach(share => {
      debug.sse(`[Task Create] - Share ID: ${share.shareId}, Shared with user: ${share.sharedWithId}`)
    })
    
    // Notify all users who have this category shared with them
    for (const share of sharedCategories) {
      try {
        debug.sse(`[Task Create] Sending shared-category-task-created event to user ${share.sharedWithId}`)
        await sendEventToUser(share.sharedWithId, {
          type: 'shared-category-task-created',
          task
        })
        debug.sse(`[Task Create] Successfully sent shared-category-task-created event to user ${share.sharedWithId}`)

        // Also send category-task-added event with shareId for the shared category page
        debug.sse(`[Task Create] Sending category-task-added event to user ${share.sharedWithId} with shareId ${share.shareId}`)
        await sendEventToUser(share.sharedWithId, {
          type: 'category-task-added',
          shareId: share.shareId,
          task
        })
        debug.sse(`[Task Create] Successfully sent category-task-added event to user ${share.sharedWithId}`)
        
        // Also send to viewers of this specific shared category page
        debug.sse(`[Task Create] Broadcasting to viewers of share:${share.shareId}`)
        await sendEventToTaskViewers(`share:${share.shareId}`, {
          type: 'category-task-added',
          shareId: share.shareId,
          task
        })
      } catch (error) {
        debug.error(`[Task Create] Error sending events to user ${share.sharedWithId}:`, error)
      }
    }
    
    // Also broadcast to anyone viewing this specific shared category page
    for (const share of sharedCategories) {
      debug.sse(`[Task Create] Broadcasting to viewers of shared category ${share.shareId}`)
      await sendEventToTaskViewers(`share:${share.shareId}`, {
        type: 'category-task-added',
        shareId: share.shareId,
        task
      })
    }
  }

  return NextResponse.json(task, { status: 201 })
}, { requireAuth: true, logAuth: true })