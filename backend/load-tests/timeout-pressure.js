import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  scenarios: {
    pressure: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '40s',
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health/ready`, { timeout: '3s' });
  check(res, {
    'service responds under pressure': (r) => [200, 503, 504, 429].includes(r.status),
  });
  sleep(0.01);
}

