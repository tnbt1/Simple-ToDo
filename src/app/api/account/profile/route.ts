import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { nanoid } from 'nanoid'

// プロフィール情報を取得
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as Session | null
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const profile = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        _count: {
          select: {
            tasks: true,
            sharedTasks: {
              where: {
                sharedById: session.user.email
              }
            }
          }
        }
      }
    })

    if (!profile) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json({ error: 'プロフィールの取得に失敗しました' }, { status: 500 })
  }
}

// プロフィール情報を更新
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as Session | null
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const imageFile = formData.get('image') as File | null

    const updateData: Record<string, string> = {}
    
    if (name !== null && name !== undefined) {
      updateData.name = name
    }

    // 画像アップロード処理（簡易実装）
    if (imageFile && imageFile.size > 0) {
      // 実際の実装では、S3やCloudinaryなどのクラウドストレージを使用することを推奨
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars')
      await mkdir(uploadDir, { recursive: true })

      const bytes = await imageFile.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      const filename = `${nanoid()}_${imageFile.name}`
      const filepath = join(uploadDir, filename)
      
      await writeFile(filepath, buffer)
      updateData.image = `/api/uploads/avatars/${filename}`
    }

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        _count: {
          select: {
            tasks: true,
            sharedTasks: true
          }
        }
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({ error: 'プロフィールの更新に失敗しました' }, { status: 500 })
  }
}