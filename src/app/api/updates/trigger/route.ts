import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// This endpoint allows clients to manually trigger a check for updates
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions as any) as Session | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { taskIds = [], categories = [] } = body

    // Get the latest state of requested tasks
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          {
            id: { in: taskIds },
            OR: [
              { userId: session.user.id },
              { sharedWith: { some: { sharedWithId: session.user.id } } },
              { isShared: true }
            ]
          },
          {
            category: { in: categories },
            OR: [
              { userId: session.user.id },
              { sharedWith: { some: { sharedWithId: session.user.id } } },
              { isShared: true }
            ]
          }
        ]
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
      orderBy: [
        { position: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Also get tasks from shared categories
    if (categories.length > 0) {
      const sharedCategories = await prisma.sharedCategory.findMany({
        where: {
          category: { in: categories },
          sharedWithId: session.user.id
        },
        include: {
          owner: true
        }
      })

      for (const sharedCat of sharedCategories) {
        const categoryTasks = await prisma.task.findMany({
          where: {
            category: sharedCat.category,
            userId: sharedCat.ownerId
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
          }
        })
        
        tasks.push(...categoryTasks)
      }
    }

    return NextResponse.json({ 
      tasks,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching updates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}