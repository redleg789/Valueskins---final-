'use client';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{
      background: C.surface,
      borderTop: `1px solid ${C.border}`,
      padding: '40px 20px',
      marginTop: '60px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px',
          marginBottom: '40px',
        }}>
          {/* Brand */}
          <div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 700,
              color: C.text,
              marginBottom: '16px',
            }}>
              ValueSkins
            </h3>
            <p style={{
              fontSize: '13px',
              color: C.textSecondary,
              lineHeight: '1.6',
            }}>
              Connect creators with brands. Build reputation. Complete deals.
            </p>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{
              fontSize: '13px',
              fontWeight: 600,
              color: C.text,
              marginBottom: '12px',
              textTransform: 'uppercase',
            }}>
              Legal
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href="/legal/privacy" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Privacy Policy
              </Link>
              <Link href="/legal/terms" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Terms of Service
              </Link>
              <Link href="/legal/cookies" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Cookie Policy
              </Link>
            </div>
          </div>

          {/* Compliance */}
          <div>
            <h4 style={{
              fontSize: '13px',
              fontWeight: 600,
              color: C.text,
              marginBottom: '12px',
              textTransform: 'uppercase',
            }}>
              Data & Privacy
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href="/legal/data-request" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Data Access (GDPR/CCPA)
              </Link>
              <Link href="/account/settings" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Delete My Account
              </Link>
              <Link href="/legal/security" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Security & Compliance
              </Link>
            </div>
          </div>

          {/* Support */}
          <div>
            <h4 style={{
              fontSize: '13px',
              fontWeight: 600,
              color: C.text,
              marginBottom: '12px',
              textTransform: 'uppercase',
            }}>
              Support
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href="mailto:support@valueskins.com" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Email Support
              </a>
              <a href="https://github.com/redleg789/Valueskins---final-/issues" style={{
                fontSize: '13px',
                color: C.textSecondary,
                textDecoration: 'none',
              }}>
                Report Issue
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}>
          <p style={{
            fontSize: '12px',
            color: C.textSecondary,
            margin: 0,
          }}>
            © {currentYear} ValueSkins. All rights reserved.
          </p>
          <div style={{
            fontSize: '12px',
            color: C.textSecondary,
          }}>
            Made with care for creators & brands
          </div>
        </div>
      </div>
    </footer>
  );
}
