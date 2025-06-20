const EventSource = require('eventsource');
const fetch = require('node-fetch');

// Configuration
const BASE_URL = 'http://localhost:3000';
const EMAIL = 'user@example.com';
const PASSWORD = 'password123';

async function getSession() {
  console.log('Getting session...');
  
  // First, get CSRF token
  const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`, {
    credentials: 'include',
  });
  const csrfData = await csrfResponse.json();
  const csrfToken = csrfData.csrfToken;
  
  // Sign in
  const signInResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
    }),
    credentials: 'include',
    redirect: 'manual',
  });
  
  // Get session cookie
  const cookies = signInResponse.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('No session cookie received');
  }
  
  // Extract session token
  const sessionMatch = cookies.match(/next-auth\.session-token=([^;]+)/);
  if (!sessionMatch) {
    throw new Error('No session token found');
  }
  
  return sessionMatch[1];
}

async function testSSE() {
  try {
    const sessionToken = await getSession();
    console.log('Session token obtained');
    
    // Connect to SSE endpoint
    console.log('Connecting to SSE endpoint...');
    const eventSource = new EventSource(`${BASE_URL}/api/events`, {
      headers: {
        'Cookie': `next-auth.session-token=${sessionToken}`,
      },
    });
    
    eventSource.onopen = () => {
      console.log('SSE connection opened');
    };
    
    eventSource.onmessage = (event) => {
      console.log('SSE message received:', event.data);
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
    };
    
    // Create a task to trigger SSE event
    setTimeout(async () => {
      console.log('Creating a test task...');
      const response = await fetch(`${BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `next-auth.session-token=${sessionToken}`,
        },
        body: JSON.stringify({
          title: 'Test Task ' + new Date().toISOString(),
          description: 'Testing SSE',
          priority: 'MEDIUM',
        }),
      });
      
      if (response.ok) {
        const task = await response.json();
        console.log('Task created:', task.id);
      } else {
        console.error('Failed to create task:', response.status);
      }
    }, 2000);
    
    // Keep the script running
    setTimeout(() => {
      console.log('Closing SSE connection...');
      eventSource.close();
      process.exit(0);
    }, 10000);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testSSE();