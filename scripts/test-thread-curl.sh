#!/bin/bash

# Usage: ./test-thread-curl.sh <taskId> <sessionCookie>

TASK_ID=$1
SESSION_COOKIE=$2

if [ -z "$TASK_ID" ] || [ -z "$SESSION_COOKIE" ]; then
  echo "Usage: $0 <taskId> <sessionCookie>"
  echo "Example: $0 '123' 'next-auth.session-token=...'"
  exit 1
fi

echo "Testing thread message API..."
echo "Task ID: $TASK_ID"
echo ""

# Test with curl
echo "Sending POST request with curl..."
curl -X POST "http://localhost:3000/api/tasks/$TASK_ID/thread" \
  -H "Cookie: $SESSION_COOKIE" \
  -F "content=Test message from curl" \
  -v

echo ""
echo "Done."