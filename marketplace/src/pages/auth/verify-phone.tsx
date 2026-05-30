'use client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function VerifyPhone() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!phone || phone.length < 10) {
      setError('Enter a valid phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/phone/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setStep('otp');
        setSuccess('OTP sent to your phone');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send OTP');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      const next = document.getElementById(`phone-code-${index + 1}`);
      next?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, code: fullCode }),
      });
      if (res.ok) {
        setSuccess('Phone verified!');
        setTimeout(() => router.push('/account/settings'), 1500);
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

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        {step === 'phone' ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Verify your phone</h1>
            <p style={{ fontSize: '15px', color: C.textSecondary, marginBottom: '32px', lineHeight: 1.5 }}>
              Enter your phone number to receive a verification code.
            </p>

            {error && <div style={{ padding: '10px', background: '#fef2f2', color: C.error, borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
            {success && <div style={{ padding: '10px', background: '#f0fdf4', color: C.success, borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{success}</div>}

            <div style={{ marginBottom: '16px' }}>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                onKeyDown={e => { if (e.key === 'Enter') handleRequestOtp(); }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={handleRequestOtp}
              disabled={loading || phone.length < 10}
              style={{ width: '100%', padding: '12px', background: phone.length >= 10 ? C.primary : C.border, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: phone.length >= 10 ? 'pointer' : 'not-allowed' }}
            >
              {loading ? 'Sending...' : 'Send verification code'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Enter verification code</h1>
            <p style={{ fontSize: '15px', color: C.textSecondary, marginBottom: '32px', lineHeight: 1.5 }}>
              Enter the 6-digit code sent to {phone}.
            </p>

            {error && <div style={{ padding: '10px', background: '#fef2f2', color: C.error, borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
            {success && <div style={{ padding: '10px', background: '#f0fdf4', color: C.success, borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{success}</div>}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  id={`phone-code-${i}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleCodeChange(i, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !digit && i > 0) {
                      const prev = document.getElementById(`phone-code-${i - 1}`);
                      prev?.focus();
                    }
                    if (e.key === 'Enter') handleVerifyOtp();
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
              onClick={handleVerifyOtp}
              disabled={loading || code.join('').length !== 6}
              style={{ width: '100%', padding: '12px', background: code.join('').length === 6 ? C.primary : C.border, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: code.join('').length === 6 ? 'pointer' : 'not-allowed', marginBottom: '12px' }}
            >
              {loading ? 'Verifying...' : 'Verify phone'}
            </button>

            <button
              onClick={() => { setStep('phone'); setError(''); setSuccess(''); setCode(Array(6).fill('')); }}
              style={{ background: 'transparent', color: C.textSecondary, border: 'none', fontSize: '13px', cursor: 'pointer' }}
            >
              Change phone number
            </button>
          </>
        )}

        <p style={{ marginTop: '24px', fontSize: '13px' }}>
          <Link href="/account/settings" style={{ color: C.textSecondary }}>Back to settings</Link>
        </p>
      </div>
    </div>
  );
}
