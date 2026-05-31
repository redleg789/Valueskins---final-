'use client';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function Security() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>
          ← Back to Home
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Security & Compliance</h1>
        <p style={{ color: C.textSecondary, fontSize: '14px', marginBottom: '32px' }}>
          ValueSkins is built with security and compliance as core principles.
        </p>

        <div style={{ lineHeight: '1.8', fontSize: '14px', color: C.text' }}>
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>🔐 Data Security</h2>
            <ul style={{ marginLeft: '20px' }}>
              <li><strong>Encryption in Transit:</strong> TLS 1.3+ for all connections</li>
              <li><strong>Encryption at Rest:</strong> AES-256-GCM for sensitive fields</li>
              <li><strong>Password Hashing:</strong> bcrypt with 12+ rounds + pepper</li>
              <li><strong>Session Management:</strong> 30-minute timeout, HttpOnly cookies</li>
              <li><strong>CSRF Protection:</strong> Token-based on all state-changing endpoints</li>
              <li><strong>Input Validation:</strong> Parameterized queries, schema validation</li>
              <li><strong>Rate Limiting:</strong> Per-user and per-IP rate limits</li>
              <li><strong>2FA Support:</strong> TOTP (Time-based One-Time Password)</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>✅ Compliance Frameworks</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>GDPR (EU)</h3>
                <p style={{ fontSize: '13px', color: C.textSecondary, margin: 0 }}>
                  ✓ Data minimization
                  <br />
                  ✓ Right to deletion
                  <br />
                  ✓ Data portability
                  <br />
                  ✓ Consent management
                </p>
              </div>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>CCPA (California)</h3>
                <p style={{ fontSize: '13px', color: C.textSecondary, margin: 0 }}>
                  ✓ Right to know
                  <br />
                  ✓ Right to delete
                  <br />
                  ✓ Right to opt-out
                  <br />
                  ✓ No discrimination
                </p>
              </div>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>COPPA (US Children)</h3>
                <p style={{ fontSize: '13px', color: C.textSecondary, margin: 0 }}>
                  ✓ Parental consent
                  <br />
                  ✓ No data sales
                  <br />
                  ✓ Limited tracking
                  <br />
                  ✓ Safety mechanisms
                </p>
              </div>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>PCI-DSS</h3>
                <p style={{ fontSize: '13px', color: C.textSecondary, margin: 0 }}>
                  ✓ Tokenized payments (Stripe)
                  <br />
                  ✓ No card storage
                  <br />
                  ✓ Secure transmissions
                  <br />
                  ✓ PCI compliance
                </p>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>🛡️ Security Practices</h2>
            <ul style={{ marginLeft: '20px' }}>
              <li><strong>Security Audits:</strong> Monthly code reviews, quarterly penetration testing</li>
              <li><strong>Dependency Management:</strong> Weekly vulnerability scans, pinned versions</li>
              <li><strong>Access Control:</strong> Role-based access (RBAC), Row-level security (RLS)</li>
              <li><strong>Incident Response:</strong> 24/7 monitoring, <2-hour response time</li>
              <li><strong>Vulnerability Disclosure:</strong> security@valueskins.com for responsible disclosure</li>
              <li><strong>Penetration Testing:</strong> Regular third-party security assessments</li>
              <li><strong>Logging & Monitoring:</strong> Structured JSON logs, real-time alerts</li>
              <li><strong>Backup & Recovery:</strong> Daily automated backups, cross-region redundancy</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>🏥 Infrastructure Security</h2>
            <ul style={{ marginLeft: '20px' }}>
              <li><strong>Hosting:</strong> Vercel (serverless, auto-scaled, DDoS protected)</li>
              <li><strong>Database:</strong> Render PostgreSQL (multi-AZ, encrypted, backed up)</li>
              <li><strong>CDN:</strong> Global edge network with DDoS mitigation</li>
              <li><strong>DDoS Protection:</strong> AWS WAF, rate limiting, traffic shaping</li>
              <li><strong>Network Security:</strong> TLS 1.3+, HSTS, CSP headers</li>
              <li><strong>Secrets Management:</strong> Environment variables, no hardcoded secrets</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>📋 Third-Party Compliance</h2>
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontWeight: 600, marginBottom: '8px' }}>We only use vendors with strong security practices:</p>
              <ul style={{ marginLeft: '20px' }}>
                <li><strong>Stripe</strong> - PCI-DSS Level 1, SOC 2 Type II, GDPR compliant</li>
                <li><strong>Supabase</strong> - SOC 2, GDPR DPA, encrypted infrastructure</li>
                <li><strong>Vercel</strong> - SOC 2, GDPR compliant, DDoS protected</li>
                <li><strong>Google Analytics</strong> - GDPR consent-based, data anonymized</li>
              </ul>
            </div>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>🚨 Report a Security Vulnerability</h2>
            <p>
              Found a security vulnerability? Please report it responsibly:
            </p>
            <p style={{ marginTop: '12px' }}>
              <strong>Email:</strong> security@valueskins.com
              <br />
              <strong>Include:</strong> Description, steps to reproduce, impact
              <br />
              <strong>Response Time:</strong> Within 48 hours
              <br />
              <strong>Confidentiality:</strong> We'll keep your report confidential until patched
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>📞 Security Contact</h2>
            <p>
              For security questions or concerns, contact us at <strong>security@valueskins.com</strong>
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>📚 Learn More</h2>
            <ul style={{ marginLeft: '20px' }}>
              <li><Link href="/legal/privacy" style={{ color: C.primary, textDecoration: 'none' }}>Privacy Policy</Link></li>
              <li><Link href="/legal/terms" style={{ color: C.primary, textDecoration: 'none' }}>Terms of Service</Link></li>
              <li><Link href="/legal/cookies" style={{ color: C.primary, textDecoration: 'none' }}>Cookie Policy</Link></li>
              <li><Link href="/legal/data-request" style={{ color: C.primary, textDecoration: 'none' }}>Data Access & Deletion</Link></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
