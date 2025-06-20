#!/usr/bin/env node

/**
 * Test script to verify real-time thread message updates for shared tasks
 * 
 * This script simulates two users:
 * 1. User A creates and shares a task
 * 2. User B imports the shared task
 * 3. Both users connect to SSE
 * 4. User A posts a thread message
 * 5. Verify User B receives the update in real-time
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const isHTTPS = BASE_URL.startsWith('https');
const httpModule = isHTTPS ? https : http;

// Test users (these should exist in your database)
const USER_A = {
  email: 'test1@example.com',
  password: 'password123'
};

const USER_B = {
  email: 'test2@example.com', 
  password: 'password123'
};

// Helper to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url || options.path, BASE_URL);
    const requestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = httpModule.request(requestOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(result);
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Helper to get CSRF token and session cookie
async function getCsrfToken() {
  const response = await makeRequest({
    url: '/api/auth/csrf',
    method: 'GET'
  });
  
  return {
    csrfToken: response.body.csrfToken,
    cookie: response.headers['set-cookie']?.[0]
  };
}

// Helper to sign in
async function signIn(email, password) {
  const { csrfToken, cookie } = await getCsrfToken();
  
  const response = await makeRequest({
    url: '/api/auth/callback/credentials',
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
  
  // Get session cookie
  const sessionCookie = response.headers['set-cookie']?.find(c => c.includes('next-auth.session-token'));
  
  if (!sessionCookie) {
    throw new Error('Failed to sign in: ' + JSON.stringify(response.body));
  }
  
  return sessionCookie;
}

// Helper to connect to SSE
function connectSSE(cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/events', BASE_URL);
    
    httpModule.get({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Cookie': cookie,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`SSE connection failed: ${res.statusCode}`));
        return;
      }
      
      resolve(res);
    }).on('error', reject);
  });
}

// Main test
async function runTest() {
  console.log('🚀 Starting real-time thread message test...\n');
  
  try {
    // Step 1: Sign in both users
    console.log('1️⃣ Signing in users...');
    const [sessionA, sessionB] = await Promise.all([
      signIn(USER_A.email, USER_A.password),
      signIn(USER_B.email, USER_B.password)
    ]);
    console.log('✅ Both users signed in\n');
    
    // Step 2: User A creates a task
    console.log('2️⃣ User A creating a task...');
    const createResponse = await makeRequest({
      url: '/api/tasks',
      method: 'POST',
      headers: { 'Cookie': sessionA }
    }, {
      title: 'Test Real-time Thread Updates',
      description: 'Testing if thread messages update in real-time for shared tasks',
      priority: 'HIGH'
    });
    
    if (createResponse.status !== 200) {
      throw new Error('Failed to create task: ' + JSON.stringify(createResponse.body));
    }
    
    const task = createResponse.body;
    console.log(`✅ Task created: ${task.id}\n`);
    
    // Step 3: User A shares the task
    console.log('3️⃣ User A sharing the task...');
    const shareResponse = await makeRequest({
      url: `/api/tasks/${task.id}/share`,
      method: 'POST',
      headers: { 'Cookie': sessionA }
    });
    
    if (shareResponse.status !== 200) {
      throw new Error('Failed to share task: ' + JSON.stringify(shareResponse.body));
    }
    
    const shareLink = shareResponse.body.shareLink;
    console.log(`✅ Task shared: ${shareLink}\n`);
    
    // Step 4: User B imports the shared task
    console.log('4️⃣ User B importing the shared task...');
    const shareId = shareLink.split('/').pop();
    const importResponse = await makeRequest({
      url: `/api/shared/${shareId}/import`,
      method: 'POST',
      headers: { 'Cookie': sessionB }
    });
    
    if (importResponse.status !== 200) {
      throw new Error('Failed to import task: ' + JSON.stringify(importResponse.body));
    }
    
    const importedTask = importResponse.body;
    console.log(`✅ Task imported: ${importedTask.id}\n`);
    
    // Step 5: Both users connect to SSE
    console.log('5️⃣ Connecting both users to SSE...');
    const [sseA, sseB] = await Promise.all([
      connectSSE(sessionA),
      connectSSE(sessionB)
    ]);
    console.log('✅ Both users connected to SSE\n');
    
    // Step 6: Set up SSE listeners
    console.log('6️⃣ Setting up SSE event listeners...');
    let messageReceivedByB = false;
    const messagePromise = new Promise((resolve) => {
      sseB.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('User B received SSE event:', data.type);
              
              if (data.type === 'thread-message-added') {
                console.log('✅ User B received thread message!');
                messageReceivedByB = true;
                resolve(data);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      });
    });
    
    // Step 7: Register both users as viewing their respective tasks
    console.log('7️⃣ Registering users as viewing tasks...');
    await Promise.all([
      makeRequest({
        url: `/api/tasks/${task.id}/view`,
        method: 'POST',
        headers: { 'Cookie': sessionA }
      }),
      makeRequest({
        url: `/api/tasks/${importedTask.id}/view`,
        method: 'POST',
        headers: { 'Cookie': sessionB }
      })
    ]);
    console.log('✅ Users registered as viewing tasks\n');
    
    // Wait a bit for connections to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 8: User A posts a thread message
    console.log('8️⃣ User A posting a thread message...');
    const messageContent = `Test message at ${new Date().toISOString()}`;
    
    // Create form data
    const boundary = '----FormBoundary' + Date.now();
    const formData = `------${boundary}\r\n` +
      `Content-Disposition: form-data; name="content"\r\n\r\n` +
      `${messageContent}\r\n` +
      `------${boundary}--\r\n`;
    
    const messageResponse = await makeRequest({
      url: `/api/tasks/${task.id}/thread`,
      method: 'POST',
      headers: {
        'Cookie': sessionA,
        'Content-Type': `multipart/form-data; boundary=----${boundary}`
      }
    }, formData);
    
    if (messageResponse.status !== 200) {
      throw new Error('Failed to post message: ' + JSON.stringify(messageResponse.body));
    }
    
    console.log('✅ Thread message posted\n');
    
    // Step 9: Wait for User B to receive the message
    console.log('9️⃣ Waiting for User B to receive the message...');
    const timeout = setTimeout(() => {
      console.log('❌ Timeout: User B did not receive the message within 5 seconds');
      process.exit(1);
    }, 5000);
    
    await messagePromise;
    clearTimeout(timeout);
    
    console.log('\n✅ SUCCESS! Real-time thread updates are working correctly.');
    console.log('User B received the thread message in real-time when User A posted it.\n');
    
    // Cleanup
    sseA.destroy();
    sseB.destroy();
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest();