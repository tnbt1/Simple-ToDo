const fetch = require('node-fetch');

async function testThreadMessage() {
  const taskId = process.argv[2];
  const sessionCookie = process.argv[3];
  
  if (!taskId || !sessionCookie) {
    console.error('Usage: node test-thread-message.js <taskId> <sessionCookie>');
    console.error('Example: node test-thread-message.js "123" "next-auth.session-token=..."');
    process.exit(1);
  }

  const baseUrl = 'http://localhost:3000';
  
  console.log('Testing thread message creation...');
  console.log('Task ID:', taskId);
  
  try {
    // Create FormData
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('content', 'Test message from script');
    
    // Send POST request
    console.log('Sending POST request...');
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}/thread`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('Success! Message created:', data);
      } catch (e) {
        console.log('Response is not JSON:', responseText);
      }
    } else {
      console.error('Failed to send message');
      try {
        const error = JSON.parse(responseText);
        console.error('Error:', error);
      } catch (e) {
        console.error('Error response:', responseText);
      }
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testThreadMessage();