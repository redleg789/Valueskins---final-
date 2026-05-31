'use client';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>
          ← Back to Home
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Privacy Policy</h1>
        <p style={{ color: C.textSecondary, fontSize: '14px', marginBottom: '32px' }}>Last updated: May 2026</p>

        <div style={{ lineHeight: '1.8', fontSize: '14px', color: C.text }}>
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>1. Introduction</h2>
            <p>
              ValueSkins ("we," "our," or "us") operates the ValueSkins platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our platform and use our services.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>2. Information We Collect</h2>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Information You Provide:</h3>
            <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
              <li>Display name, email, phone number</li>
              <li>Profile information (bio, location, social media handles, portfolio)</li>
              <li>Payment and billing information (via Stripe)</li>
              <li>Messages and communications on the platform</li>
              <li>Profile photos and portfolio media</li>
            </ul>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Information Automatically Collected:</h3>
            <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
              <li>Device information (OS, browser, IP address)</li>
              <li>Usage data (pages visited, features used, timestamps)</li>
              <li>Cookies and similar technologies</li>
              <li>Location data (if permitted)</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>3. How We Use Your Information</h2>
            <ul style={{ marginLeft: '20px' }}>
              <li>Provide and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send marketing communications (with your consent)</li>
              <li>Comply with legal obligations</li>
              <li>Prevent fraud and abuse</li>
              <li>Analyze usage patterns and platform performance</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>4. Data Retention</h2>
            <p>
              We retain your personal data as long as your account is active or as needed to provide services. You can request deletion at any time through your account settings. We retain certain data for legal compliance (tax records: 7 years, audit logs: 1 year).
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>5. Third-Party Services</h2>
            <p>We use the following services that may access your data:</p>
            <ul style={{ marginLeft: '20px' }}>
              <li><strong>Stripe</strong> - Payment processing (payment information)</li>
              <li><strong>Supabase/PostgreSQL</strong> - Data storage</li>
              <li><strong>Vercel</strong> - Hosting and deployment</li>
              <li><strong>Google Analytics</strong> - Usage analytics (anonymized)</li>
            </ul>
            <p style={{ marginTop: '12px' }}>
              These services have their own privacy policies. We only share necessary information and have Data Processing Agreements in place.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>6. Your Rights (GDPR/CCPA)</h2>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>EU Users (GDPR):</h3>
            <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
              <li>Right to access your data</li>
              <li>Right to correction of inaccurate data</li>
              <li>Right to erasure ("right to be forgotten")</li>
              <li>Right to restrict processing</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
            </ul>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>California Users (CCPA):</h3>
            <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
              <li>Right to know what personal information is collected</li>
              <li>Right to delete personal information (with exceptions)</li>
              <li>Right to opt-out of the sale/sharing of personal information</li>
              <li>Right to non-discrimination for exercising CCPA rights</li>
            </ul>

            <p>
              Submit requests at <Link href="/legal/data-request" style={{ color: C.primary, textDecoration: 'none' }}>our data request page</Link> or email privacy@valueskins.com.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>7. Security</h2>
            <p>
              We implement encryption (TLS 1.3+), secure authentication (bcrypt + TOTP), access controls, and regular security audits. However, no method is 100% secure. Please report security vulnerabilities to security@valueskins.com.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>8. Children's Privacy</h2>
            <p>
              ValueSkins is not intended for users under 13. We comply with COPPA (Children's Online Privacy Protection Act). If we learn we've collected data from children under 13, we delete it immediately.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>9. Contact Us</h2>
            <p>
              For privacy questions or to exercise your rights:<br />
              <strong>Email:</strong> privacy@valueskins.com<br />
              <strong>Mailing Address:</strong> ValueSkins, Inc. (contact form coming soon)
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>10. Changes to This Policy</h2>
            <p>
              We may update this policy. Changes will be posted here with an updated date. Continued use constitutes acceptance of changes.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
