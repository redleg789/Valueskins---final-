'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function VerifyEmail() {
  const router = useRouter();
  const { token } = router.query;
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (token && typeof token === 'string') {
      handleVerifyWithToken(token);
    }
  }, [token]);

  const handleVerifyWithToken = async (t: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      if (res.ok) {
        setSuccess('Email verified!');
        setTimeout(() => router.push('/auth/onboarding'), 1500);
      } else {
        const data = await res.json();
        setError(data.error || 'Verification failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/auth/email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        setSuccess('Verification email sent!');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send');
      }
    } catch {
      setError('Network error');
    } finally {
      setResending(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      const next = document.getElementById(`code-${index + 1}`);
      next?.focus();
    }
  };

  const handleCodeSubmit = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;
    handleVerifyWithToken(fullCode);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Verify your email</h1>
        <p style={{ fontSize: '15px', color: C.textSecondary, marginBottom: '32px', lineHeight: 1.5 }}>
          Enter the verification code sent to your email, or click the link in the email.
        </p>

        {error && <div style={{ padding: '10px', background: '#fef2f2', color: C.error, borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
        {success && <div style={{ padding: '10px', background: '#f0fdf4', color: C.success, borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{success}</div>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
          {code.map((digit, i) => (
            <input
              key={i}
              id={`code-${i}`}
              type="text"
              maxLength={1}
              value={digit}
              onChange={e => handleCodeChange(i, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Backspace' && !digit && i > 0) {
                  const prev = document.getElementById(`code-${i - 1}`);
                  prev?.focus();
                }
                if (e.key === 'Enter') handleCodeSubmit();
              }}
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
          onClick={handleCodeSubmit}
          disabled={loading || code.join('').length !== 6}
          style={{ width: '100%', padding: '12px', background: code.join('').length === 6 ? C.primary : C.border, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: code.join('').length === 6 ? 'pointer' : 'not-allowed', marginBottom: '12px' }}
        >
          {loading ? 'Verifying...' : 'Verify email'}
        </button>

        <button
          onClick={handleResend}
          disabled={resending}
          style={{ background: 'transparent', color: C.primary, border: 'none', fontSize: '13px', cursor: 'pointer' }}
        >
          {resending ? 'Sending...' : 'Resend verification email'}
        </button>

        <p style={{ marginTop: '24px', fontSize: '13px' }}>
          <Link href="/auth/onboarding" style={{ color: C.textSecondary }}>Skip for now</Link>
        </p>
      </div>
    </div>
  );
}
