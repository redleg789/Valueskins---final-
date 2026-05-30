'use client';
import { useState } from 'react';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function AccountLocked() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUnlockRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/unlock-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {}
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Account locked</h1>
        <p style={{ fontSize: '15px', color: C.textSecondary, lineHeight: 1.5, marginBottom: '24px' }}>
          Too many failed login attempts. Your account has been temporarily locked for security reasons. Please try again later or request an unlock.
        </p>

        {!sent ? (
          <form onSubmit={handleUnlockRequest}>
            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' }} />
            <button type="submit" disabled={loading || !email} style={{ width: '100%', padding: '12px', background: loading || !email ? C.border : C.primary, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: loading || !email ? 'not-allowed' : 'pointer', marginBottom: '12px' }}>
              {loading ? 'Sending...' : 'Send unlock email'}
            </button>
          </form>
        ) : (
          <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <p style={{ fontSize: '14px', color: '#166534' }}>If an account exists with that email, we've sent unlock instructions.</p>
          </div>
        )}

        <p style={{ marginTop: '16px', fontSize: '13px' }}>
          <Link href="/auth/login" style={{ color: C.primary, textDecoration: 'none' }}>Back to login</Link>
        </p>
      </div>
    </div>
  );
}
