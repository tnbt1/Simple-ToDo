import { NextRequest, NextResponse } from 'next/server';
import { logApiResponse, logError, logAuthEvent } from './logger';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import type { Session } from 'next-auth';

type RouteHandler = (
  request: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

interface WrapperOptions {
  requireAuth?: boolean;
  logAuth?: boolean;
}

export function withLogging(
  handler: RouteHandler,
  options: WrapperOptions = {}
): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    const startTime = Date.now();
    const requestId = request.headers.get('x-request-id') || 'unknown';
    const method = request.method;
    const path = request.nextUrl.pathname;

    try {
      // Check authentication if required
      if (options.requireAuth || options.logAuth) {
        const session = await getServerSession(authOptions) as Session | null;
        
        if (options.requireAuth && !session) {
          logAuthEvent('unauthorized_access', undefined, false, requestId, {
            method,
            path,
          });
          
          const response = NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
          
          const duration = Date.now() - startTime;
          logApiResponse(method, path, 401, duration, requestId);
          
          return response;
        }

        if (options.logAuth && session) {
          logAuthEvent('authenticated_request', session.user?.id, true, requestId, {
            method,
            path,
            userEmail: session.user?.email,
          });
        }
      }

      // Execute the actual handler
      const response = await handler(request, context);
      
      // Log the response
      const duration = Date.now() - startTime;
      const status = response.status;
      
      logApiResponse(method, path, status, duration, requestId, {
        contentType: response.headers.get('content-type'),
      });

      // Add request ID to response headers
      response.headers.set('x-request-id', requestId);
      response.headers.set('x-response-time', duration.toString());

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log the error
      if (error instanceof Error) {
        logError(error, `API Handler: ${method} ${path}`, requestId);
      }

      // Create error response
      const errorResponse = NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Internal Server Error',
          requestId,
        },
        { status: 500 }
      );

      // Log the error response
      logApiResponse(method, path, 500, duration, requestId, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      errorResponse.headers.set('x-request-id', requestId);
      errorResponse.headers.set('x-response-time', duration.toString());

      return errorResponse;
    }
  };
}

// Helper to get request ID from headers
export function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') || 'unknown';
}

// Helper to create a Prisma context with request ID
export function createPrismaContext(requestId: string) {
  // Return an empty object as Prisma doesn't accept custom context properties
  return {};
}