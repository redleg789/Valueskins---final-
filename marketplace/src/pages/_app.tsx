import type { AppProps } from 'next/app';
import { AuthProvider } from '@/context/AuthContext';
import Link from 'next/link';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Link
        href="/"
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 9999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 16px',
          borderRadius: '999px',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(12px)',
          color: '#fff',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 700,
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
      >
        ValueSkins
      </Link>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
