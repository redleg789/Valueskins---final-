'use client';

import { useState } from 'react';

const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  error: '#ef4444',
  errorBg: '#7f1d1d',
};

export function AccountDeletionSection() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmationPhrase !== 'PERMANENTLY DELETE MY ACCOUNT') {
      setError('Confirmation phrase does not match');
      return;
    }

    setIsDeleting(true);
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || '',
        },
        body: JSON.stringify({
          confirmationPhrase,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      setSuccess(true);
      setError('');
      localStorage.clear();
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  if (success) {
    return (
      <div style={{
        padding: '20px',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: '8px' }}>Account Deleted</div>
        <div style={{ fontSize: '14px', color: '#16a34a' }}>
          Your account has been permanently deleted. Redirecting...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', borderTop: `1px solid ${C.border}`, marginTop: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: '13px', color: C.textSecondary, margin: 0 }}>
          Permanently delete your account and all associated data
        </p>
      </div>

      <button
        onClick={() => setShowDeleteModal(true)}
        style={{
          padding: '10px 16px',
          background: C.error,
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Delete Account
      </button>

      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }} onClick={() => setShowDeleteModal(false)}>
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.error, marginBottom: '12px' }}>
              Permanent Account Deletion
            </h2>

            <div style={{
              background: C.errorBg,
              border: `1px solid ${C.error}40`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '13px',
              color: C.text,
              lineHeight: '1.5',
            }}>
              This will permanently delete:
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                <li>Your account and profile</li>
                <li>All your messages and deals</li>
                <li>All your events</li>
                <li>All personal data</li>
              </ul>
              <strong style={{ display: 'block', marginTop: '8px' }}>This action cannot be undone.</strong>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>
                  Type this exactly to confirm:
                </div>
                <code style={{
                  display: 'block',
                  padding: '8px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: '6px',
                  color: C.text,
                  fontSize: '12px',
                  marginBottom: '8px',
                  wordBreak: 'break-all',
                }}>
                  PERMANENTLY DELETE MY ACCOUNT
                </code>
                <input
                  type="text"
                  value={confirmationPhrase}
                  onChange={e => {
                    setConfirmationPhrase(e.target.value);
                    setError('');
                  }}
                  placeholder="Type confirmation phrase here"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '6px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </label>
            </div>

            {error && (
              <div style={{
                padding: '8px 12px',
                background: C.errorBg,
                border: `1px solid ${C.error}40`,
                borderRadius: '6px',
                color: C.error,
                fontSize: '12px',
                marginBottom: '16px',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmationPhrase('');
                  setError('');
                }}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'transparent',
                  color: C.textSecondary,
                  border: `1px solid ${C.border}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isDeleting ? 'default' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || confirmationPhrase !== 'PERMANENTLY DELETE MY ACCOUNT'}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: confirmationPhrase === 'PERMANENTLY DELETE MY ACCOUNT' ? C.error : C.error + '60',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isDeleting || confirmationPhrase !== 'PERMANENTLY DELETE MY ACCOUNT' ? 'default' : 'pointer',
                  opacity: isDeleting || confirmationPhrase !== 'PERMANENTLY DELETE MY ACCOUNT' ? 0.6 : 1,
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
