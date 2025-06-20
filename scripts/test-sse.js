#!/usr/bin/env node

const EventSource = require('eventsource');
const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3100';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

async function testSSE() {
  console.log('Testing SSE functionality...');
  console.log('Base URL:', BASE_URL);
  
  // First check if the events endpoint is accessible
  try {
    const statusResponse = await fetch(`${BASE_URL}/api/events/status`, {
      headers: {
        'Cookie': AUTH_TOKEN
      }
    });
    
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('SSE Status:', status);
    } else {
      console.error('Failed to get SSE status:', statusResponse.status);
    }
  } catch (error) {
    console.error('Error checking SSE status:', error);
  }
  
  // Test SSE connection
  console.log('\nTesting SSE connection...');
  const eventSource = new EventSource(`${BASE_URL}/api/events`, {
    headers: {
      'Cookie': AUTH_TOKEN
    },
    withCredentials: true
  });
  
  let messageCount = 0;
  let heartbeatCount = 0;
  const startTime = Date.now();
  
  eventSource.onopen = () => {
    console.log('SSE connection opened');
  };
  
  eventSource.onmessage = (event) => {
    messageCount++;
    try {
      const data = JSON.parse(event.data);
      console.log(`Message ${messageCount}:`, data);
      
      if (data.type === 'heartbeat') {
        heartbeatCount++;
        console.log(`Heartbeat ${heartbeatCount} received after ${Date.now() - startTime}ms`);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    if (eventSource.readyState === EventSource.CLOSED) {
      console.log('SSE connection closed');
    }
  };
  
  // Test for 60 seconds
  setTimeout(() => {
    console.log('\nTest completed:');
    console.log(`Total messages received: ${messageCount}`);
    console.log(`Heartbeats received: ${heartbeatCount}`);
    console.log(`Connection duration: ${Date.now() - startTime}ms`);
    eventSource.close();
    process.exit(0);
  }, 60000);
  
  // Send a test task update after 5 seconds
  setTimeout(async () => {
    console.log('\nCreating test task to trigger SSE event...');
    try {
      const response = await fetch(`${BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': AUTH_TOKEN
        },
        body: JSON.stringify({
          title: 'SSE Test Task ' + new Date().toISOString(),
          description: 'This task was created to test SSE functionality'
        })
      });
      
      if (response.ok) {
        const task = await response.json();
        console.log('Test task created:', task.id);
      } else {
        console.error('Failed to create test task:', response.status);
      }
    } catch (error) {
      console.error('Error creating test task:', error);
    }
  }, 5000);
}

// Instructions for getting auth token
console.log(`
To test SSE with authentication:
1. Login to the app in your browser
2. Open DevTools and go to Application > Cookies
3. Copy the value of 'next-auth.session-token' cookie
4. Run: AUTH_TOKEN="next-auth.session-token=YOUR_TOKEN_HERE" node scripts/test-sse.js
`);

testSSE();