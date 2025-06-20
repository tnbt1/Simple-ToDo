# Server-Sent Events (SSE) Implementation

## Overview
This document describes the SSE implementation for real-time updates in the Todo app, including fixes for production deployment issues.

## Key Issues Fixed

### 1. Next.js App Router Streaming
- **Problem**: Next.js App Router buffers responses by default, preventing real-time streaming
- **Solution**: Implemented `TransformStream` with proper writer interface and added streaming headers

### 2. Response Buffering
- **Problem**: Responses were buffered until completion in production
- **Solution**: 
  - Added `X-Accel-Buffering: no` header for Nginx
  - Implemented chunked transfer encoding
  - Added proper cache control headers

### 3. Connection Stability
- **Problem**: Connections dropping due to timeouts and network issues
- **Solution**:
  - Implemented 15-second heartbeat mechanism
  - Added exponential backoff for reconnection
  - Added visibility and online/offline detection

### 4. Browser Limitations
- **Problem**: Browser connection limits and SSE restrictions
- **Solution**:
  - Single SSE connection per user
  - Proper connection cleanup
  - Fallback polling mechanism

## Implementation Details

### Server-Side (`/api/events/route.ts`)
```typescript
// Key features:
- TransformStream for proper streaming
- Heartbeat every 15 seconds
- Proper cleanup on disconnect
- Force dynamic rendering
```

### Client-Side (`/lib/sse-client.ts`)
```typescript
// Key features:
- Exponential backoff with jitter
- Connection state tracking
- Auto-reconnect on visibility/online
- Last event ID tracking
```

## Deployment Considerations

### Nginx Configuration
```nginx
location /api/events {
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
    add_header X-Accel-Buffering 'no';
}
```

### Vercel/Edge Deployments
- Be aware of 15-second function timeout
- Consider using Edge Runtime for SSE endpoints
- May need to implement long-polling as fallback

### Docker Deployment
- Ensure proper health checks don't interfere with SSE
- Configure timeouts appropriately
- Use nginx configuration provided

## Testing

### Manual Testing
1. Open browser DevTools Network tab
2. Look for `/api/events` request
3. Should see "EventStream" type
4. Should receive heartbeats every 15 seconds

### Automated Testing
```bash
# Run SSE test script
AUTH_TOKEN="next-auth.session-token=YOUR_TOKEN" node scripts/test-sse.js
```

### Debugging
- Check `/api/events/status` endpoint for connection info
- Monitor browser console for SSE logs
- Check server logs for connection/disconnection events

## Common Issues

### 1. SSE Not Working in Production
- Check reverse proxy configuration
- Verify headers are not being stripped
- Check for response buffering

### 2. Frequent Disconnections
- Increase heartbeat frequency
- Check network stability
- Verify timeout configurations

### 3. Events Not Received
- Verify user authentication
- Check SSE manager registration
- Monitor server-side event sending

## Performance Considerations

- Each SSE connection uses a persistent HTTP connection
- Memory usage scales with number of connected users
- Consider implementing connection pooling for large scale
- Monitor server resources and connection limits