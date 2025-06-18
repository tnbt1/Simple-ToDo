import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import type { Session } from "next-auth"
import { authOptions } from "../../../../lib/auth"
import { prisma } from "../../../../lib/prisma"
import { sendEventToUser } from "../../../../lib/sse-manager"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions as any) as Session | null
  
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions as any) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, dueDate, priority, status, completed, position, tags, category } = body

    // Validate title if provided
    if (title !== undefined && (!title || title.trim().length === 0)) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 })
    }

    // Validate priority if provided
    if (priority !== undefined && !['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
      return NextResponse.json({ error: "Invalid priority value" }, { status: 400 })
    }

    // Validate status if provided
    if (status !== undefined && !['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
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
    await prisma.task.update({
      where: {
        id,
        userId: session.user.id
      },
      data: updateData
    })

    // Then fetch the complete updated task with all relations
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

    // Send real-time update to task owner
    sendEventToUser(session.user.id, {
      type: 'task-updated',
      task
    })

    // If task is shared, send updates to all shared users
    if (task.isShared) {
      const sharedWith = await prisma.sharedTask.findMany({
        where: { taskId: task.id },
        select: { sharedWithId: true }
      })
      
      for (const share of sharedWith) {
        sendEventToUser(share.sharedWithId, {
          type: 'shared-task-updated',
          task
        })
      }
    }

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
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions as any) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    await prisma.task.delete({
      where: {
        id,
        userId: session.user.id
      }
    })

    // Send real-time update
    sendEventToUser(session.user.id, {
      type: 'task-deleted',
      taskId: id
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting task:", error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}