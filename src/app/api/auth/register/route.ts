import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../lib/prisma"
import bcrypt from "bcryptjs"
import { withLogging, getRequestId, createPrismaContext } from "../../../../lib/api-wrapper"
import { logAuthEvent } from "../../../../lib/logger"

export const POST = withLogging(async (request: NextRequest) => {
  const requestId = getRequestId(request)
  const body = await request.json()
  const { name, email, password } = body

  // Validation
  if (!name || !email || !password) {
    logAuthEvent('registration_failed', undefined, false, requestId, {
      reason: 'missing_fields',
      email
    })
    return NextResponse.json(
      { error: "すべてのフィールドを入力してください。" },
      { status: 400 }
    )
  }

  if (password.length < 6) {
    logAuthEvent('registration_failed', undefined, false, requestId, {
      reason: 'weak_password',
      email
    })
    return NextResponse.json(
      { error: "パスワードは6文字以上で入力してください。" },
      { status: 400 }
    )
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
    ...createPrismaContext(requestId)
  })

  if (existingUser) {
    logAuthEvent('registration_failed', undefined, false, requestId, {
      reason: 'email_exists',
      email
    })
    return NextResponse.json(
      { error: "このメールアドレスは既に登録されています。" },
      { status: 400 }
    )
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12)

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      email,
      username: email.split('@')[0], // Use email prefix as username
      password: hashedPassword, // Store the hashed password
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      createdAt: true,
    },
    ...createPrismaContext(requestId)
  })

  // Log successful registration
  logAuthEvent('user_registered', user.id, true, requestId, {
    email: user.email,
    username: user.username
  })

  // Return user without sensitive data
  const { ...userWithoutPassword } = user
  return NextResponse.json(
    { 
      message: "アカウントが正常に作成されました。",
      user: userWithoutPassword 
    },
    { status: 201 }
  )
})