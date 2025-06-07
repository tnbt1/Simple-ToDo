import { NextResponse } from "next/server"
import { prisma } from "../../../lib/prisma"
import bcrypt from "bcryptjs"

export async function POST() {
  try {
    // Check if any users already exist
    const userCount = await prisma.user.count()
    
    if (userCount > 0) {
      return NextResponse.json(
        { message: "Users already exist, skipping initialization" },
        { status: 200 }
      )
    }

    // Create initial test user
    const hashedPassword = await bcrypt.hash('test123', 12)
    
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        username: 'test',
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        createdAt: true,
      }
    })

    // Create some sample tasks for the test user
    const sampleTasks = [
      {
        title: 'プロジェクトの企画書を作成',
        description: '来週のプレゼンテーション用の企画書を準備する',
        priority: 'HIGH' as const,
        status: 'PENDING' as const,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        position: 1,
        userId: testUser.id,
      },
      {
        title: 'UIデザインのレビュー',
        description: 'デザイナーから送られてきたモックアップをチェック',
        priority: 'MEDIUM' as const,
        status: 'IN_PROGRESS' as const,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // tomorrow
        position: 2,
        userId: testUser.id,
      },
      {
        title: 'データベース設計の完了',
        description: 'ER図とテーブル定義書の作成',
        priority: 'HIGH' as const,
        status: 'COMPLETED' as const,
        completed: true,
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // yesterday
        position: 3,
        userId: testUser.id,
      },
    ]

    for (const task of sampleTasks) {
      await prisma.task.create({ data: task })
    }

    return NextResponse.json(
      { 
        message: "Initial user and sample data created successfully",
        user: testUser
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Initialization error:", error)
    return NextResponse.json(
      { error: "Failed to initialize application" },
      { status: 500 }
    )
  }
}