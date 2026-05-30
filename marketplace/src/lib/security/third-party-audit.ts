import crypto from 'crypto';

const AUDITED_INTEGRATIONS = new Map<string, {
  name: string;
  type: 'oauth' | 'api' | 'webhook' | 'sdk';
  lastAudit: string;
  risk: 'low' | 'medium' | 'high';
  permissions: string[];
  contact?: string;
}>();

export function registerIntegration(
  id: string,
  config: {
    name: string;
    type: 'oauth' | 'api' | 'webhook' | 'sdk';
    permissions: string[];
    contact?: string;
  }
): void {
  AUDITED_INTEGRATIONS.set(id, {
    ...config,
    lastAudit: new Date().toISOString(),
    risk: config.type === 'oauth' ? 'high' : 'medium',
  });
}

export function auditIntegrations(): { id: string; status: string; risk: string }[] {
  const results: { id: string; status: string; risk: string }[] = [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  for (const [id, integration] of AUDITED_INTEGRATIONS) {
    const lastAudit = new Date(integration.lastAudit).getTime();
    const isStale = lastAudit < thirtyDaysAgo;
    const risk = integration.risk;
    
    results.push({
      id,
      status: isStale ? 'NEEDS AUDIT' : 'OK',
      risk,
    });
  }

  return results;
}

export function checkOAuthRisk(
  accessToken: string,
  tokenAgeHours: number
): { safe: boolean; reason: string } {
  if (tokenAgeHours > 24 * 7) {
    return {
      safe: false,
      reason: 'OAuth token older than 7 days - rotate immediately',
    };
  }

  if (accessToken.length < 32) {
    return {
      safe: false,
      reason: 'Token too short - may be truncated or fake',
    };
  }

  const suspiciousPatterns = ['gho_', 'ghp_', 'xoxb-', 'AKIA'];
  for (const pattern of suspiciousPatterns) {
    if (accessToken.startsWith(pattern)) {
      return {
        safe: false,
        reason: `Token matches ${pattern} - requires immediate rotation`,
      };
    }
  }

  return { safe: true, reason: 'Token appears valid' };
}

export function detectSuspiciousOAuthBehavior(
  events: { timestamp: number; ip: string; action: string }[]
): { suspicious: boolean; alerts: string[] } {
  const alerts: string[] = [];
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  const ipCount = new Map<string, number>();
  for (const event of events) {
    if (now - event.timestamp < oneHour) {
      ipCount.set(event.ip, (ipCount.get(event.ip) || 0) + 1);
    }
  }

  for (const [ip, count] of ipCount) {
    if (count > 10) {
      alerts.push(`Excessive OAuth activity from ${ip}: ${count} requests/hour`);
    }
  }

  const actions = events.slice(-10).map(e => e.action);
  const uniqueActions = new Set(actions);
  if (uniqueActions.size > 5) {
    alerts.push('Unusual number of different OAuth actions - possible token harvesting');
  }

  return {
    suspicious: alerts.length > 0,
    alerts,
  };
}

export function generateOAuthToken(): string {
  return crypto
    .randomBytes(32)
    .toString('base64url')
    .replace(/[-_]/, '')
    .slice(0, 40);
}

export function hashTokenForStorage(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

export const THIRD_PARTY_INTEGRATIONS = {
  google: {
    name: 'Google Workspace',
    riskLevel: 'high',
    requiredScopes: ['email', 'profile'],
    shouldAudit: true,
  },
  github: {
    name: 'GitHub',
    riskLevel: 'medium',
    requiredScopes: ['repo', 'read:user'],
    shouldAudit: true,
  },
  slack: {
    name: 'Slack',
    riskLevel: 'medium',
    requiredScopes: ['chat:write', 'channels:read'],
    shouldAudit: true,
  },
  stripe: {
    name: 'Stripe',
    riskLevel: 'medium',
    requiredScopes: ['payments'],
    shouldAudit: true,
  },
  supabase: {
    name: 'Supabase',
    riskLevel: 'low',
    requiredScopes: ['database'],
    shouldAudit: true,
  },
  vercel: {
    name: 'Vercel',
    riskLevel: 'medium',
    requiredScopes: ['deployments', 'domains'],
    shouldAudit: true,
  },
};

export function getIntegrationRiskScore(
  vendor: keyof typeof THIRD_PARTY_INTEGRATIONS
): { score: number; factors: string[] } {
  const integration = THIRD_PARTY_INTEGRATIONS[vendor];
  if (!integration) {
    return { score: 100, factors: ['Unknown vendor'] };
  }

  const factors: string[] = [];

  const riskLevels: Record<string, number> = {
    high: 90,
    medium: 60,
    low: 30,
  };

  return {
    score: riskLevels[integration.riskLevel] || 50,
    factors,
  };
}