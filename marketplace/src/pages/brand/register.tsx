import React, { useState, useEffect, CSSProperties } from 'react';
import { useAuth } from '@/context/AuthContext';
import BrandRegistrationPayment from '@/features/brand/components/BrandRegistrationPayment';
import Head from 'next/head';

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
};

const containerStyle: CSSProperties = {
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${C.bg} 0%, rgba(30, 41, 59, 0.8) 100%)`,
  padding: '40px 20px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const contentStyle: CSSProperties = {
  maxWidth: 600,
  margin: '0 auto',
  display: 'grid',
  gap: 32,
};

const headerStyle: CSSProperties = {
  textAlign: 'center',
  display: 'grid',
  gap: 12,
};

const titleStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: C.text,
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontSize: 16,
  color: C.textMuted,
  margin: 0,
  lineHeight: 1.6,
};

const benefitsStyle: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.86)',
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  padding: 24,
  boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
  display: 'grid',
  gap: 16,
};

const benefitItemStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
};

const benefitIconStyle: CSSProperties = {
  fontSize: 24,
  minWidth: 32,
};

const benefitTextStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
};

const benefitTitleStyle: CSSProperties = {
  fontWeight: 600,
  color: C.text,
  fontSize: 14,
};

const benefitDescStyle: CSSProperties = {
  color: C.textMuted,
  fontSize: 13,
  lineHeight: 1.5,
};

const pricingInfoStyle: CSSProperties = {
  background: 'rgba(56, 189, 248, 0.05)',
  border: `1px solid rgba(56, 189, 248, 0.2)`,
  borderRadius: 16,
  padding: 16,
  display: 'grid',
  gap: 8,
};

const infoLabelStyle: CSSProperties = {
  color: C.textMuted,
  fontSize: 12,
  textTransform: 'uppercase',
  fontWeight: 600,
};

const infoValueStyle: CSSProperties = {
  color: C.text,
  fontSize: 14,
  fontWeight: 500,
};

interface BrandRegisterProps {
  registrationFeeCents?: number;
}

export default function BrandRegisterPage({ registrationFeeCents = 99900 }: BrandRegisterProps) {
  const { account, loading } = useAuth();
  const [customFee, setCustomFee] = useState<number | null>(null);
  const [isFlexible, setIsFlexible] = useState(false);

  const finalFee = customFee !== null ? customFee : registrationFeeCents;

  useEffect(() => {
    if (!loading && !account) {
      window.location.href = '/auth/login?redirect=/brand/register';
    }
  }, [account, loading]);

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>
          <div style={{ ...C, textAlign: 'center', color: C.textMuted }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!account) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Brand Registration - ValueSkins</title>
        <meta name="description" content="Register as a brand on ValueSkins" />
      </Head>

      <div style={containerStyle}>
        <div style={contentStyle}>
          {/* Header */}
          <div style={headerStyle}>
            <h1 style={titleStyle}>Brand Registration</h1>
            <p style={subtitleStyle}>
              Unlock premium features and start collaborating with top creators today.
            </p>
          </div>

          {/* Benefits */}
          <div style={benefitsStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>What You Get</h2>

            <div style={benefitItemStyle}>
              <div style={benefitIconStyle}>🔍</div>
              <div style={benefitTextStyle}>
                <div style={benefitTitleStyle}>Advanced Creator Search</div>
                <div style={benefitDescStyle}>Filter creators by location, followers, engagement, and more.</div>
              </div>
            </div>

            <div style={benefitItemStyle}>
              <div style={benefitIconStyle}>💬</div>
              <div style={benefitTextStyle}>
                <div style={benefitTitleStyle}>Direct Messaging</div>
                <div style={benefitDescStyle}>Message creators directly to discuss collaboration opportunities.</div>
              </div>
            </div>

            <div style={benefitItemStyle}>
              <div style={benefitIconStyle}>📊</div>
              <div style={benefitTextStyle}>
                <div style={benefitTitleStyle}>Analytics & Insights</div>
                <div style={benefitDescStyle}>Track your collaborations, engagement, and ROI metrics.</div>
              </div>
            </div>

            <div style={benefitItemStyle}>
              <div style={benefitIconStyle}>🎯</div>
              <div style={benefitTextStyle}>
                <div style={benefitTitleStyle}>Campaign Management</div>
                <div style={benefitDescStyle}>Create, manage, and track multiple creator collaboration campaigns.</div>
              </div>
            </div>

            <div style={benefitItemStyle}>
              <div style={benefitIconStyle}>⭐</div>
              <div style={benefitTextStyle}>
                <div style={benefitTitleStyle}>Creator Reputation Scores</div>
                <div style={benefitDescStyle}>Access detailed reputation scores and verified reviews from other brands.</div>
              </div>
            </div>

            <div style={benefitItemStyle}>
              <div style={benefitIconStyle}>🚀</div>
              <div style={benefitTextStyle}>
                <div style={benefitTitleStyle}>Priority Support</div>
                <div style={benefitDescStyle}>Get dedicated support to help maximize your creator partnerships.</div>
              </div>
            </div>
          </div>

          {/* Pricing Info */}
          {isFlexible && (
            <div style={pricingInfoStyle}>
              <div style={infoLabelStyle}>Custom Registration Fee (in paise)</div>
              <input
                type="number"
                min="0"
                value={customFee ?? registrationFeeCents}
                onChange={(e) => setCustomFee(parseInt(e.target.value) || 0)}
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: C.text,
                  fontSize: 14,
                  fontFamily: 'monospace',
                }}
              />
              <div style={infoValueStyle}>
                ≈ ₹{(Math.round(finalFee) / 100).toFixed(2)}
              </div>
            </div>
          )}

          {/* Flexible Pricing Toggle (for admin/testing) */}
          {process.env.NODE_ENV === 'development' && (
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.05)',
                border: `1px dashed ${C.border}`,
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={isFlexible}
                onChange={(e) => setIsFlexible(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label style={{ color: C.textMuted, fontSize: 12, cursor: 'pointer', flex: 1 }}>
                Use custom fee (development only)
              </label>
            </div>
          )}

          {/* Registration Form */}
          <BrandRegistrationPayment
            registrationFeeCents={finalFee}
            currency="INR"
            title="Complete Your Registration"
            description="One-time payment to activate your brand account. No recurring charges."
            onPaymentSuccess={() => {
              setTimeout(() => {
                window.location.href = '/account/settings';
              }, 2000);
            }}
          />
        </div>
      </div>
    </>
  );
}
