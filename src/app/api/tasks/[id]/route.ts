import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import type { Session } from "next-auth"
import { authOptions } from "../../../../lib/auth"
import { prisma } from "../../../../lib/prisma"
import { sendEventToUser, sendEventToTaskViewers } from "../../../../lib/sse-manager"
import { withLogging } from "../../../../lib/api-wrapper"

// Helper function to send task update events in parallel
async function sendTaskUpdateEvents(
  task: any,
  sessionUserId: string,
  prisma: any
) {
  try {
    const eventPromises = []
    
    // Send to task owner
    eventPromises.push(
      sendEventToUser(sessionUserId, {
        type: 'task-updated',
        task
      }).catch(_error => {
        debug.error('[Task Update] Error sending to owner:', _error)
      })
    )
    
    // Send to task viewers
    eventPromises.push(
      sendEventToTaskViewers(task.id, {
        type: 'task-updated',
        task
      }).catch(_error => {
        debug.error('[Task Update] Error sending to task viewers:', _error)
      })
    )

    // If task is shared, send updates to all shared users
    if (task.isShared) {
      // Fetch shared users in parallel
      const sharedWithPromise = prisma.sharedTask.findMany({
        where: { taskId: task.id },
        select: { sharedWithId: true }
      }).catch((error: any) => {
        debug.error('[Task Update] Error fetching shared users:', error)
        return []
      })
      
      const sharedWith = await sharedWithPromise
      
      // Add shared user notifications to promises
      sharedWith.forEach((share: any) => {
        eventPromises.push(
          sendEventToUser(share.sharedWithId, {
            type: 'shared-task-updated',
            task
          }).catch(_error => {
            debug.error(`[Task Update] Error sending to shared user ${share.sharedWithId}:`, _error)
          })
        )
      })
    }

    // Check if this category is shared and notify shared users
    if (task.category) {
      // Fetch shared categories in parallel
      const sharedCategoriesPromise = prisma.sharedCategory.findMany({
        where: {
          category: task.category,
          ownerId: sessionUserId
        },
        select: {
          shareId: true,
          sharedWithId: true
        }
      }).catch((error: any) => {
        debug.error('[Task Update] Error fetching shared categories:', error)
        return []
      })
      
      const sharedCategories = await sharedCategoriesPromise
      
      // Add category notifications to promises
      sharedCategories.forEach((share: any) => {
        eventPromises.push(
          sendEventToUser(share.sharedWithId, {
            type: 'category-task-updated',
            shareId: share.shareId,
            task
          }).catch(_error => {
            debug.error(`[Task Update] Error sending category update to user ${share.sharedWithId}:`, _error)
          })
        )
        
        eventPromises.push(
          sendEventToTaskViewers(`share:${share.shareId}`, {
            type: 'category-task-updated',
            shareId: share.shareId,
            task
          }).catch(_error => {
            debug.error(`[Task Update] Error broadcasting to share viewers:`, _error)
          })
        )
      })
    }
    
    // Execute all event notifications in parallel with reasonable timeout
    const timeoutPromise = new Promise((resolve) => 
      setTimeout(() => {
        debug.warn('[Task Update] Event notifications timeout after 500ms')
        resolve('timeout')
      }, 500)
    )
    
    // Use Promise.race but don't throw on timeout
    await Promise.race([
      Promise.allSettled(eventPromises).then(() => 'completed'),
      timeoutPromise
    ])
  } catch (error) {
    debug.error('[Task Update] Unexpected error in sendTaskUpdateEvents:', error)
  }
}
import { PRIORITY, TASK_STATUS } from "../../../../constants"
import { debug } from "../../../../lib/debug"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    
    // First check if the user owns the task or has access to it
    const task = await prisma.task.findFirst({
      where: {
        id,
        OR: [
          { userId: session.user.id },
          { sharedWith: { some: { sharedWithId: session.user.id } } },
          { isShared: true }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        priority: true,
        status: true,
        completed: true,
        category: true,
        isShared: true,
        shareId: true,
        createdAt: true,
        updatedAt: true,
        position: true,
        tags: true,
        userId: true,
        importedFromTaskId: true,
        importedFromUserId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
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
      }
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error: unknown) {
    console.error("Error fetching task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const PUT = withLogging(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const startTime = Date.now()
  debug.api('PUT', `/api/tasks/[id]`, 'Start')
  
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, dueDate, priority, status, completed, position, tags, category } = body
    
    debug.api('PUT', `/api/tasks/${id}`, 'Body:', body, 'User:', session.user.id)

    // Validate title if provided
    if (title !== undefined && (!title || title.trim().length === 0)) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 })
    }

    // Validate priority if provided
    if (priority !== undefined && !Object.values(PRIORITY).includes(priority)) {
      return NextResponse.json({ error: "Invalid priority value" }, { status: 400 })
    }

    // Validate status if provided
    if (status !== undefined && !Object.values(TASK_STATUS).includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
    }

    // Validate and parse dueDate if provided
    let parsedDueDate = undefined
    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === '') {
        parsedDueDate = null
      } else {
        parsedDueDate = new Date(dueDate)
        if (isNaN(parsedDueDate.getTime())) {
          return NextResponse.json({ error: "Invalid due date format" }, { status: 400 })
        }
      }
    }

    const updateData: Record<string, string | number | boolean | Date | null | string[]> = {}
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description ? description.trim() : null
    if (parsedDueDate !== undefined) updateData.dueDate = parsedDueDate
    if (priority !== undefined) updateData.priority = priority
    if (status !== undefined) updateData.status = status
    if (completed !== undefined) updateData.completed = completed
    if (position !== undefined) updateData.position = position
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : []
    if (category !== undefined) updateData.category = category && category.trim() ? category.trim() : null

    // First update the task
    debug.api('PUT', `/api/tasks/${id}`, 'Updating task with data:', updateData)
    const updateStartTime = Date.now()
    
    await prisma.task.update({
      where: {
        id,
        userId: session.user.id
      },
      data: updateData
    })
    
    debug.api('PUT', `/api/tasks/${id}`, `Task updated in ${Date.now() - updateStartTime}ms`)

    // Then fetch the complete updated task with all relations
    const fetchStartTime = Date.now()
    const task = await prisma.task.findFirst({
      where: {
        id,
        userId: session.user.id
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        priority: true,
        status: true,
        completed: true,
        category: true,
        isShared: true,
        shareId: true,
        createdAt: true,
        updatedAt: true,
        position: true,
        tags: true,
        userId: true,
        importedFromTaskId: true,
        importedFromUserId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
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
      }
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found after update" }, { status: 404 })
    }
    
    debug.api('PUT', `/api/tasks/${id}`, `Task fetched in ${Date.now() - fetchStartTime}ms`)

    debug.api('PUT', `/api/tasks/${id}`, `Total request time: ${Date.now() - startTime}ms`)
    
    // Send events in background without blocking response
    setImmediate(() => {
      const eventStartTime = Date.now()
      sendTaskUpdateEvents(task, session.user.id, prisma)
        .then(() => {
          debug.api('PUT', `/api/tasks/${id}`, `Events sent in ${Date.now() - eventStartTime}ms (async)`)
        })
        .catch((error) => {
          // Log error but don't fail the request
          debug.error('[Task Update] Error sending events:', error)
        })
    })

    // Return response immediately
    return NextResponse.json(task)
  } catch (error: unknown) {
    console.error("Error updating task:", error)
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 })
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}, { requireAuth: true, logAuth: true })

