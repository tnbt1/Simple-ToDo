import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import type { Session } from "next-auth"
import { authOptions } from "../../../../lib/auth"
import { prisma } from "../../../../lib/prisma"

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

    const task = await prisma.task.update({
      where: {
        id,
        userId: session.user.id
      },
      data: updateData
    })

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

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting task:", error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}