import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  vus: 60,
  duration: '60s',
  thresholds: {
    http_req_failed: ['rate<0.10'],
  },
};

export default function () {
  const payload = JSON.stringify({
    refresh_token: 'x'.repeat(5000),
  });

  const res = http.post(`${BASE_URL}/auth/refresh`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'oversized refresh token blocked': (r) => [400, 401, 429].includes(r.status),
  });

  sleep(0.05);
}

