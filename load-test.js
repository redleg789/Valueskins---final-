import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.01'],                   // Error rate < 1%
    errors: ['rate<0.01'],
  },
};

export default function () {
  group('Health Check', () => {
    const res = http.get('http://api:8080/health');
    apiDuration.add(res.timings.duration);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 100ms': (r) => r.timings.duration < 100,
    }) || errorRate.add(1);
  });

  group('Rate Limiting', () => {
    const res = http.get('http://api:8080/health', {
      headers: {
        'X-API-Key': 'sk_test_' + Math.random().toString(36).substring(7),
      },
    });
    check(res, {
      'rate limit header present': (r) => r.headers['x-ratelimit-limit'] !== undefined,
      'remaining requests > 0': (r) => parseInt(r.headers['x-ratelimit-remaining']) > 0,
    }) || errorRate.add(1);
  });

  group('Security Headers', () => {
    const res = http.get('http://api:8080/health');
    check(res, {
      'CSP header present': (r) => r.headers['content-security-policy'] !== undefined,
      'no Server header leak': (r) => r.headers['server'] === undefined,
      'X-Content-Type-Options set': (r) => r.headers['x-content-type-options'] === 'nosniff',
      'X-Frame-Options set': (r) => r.headers['x-frame-options'] === 'DENY',
    }) || errorRate.add(1);
  });

  sleep(1);
}
