'use client';

import Link from 'next/link';

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  primary: '#38bdf8',
};

export default function CookiesPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>
          ← Back to Home
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>🍪 Cookie Policy</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px' }}>Last updated: May 31, 2026</p>

        <div style={{ lineHeight: '1.8', color: C.textSecondary }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '32px', marginBottom: '12px' }}>
            What are cookies?
          </h2>
          <p>Cookies are small text files stored on your device when you visit our website. They help us remember your preferences and improve your experience.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '32px', marginBottom: '12px' }}>
            Types of cookies we use
          </h2>

          <h3 style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginTop: '20px', marginBottom: '8px' }}>
            1. Essential Cookies (Required)
          </h3>
          <p style={{ marginBottom: '16px' }}>Necessary for authentication, security, and form protection. Cannot be disabled. Duration: 7 days.</p>

          <h3 style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginTop: '20px', marginBottom: '8px' }}>
            2. Analytics Cookies (Optional)
          </h3>
          <p style={{ marginBottom: '16px' }}>Help us understand usage patterns. Google Analytics, Mixpanel, Amplitude. Duration: 2 years.</p>

          <h3 style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginTop: '20px', marginBottom: '8px' }}>
            3. Marketing Cookies (Optional)
          </h3>
          <p style={{ marginBottom: '16px' }}>Enable personalized ads and retargeting. Facebook Pixel, Google Ads. Duration: 1 year.</p>

          <h3 style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginTop: '20px', marginBottom: '8px' }}>
            4. Preference Cookies (Optional)
          </h3>
          <p style={{ marginBottom: '16px' }}>Remember your theme, language, and settings. Duration: 1 year.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '32px', marginBottom: '12px' }}>
            How to manage cookies
          </h2>
          <p>Click the cookie banner at the bottom of the page to update your preferences. You can change them anytime.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '32px', marginBottom: '12px' }}>
            GDPR & CCPA Compliance
          </h2>
          <p>We respect your privacy rights. Essential cookies only. Non-essential cookies require explicit consent.</p>
        </div>
      </div>
    </div>
  );
}
