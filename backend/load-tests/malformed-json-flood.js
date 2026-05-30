import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  vus: 80,
  duration: '45s',
  thresholds: {
    http_req_failed: ['rate<0.10'],
  },
};

export default function () {
  const badJson = '{"role":"creator","access_token": invalid-json}';
  const res = http.post(`${BASE_URL}/auth/login`, badJson, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'malformed payload rejected': (r) => [400, 401, 429].includes(r.status),
  });
}

