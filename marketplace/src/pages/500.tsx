'use client';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function ServerError() {
  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '80px',
          fontWeight: 800,
          color: '#ef4444',
          marginBottom: '16px',
        }}>
          500
        </div>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: C.text,
          marginBottom: '8px',
        }}>
          Server Error
        </h1>
        <p style={{
          fontSize: '16px',
          color: C.textSecondary,
          marginBottom: '32px',
          maxWidth: '400px',
        }}>
          Something went wrong on our end. Our team has been notified and is working to fix it.
        </p>
        <Link href="/" style={{
          display: 'inline-block',
          padding: '12px 24px',
          background: C.primary,
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '8px',
          fontWeight: 600,
        }}>
          Go Home
        </Link>
      </div>
    </div>
  );
}
