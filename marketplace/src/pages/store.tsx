'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { PROFESSIONS } from '@/config/professions';

const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  primary: '#0066CC',
  success: '#22c55e',
  warning: '#f59e0b',
};

export default function StorePage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const categories = Object.values(PROFESSIONS);
  const currentCategory = selectedCategory ? PROFESSIONS[selectedCategory as keyof typeof PROFESSIONS] : null;

  const handlePurchase = async () => {
    if (!selectedProfession || !selectedCategory) {
      setError('Please select a profession');
      return;
    }

    setPurchasing(true);
    setError('');
    try {
      const res = await fetch('/api/valueskins/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profession_name: selectedProfession,
          category: selectedCategory,
          tier: 1,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Purchase failed');
      }

      const data = await res.json();
      setSuccessMessage(`ValueSkin purchased! Your unique ID: ${data.sticker.valueskin_code}`);
      setTimeout(() => router.push('/'), 2000);
    } catch (err: any) {
      setError(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '24px', display: 'inline-block' }}>
          ← Back to Home
        </Link>

        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: C.text, margin: '0 0 12px 0' }}>ValueSkin Store</h1>
          <p style={{ fontSize: '14px', color: C.textSecondary, margin: 0 }}>
            Purchase a ValueSkin to unlock the marketplace and showcase your expertise
          </p>
        </div>

        {successMessage && (
          <div style={{
            padding: '12px 16px',
            background: C.success,
            color: '#000',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
          }}>
            ✓ {successMessage}
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#ef4444',
            color: '#fff',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
          }}>
            ✕ {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
          {/* Categories Sidebar */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: C.text, margin: '0 0 12px 0', textTransform: 'uppercase' }}>
              Categories
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === cat.name ? null : cat.name);
                    setSelectedProfession(null);
                  }}
                  style={{
                    padding: '12px 16px',
                    background: selectedCategory === cat.name ? C.primary : C.surface,
                    color: selectedCategory === cat.name ? '#fff' : C.text,
                    border: `1px solid ${selectedCategory === cat.name ? C.primary : C.border}`,
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div>
            {!selectedCategory ? (
              <div style={{
                padding: '60px 40px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: '12px',
                textAlign: 'center',
                color: C.textSecondary,
              }}>
                <div style={{ fontSize: '16px' }}>Select a category to view professions</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 700, color: C.text, margin: '0 0 12px 0' }}>
                    {currentCategory?.name}
                  </h2>
                  <p style={{ fontSize: '13px', color: C.textSecondary, margin: 0 }}>
                    Choose a profession in {currentCategory?.name}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
                  {currentCategory?.subProfessions.map(prof => (
                    <button
                      key={prof}
                      onClick={() => setSelectedProfession(selectedProfession === prof ? null : prof)}
                      style={{
                        padding: '16px',
                        background: selectedProfession === prof ? C.primary : C.surface,
                        color: selectedProfession === prof ? '#fff' : C.text,
                        border: `1px solid ${selectedProfession === prof ? C.primary : C.border}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                      }}
                    >
                      {prof}
                    </button>
                  ))}
                </div>

                {selectedProfession && (
                  <div style={{
                    padding: '24px',
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: '12px',
                    marginBottom: '24px',
                  }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: C.text, margin: '0 0 16px 0' }}>
                      {selectedProfession}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: C.textSecondary, textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                          Category
                        </div>
                        <div style={{ fontSize: '14px', color: C.text }}>
                          {currentCategory?.name}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: C.textSecondary, textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                          Price
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: C.primary }}>
                          ₹999
                        </div>
                      </div>
                    </div>

                    <ul style={{ fontSize: '13px', color: C.textSecondary, margin: '0 0 24px 0', paddingLeft: '20px', lineHeight: 1.8 }}>
                      <li>Unique ValueSkin ID</li>
                      <li>Marketplace access</li>
                      <li>Creator profile</li>
                      <li>Deal negotiation</li>
                      <li>Brand connections</li>
                    </ul>

                    <button
                      onClick={handlePurchase}
                      disabled={purchasing}
                      style={{
                        width: '100%',
                        padding: '14px 20px',
                        background: purchasing ? '#666' : C.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: purchasing ? 'not-allowed' : 'pointer',
                        opacity: purchasing ? 0.6 : 1,
                      }}
                    >
                      {purchasing ? 'Processing...' : 'Purchase Now'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
