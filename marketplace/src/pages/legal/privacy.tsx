'use client';
import Link from 'next/link';
const C = { bg: '#0f172a', text: '#f8fafc', textSecondary: '#94a3b8', primary: '#38bdf8' };
export default function Privacy() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>← Back</Link>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Privacy Policy</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px' }}>Last updated: May 31, 2026</p>
        <div style={{ lineHeight: '1.8', color: C.textSecondary }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>1. Information We Collect</h2>
          <p><strong>Account Data:</strong> Email, password hash, display name, avatar</p>
          <p><strong>Profile Data:</strong> Bio, links, preferences, creator/brand info</p>
          <p><strong>Usage Data:</strong> Pages visited, features used, timestamps, IP address</p>
          <p><strong>Communication Data:</strong> Messages, deal discussions, support emails</p>
          <p><strong>Device Data:</strong> Browser type, OS, device info (for analytics)</p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>2. How We Use Your Data</h2>
          <p>• Provide services (authentication, messaging, deals)</p>
          <p>• Improve features (analytics, A/B testing)</p>
          <p>• Send important emails (verification, password reset)</p>
          <p>• Prevent fraud and abuse</p>
          <p>• Comply with legal obligations</p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>3. Data Retention</h2>
          <p><strong>Active accounts:</strong> Kept while account is active</p>
          <p><strong>Deleted accounts:</strong> Permanently deleted within 30 days</p>
          <p><strong>Logs:</strong> Kept for 30 days</p>
          <p><strong>Backups:</strong> Retained for 90 days</p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>4. Who We Share Data With</h2>
          <p><strong>Service Providers:</strong> Render (database), Vercel (hosting), Google (OAuth)</p>
          <p><strong>Analytics:</strong> Google Analytics, Mixpanel (only with consent)</p>
          <p><strong>Legal:</strong> If required by law</p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>5. Your Rights (GDPR/CCPA)</h2>
          <p><strong>Access:</strong> Request all data about you</p>
          <p><strong>Portability:</strong> Export data as JSON</p>
          <p><strong>Deletion:</strong> Request account deletion</p>
          <p><strong>Correction:</strong> Update your information</p>
          <p><strong>Opt-out:</strong> Disable marketing/analytics</p>
          <p>Contact: <Link href="mailto:privacy@valueskins.com" style={{color: C.primary}}>privacy@valueskins.com</Link></p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>6. Security</h2>
          <p>• Passwords hashed with bcrypt</p>
          <p>• HTTPS encryption in transit</p>
          <p>• Database encryption at rest</p>
          <p>• Rate limiting to prevent abuse</p>
          <p>• Regular security audits</p>
        </div>
      </div>
    </div>
  );
}
