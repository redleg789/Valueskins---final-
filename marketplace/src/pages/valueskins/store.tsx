'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { C } from '@/theme/colors';

const PROFESSIONS = {
  'Fashion': ['Fashion Influencer','Stylist','Fashion Designer','Model','Personal Shopper','Fashion Photographer','Streetwear Creator','Sustainable Fashion Advocate'],
  'Beauty': ['Makeup Artist','Skincare Specialist','Hair Stylist','Nail Artist','Beauty Reviewer','Fragrance Enthusiast','Esthetician','Beauty Educator'],
  'Travel': ['Travel Blogger','Adventure Creator','Luxury Travel','Budget Travel','Solo Travel','Travel Photographer','Digital Nomad','Hotel Reviewer'],
  'Food & Beverage': ['Chef','Food Photographer','Recipe Creator','Restaurant Reviewer','Pastry Chef','Nutritionist','Food Stylist','Culinary Student'],
  'Fitness': ['Personal Trainer','Yoga Instructor','Fitness Coach','CrossFit Athlete','Pilates Instructor','Bodybuilder','Marathon Runner','Sports Nutritionist'],
  'Lifestyle': ['Lifestyle Blogger','Minimalist','Wellness Coach','Self-Care Advocate','Productivity Creator','Journal Creator','Morning Routine Creator','Slow Living Advocate'],
  'Photography': ['Portrait Photographer','Street Photographer','Landscape Photographer','Product Photographer','Wedding Photographer','Drone Photographer','Photo Editor','Analog Film Creator'],
  'Interior Design': ['Interior Designer','Home Decor Creator','DIY Home','Minimalist Home','Plant Parent','Organization Expert','Furniture Designer','Renovation Creator'],
  'Technology': ['Software Engineer','Full Stack Developer','Data Scientist','Product Manager','DevOps Engineer','UX/UI Designer','Tech Entrepreneur','AI/ML Specialist'],
  'Entertainment': ['Actor','Comedian','Musician','Producer','Director','Screenwriter','Animator','Voice Actor','Podcast Host','DJ','Streamer','Stunt Performer'],
  'Sports': ['Professional Athlete','Fitness Coach','Sports Coach','Yoga Instructor','Nutritionist','Sports Analyst','Personal Trainer','Physical Therapist'],
  'Business': ['CEO','Entrepreneur','Consultant','Sales Manager','HR Manager','Operations Manager','Marketing Manager','Business Analyst'],
};

export default function ValueSkinsStore() {
  const router = useRouter();
  const { account } = useAuth();
  const [ownedSkins, setOwnedSkins] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account?.id) return;

    const fetchOwnedSkins = async () => {
      try {
        const res = await fetch(`/api/skins/manage?userId=${account.id}`);
        if (res.ok) {
          const data = await res.json();
          setOwnedSkins(data.skins?.map((s: any) => s.value_skin) || []);
        }
      } catch (err) {
        console.error('Failed to fetch skins:', err);
      }
    };
    fetchOwnedSkins();
  }, [account?.id]);

  const handlePurchase = async (skinName: string) => {
    if (!account?.id) {
      alert('Please log in first');
      return;
    }

    if (ownedSkins.length >= 3) {
      alert('You can only own 3 value skins. Delete one to purchase another.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/skins/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: account.id, valueSkin: skinName }),
      });

      if (res.ok) {
        setOwnedSkins([...ownedSkins, skinName.toLowerCase()]);
        alert('Profession unlocked!');
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      alert('Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredSkins = Object.entries(PROFESSIONS).filter(([name]) =>
    name.toLowerCase().includes(filter.toLowerCase())
  );

  const canPurchase = ownedSkins.length < 3;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '800', color: C.text, marginBottom: '12px' }}>
            ValueSkins Store
          </h1>
          <p style={{ fontSize: '16px', color: C.textSecondary, marginBottom: '24px' }}>
            Choose your profession and unlock your unique value skin. You can own up to 3 skins.
          </p>
          <p style={{ fontSize: '14px', color: C.accent, marginBottom: '24px' }}>
            Owned: {ownedSkins.length}/3
          </p>

          <input
            type="text"
            placeholder="Search professions..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              maxWidth: '400px',
              padding: '12px 16px',
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              background: C.surface,
              color: C.text,
              fontSize: '14px',
              width: '100%',
            }}
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '40px',
        }}>
          {filteredSkins.map(([name, subProfessions]) => {
            const isOwned = ownedSkins.includes(name.toLowerCase());
            return (
              <div
                key={name}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                }}
              >
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.text, marginBottom: '16px' }}>
                  {name}
                </h3>

                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: C.textSecondary, marginBottom: '8px', textTransform: 'uppercase' }}>
                    Sub-professions:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {subProfessions.map((sub) => (
                      <span
                        key={sub}
                        style={{
                          fontSize: '12px',
                          background: C.bg,
                          color: C.textSecondary,
                          padding: '4px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(name)}
                  disabled={isOwned || loading || !canPurchase}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: isOwned ? C.border : canPurchase ? C.primary : C.textSecondary,
                    color: isOwned ? C.textSecondary : '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isOwned || !canPurchase || loading ? 'not-allowed' : 'pointer',
                    opacity: !canPurchase && !isOwned ? 0.5 : 1,
                  }}
                >
                  {loading ? 'Purchasing...' : isOwned ? 'Owned' : !canPurchase ? 'Max Skins' : 'Purchase'}
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => router.push('/marketplace')}
          style={{
            padding: '12px 24px',
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.text,
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Back to Marketplace
        </button>
      </div>
    </div>
  );
}
