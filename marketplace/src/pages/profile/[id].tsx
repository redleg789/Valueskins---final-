'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import MarketplaceLayout from '@/components/MarketplaceLayout';
import { api } from '@/lib/api';
import ReputationAndHistoryLight from '@/features/creator-profile/components/ReputationAndHistoryLight';
import type { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(_ctx: GetServerSidePropsContext) {
  return { props: {} };
}

const C = {
  primary: '#2563EB',
  primaryGradient: 'linear-gradient(135deg, #2563EB, #1e40af)',
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f9fafb',
  card: '#f3f4f6',
  text: '#1f2937',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  success: '#00D46A',
  warning: '#FFAB00',
  danger: '#ED4956',
  accent: '#3B82F6',
};

export default function PublicProfilePage() {
  const router = useRouter();
  const { id } = router.query;
  const [isFollowing, setIsFollowing] = useState(false);
  const [remoteProfile, setRemoteProfile] = useState<null | {
    name: string;
    handle: string;
    bio: string;
    followers: number;
    following: number;
    engagement: number;
    dealsCompleted: number;
    avgDealValue: number;
    skins: string[];
    level: number;
    verified: boolean;
    avatarColor: string;
    avatarAbbr: string;
    recentDeals: { brand: string; amount: string; date: string }[];
    reviews?: { author: string; rating: number; quote: string }[];
  }>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      const raw = typeof id === 'string' ? id.replace('@', '') : '';
      if (!raw) return;

      const numericId = Number(raw);
      if (Number.isNaN(numericId)) {
        return;
      }

      const profileResult = await api.persona.getPersona(numericId);
      if (cancelled || !profileResult.data) return;
      const skinsResult = await api.persona.getPersonaSkins(numericId);
      if (cancelled) return;

      setRemoteProfile({
        name: profileResult.data.display_name,
        handle: `@${profileResult.data.username}`,
        bio: '',
        followers: 0,
        following: 0,
        engagement: 0,
        dealsCompleted: 0,
        avgDealValue: 0,
        skins: skinsResult.data?.map((skin) => skin.profession_name) ?? [],
        level: Math.max(...(skinsResult.data?.map((skin) => skin.level) ?? [1])),
        verified: true,
        avatarColor: '#2563EB',
        avatarAbbr: profileResult.data.display_name.slice(0, 2).toUpperCase(),
        recentDeals: [],
        reviews: [],
      });
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handle = typeof id === 'string' ? id.replace('@', '') : '';
  const profile = remoteProfile;
  const isLoadingRemote = !!handle && !Number.isNaN(Number(handle)) && !profile;

  if (!handle || (!profile && !isLoadingRemote)) {
    return (
      <MarketplaceLayout title="Profile" hideHeader>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>
            User not found
          </div>
          <div style={{ fontSize: '13px', color: C.textMuted }}>
            {handle ? `No user found for @${handle}` : 'Loading...'}
          </div>
        </div>
      </MarketplaceLayout>
    );
  }

  if (isLoadingRemote) {
    return (
      <MarketplaceLayout title="Profile" hideHeader>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>
            Loading profile...
          </div>
        </div>
      </MarketplaceLayout>
    );
  }

  return (
    <MarketplaceLayout title={profile.name} hideHeader>
      <div style={{ padding: '20px 16px' }}>
        {/* Profile header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: `${profile.avatarColor}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 700,
            color: profile.avatarColor,
            border: `3px solid ${profile.avatarColor}40`,
          }}>
            {profile.avatarAbbr}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>
                {profile.name}
              </span>
              {profile.verified && (
                <span style={{ fontSize: '14px' }}>✓</span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '2px' }}>
              {profile.handle}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: C.textSecondary }}>
                <strong style={{ color: C.text }}>{profile.followers.toLocaleString()}</strong> followers
              </div>
              <div style={{ fontSize: '12px', color: C.textSecondary }}>
                <strong style={{ color: C.text }}>{profile.following.toLocaleString()}</strong> following
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsFollowing(!isFollowing)}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: isFollowing ? C.surfaceAlt : C.primary,
              color: isFollowing ? C.text : '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: isFollowing ? `1px solid ${C.border}` : 'none',
            }}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>

        {/* Bio */}
        <div style={{
          fontSize: '13px',
          color: C.textSecondary,
          lineHeight: 1.6,
          marginBottom: '20px',
          padding: '14px',
          background: C.surfaceAlt,
          borderRadius: '10px',
        }}>
          {profile.bio}
        </div>

        {/* ValueSkins */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '10px' }}>
            ValueSkins
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {profile.skins.map(skin => (
              <span key={skin} style={{
                padding: '6px 14px',
                borderRadius: '20px',
                background: C.primary + '12',
                color: C.primary,
                fontSize: '13px',
                fontWeight: 600,
                border: `1px solid ${C.primary}30`,
              }}>
                {skin}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: '24px',
        }}>
          <div style={{
            background: C.surfaceAlt,
            borderRadius: '10px',
            padding: '14px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
              Lv.{profile.level}
            </div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: 2 }}>
              Level
            </div>
          </div>
          <div style={{
            background: C.surfaceAlt,
            borderRadius: '10px',
            padding: '14px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
              {profile.engagement}%
            </div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: 2 }}>
              Engagement
            </div>
          </div>
          <div style={{
            background: C.surfaceAlt,
            borderRadius: '10px',
            padding: '14px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
              {profile.dealsCompleted}
            </div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: 2 }}>
              Deals Done
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          marginBottom: '24px',
        }}>
          <div style={{ background: C.surfaceAlt, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
              ${(profile.avgDealValue || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: 2 }}>
              Avg Deal Value
            </div>
          </div>
          <div style={{ background: C.surfaceAlt, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
              {profile.verified ? 'Verified' : 'Pending'}
            </div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: 2 }}>
              Trust Status
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '10px' }}>
            Why brands book this profile
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              'Verified ValueSkin identity',
              'Repeat brand collaborations',
              'Audience trust and conversion-ready positioning',
            ].map((item) => (
              <div key={item} style={{ padding: '12px 14px', background: C.surfaceAlt, borderRadius: '10px', fontSize: '13px', color: C.textSecondary }}>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Recent deals */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '10px' }}>
            Recent Deals
          </div>
          {profile.recentDeals.map((deal, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderBottom: i < profile.recentDeals.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>
                {deal.brand}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: C.success, fontWeight: 600 }}>
                  {deal.amount}
                </span>
                <span style={{ fontSize: '11px', color: C.textMuted }}>
                  {deal.date}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Reputation & History from Events */}
        <ReputationAndHistoryLight userId={parseInt(id as string)} />

        {!!profile.reviews?.length && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '10px' }}>
              Reviews
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {profile.reviews.map((review, i) => (
                <div key={`${review.author}-${i}`} style={{ background: C.surfaceAlt, borderRadius: '10px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{review.author}</div>
                    <div style={{ fontSize: '12px', color: C.warning }}>{'★'.repeat(review.rating)}</div>
                  </div>
                  <div style={{ fontSize: '13px', color: C.textSecondary, lineHeight: 1.5 }}>
                    {review.quote}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: '10px' }}>
          <button style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            background: C.primary,
            color: '#fff',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Message {profile.name.split(' ')[0]}
          </button>
          <button style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            background: C.surfaceAlt,
            color: C.text,
            border: `1px solid ${C.border}`,
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Request collaboration
          </button>
        </div>
      </div>
    </MarketplaceLayout>
  );
}
