'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { C } from '@/theme/colors';

interface Account {
  id: number;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
}

export default function AccountSettings() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadAccount = async () => {
      try {
        const res = await fetch('/api/account/me', {
          credentials: 'include',
        });

        if (!res.ok) {
          console.error('Failed to load account:', res.status);
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (json.error) {
          console.error('Failed to load account:', json.error);
          setLoading(false);
          return;
        }

        setAccount(json.data as any);
        if (json.data) {
          setDisplayName(json.data.display_name || '');
          setAvatarUrl(json.data.avatar_url || '');
        }
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading account:', err);
        setLoading(false);
      }
    };

    loadAccount();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/account/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          display_name: displayName,
          avatar_url: avatarUrl || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to save profile (${res.status})`);
      }

      const result = await res.json();
      setAccount(prev => prev ? {
        ...prev,
        display_name: result.data.display_name,
        avatar_url: result.data.avatar_url,
      } : prev);

      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.push('/auth/login');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textSecondary }}>Loading...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: C.textSecondary, marginBottom: '12px' }}>Not logged in</p>
          <Link href="/auth/login" style={{ color: C.primary, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.surface }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '32px' }}>Settings</h1>

        {error && <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: `1px solid #fecaca` }}>{error}</div>}
        {success && <div style={{ padding: '12px 16px', background: '#f0fdf4', color: '#166534', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: `1px solid #bbf7d0` }}>{success}</div>}

        {/* Account Settings */}
        <div style={{ background: C.bg, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}`, marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text, marginBottom: '20px' }}>Account Settings</h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: C.text, marginBottom: '8px' }}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                color: C.text,
                background: C.surface,
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: C.text, marginBottom: '8px' }}>Email</label>
            <div style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              color: C.textSecondary,
              background: C.surface,
            }}>
              {account.email || 'No email set'}
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            style={{
              padding: '10px 20px',
              background: C.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Creator Profile Link */}
        <div style={{ background: C.bg, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}`, marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text, marginBottom: '12px' }}>Creator Profile</h2>
          <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '16px' }}>
            Edit your detailed creator profile including bio, social links, portfolio, and marketplace settings.
          </p>
          <Link href="/profile/me" style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: C.primary,
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '14px',
          }}>
            Go to Profile Editor
          </Link>
        </div>

        {/* Logout */}
        <div style={{ background: C.bg, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text, marginBottom: '12px' }}>Logout</h2>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
