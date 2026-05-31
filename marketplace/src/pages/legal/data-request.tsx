'use client';
import { useState } from 'react';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function DataRequest() {
  const [requestType, setRequestType] = useState<'access' | 'delete' | 'export'>('access');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/legal/data-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Failed to submit request');
        return;
      }

      setStatus('success');
      setMessage('Request submitted successfully. Check your email for confirmation.');
      setEmail('');
      setRequestType('access');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Error submitting request');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>
          ← Back to Home
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Data Access & Deletion Request</h1>
        <p style={{ color: C.textSecondary, fontSize: '14px', marginBottom: '32px' }}>
          Exercise your GDPR and CCPA rights. Submit a request to access, export, or delete your personal data.
        </p>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Request Type</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="access"
                  checked={requestType === 'access'}
                  onChange={(e) => setRequestType(e.target.value as any)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>
                  <div style={{ fontWeight: 600 }}>Access My Data (GDPR/CCPA)</div>
                  <div style={{ fontSize: '13px', color: C.textSecondary }}>Get a copy of all your personal data</div>
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="export"
                  checked={requestType === 'export'}
                  onChange={(e) => setRequestType(e.target.value as any)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>
                  <div style={{ fontWeight: 600 }}>Export My Data (Data Portability)</div>
                  <div style={{ fontSize: '13px', color: C.textSecondary }}>Download your data in a portable format</div>
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="delete"
                  checked={requestType === 'delete'}
                  onChange={(e) => setRequestType(e.target.value as any)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>
                  <div style={{ fontWeight: 600 }}>Delete My Data (Right to Erasure)</div>
                  <div style={{ fontSize: '13px', color: C.textSecondary }}>Request permanent deletion of your account and data</div>
                </span>
              </label>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  color: C.text,
                  background: C.bg,
                }}
              />
              <p style={{ fontSize: '12px', color: C.textSecondary, marginTop: '6px' }}>
                We'll send verification to this email address
              </p>
            </div>

            {message && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  border: `1px solid ${status === 'success' ? '#10b981' : '#ef4444'}`,
                  background: status === 'success' ? '#f0fdf4' : '#fef2f2',
                  color: status === 'success' ? '#166534' : '#991b1b',
                }}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: C.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                opacity: status === 'loading' ? 0.6 : 1,
              }}
            >
              {status === 'loading' ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>What Happens Next?</h2>
          <ol style={{ marginLeft: '20px', fontSize: '14px', lineHeight: '1.6' }}>
            <li>We verify your email address</li>
            <li>We confirm your identity (you may need to verify ownership)</li>
            <li>For access/export: We compile your data and send it within 30 days</li>
            <li>For deletion: We delete your account and data within 30 days</li>
            <li>Some data may be retained for legal compliance (7 years for tax records)</li>
          </ol>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Need Help?</h2>
          <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '12px' }}>
            You can also contact us directly at <strong>privacy@valueskins.com</strong> with your request.
          </p>
          <p style={{ fontSize: '14px', color: C.textSecondary }}>
            Or delete your account directly from your <Link href="/account/settings" style={{ color: C.primary, textDecoration: 'none' }}>account settings</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
