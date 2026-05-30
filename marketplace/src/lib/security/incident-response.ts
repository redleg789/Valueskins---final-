export interface IncidentType {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  responseTime: number;
  escalationPath: string[];
}

export interface PlaybookStep {
  order: number;
  action: string;
  responsible: string;
  completed: boolean;
  timestamp?: string;
}

export const INCIDENT_TYPES: IncidentType[] = [
  {
    name: 'unauthorized_access',
    severity: 'critical',
    responseTime: 15,
    escalationPath: ['security-on-call', 'cto', 'ceo'],
  },
  {
    name: 'data_breach',
    severity: 'critical',
    responseTime: 60,
    escalationPath: ['security-on-call', 'legal', 'ceo', 'board'],
  },
  {
    name: 'ddos_attack',
    severity: 'high',
    responseTime: 30,
    escalationPath: ['security-on-call', 'infra-lead'],
  },
  {
    name: 'ransomware',
    severity: 'critical',
    responseTime: 15,
    escalationPath: ['security-on-call', 'cto', 'legal', 'fbi'],
  },
  {
    name: 'credential_leak',
    severity: 'high',
    responseTime: 60,
    escalationPath: ['security-on-call', 'cto'],
  },
  {
    name: 'api_abuse',
    severity: 'medium',
    responseTime: 240,
    escalationPath: ['security-on-call'],
  },
  {
    name: 'insider_threat',
    severity: 'high',
    responseTime: 60,
    escalationPath: ['security-on-call', 'legal', 'hr'],
  },
  {
    name: 'third_party_breach',
    severity: 'high',
    responseTime: 60,
    escalationPath: ['security-on-call', 'vendor-manager', 'legal'],
  },
];

export const INCIDENT_PLAYBOOK: Record<string, PlaybookStep[]> = {
  data_breach: [
    { order: 1, action: 'Confirm breach - is data actually exposed?', responsible: 'security-on-call', completed: false },
    { order: 2, action: 'Contain - revoke all compromised credentials', responsible: 'security-on-call', completed: false },
    { order: 3, action: 'Preserve evidence - snapshot logs, network state', responsible: 'security-on-call', completed: false },
    { order: 4, action: 'Assess scope - which users? what data?', responsible: 'security-lead', completed: false },
    { order: 5, action: 'Notify legal within 24 hours', responsible: 'legal', completed: false },
    { order: 6, action: 'Notify regulators within 72 hours (GDPR)', responsible: 'legal', completed: false },
    { order: 7, action: 'Notify affected users immediately', responsible: 'communications', completed: false },
    { order: 8, action: 'Rotate all credentials', responsible: 'infra-team', completed: false },
    { order: 9, action: 'Fix vulnerability that enabled breach', responsible: 'engineering', completed: false },
    { order: 10, action: 'Post-incident report', responsible: 'security-lead', completed: false },
  ],
  unauthorized_access: [
    { order: 1, action: 'Terminate suspicious sessions immediately', responsible: 'security-on-call', completed: false },
    { order: 2, action: 'Block IP address or range', responsible: 'security-on-call', completed: false },
    { order: 3, action: 'Force password reset for affected accounts', responsible: 'security-on-call', completed: false },
    { order: 4, action: 'Review access logs for scope', responsible: 'security-on-call', completed: false },
    { order: 5, action: 'Enable enhanced monitoring', responsible: 'security-on-call', completed: false },
    { order: 6, action: 'Investigate root cause', responsible: 'security-lead', completed: false },
  ],
  ddos_attack: [
    { order: 1, action: 'Confirm attack pattern', responsible: 'security-on-call', completed: false },
    { order: 2, action: 'Enable rate limiting', responsible: 'infra', completed: false },
    { order: 3, action: 'Scale infrastructure if needed', responsible: 'infra', completed: false },
    { order: 4, action: 'Configure WAF rules', responsible: 'security-on-call', completed: false },
    { order: 5, action: 'Contact ISP for upstream filtering', responsible: 'infra', completed: false },
    { order: 6, action: 'Monitor for secondary attacks', responsible: 'security-on-call', completed: false },
  ],
  credential_leak: [
    { order: 1, action: 'Identify leaked credential type', responsible: 'security-on-call', completed: false },
    { order: 2, action: 'Rotate exposed credentials', responsible: 'infra', completed: false },
    { order: 3, action: 'Invalidate all sessions using old credentials', responsible: 'security-on-call', completed: false },
    { order: 4, action: 'Check for unauthorized access using leaked creds', responsible: 'security-on-call', completed: false },
    { order: 5, action: 'Force MFA enablement if not already', responsible: 'security-on-call', completed: false },
    { order: 6, action: 'Investigate how credentials were leaked', responsible: 'security-lead', completed: false },
  ],
};

export function getIncidentResponseTime(incidentType: string): number {
  const incident = INCIDENT_TYPES.find(i => i.name === incidentType);
  return incident?.responseTime ?? 60;
}

export function getEscalationPath(incidentType: string): string[] {
  const incident = INCIDENT_TYPES.find(i => i.name === incidentType);
  return incident?.escalationPath ?? ['security-on-call', 'cto'];
}

export function getPlaybook(incidentType: string): PlaybookStep[] {
  return INCIDENT_PLAYBOOK[incidentType] ?? [];
}

export function createIncident(
  incidentType: string,
  details: Record<string, unknown>
): {
  id: string;
  type: string;
  severity: string;
  responseTime: number;
  escalationPath: string[];
  playbook: PlaybookStep[];
  createdAt: string;
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
} {
  const incident = INCIDENT_TYPES.find(i => i.name === incidentType);
  const playbook = getPlaybook(incidentType);

  return {
    id: crypto.randomUUID(),
    type: incidentType,
    severity: incident?.severity ?? 'medium',
    responseTime: incident?.responseTime ?? 60,
    escalationPath: incident?.escalationPath ?? [],
    playbook,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
}

export function verifyIncidentResponse(
  incidentId: string,
  startTime: number
): { withinSla: boolean; minutesElapsed: number; requiredMinutes: number } {
  const endTime = Date.now();
  const minutesElapsed = (endTime - startTime) / (1000 * 60);
  
  return {
    withinSla: minutesElapsed <= 60,
    minutesElapsed: Math.round(minutesElapsed),
    requiredMinutes: 60,
  };
}

export const EMERGENCY_CONTACTS = {
  securityOnCall: '+1-555-NEXUS-SEC',
  cto: '+1-555-NEXUS-CTO',
  legal: '+1-555-NEXUS-LEGAL',
  ceo: '+1-555-NEXUS-CEO',
  fbiCyber: '+1-ocat FBI field office',
  reg72Hours: 'notify within 72 hours',
};

export const BREACH_NOTIFICATION_TIMELINES = {
  eu: { authority: '72 hours', users: 'as soon as possible' },
  california: { authority: 'unknown', users: 'expeditiously' },
  newYork: { authority: 'in most expedient time', users: 'without unreasonable delay' },
};

export const CRITICAL_CREDENTIALS_TO_ROTATE = [
  'JWT_SECRET',
  'SESSION_SECRET',
  'DB_ENCRYPTION_KEY',
  'API_KEYS',
  'OAUTH_CLIENT_SECRETS',
  'STRIPE_SECRET',
  'AWS_ACCESS_KEYS',
];

export function getCredentialRotationList(): string[] {
  return CRITICAL_CREDENTIALS_TO_ROTATE;
}

import crypto from 'crypto';