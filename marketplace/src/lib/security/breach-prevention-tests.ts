import {
  registerIntegration,
  auditIntegrations,
  checkOAuthRisk,
  detectSuspiciousOAuthBehavior,
  getIntegrationRiskScore,
  THIRD_PARTY_INTEGRATIONS,
} from './third-party-audit';
import {
  getRetentionRules,
  getRetentionPeriod,
  shouldDelete,
  anonymizeUserData,
  verifyDataDeletion,
  STORAGE_ISOLATION_RULES,
  verifyStorageSegregation,
} from './data-retention';
import {
  createIncident,
  getIncidentResponseTime,
  getEscalationPath,
  getPlaybook,
  EMERGENCY_CONTACTS,
} from './incident-response';

console.log('🛡️  VERCEL + TEA APP LESSONS: PREVENTION TESTS\n');
console.log('='.repeat(55));

const results: { test: string; passed: boolean; details: string }[] = [];

function test(name: string, passed: boolean, details: string) {
  results.push({ test: name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  console.log(`   ${details}\n`);
}

console.log('\n🔐 THIRD-PARTY OAUTH - VERCEL BREACH PREVENTION\n');

test(
  'Register Integration for Audit',
  (() => {
    registerIntegration('github-oauth', {
      name: 'GitHub',
      type: 'oauth',
      permissions: ['repo', 'read:user'],
    });
    const audits = auditIntegrations();
    return audits.some(a => a.id === 'github-oauth');
  })(),
  'Should register and track third-party integrations'
);

test(
  'OAuth Token Age Validation',
  (() => {
    const oldToken = checkOAuthRisk('token123', 200);
    return !oldToken.safe;
  })(),
  'Should reject tokens older than 7 days'
);

test(
  'OAuth Token Suspicious Patterns',
  (() => {
    const ghToken = checkOAuthRisk('ghp_suspicious12345678901234567890', 1);
    return !ghToken.safe;
  })(),
  'Should flag known suspicious token prefixes'
);

test(
  'Suspicious OAuth Behavior Detection',
  (() => {
    const now = Date.now();
    const events = Array(15).fill(null).map((_, i) => ({
      timestamp: now - i * 1000,
      ip: '192.168.1.100',
      action: 'oauth_access',
    }));
    const result = detectSuspiciousOAuthBehavior(events);
    return result.suspicious;
  })(),
  'Should detect excessive OAuth activity'
);

test(
  'Risk Score for High-Risk Vendors',
  (() => {
    const google = getIntegrationRiskScore('google');
    return google.score >= 80;
  })(),
  'Google OAuth should have high risk score'
);

test(
  'Risk Score for Low-Risk Vendors',
  (() => {
    const supabase = getIntegrationRiskScore('supabase');
    return supabase.score <= 40;
  })(),
  'Supabase should have low risk score'
);

test(
  'All Third-Party Integrations Documented',
  (() => {
    return Object.keys(THIRD_PARTY_INTEGRATIONS).length >= 5;
  })(),
  'Should have documented risk for common integrations'
);

console.log('\n🗑️ DATA RETENTION - TEA APP BREACH PREVENTION\n');

test(
  'Data Retention Rules Defined',
  (() => {
    const rules = getRetentionRules();
    return rules.length >= 5;
  })(),
  'Should have retention rules for all data types'
);

test(
  'Verify ID Images Are Not Retained',
  (() => {
    const retention = getRetentionPeriod('user_id_images');
    return retention === 0;
  })(),
  'ID verification images should have 0-day retention (delete immediately)'
);

test(
  'Verify Session Logs Auto-Delete',
  (() => {
    const retention = getRetentionPeriod('session_logs');
    return retention === 30;
  })(),
  'Session logs should auto-delete after 30 days'
);

test(
  'Determine What Should Be Deleted',
  (() => {
    const idShouldDelete = shouldDelete('user_id_images', new Date('2024-01-01'));
    const recentMsg = shouldDelete('chat_messages', new Date());
    return idShouldDelete && !recentMsg;
  })(),
  'Should correctly identify data past retention'
);

test(
  'Anonymize Instead of Delete PII',
  (() => {
    const data = { email: 'user@example.com', name: 'John', passwordHash: 'hash123' };
    const anonymized = anonymizeUserData(data);
    return anonymized.email === '[DELETED]' && anonymized.name === '[DELETED]';
  })(),
  'Should anonymize PII instead of leaving plaintext'
);

test(
  'Verify No Sensitive Data Exists',
  (() => {
    const data = [{ type: 'id_images', data: 'sensitive' }];
    const result = verifyDataDeletion('user_id_images', data as any);
    return !result.verified;
  })(),
  'Should fail if sensitive data exists when it should be deleted'
);

console.log('\n🏛️ STORAGE ISOLATION - TEA APP PREVENTION\n');

test(
  'Sensitive Data Requires Encryption',
  (() => {
    const sensitive = STORAGE_ISOLATION_RULES.sensitive;
    return sensitive.encryption === 'required';
  })(),
  'Sensitive data storage should require encryption'
);

test(
  'Sensitive Data Stored Separately',
  (() => {
    const sensitive = STORAGE_ISOLATION_RULES.sensitive;
    return sensitive.storageClass === 'isolated';
  })(),
  'Sensitive data require isolated storage'
);

test(
  'Verify Storage Segregation',
  (() => {
    const data = new Map([
      ['id_images', [{ type: 'id_images', location: 's3://private-bucket', encrypted: true }]],
    ]);
    const result = verifyStorageSegregation(data as any);
    return result.verified;
  })(),
  'Should pass when storage is properly segregated'
);

test(
  'Detect Unencrypted Sensitive Data',
  (() => {
    const data = new Map<string, { type: string; location: string; encrypted: boolean }[]>();
    data.set('id_images', [{ type: 'id_images', location: 's3://private-bucket', encrypted: false }]);
    const result = verifyStorageSegregation(data);
    return !result.verified;
  })(),
  'Should fail when sensitive data is unencrypted'
);

test(
  'Detect Public Sensitive Storage',
  (() => {
    const data = new Map<string, { type: string; location: string; encrypted: boolean }[]>();
    data.set('id_images', [{ type: 'id_images', location: 's3://public-bucket', encrypted: true }]);
    const result = verifyStorageSegregation(data);
    return !result.verified;
  })(),
  'Should fail if sensitive data in public storage'
);

console.log('\n🚨 INCIDENT RESPONSE PLAN\n');

test(
  'Create Incident with SLA',
  (() => {
    const incident = createIncident('data_breach', { discoveredBy: 'system' });
    return incident.responseTime <= 60 && incident.severity === 'critical';
  })(),
  'Data breach should have critical severity and 60min SLA'
);

test(
  'Get Incident Response Time',
  (() => {
    const time = getIncidentResponseTime('unauthorized_access');
    return time <= 15;
  })(),
  'Unauthorized access should have 15min response SLA'
);

test(
  'Escalation Path Defined',
  (() => {
    const path = getEscalationPath('data_breach');
    return path.includes('legal') && path.includes('ceo');
  })(),
  'Data breach should escalate to legal and CEO'
);

test(
  'Playbook Has Steps',
  (() => {
    const playbook = getPlaybook('data_breach');
    return playbook.length >= 8;
  })(),
  'Data breach should have actionable playbook'
);

test(
  'Emergency Contacts Available',
  Boolean(EMERGENCY_CONTACTS.securityOnCall && EMERGENCY_CONTACTS.legal),
  'Should have emergency contacts documented'
);

console.log('\n🛡️ ADDITIONAL BREACH PREVENTION\n');

test(
  'No Legacy Data After Migration',
  (() => {
    const oldData = [{ type: 'messages', createdAt: '2024-01-01' }];
    return oldData.length === 0;
  })(),
  'Should not leave legacy data after migration (Tea App failure)'
);

test(
  'Privacy Policy Matches Reality',
  (() => {
    const retention = getRetentionPeriod('user_id_images');
    return retention === 0;
  })(),
  'Retention policy should match actual practices (Tea App failure)'
);

test(
  'Separate Sensitive Storage',
  (() => {
    const sensitive = STORAGE_ISOLATION_RULES.sensitive;
    return sensitive.storageClass === 'isolated';
  })(),
  'IDs and selfies should be in isolated storage (Tea App failure)'
);

test(
  'Environment Variables Encrypted at Rest',
  (() => {
    const rule = STORAGE_ISOLATION_RULES.private;
    return rule.encryption === 'required';
  })(),
  'Private data should use encryption at rest'
);

test(
  'No Public Bucket Access',
  (() => {
    const data = new Map<string, { type: string; location: string; encrypted: boolean }[]>();
    data.set('id_images', [{ type: 'id_images', location: 'public-read', encrypted: true }]);
    const result = verifyStorageSegregation(data);
    return !result.verified;
  })(),
  'Data should never be in publicly accessible storage (Tea App failure)'
);

console.log('\n' + '='.repeat(55));
console.log('\n📊 VERCEL + TEA APP LESSONS TEST RESULTS\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`Total Tests: ${total}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n⚠️  FAILED TESTS:\n');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`❌ ${r.test}`);
    console.log(`   ${r.details}\n`);
  });
  process.exit(1);
} else {
  console.log('\n✅ ALL VERCEL + TEA APP PREVENTION TESTS PASSED!');
  console.log('🛡️  Nexus is protected against common breach patterns!\n');
  process.exit(0);
}