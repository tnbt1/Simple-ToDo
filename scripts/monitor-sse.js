#!/usr/bin/env node

/**
 * SSE Connection Monitor
 * This script helps monitor SSE connections and debug real-time sync issues
 */

const readline = require('readline');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class SSEMonitor {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.connections = new Map();
    this.eventCounts = new Map();
    this.startTime = Date.now();
  }

  formatTime(timestamp) {
    const elapsed = timestamp - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const ms = elapsed % 1000;
    return `[${seconds}.${ms.toString().padStart(3, '0')}s]`;
  }

  log(level, message, data = {}) {
    const timestamp = this.formatTime(Date.now());
    const levelColors = {
      info: colors.blue,
      success: colors.green,
      warning: colors.yellow,
      error: colors.red,
    };
    
    const color = levelColors[level] || colors.reset;
    console.log(`${colors.dim}${timestamp}${colors.reset} ${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
    
    if (Object.keys(data).length > 0) {
      console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
  }

  async connectUser(userId, authToken) {
    this.log('info', `Connecting user: ${userId}`);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/events`, {
        headers: {
          'Cookie': `next-auth.session-token=${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      this.connections.set(userId, { reader, active: true });
      this.log('success', `Connected user: ${userId}`);

      // Read SSE stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          this.log('warning', `Stream ended for user: ${userId}`);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              this.handleEvent(userId, data);
            } catch (e) {
              this.log('error', `Failed to parse event for user ${userId}:`, { line, error: e.message });
            }
          } else if (line.startsWith(': heartbeat')) {
            this.log('info', `Heartbeat received for user: ${userId}`);
          }
        }
      }
    } catch (error) {
      this.log('error', `Connection failed for user ${userId}:`, { error: error.message });
    } finally {
      this.connections.delete(userId);
    }
  }

  handleEvent(userId, event) {
    const key = `${userId}:${event.type}`;
    this.eventCounts.set(key, (this.eventCounts.get(key) || 0) + 1);
    
    const eventInfo = {
      userId,
      type: event.type,
      count: this.eventCounts.get(key),
    };

    if (event.task) {
      eventInfo.taskId = event.task.id;
      eventInfo.taskTitle = event.task.title;
      eventInfo.category = event.task.category;
    }

    if (event.shareId) {
      eventInfo.shareId = event.shareId;
    }

    this.log('success', `Event received:`, eventInfo);
  }

  getStats() {
    const stats = {
      activeConnections: this.connections.size,
      totalEvents: Array.from(this.eventCounts.values()).reduce((a, b) => a + b, 0),
      eventBreakdown: {},
    };

    for (const [key, count] of this.eventCounts.entries()) {
      const [userId, eventType] = key.split(':');
      if (!stats.eventBreakdown[userId]) {
        stats.eventBreakdown[userId] = {};
      }
      stats.eventBreakdown[userId][eventType] = count;
    }

    return stats;
  }

  async simulateScenario(scenario) {
    this.log('info', `Starting scenario: ${scenario.name}`);
    
    for (const step of scenario.steps) {
      this.log('info', `Executing: ${step.description}`);
      
      switch (step.action) {
        case 'connect':
          this.connectUser(step.userId, step.authToken);
          break;
          
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, step.duration));
          break;
          
        case 'api_call':
          await this.makeApiCall(step);
          break;
          
        case 'stats':
          console.log('\n=== Current Stats ===');
          console.log(JSON.stringify(this.getStats(), null, 2));
          console.log('===================\n');
          break;
      }
    }
  }

  async makeApiCall(step) {
    try {
      const response = await fetch(`${this.baseUrl}${step.endpoint}`, {
        method: step.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `next-auth.session-token=${step.authToken}`,
          ...step.headers,
        },
        body: step.body ? JSON.stringify(step.body) : undefined,
      });

      const result = await response.json();
      this.log('info', `API call completed:`, { 
        endpoint: step.endpoint, 
        status: response.status,
        result: result.id || result.success || 'completed'
      });
    } catch (error) {
      this.log('error', `API call failed:`, { endpoint: step.endpoint, error: error.message });
    }
  }
}

// Example usage
async function main() {
  const monitor = new SSEMonitor();
  
  console.log(`${colors.bright}SSE Connection Monitor${colors.reset}`);
  console.log(`${colors.dim}Monitoring SSE connections at: ${monitor.baseUrl}${colors.reset}\n`);

  // Example scenario for testing real-time sync
  const testScenario = {
    name: 'Real-time Sync Test',
    steps: [
      {
        action: 'connect',
        userId: 'user1',
        authToken: 'YOUR_AUTH_TOKEN_1', // Replace with actual token
        description: 'Connect User 1',
      },
      {
        action: 'wait',
        duration: 1000,
        description: 'Wait 1 second',
      },
      {
        action: 'connect',
        userId: 'user2',
        authToken: 'YOUR_AUTH_TOKEN_2', // Replace with actual token
        description: 'Connect User 2',
      },
      {
        action: 'wait',
        duration: 2000,
        description: 'Wait 2 seconds',
      },
      {
        action: 'api_call',
        endpoint: '/api/tasks',
        method: 'POST',
        authToken: 'YOUR_AUTH_TOKEN_1',
        body: {
          title: 'Test Task for Sync',
          category: 'shared-category',
        },
        description: 'User 1 creates a task',
      },
      {
        action: 'wait',
        duration: 3000,
        description: 'Wait 3 seconds for events',
      },
      {
        action: 'stats',
        description: 'Show statistics',
      },
    ],
  };

  // Uncomment to run the test scenario
  // await monitor.simulateScenario(testScenario);

  // Interactive mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\nCommands:');
  console.log('  connect <userId> <authToken> - Connect a user');
  console.log('  stats - Show current statistics');
  console.log('  exit - Exit the monitor\n');

  rl.on('line', (line) => {
    const [command, ...args] = line.trim().split(' ');
    
    switch (command) {
      case 'connect':
        if (args.length >= 2) {
          monitor.connectUser(args[0], args[1]);
        } else {
          console.log('Usage: connect <userId> <authToken>');
        }
        break;
        
      case 'stats':
        console.log('\n=== Current Stats ===');
        console.log(JSON.stringify(monitor.getStats(), null, 2));
        console.log('===================\n');
        break;
        
      case 'exit':
        process.exit(0);
        break;
        
      default:
        console.log('Unknown command:', command);
    }
  });
}

// Run the monitor
main().catch(console.error);