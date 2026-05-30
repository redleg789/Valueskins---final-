'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const C = {
  primary: '#2563EB',
  bg: '#ffffff',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  error: '#ef4444',
  success: '#22c55e',
};

export default function TwoFactorSetup() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [step, setStep] = useState<'loading' | 'show' | 'verify' | 'done'>('loading');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/auth/2fa/enable', {
      method: 'POST',
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        setSecret(data.secret);
        setQrUrl(data.qr_code_url);
        setCodes(data.recovery_codes || []);
        setStep('show');
      })
      .catch(() => {
        setError('Failed to initialize 2FA setup');
        setStep('show');
      });
  }, []);

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totp_code: verifyCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid code');
      }
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCodes = () => {
    navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        {step === 'show' && (
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Set up two-factor authentication</h1>
            {error && <div style={{ padding: '10px', background: '#fef2f2', color: C.error, borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
            <ol style={{ fontSize: '14px', color: C.textSecondary, lineHeight: 2, marginBottom: '24px', paddingLeft: '20px' }}>
              <li>Install an authenticator app (Google Authenticator, Authy, etc.)</li>
              <li>Scan the QR code below or enter the secret key manually</li>
              <li>Enter the 6-digit code from the app to verify</li>
            </ol>
            {qrUrl && (
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`} alt="QR Code" style={{ width: '200px', height: '200px', borderRadius: '12px' }} />
              </div>
            )}
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px', marginBottom: '24px', textAlign: 'center' }}>
              <span style={{ fontSize: '13px', color: C.textSecondary }}>Secret: </span>
              <code style={{ fontSize: '14px', color: C.text, fontWeight: 600 }}>{secret}</code>
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>Recovery codes (save these):</p>
                    <div style={{ background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
              {codes.map((code, i) => (
                <div key={i} style={{ fontFamily: 'monospace', fontSize: '14px', color: C.text, padding: '2px 0' }}>{code}</div>
              ))}
            </div>
            <button onClick={copyCodes} style={{ background: 'transparent', color: C.primary, border: 'none', fontSize: '13px', cursor: 'pointer', marginBottom: '20px' }}>
              {copied ? 'Copied!' : 'Copy codes'}
            </button>
            <input type="text" placeholder="Enter 6-digit code from app" value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ width: '100%', padding: '12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', marginBottom: '12px', textAlign: 'center', letterSpacing: '8px', boxSizing: 'border-box' }} />
            <button onClick={handleVerify} disabled={loading || verifyCode.length < 6} style={{ width: '100%', padding: '12px', background: verifyCode.length < 6 ? C.border : C.primary, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: verifyCode.length < 6 ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Verifying...' : 'Verify & enable'}
            </button>
          </div>
        )}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>2FA enabled</h1>
            <p style={{ fontSize: '15px', color: C.textSecondary, marginBottom: '24px' }}>Your account is now protected with two-factor authentication.</p>
            <button onClick={() => router.push('/account/settings')} style={{ padding: '12px 24px', background: C.primary, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
              Back to settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
