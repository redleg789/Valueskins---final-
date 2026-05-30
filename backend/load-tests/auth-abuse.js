import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  scenarios: {
    brute_force: {
      executor: 'constant-arrival-rate',
      rate: 40,
      timeUnit: '1s',
      duration: '90s',
      preAllocatedVUs: 40,
      maxVUs: 80,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

function badPayload() {
  return JSON.stringify({
    role: 'creator',
    code: 'x'.repeat(64),
    redirect_uri: 'https://evil.example.com/callback',
  });
}

export default function () {
  const res = http.post(`${BASE_URL}/auth/login`, badPayload(), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'auth abuse blocked': (r) => [400, 401, 429].includes(r.status),
  });

  sleep(0.05);
}

