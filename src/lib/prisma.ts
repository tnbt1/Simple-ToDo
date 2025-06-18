import { PrismaClient } from '@prisma/client'
import { logDatabaseQuery, logError } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with logging middleware
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
  })

  // Add middleware for query logging
  client.$use(async (params, next) => {
    const startTime = Date.now()
    const requestId = (params as any).requestId

    try {
      const result = await next(params)
      const duration = Date.now() - startTime

      // Log successful query
      logDatabaseQuery(
        params.action,
        params.model || 'unknown',
        duration,
        requestId,
        {
          args: process.env.NODE_ENV === 'development' ? params.args : undefined,
        }
      )

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      // Log failed query
      logDatabaseQuery(
        params.action,
        params.model || 'unknown',
        duration,
        requestId,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          args: process.env.NODE_ENV === 'development' ? params.args : undefined,
        }
      )

      // Log the error
      if (error instanceof Error) {
        logError(error, `Prisma ${params.action} on ${params.model}`, requestId)
      }

      throw error
    }
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma