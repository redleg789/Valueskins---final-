// Stress Testing Dashboard + System
// Tests to find the breaking point of 100K users

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { randomItem } from 'k6/util';

// ==================== CUSTOM METRICS ====================

const requests = new Counter('requests');
const errors = new Counter('errors');
const successes = new Counter('successes');

const requestDuration = new Trend('request_duration_ms');
const connectionLatency = new Trend('connection_latency_ms');
const messageLatency = new Trend('message_latency_ms');

const activeUsers = new Gauge('active_users');
const activeConnections = new Gauge('active_connections');
const messageThroughput = new Gauge('message_throughput');

const errorRate = new Rate('error_rate');
const successRate = new Rate('success_rate');

// ==================== CONFIG ====================

export const options = {
  scenarios: {
    // Phase 1: Ramp to 10K
    ramp_10k: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 1000 },
        { duration: '1m', target: 2000 },
        { duration: '2m', target: 5000 },
        { duration: '3m', target: 10000 },
        { duration: '10m', target: 10000 }, // Hold
        { duration: '30s', target: 0 },
      ],
    },
    
    // Phase 2: Spike test
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 10000,
      stages: [
        { duration: '1m', target: 30000 }, // Spike to 30K
        { duration: '2m', target: 30000 },
        { duration: '30s', target: 10000 },
        { duration: '30s', target: 0 },
      ],
    },
    
    // Phase 3: Stress test (find breaking point)
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 10000,
      stages: [
        { duration: '2m', target: 50000 },
        { duration: '5m', target: 50000 }, // Hold at 50K
        { duration: '2m', target: 75000 },
        { duration: '5m', target: 75000 }, // Hold at 75K
        { duration: '2m', target: 100000 },
        { duration: '10m', target: 100000 }, // Hold at 100K
        { duration: '1m', target: 0 },
      ],
    },
    
    // Phase 4: Soak test (find memory leaks)
    soak_test: {
      executor: 'constant-vus',
      startVUs: 10000,
      stages: [
        { duration: '1h', target: 10000 }, // Hold for 1 hour
        { duration: '30s', target: 0 },
      ],
    },
  },
  
  thresholds: {
    // Fail if error rate > 5%
    error_rate: ['rate<0.05'],
    // Fail if p95 latency > 2s
    request_duration_ms: ['p(95)<2000'],
    // Target: at least 5000 RPS
    requests: ['count>5000'],
  },
};

// ==================== TEST DATA ====================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const WS_URL = __ENV.WS_URL || 'ws://localhost:8081';
const API_KEY = __ENV.API_KEY || 'test-api-key';

const USERS_COUNT = parseInt(__ENV.USERS_COUNT || '10000');

const NICHES = [
  'beauty', 'fashion', 'fitness', 'lifestyle', 'travel',
  'food', 'photography', 'gaming', 'music', 'tech'
];

const DEAL_TITLES = [
  'Summer Campaign',
  'Holiday Special',
  'Product Launch',
  'Brand Ambassador',
  'Content Series',
  'Social Campaign',
];

const MESSAGES = [
  'Hey! interested in collaboration',
  'Awesome deal!',
  'Can we discuss the terms?',
  'Looking forward to working together',
  'Great opportunity!',
];

// ==================== TEST USERS ====================

export function setup() {
  console.log(`Creating ${USERS_COUNT} test users...`);
  
  const users = [];
  
  for (let i = 0; i < USERS_COUNT; i++) {
    users.push({
      id: `test_${i}`,
      email: `loadtest_${i}@test.com`,
      password: 'TestPassword123!',
      username: `user_${i}`,
      niche: randomItem(NICHES),
    });
  }
  
  return { users };
}

// ==================== SCENARIOS ====================

// Scenario 1: Browse + Profile
export function scenarioBrowse(data, userIndex) {
  const user = data.users[userIndex % data.users.length];
  const token = user.token;
  
  // Homepage
  let res = http.get(`${BASE_URL}/`, { tags: { name: 'homepage' } });
  let duration = res.timings.duration;
  requestDuration.add(duration);
  requests.add(1);
  
  if (res.status === 200) {
    successes.add(1);
    successRate.add(1);
  } else {
    errors.add(1);
    errorRate.add(1);
    return;
  }
  
  // Browse profiles
  res = http.get(`${BASE_URL}/api/v1/profiles?limit=20`, {
    tags: { name: 'profiles' },
    headers: { Authorization: `Bearer ${token}` },
  });
  duration = res.timings.duration;
  requestDuration.add(duration);
  requests.add(1);
  
  if (res.status === 200) {
    successes.add(1);
    successRate.add(1);
  } else {
    errors.add(1);
    errorRate.add(1);
  }
}

