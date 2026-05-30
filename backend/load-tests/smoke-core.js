import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  vus: 50,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'health status is 200': (r) => r.status === 200,
  });

  const ready = http.get(`${BASE_URL}/health/ready`);
  check(ready, {
    'ready status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  sleep(0.1);
}

