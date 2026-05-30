import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  vus: 120,
  duration: '45s',
  thresholds: {
    http_req_failed: ['rate<0.10'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'health returns 200 or 429 under flood': (r) => r.status === 200 || r.status === 429,
  });
}

