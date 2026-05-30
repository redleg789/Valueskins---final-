// k6 load test configuration for 100K concurrent users
// Run with: k6 run load-test.js

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const errors = new Counter('errors');
const latency = new Trend('latency');
const errorRate = new Rate('error_rate');

// Test configuration
export const options = {
  scenarios: {
    // Load test: gradual ramp up to target
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 1000 },   // Ramp to 1K in 2 min
        { duration: '5m', target: 10000 },  // Ramp to 10K in 5 min
        { duration: '10m', target: 50000 }, // Ramp to 50K in 10 min
        { duration: '10m', target: 100000 }, // Ramp to 100K in 10 min
        { duration: '30m', target: 100000 }, // Hold at 100K for 30 min
        { duration: '5m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
    },
    
    // Spike test: sudden traffic bursts
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 50000,
      stages: [
        { duration: '30s', target: 100000 }, // Spike to 100K
        { duration: '1m', target: 100000 }, // Hold
        { duration: '30s', target: 50000 },  // Back to normal
      ],
    },
    
    // Stress test: push beyond limits
    stress_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '5m', target: 120000 }, // Push to 120% of target
        { duration: '5m', target: 120000 },
        { duration: '5m', target: 0 },
      ],
    },
  },
  
  // Thresholds for pass/fail
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'],                     // Error rate < 1%
    http_reqs: ['rate>10000'],                        // Throughput > 10K/s
    errors: ['count<1000'],                           // Total errors < 1000
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.valueskins.io';
const USERS = __ENV.USERS || 1000;

// Test data
const usernames = Array.from({ length: USERS }, (_, i) => `user_${i}@test.com`);
const passwords = Array.from({ length: USERS }, () => 'TestPassword123!');

export function setup() {
  // Create test users
  const tokens = [];
  
  group('setup', () => {
    for (let i = 0; i < USERS; i++) {
      const res = http.post(`${BASE_URL}/api/v1/auth/register`, JSON.stringify({
        email: usernames[i],
        password: passwords[i],
        username: `user${i}`,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (res.status === 201) {
        tokens.push(res.json('token'));
      }
    }
  });
  
  return { tokens };
}

export default function(data) {
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];
  
  group('browse', () => {
    // Homepage
    let res = http.get(`${BASE_URL}/`, { tags: { name: 'homepage' } });
    check(res, { 'homepage loaded': (r) => r.status === 200 }) || errors.add(1);
    latency.add(res.timings.duration);
    
    // Public profiles
    res = http.get(`${BASE_URL}/api/v1/profiles`, { 
      tags: { name: 'profiles' },
      headers: { 'Authorization': `Bearer ${token}` },
    });
    check(res, { 'profiles loaded': (r) => r.status === 200 }) || errors.add(1);
    latency.add(res.timings.duration);
  });
  
  group('profile', () => {
    // Get own profile
    const res = http.get(`${BASE_URL}/api/v1/users/me`, {
      tags: { name: 'my_profile' },
      headers: { 'Authorization': `Bearer ${token}` },
    });
    check(res, { 'profile loaded': (r) => r.status === 200 }) || errors.add(1);
    latency.add(res.timings.duration);
  });
  
  group('deals', () => {
    // List deals
    const res = http.get(`${BASE_URL}/api/v1/deals`, {
      tags: { name: 'deals_list' },
      headers: { 'Authorization': `Bearer ${token}` },
    });
    check(res, { 'deals loaded': (r) => r.status === 200 }) || errors.add(1);
    latency.add(res.timings.duration);
    
    // Get deal details (if any)
    if (res.status === 200) {
      const deals = res.json('deals');
      if (deals && deals.length > 0) {
        const dealId = deals[0].id;
        const detailRes = http.get(`${BASE_URL}/api/v1/deals/${dealId}`, {
          tags: { name: 'deal_detail' },
          headers: { 'Authorization': `Bearer ${token}` },
        });
        check(detailRes, { 'deal loaded': (r) => r.status === 200 }) || errors.add(1);
      }
    }
  });
  
  group('messaging', () => {
    // Send message (chat)
    const res = http.post(`${BASE_URL}/api/v1/messages/send`, JSON.stringify({
      deal_room_id: 1,
      content: 'Test message',
    }), {
      tags: { name: 'send_message' },
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    check(res, { 'message sent': (r) => r.status === 200 }, {
      'status was': `${res.status}`,
    }) || errors.add(1);
    latency.add(res.timings.duration);
  });
  
  group('health', () => {
    // Health check
    const res = http.get(`${BASE_URL}/health/live`, { tags: { name: 'health' } });
    check(res, { 'healthy': (r) => r.status === 200 });
  });
  
  // Think time between operations
  sleep(Math.random() * 2);
}

export function handleWebSocket(data) {
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];
  
  ws.connect(`${BASE_URL}/ws/deal-rooms/1`, { 
    headers: { 'Authorization': `Bearer ${token}` },
  }, function(socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ action: 'auth', token }));
    });
    
    socket.on('message', (msg) => {
      // Handle incoming messages
    });
    
    socket.on('close', () => {});
  });
  
  sleep(60);
}

export function teardown(data) {
  // Cleanup - logout all users
  group('teardown', () => {
    data.tokens.forEach((token) => {
      http.post(`${BASE_URL}/api/v1/auth/logout`, '', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
    });
  });
}