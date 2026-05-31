'use client';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function Rankings() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: C.text, marginBottom: '8px' }}>Top Creators</h1>
          <p style={{ fontSize: '16px', color: C.textSecondary }}>Ranked by completed deals and customer reviews</p>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: C.primary, minWidth: '40px' }}>#{i}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 4px 0' }}>Creator #{i}</h3>
                <div style={{ fontSize: '13px', color: C.textSecondary }}>⭐ 4.{i} • {i * 5} deals completed</div>
              </div>
              <button style={{
                padding: '8px 16px',
                background: C.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}>
                View Profile
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <Link href="/marketplace" style={{ color: C.primary, textDecoration: 'none', fontWeight: 600 }}>
            Back to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
