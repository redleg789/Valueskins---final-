'use client';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function NotFound() {
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
          color: C.primary,
          marginBottom: '16px',
        }}>
          404
        </div>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: C.text,
          marginBottom: '8px',
        }}>
          Page Not Found
        </h1>
        <p style={{
          fontSize: '16px',
          color: C.textSecondary,
          marginBottom: '32px',
          maxWidth: '400px',
        }}>
          The page you're looking for doesn't exist. It may have been moved or deleted.
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
