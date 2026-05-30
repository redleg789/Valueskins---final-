'use client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { C } from '@/theme/colors';

export default function TwoFactorAuth() {
  const router = useRouter();
  const { token } = router.query;
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      const next = document.getElementById(`2fa-${index + 1}`);
      next?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;
    setLoading(true);
    setError('');

    try {
      const body: Record<string, string> = { google_token: token as string, totp_code: fullCode };

      const res = await fetch('/api/auth/unified/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code');

      router.push(data.account?.onboarding_stage === 'complete' ? '/' : '/auth/onboarding');
    } catch (err: any) {
      setError(err.message);
      setCode(Array(6).fill(''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Two-factor authentication</h1>
        <p style={{ fontSize: '15px', color: C.textSecondary, marginBottom: '32px' }}>
          Enter the code from your authenticator app.
        </p>

        {error && <div style={{ padding: '10px', background: '#fef2f2', color: C.error, borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
          {code.map((digit, i) => (
            <input
              key={i}
              id={`2fa-${i}`}
              type="text"
              maxLength={1}
              value={digit}
              onChange={e => handleCodeChange(i, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleVerify(); }}
              style={{
                width: '48px',
                height: '56px',
                textAlign: 'center',
                fontSize: '20px',
                fontWeight: 600,
                border: `2px solid ${C.border}`,
                borderRadius: '10px',
              }}
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || code.join('').length !== 6}
          style={{ width: '100%', padding: '12px', background: code.join('').length === 6 ? C.primary : C.border, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: code.join('').length === 6 ? 'pointer' : 'not-allowed', marginBottom: '12px' }}
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    </div>
  );
}