export const PATCH = withLogging(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { status, completed } = body

    // Validate status if provided
    if (status !== undefined && !Object.values(TASK_STATUS).includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
    }

    // Update only status and completed fields
    await prisma.task.update({
      where: {
        id,
        userId: session.user.id
      },
      data: {
        status,
        completed
      }
    })

    // Fetch the complete updated task with all relations
    const task = await prisma.task.findFirst({
      where: {
        id,
        userId: session.user.id
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        priority: true,
        status: true,
        completed: true,
        category: true,
        isShared: true,
        shareId: true,
        createdAt: true,
        updatedAt: true,
        position: true,
        tags: true,
        userId: true,
        importedFromTaskId: true,
        importedFromUserId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
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
      }
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found after update" }, { status: 404 })
    }

    // Send events in background without blocking response
    setImmediate(() => {
      sendTaskUpdateEvents(task, session.user.id, prisma)
        .catch((error) => {
          // Log error but don't fail the request
          debug.error('[Task Update] Error sending events:', error)
        })
    })

    // Return response immediately
    return NextResponse.json(task)
  } catch (error: unknown) {
    console.error("Error updating task status:", error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}, { requireAuth: true, logAuth: true })

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    
    // Get task details before deletion to check category
    const taskToDelete = await prisma.task.findUnique({
      where: {
        id,
        userId: session.user.id
      },
      select: {
        category: true
      }
    })

    if (!taskToDelete) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    await prisma.task.delete({
      where: {
        id,
        userId: session.user.id
      }
    })

    // Send real-time update
    console.log('Sending task-deleted event:', session.user.id)
    await sendEventToUser(session.user.id, {
      type: 'task-deleted',
      taskId: id
    })
    console.log('Task-deleted event sent')

    // Send update to all users viewing this task
    console.log('Sending task-deleted to task viewers for task:', id)
    await sendEventToTaskViewers(id, {
      type: 'task-deleted',
      taskId: id
    })

    // Check if this category is shared and notify shared users
    if (taskToDelete.category) {
      const sharedCategories = await prisma.sharedCategory.findMany({
        where: {
          category: taskToDelete.category,
          ownerId: session.user.id
        },
        select: {
          shareId: true,
          sharedWithId: true
        }
      })

      console.log(`Sending category-task-deleted to ${sharedCategories.length} category viewers`)
      // Notify all users who have this category shared with them
      for (const share of sharedCategories) {
        await sendEventToUser(share.sharedWithId, {
          type: 'category-task-deleted',
          shareId: share.shareId,
          taskId: id
        })
        
        // Also send to viewers of this specific shared category page
        await sendEventToTaskViewers(`share:${share.shareId}`, {
          type: 'category-task-deleted',
          shareId: share.shareId,
          taskId: id
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting task:", error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}