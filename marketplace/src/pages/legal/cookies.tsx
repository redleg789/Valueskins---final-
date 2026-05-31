'use client';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function CookiePolicy() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>
          ← Back to Home
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Cookie Policy</h1>
        <p style={{ color: C.textSecondary, fontSize: '14px', marginBottom: '32px' }}>Last updated: May 2026</p>

        <div style={{ lineHeight: '1.8', fontSize: '14px', color: C.text }}>
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>1. What are Cookies?</h2>
            <p>
              Cookies are small text files that are stored on your device when you visit our website. They help us recognize you, remember your preferences, and improve your experience on ValueSkins. Cookies are widely used by website owners in order to make their websites work more efficiently.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>2. Types of Cookies We Use</h2>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Essential/Strictly Necessary Cookies:</h3>
            <p style={{ marginBottom: '16px' }}>
              These cookies are necessary for the website to function properly. They enable core functionality such as authentication, session management, and CSRF protection.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Cookie Name</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Purpose</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px' }}>valueskins_session</td>
                  <td style={{ padding: '8px' }}>User authentication</td>
                  <td style={{ padding: '8px' }}>7 days</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px' }}>csrf_token</td>
                  <td style={{ padding: '8px' }}>CSRF protection</td>
                  <td style={{ padding: '8px' }}>Session</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px' }}>next-auth.session-token</td>
                  <td style={{ padding: '8px' }}>OAuth session</td>
                  <td style={{ padding: '8px' }}>7 days</td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Analytics Cookies:</h3>
            <p style={{ marginBottom: '16px' }}>
              We use Google Analytics to understand how users interact with our platform. These cookies help us improve the service. You can opt-out at any time.
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
              <li>_ga, _ga_* - Google Analytics tracking</li>
              <li>Purpose: Usage analytics (anonymized)</li>
              <li>Duration: 2 years</li>
            </ul>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Preference Cookies:</h3>
            <ul style={{ marginLeft: '20px' }}>
              <li>valueskins_cookie_consent - Your cookie preference choice</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>3. How to Control Cookies</h2>
            <p>
              Most browsers allow you to control cookies through their settings. You can:
            </p>
            <ul style={{ marginLeft: '20px' }}>
              <li>Block all cookies</li>
              <li>Allow only certain cookies</li>
              <li>Delete cookies when you close your browser</li>
              <li>View and manage stored cookies</li>
            </ul>
            <p style={{ marginTop: '12px' }}>
              <strong>Note:</strong> Blocking essential cookies may prevent ValueSkins from working properly.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>4. Third-Party Cookies</h2>
            <p>
              We use third-party services that set cookies on our behalf:
            </p>
            <ul style={{ marginLeft: '20px' }}>
              <li><strong>Google Analytics</strong> - Usage analytics (analytics cookies)</li>
              <li><strong>Stripe</strong> - Payment processing (may set cookies)</li>
              <li><strong>Next.js</strong> - Session management (next-auth)</li>
            </ul>
            <p style={{ marginTop: '12px' }}>
              These third parties have their own privacy policies and cookie practices. We recommend reviewing them.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>5. GDPR/CCPA Compliance</h2>
            <p>
              <strong>EU Users (GDPR):</strong> We obtain your consent before using non-essential cookies. You can withdraw consent at any time.
            </p>
            <p style={{ marginTop: '12px' }}>
              <strong>California Users (CCPA):</strong> You have the right to opt-out of analytics cookies. We don't "sell" your data, but third-party analytics may constitute data sharing.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>6. Cookie Banner</h2>
            <p>
              When you first visit ValueSkins, we show a cookie consent banner. You can:
            </p>
            <ul style={{ marginLeft: '20px' }}>
              <li><strong>Accept All</strong> - Enable essential and analytics cookies</li>
              <li><strong>Reject</strong> - Essential cookies only (required for authentication)</li>
            </ul>
            <p style={{ marginTop: '12px' }}>
              Your choice is saved for 12 months. You can change preferences anytime in this policy.
            </p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>7. Disabling Cookies</h2>
            <p>
              You can disable cookies in your browser settings:
            </p>
            <ul style={{ marginLeft: '20px' }}>
              <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
              <li><strong>Firefox:</strong> Preferences → Privacy & Security → Cookies and Site Data</li>
              <li><strong>Safari:</strong> Preferences → Privacy → Cookies and website data</li>
              <li><strong>Edge:</strong> Settings → Privacy, search, and services → Clear browsing data</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>8. Updates</h2>
            <p>
              We may update this cookie policy from time to time. The date at the top indicates when it was last updated. Continued use of ValueSkins constitutes acceptance of any changes.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
