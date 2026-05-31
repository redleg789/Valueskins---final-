'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cookieConsent } from '@/lib/cookie-consent';
import type { ConsentChoice, CookiePreferences } from '@/lib/cookie-consent';

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.95)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  accent: '#38bdf8',
  success: '#86efac',
};

export default function CookieConsent() {
  const [choice, setChoice] = useState<ConsentChoice>('pending');
  const [showPreferences, setShowPreferences] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    preferences: false,
  });

  useEffect(() => {
    setChoice(cookieConsent.getChoice());
    setPrefs(cookieConsent.getPreferences());
  }, []);

  if (choice !== 'pending' && !showPreferences) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        backdropFilter: 'blur(12px)',
        zIndex: 9998,
        padding: '24px',
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {!showPreferences ? (
          // Initial banner
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '20px',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '24px' }}>🍪</div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: '8px', color: C.text }}>
                Cookie Settings
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  color: C.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                We use cookies to improve your experience. Essential cookies are required for
                authentication. Analytics & marketing cookies are optional.{' '}
                <Link
                  href="/legal/cookies"
                  style={{ color: C.accent, textDecoration: 'none' }}
                >
                  Learn more
                </Link>
                .
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => cookieConsent.rejectAll()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.text,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Reject All
              </button>

              <button
                onClick={() => setShowPreferences(true)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: `1px solid ${C.accent}`,
                  background: 'transparent',
                  color: C.accent,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Preferences
              </button>

              <button
                onClick={() => cookieConsent.acceptAll()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  background: C.accent,
                  border: 'none',
                  color: '#0f172a',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Accept All
              </button>
            </div>
          </div>
        ) : (
          // Preferences modal
          <div>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '24px' }}>
              Cookie Preferences
            </div>

            {/* Essential cookies */}
            <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 600 }}>Essential Cookies</div>
                <div style={{ color: C.success, fontSize: '12px' }}>Required</div>
              </div>
              <p style={{ margin: '0', fontSize: '14px', color: C.textSecondary }}>
                Required for authentication, security, and basic functionality. Cannot be disabled.
              </p>
            </div>

            {/* Analytics cookies */}
            <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 600 }}>Analytics Cookies</div>
                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                />
              </div>
              <p style={{ margin: '0', fontSize: '14px', color: C.textSecondary }}>
                Help us understand how you use the app to improve features and performance.
              </p>
            </div>

            {/* Marketing cookies */}
            <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 600 }}>Marketing Cookies</div>
                <input
                  type="checkbox"
                  checked={prefs.marketing}
                  onChange={(e) => setPrefs({ ...prefs, marketing: e.target.checked })}
                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                />
              </div>
              <p style={{ margin: '0', fontSize: '14px', color: C.textSecondary }}>
                Allow personalized ads and promotional content. Used for retargeting campaigns.
              </p>
            </div>

            {/* Preference cookies */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 600 }}>Preference Cookies</div>
                <input
                  type="checkbox"
                  checked={prefs.preferences}
                  onChange={(e) => setPrefs({ ...prefs, preferences: e.target.checked })}
                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                />
              </div>
              <p style={{ margin: '0', fontSize: '14px', color: C.textSecondary }}>
                Remember your preferences like language, theme, and layout choices.
              </p>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => {
                  cookieConsent.setPreferences(prefs);
                  setShowPreferences(false);
                }}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '6px',
                  background: C.accent,
                  border: 'none',
                  color: '#0f172a',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Save Preferences
              </button>

              <button
                onClick={() => setShowPreferences(false)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '6px',
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.text,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
