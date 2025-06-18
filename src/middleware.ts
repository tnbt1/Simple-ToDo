import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function middleware(request: NextRequest) {
  // Skip logging for static assets and Next.js internals
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/static') ||
    request.nextUrl.pathname.includes('.') ||
    !request.nextUrl.pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  const requestId = uuidv4();
  const startTime = Date.now();

  // Clone the request to add headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  
  // Log request in development only (Edge Runtime safe)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API Request] ${request.method} ${request.nextUrl.pathname}`, {
      requestId,
      query: Object.fromEntries(request.nextUrl.searchParams),
    });
  }

  // Create response with request ID header
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add request ID and response time to headers
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-response-time', (Date.now() - startTime).toString());

  return response;
}

export const config = {
  matcher: '/api/:path*',
};