// Scenario 2: Deals + Applications
export function scenarioDeals(data, userIndex) {
  const user = data.users[userIndex % data.users.length];
  const token = user.token;
  
  // List deals
  let res = http.get(`${BASE_URL}/api/v1/deals?limit=20`, {
    tags: { name: 'deals_list' },
    headers: { Authorization: `Bearer ${token}` },
  });
  let duration = res.timings.duration;
  requestDuration.add(duration);
  requests.add(1);
  
  if (res.status === 200) {
    successes.add(1);
    successRate.add(1);
  } else {
    errors.add(1);
    errorRate.add(1);
    return;
  }
  
  // View deal detail
  const deals = res.json('deals') || [];
  if (deals.length > 0) {
    const dealId = deals[0].id;
    res = http.get(`${BASE_URL}/api/v1/deals/${dealId}`, {
      tags: { name: 'deal_detail' },
      headers: { Authorization: `Bearer ${token}` },
    });
    duration = res.timings.duration;
    requestDuration.add(duration);
    requests.add(1);
    
    if (res.status === 200) {
      successes.add(1);
      successRate.add(1);
    } else {
      errors.add(1);
      errorRate.add(1);
    }
  }
}

// Scenario 3: Messaging
export function scenarioMessaging(data, userIndex) {
  const user = data.users[userIndex % data.users.length];
  const token = user.token;
  
  // Send message via HTTP
  const payload = JSON.stringify({
    room_id: 1,
    content: randomItem(MESSAGES),
  });
  
  let res = http.post(`${BASE_URL}/api/v1/messages/send`, payload, {
    tags: { name: 'send_message' },
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  let duration = res.timings.duration;
  messageLatency.add(duration);
  requests.add(1);
  
  if (res.status === 200) {
    successes.add(1);
    successRate.add(1);
  } else {
    errors.add(1);
    errorRate.add(1);
  }
  
  // Get message history
  res = http.get(`${BASE_URL}/api/v1/messages/1?limit=20`, {
    tags: { name: 'get_messages' },
    headers: { Authorization: `Bearer ${token}` },
  });
  duration = res.timings.duration;
  messageLatency.add(duration);
  requests.add(1);
  
  if (res.status === 200) {
    successes.add(1);
    successRate.add(1);
  } else {
    errors.add(1);
    errorRate.add(1);
  }
}

// Scenario 4: WebSocket (real-time)
export function scenarioWebSocket(data, userIndex) {
  const user = data.users[userIndex % data.users.length];
  const token = user.token;
  
  // Connect to WebSocket
  let connected = false;
  let wsConn;
  
  try {
    wsConn = ws.connect(
      `${WS_URL}/ws/deal-rooms/1?token=${token}`,
      { tag: 'websocket' },
      function(socket) {
        socket.on('open', () => {
          connected = true;
          activeConnections.add(1);
          
          // Send auth
          socket.send(JSON.stringify({
            action: 'auth',
            data: { token },
          }));
        });
        
        socket.on('message', (msg) => {
          // Handle incoming messages
        });
        
        socket.on('close', () => {
          connected = false;
          activeConnections.add(-1);
        });
        
        socket.on('error', (err) => {
          console.error('WebSocket error:', err);
          connected = false;
        });
      }
    );
  } catch (e) {
    console.error('WebSocket connect error:', e);
    errors.add(1);
    return;
  }
  
  // Hold connection for some time
  sleep(randomInt(5, 15));
  
  // Send message
  if (connected) {
    const start = Date.now();
    wsConn.send(JSON.stringify({
      action: 'message',
      data: {
        content: randomItem(MESSAGES),
      },
    }));
    messageLatency.add(Date.now() - start);
    messageThroughput.add(1);
  }
  
  // Close
  if (wsConn) {
    wsConn.close();
  }
  
  sleep(randomInt(1, 3));
}

// Scenario 5: Mixed (realistic usage)
export function scenarioMixed(data, userIndex) {
  const scenario = randomInt(1, 4);
  
  switch (scenario) {
    case 1:
      scenarioBrowse(data, userIndex);
      break;
    case 2:
      scenarioDeals(data, userIndex);
      break;
    case 3:
      scenarioMessaging(data, userIndex);
      break;
    case 4:
      scenarioWebSocket(data, userIndex);
      break;
  }
}

// ==================== MAIN ====================

export default function(data) {
  const userIndex = __VU * __ITERATION + __VU;
  
  // Active users gauge
  activeUsers.add(__VU);
  
  // Run mixed scenarios
  scenarioMixed(data, userIndex);
  
  // Think time
  sleep(randomInt(1, 5));
}

// Helper functions
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ==================== TEARDOWN ====================

export function teardown(data) {
  console.log('=== STRESS TEST COMPLETE ===');
  console.log(`Total Requests: ${requests}`);
  console.log(`Total Errors: ${errors}`);
  console.log(`Error Rate: ${(errors.count / requests.count * 100).toFixed(2)}%`);
  console.log(`p95 Latency: ${requestDuration.values['p(95)']}ms`);
}