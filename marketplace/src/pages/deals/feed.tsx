'use client';
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function DealsFeed() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: C.text, marginBottom: '8px' }}>Active Deals</h1>
          <p style={{ fontSize: '16px', color: C.textSecondary' }}>Browse brand opportunities and creator collaborations</p>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: C.text, margin: '0 0 8px 0' }}>Deal Opportunity #{i}</h3>
                <p style={{ fontSize: '14px', color: C.textSecondary, margin: 0 }}>Brand collaboration • $500-2000 budget</p>
              </div>
              <button style={{
                padding: '10px 20px',
                background: C.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}>
                View Details
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '40px', textAlign: 'center', color: C.textSecondary }}>
          <p>No more deals. Check back soon!</p>
          <Link href="/marketplace" style={{ color: C.primary, textDecoration: 'none', fontWeight: 600 }}>
            Back to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
