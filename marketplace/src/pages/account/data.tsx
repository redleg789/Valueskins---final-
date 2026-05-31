'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const C = { bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)', text: '#f8fafc', textSecondary: '#94a3b8', primary: '#38bdf8', danger: '#fca5a5' };

export default function MyData() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/account/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (error) {
        console.error('Failed to load user data');
      }
      setLoading(false);
    })();
  }, []);

  const exportData = async () => {
    const res = await fetch('/api/legal/export');
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valueskins-export-${Date.now()}.json`;
      a.click();
    }
  };

  const requestDeletion = async () => {
    if (!confirm('This will delete your account after 30 days. Continue?')) return;
    const res = await fetch('/api/legal/delete', { method: 'POST' });
    if (res.ok) {
      alert('Account deletion scheduled. You have 30 days to cancel.');
      window.location.href = '/';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', marginBottom: '32px', display: 'inline-block' }}>← Back</Link>

        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '32px' }}>My Data</h1>

        {loading ? (
          <p>Loading...</p>
        ) : user ? (
          <div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Account Information</h2>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Name:</strong> {user.display_name || 'Not set'}</p>
              <p style={{ color: C.textSecondary, fontSize: '14px', marginTop: '16px' }}>You can update this info in Settings</p>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Data Management</h2>
              <button onClick={exportData} style={{ width: '100%', padding: '12px', background: C.primary, color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginBottom: '12px' }}>
                📥 Download My Data
              </button>
              <p style={{ color: C.textSecondary, fontSize: '13px' }}>Get a copy of all your data in JSON format</p>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.danger}`, borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: C.danger }}>Danger Zone</h2>
              <button onClick={requestDeletion} style={{ width: '100%', padding: '12px', background: C.danger, color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                🗑️ Delete Account
              </button>
              <p style={{ color: C.textSecondary, fontSize: '13px', marginTop: '12px' }}>Permanently delete your account. You have 30 days to cancel.</p>
            </div>
          </div>
        ) : (
          <p>You need to log in</p>
        )}
      </div>
    </div>
  );
}
