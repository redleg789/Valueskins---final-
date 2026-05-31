'use client';
import Link from 'next/link';
const C = { bg: '#0f172a', text: '#f8fafc', textSecondary: '#94a3b8', primary: '#38bdf8' };
export default function Terms() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>← Back</Link>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Terms of Service</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px' }}>Effective: May 31, 2026</p>
        <div style={{ lineHeight: '1.8', color: C.textSecondary }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>1. Acceptance of Terms</h2>
          <p>By using ValueSkins, you agree to these terms. If you do not agree, do not use the service.</p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>2. User Responsibilities</h2>
          <p>• You must be 18+ (or have parental consent)</p>
          <p>• You are responsible for your account security</p>
          <p>• You may not use the service for illegal purposes</p>
          <p>• You may not harass, abuse, or threaten other users</p>
          <p>• You may not upload malware or harmful content</p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>3. Content Ownership</h2>
          <p><strong>Your content:</strong> You own your photos, profiles, and messages</p>
          <p><strong>Our rights:</strong> You grant us a license to display, store, and backup your content</p>
          <p><strong>Other users' content:</strong> Do not copy, reproduce, or redistribute</p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>4. Service Availability</h2>
          <p>• We provide the service "as-is"</p>
          <p>• We may take the service offline for maintenance</p>
          <p>• We do not guarantee uptime or performance</p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>5. Limitation of Liability</h2>
          <p><strong>We are not liable for:</strong></p>
          <p>• User-generated content or third-party conduct</p>
          <p>• Data loss or corruption</p>
          <p>• Service interruptions or downtime</p>
          <p>• Indirect, consequential, or punitive damages</p>
          <p><strong>Liability cap:</strong> Limited to fees paid in last 12 months (max $100)</p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>6. Dispute Resolution</h2>
          <p>• Disputes resolved by binding arbitration (not class action)</p>
          <p>• Governed by laws of United States</p>
          <p>• Contact us first: <Link href="mailto:support@valueskins.com" style={{color: C.primary}}>support@valueskins.com</Link></p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>7. Account Termination</h2>
          <p>• We may terminate accounts that violate these terms</p>
          <p>• You may delete your account anytime</p>
          <p>• Deletion takes effect within 30 days</p>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>8. Changes to Terms</h2>
          <p>• We may update these terms with 30 days notice</p>
          <p>• Continued use = acceptance of new terms</p>
        </div>
      </div>
    </div>
  );
}
