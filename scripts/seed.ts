import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create test user with password
  const hashedPassword = await bcrypt.hash('test123', 12)
  
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      username: 'test',
      password: hashedPassword,
    },
  })

  console.log('Test user created:', testUser)

  // Create some sample tasks
  await prisma.task.deleteMany({
    where: { userId: testUser.id }
  })

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
    {
      title: 'チームミーティングの準備',
      description: 'アジェンダの作成と資料の準備',
      priority: 'LOW' as const,
      status: 'PENDING' as const,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      position: 4,
      userId: testUser.id,
    },
  ]

  for (const task of sampleTasks) {
    await prisma.task.create({ data: task })
  }

  console.log('Sample tasks created')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })