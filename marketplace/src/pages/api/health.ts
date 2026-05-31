import { NextApiRequest, NextApiResponse } from 'next';
import { setupCors } from '@/lib/cors';
import { queryOne } from '@/lib/db-pool';

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  checks: {
    database: 'healthy' | 'unhealthy';
    api: 'healthy' | 'unhealthy';
  };
  uptime: number;
}

const startTime = Date.now();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  if (setupCors(req, res)) return;

  const checks = {
    database: 'unhealthy' as const,
    api: 'healthy' as const,
  };

  try {
    // Check database connectivity
    const result = await queryOne('SELECT 1 as ping');
    if (result?.ping === 1) {
      checks.database = 'healthy';
    }
  } catch (error) {
    console.error('Health check database error:', error);
  }

  const status =
    checks.database === 'healthy' && checks.api === 'healthy'
      ? 'ok'
      : 'degraded';

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    checks,
    uptime: Date.now() - startTime,
  };

  res.status(status === 'ok' ? 200 : 503).json(response);
}
