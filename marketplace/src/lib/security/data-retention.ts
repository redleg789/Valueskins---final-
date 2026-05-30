interface DataRetentionRule {
  dataType: string;
  retentionDays: number;
  deletionMethod: 'purge' | 'anonymize' | 'archive';
  legalHold?: boolean;
  lastVerified?: string;
}

interface DataLifecycleEntry {
  dataType: string;
  createdAt: string;
  lastAccess: string;
  retentionExpiry: string;
  status: 'active' | 'pending_deletion' | 'deleted';
  anonymized?: boolean;
}

const RETENTION_RULES: DataRetentionRule[] = [
  { dataType: 'user_id_images', retentionDays: 0, deletionMethod: 'purge', legalHold: false },
  { dataType: 'id_verification', retentionDays: 1, deletionMethod: 'purge', legalHold: false },
  { dataType: 'session_logs', retentionDays: 30, deletionMethod: 'purge', legalHold: false },
  { dataType: 'access_logs', retentionDays: 90, deletionMethod: 'anonymize', legalHold: true },
  { dataType: 'chat_messages', retentionDays: 365, deletionMethod: 'anonymize', legalHold: false },
  { dataType: 'user_profiles', retentionDays: 730, deletionMethod: 'anonymize', legalHold: false },
  { dataType: 'payment_records', retentionDays: 2555, deletionMethod: 'archive', legalHold: true },
  { dataType: 'tax_records', retentionDays: 2555, deletionMethod: 'archive', legalHold: true },
  { dataType: 'backup_files', retentionDays: 90, deletionMethod: 'purge', legalHold: false },
];

export function getRetentionRules(): DataRetentionRule[] {
  return RETENTION_RULES;
}

export function getRetentionPeriod(dataType: string): number | null {
  const rule = RETENTION_RULES.find(r => r.dataType === dataType);
  return rule?.retentionDays ?? null;
}

export function shouldDelete(dataType: string, createdAt: Date): boolean {
  const retention = getRetentionPeriod(dataType);
  if (retention === null || retention === undefined) {
    return false;
  }

  if (retention === 0) {
    return true;
  }

  const expiryDate = new Date(createdAt);
  expiryDate.setDate(expiryDate.getDate() + retention);

  return new Date() > expiryDate;
}

export function anonymizeUserData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['email', 'phone', 'name', 'address', 'ip'];

  const anonymized = { ...data };

  for (const field of sensitiveFields) {
    if (anonymized[field] !== undefined) {
      anonymized[field] = '[DELETED]';
    }
  }

  if (anonymized['passwordHash']) {
    anonymized['passwordHash'] = '[DELETED]';
  }

  return anonymized;
}

export function verifyDataDeletion(
  dataType: string,
  storedData: Record<string, unknown>[]
): { verified: boolean; issues: string[] } {
  const issues: string[] = [];
  const rule = RETENTION_RULES.find(r => r.dataType === dataType);

  if (!rule) {
    issues.push(`No retention rule for ${dataType}`);
    return { verified: false, issues };
  }

  if (rule.retentionDays === 0) {
    if (storedData.length > 0) {
      issues.push(`${dataType} should be immediately deleted but ${storedData.length} records exist`);
    }
  }

  return {
    verified: issues.length === 0,
    issues,
  };
}

export function checkAllDataTypes(
  datasets: Map<string, Record<string, unknown>[]>
): { dataType: string; status: string; issue?: string }[] {
  const results: { dataType: string; status: string; issue?: string }[] = [];

  for (const rule of RETENTION_RULES) {
    const dataArray = datasets.get(rule.dataType);

    if (!dataArray || dataArray.length === 0) {
      results.push({
        dataType: rule.dataType,
        status: 'NO DATA',
      });
      continue;
    }

    if (rule.retentionDays === 0) {
      results.push({
        dataType: rule.dataType,
        status: dataArray.length > 0 ? 'FAIL' : 'OK',
        issue: dataArray.length > 0 ? `${dataArray.length} records should have been deleted` : undefined,
      });
    } else {
      results.push({
        dataType: rule.dataType,
        status: 'OK',
      });
    }
  }

  return results;
}

export function getDataLifecycleReport(
  dataType: string,
  createdAt: string
): DataLifecycleEntry {
  const retentionDays = getRetentionPeriod(dataType) ?? 365;
  const created = new Date(createdAt);
  const expiry = new Date(created);
  expiry.setDate(expiry.getDate() + retentionDays);

  const now = new Date();
  const status: DataLifecycleEntry['status'] = now > expiry ? 'pending_deletion' : 'active';

  return {
    dataType,
    createdAt,
    lastAccess: new Date().toISOString(),
    retentionExpiry: expiry.toISOString(),
    status,
  };
}

export const STORAGE_ISOLATION_RULES = {
  sensitive: {
    types: ['id_images', 'government_ids', 'biometric_data'],
    encryption: 'required',
    storageClass: 'isolated',
    accessPattern: 'by-authorization-only',
    networkAccess: 'private-only',
  },
  private: {
    types: ['messages', 'personal_profile', 'contacts'],
    encryption: 'required',
    storageClass: 'standard',
    accessPattern: 'authenticated-users',
    networkAccess: 'private-only',
  },
  public: {
    types: ['posts', 'comments', 'public_profile'],
    encryption: 'optional',
    storageClass: 'public',
    accessPattern: 'public-read',
    networkAccess: 'any',
  },
};

export function getStorageIsolationRule(
  dataType: string
): { isolation: string; issues: string[] } {
  for (const [level, rule] of Object.entries(STORAGE_ISOLATION_RULES)) {
    if (rule.types.includes(dataType)) {
      return {
        isolation: level,
        issues: [],
      };
    }
  }

  return {
    isolation: 'unknown',
    issues: [`No storage isolation rule for ${dataType}`],
  };
}

export function verifyStorageSegregation(
  storedData: Map<string, { type: string; location: string; encrypted: boolean }[]>
): { verified: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const [type, data] of storedData) {
    const rule = STORAGE_ISOLATION_RULES.sensitive;

    if (rule.types.includes(type)) {
      for (const item of data) {
        if (!item.encrypted) {
          violations.push(`${type} at ${item.location} is not encrypted`);
        }

        if (item.location.includes('public')) {
          violations.push(`${type} stored in public location: ${item.location}`);
        }
      }
    }
  }

  return {
    verified: violations.length === 0,
    violations,
  };
}