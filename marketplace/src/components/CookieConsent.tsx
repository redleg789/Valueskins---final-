'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function CookieConsent() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const cookieConsent = localStorage.getItem('valueskins_cookie_consent');
    if (!cookieConsent) {
      setShown(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('valueskins_cookie_consent', 'accepted');
    setShown(false);
  };

  const handleReject = () => {
    localStorage.setItem('valueskins_cookie_consent', 'rejected');
    setShown(false);
  };

  if (!shown) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: C.surface,
      borderTop: `1px solid ${C.border}`,
      padding: '20px',
      zIndex: 1000,
      boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.15)',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <p style={{
            fontSize: '14px',
            color: C.text,
            margin: '0 0 8px 0',
            fontWeight: 500,
          }}>
            We use cookies to improve your experience
          </p>
          <p style={{
            fontSize: '12px',
            color: C.textSecondary,
            margin: 0,
            lineHeight: '1.4',
          }}>
            We use essential cookies for authentication and session management. Analytics cookies help us understand how you use ValueSkins.{' '}
            <Link href="/legal/cookies" style={{
              color: C.primary,
              textDecoration: 'none',
              fontWeight: 500,
            }}>
              Learn more
            </Link>
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={handleReject}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.text,
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Reject
          </button>
          <button
            onClick={handleAccept}
            style={{
              padding: '10px 16px',
              background: C.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
