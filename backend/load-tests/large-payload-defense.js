import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

const hugeBody = JSON.stringify({
  role: 'creator',
  access_token: 'x'.repeat(600_000),
});

export default function () {
  const res = http.post(`${BASE_URL}/auth/login`, hugeBody, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'oversized payload rejected': (r) => [400, 413].includes(r.status),
  });

  sleep(0.1);
}

