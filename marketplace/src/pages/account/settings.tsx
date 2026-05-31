'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import BrandRegistrationPayment from '@/features/brand/components/BrandRegistrationPayment';
import { AccountDeletionSection } from '@/components/AccountDeletion';
import { api } from '@/lib/api';
import { C } from '@/theme/colors';

type Tab = 'profile' | 'events' | 'security' | 'modules' | 'sessions' | 'brand';
type ProfileSection = 'basic' | 'social' | 'pitch' | 'marketplace' | 'account';

interface Account {
  id: number;
  email: string | null;
  phone: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  display_name: string;
  avatar_url: string | null;
  onboarding_stage: string;
  preferences: string[];
  modules: Array<{ code: string; is_active: boolean }>;
  totp_enabled: boolean;
  created_at: string;
}

interface CreatorProfile {
  display_name: string;
  username: string;
  bio: string;
  location: string;
  country: string;
  niche: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  twitter: string;
  linkedin: string;
  website: string;
  followers_count: number;
  engagement_rate: number;
  pitch_video_url: string;
  pitch_text: string;
  open_for_work: boolean;
  min_deal_value: number;
  response_time: string;
}

export default function AccountSettings() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('profile');
  const [account, setAccount] = useState<Account | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingSection, setEditingSection] = useState<ProfileSection | null>(null);
  const [profile, setProfile] = useState<Partial<CreatorProfile>>({
    username: '',
    bio: '',
    location: '',
    country: '',
    niche: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    twitter: '',
    linkedin: '',
    website: '',
    followers_count: 0,
    engagement_rate: 0,
    pitch_video_url: '',
    pitch_text: '',
    open_for_work: true,
    min_deal_value: 500,
    response_time: '24',
  });

  useEffect(() => {
    const loadAccount = async () => {
      try {
        const res = await fetch('/api/account/me', {
          credentials: 'include',
        });

        if (!res.ok) {
          console.error('Failed to load account:', res.status);
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (json.error) {
          console.error('Failed to load account:', json.error);
          setLoading(false);
          return;
        }

        setAccount(json.data as any);
        if (json.data) {
          setDisplayName(json.data.display_name || '');
          setAvatarUrl(json.data.avatar_url || '');
        }
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading account:', err);
        setLoading(false);
      }
    };

    loadAccount();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Save basic account info (display_name, avatar)
      const basicRes = await api.account.updateAccount({
        display_name: displayName,
        avatar_url: avatarUrl || undefined,
      });
      if (basicRes.error) throw new Error(basicRes.error);

      // Save creator profile if user is a creator
      const isCreator = account?.modules?.some(m => m.code === 'valueskin' && m.is_active);
      if (isCreator && profile) {
        const backendUrl = typeof window !== 'undefined'
          ? '/api/backend'
          : (process.env.BACKEND_URL || 'http://localhost:8080');

        const creatorRes = await fetch(`${backendUrl}/personas/me/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            display_name: displayName,
            username: profile.username,
            bio: profile.bio,
            location: profile.location,
            country: profile.country,
            niche: profile.niche,
            instagram_handle: profile.instagram,
            tiktok_handle: profile.tiktok,
            youtube_handle: profile.youtube,
            twitter_handle: profile.twitter,
            linkedin_handle: profile.linkedin,
            website_url: profile.website,
            followers_count: profile.followers_count,
            engagement_rate: profile.engagement_rate,
            pitch_video_url: profile.pitch_video_url,
            pitch_text: profile.pitch_text,
            open_for_work: profile.open_for_work,
            min_deal_value: profile.min_deal_value,
            response_time_hours: parseInt(profile.response_time || '24'),
          }),
        });
        if (!creatorRes.ok) {
          const data = await creatorRes.json().catch(() => ({}));
          throw new Error(data.error || `Failed to save creator profile (${creatorRes.status})`);
        }
      }

      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } finally {
      router.push('/auth/login');
    }
  };

  const handleToggleModule = async (code: string, active: boolean) => {
    try {
      const res = active
        ? await api.account.deactivateModule(code)
        : await api.account.activateModule(code);

      if (res.error) throw new Error(res.error);

      setAccount(prev => prev ? {
        ...prev,
        modules: prev.modules.map(m => m.code === code ? { ...m, is_active: !active } : m),
      } : prev);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
        <div style={{ color: C.textSecondary }}>Loading...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: C.textSecondary, marginBottom: '12px' }}>Not logged in</p>
          <Link href="/auth/login" style={{ color: C.primary, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.surface, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '24px' }}>Settings</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '32px', borderBottom: `1px solid ${C.border}` }}>
          {(['profile', 'events', 'security', 'modules', 'brand', 'sessions'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderBottom: tab === t ? `2px solid ${C.primary}` : '2px solid transparent',
                background: 'transparent',
                color: tab === t ? C.primary : C.textSecondary,
                fontSize: '14px',
                fontWeight: tab === t ? 600 : 400,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t === 'sessions' ? 'Devices' : t === 'events' ? 'Your Events' : t === 'brand' ? 'Brand Registration' : t}
            </button>
          ))}
        </div>

        {error && <div style={{ padding: '10px 14px', background: '#fef2f2', color: C.error, borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid #fecaca' }}>{error}</div>}
        {success && <div style={{ padding: '10px 14px', background: '#f0fdf4', color: C.success, borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid #bbf7d0' }}>{success}</div>}

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div style={{ background: C.bg, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}` }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>Creator Profile</h2>
              <p style={{ fontSize: '13px', color: C.textSecondary }}>Complete your profile to appear in creator search and attract brand partnerships</p>
            </div>

            {/* Identity Section */}
            <div style={{ marginBottom: '20px', border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setEditingSection(editingSection === 'basic' ? null : 'basic')}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: C.surface,
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: C.text,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>Identity & Basics</span>
                <span style={{ fontSize: '12px', color: C.textSecondary }}>{editingSection === 'basic' ? '−' : '+'}</span>
              </button>
              {editingSection === 'basic' && (
                <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Display name *</label>
                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Username *</label>
                    <input type="text" placeholder="your_username" value={profile.username || ''} onChange={e => setProfile({ ...profile, username: e.target.value })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Bio</label>
                    <textarea placeholder="Tell brands about yourself..." value={profile.bio || ''} onChange={e => setProfile({ ...profile, bio: e.target.value })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit', color: C.text, background: C.bg }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Location *</label>
                      <input type="text" placeholder="City" value={profile.location || ''} onChange={e => setProfile({ ...profile, location: e.target.value })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Country *</label>
                      <input type="text" placeholder="Country" value={profile.country || ''} onChange={e => setProfile({ ...profile, country: e.target.value })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Social Capital Section */}
            <div style={{ marginBottom: '20px', border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setEditingSection(editingSection === 'social' ? null : 'social')}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: C.surface,
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: C.text,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>Social Media & Reach</span>
                <span style={{ fontSize: '12px', color: C.textSecondary }}>{editingSection === 'social' ? '−' : '+'}</span>
              </button>
              {editingSection === 'social' && (
                <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Total followers *</label>
                    <input type="number" placeholder="50000" value={profile.followers_count || 0} onChange={e => setProfile({ ...profile, followers_count: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Niche / Category *</label>
                    <input type="text" placeholder="e.g., Beauty, Gaming, Tech" value={profile.niche || ''} onChange={e => setProfile({ ...profile, niche: e.target.value })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Engagement rate (%)</label>
                    <input type="number" placeholder="3.5" step="0.1" value={profile.engagement_rate || 0} onChange={e => setProfile({ ...profile, engagement_rate: parseFloat(e.target.value) || 0 })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                  </div>
                  <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '12px' }}>Main platforms</label>
                    <div>
                      <label style={{ fontSize: '13px', color: C.text, display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                        Instagram
                      </label>
                      <input type="text" placeholder="@handle" value={profile.instagram || ''} onChange={e => setProfile({ ...profile, instagram: e.target.value })} style={{ width: '100%', padding: '8px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '10px', color: C.text, background: C.bg }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', color: C.text, display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                        TikTok
                      </label>
                      <input type="text" placeholder="@handle" value={profile.tiktok || ''} onChange={e => setProfile({ ...profile, tiktok: e.target.value })} style={{ width: '100%', padding: '8px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '10px', color: C.text, background: C.bg }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', color: C.text, display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                        YouTube
                      </label>
                      <input type="text" placeholder="@handle" value={profile.youtube || ''} onChange={e => setProfile({ ...profile, youtube: e.target.value })} style={{ width: '100%', padding: '8px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '10px', color: C.text, background: C.bg }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', color: C.text, display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                        Twitter
                      </label>
                      <input type="text" placeholder="@handle" value={profile.twitter || ''} onChange={e => setProfile({ ...profile, twitter: e.target.value })} style={{ width: '100%', padding: '8px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '10px', color: C.text, background: C.bg }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', color: C.text, display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                        LinkedIn
                      </label>
                      <input type="text" placeholder="@handle" value={profile.linkedin || ''} onChange={e => setProfile({ ...profile, linkedin: e.target.value })} style={{ width: '100%', padding: '8px', border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Personal website</label>
                    <input type="url" placeholder="https://yoursite.com" value={profile.website || ''} onChange={e => setProfile({ ...profile, website: e.target.value })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                  </div>
                </div>
              )}
            </div>

            {/* Pitch Section */}
            <div style={{ marginBottom: '20px', border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setEditingSection(editingSection === 'pitch' ? null : 'pitch')}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: C.surface,
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: C.text,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>Pitch & Experience</span>
                <span style={{ fontSize: '12px', color: C.textSecondary }}>{editingSection === 'pitch' ? '−' : '+'}</span>
              </button>
              {editingSection === 'pitch' && (
                <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Pitch Video Link (Google Drive, Dropbox, OneDrive, etc.)</label>
                    <input type="url" placeholder="https://drive.google.com/file/d/... or https://dropbox.com/..." value={profile.pitch_video_url || ''} onChange={e => setProfile({ ...profile, pitch_video_url: e.target.value })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Pitch text</label>
                    <textarea placeholder="Describe your experience, past work, and what you're looking for in brand partnerships..." value={profile.pitch_text || ''} onChange={e => setProfile({ ...profile, pitch_text: e.target.value })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', minHeight: '100px', fontFamily: 'inherit', color: C.text, background: C.bg }} />
                  </div>
                </div>
              )}
            </div>

            {/* Marketplace Section */}
            <div style={{ marginBottom: '20px', border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setEditingSection(editingSection === 'marketplace' ? null : 'marketplace')}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: C.surface,
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: C.text,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>Marketplace & Availability</span>
                <span style={{ fontSize: '12px', color: C.textSecondary }}>{editingSection === 'marketplace' ? '−' : '+'}</span>
              </button>
              {editingSection === 'marketplace' && (
                <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: C.text }}>
                      <input type="checkbox" checked={profile.open_for_work !== false} onChange={e => setProfile({ ...profile, open_for_work: e.target.checked })} style={{ marginRight: '8px' }} />
                      Open for work
                    </label>
                  </div>
                  <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Minimum deal value ($)</label>
                      <input type="number" placeholder="500" value={profile.min_deal_value || 500} onChange={e => setProfile({ ...profile, min_deal_value: parseInt(e.target.value) || 500 })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Response time (hours)</label>
                      <input type="number" placeholder="24" value={profile.response_time || '24'} onChange={e => setProfile({ ...profile, response_time: e.target.value })} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '12px' }}>Deal types</label>
                    {['Paid sponsorship', 'Revenue share', 'Product exchange', 'Affiliate'].map(t => (
                      <label key={t} style={{ fontSize: '13px', color: C.text, display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        <input type="checkbox" defaultChecked={t === 'Paid sponsorship'} style={{ marginRight: '8px' }} />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Account Section */}
            <div style={{ marginBottom: '20px', border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setEditingSection(editingSection === 'account' ? null : 'account')}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: C.surface,
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: C.text,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>Account & Verification</span>
                <span style={{ fontSize: '12px', color: C.textSecondary }}>{editingSection === 'account' ? '−' : '+'}</span>
              </button>
              {editingSection === 'account' && (
                <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Avatar URL</label>
                    <input type="text" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: C.text, background: C.bg }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Email</label>
                    <p style={{ fontSize: '14px', color: C.textSecondary }}>{account.email || 'Not set'} {account.email_verified ? <span style={{ color: C.success, fontSize: '12px' }}>✓ Verified</span> : <Link href="/auth/verify-email" style={{ color: C.primary, fontSize: '12px' }}>Verify</Link>}</p>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Phone</label>
                    <p style={{ fontSize: '14px', color: C.textSecondary }}>{account.phone || 'Not set'} {account.phone_verified ? <span style={{ color: C.success, fontSize: '12px' }}>✓ Verified</span> : account.phone ? <Link href="/auth/verify-phone" style={{ color: C.primary, fontSize: '12px' }}>Verify</Link> : <Link href="/auth/verify-phone" style={{ color: C.primary, fontSize: '12px' }}>Add</Link>}</p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '24px' }}>
              <button onClick={handleSaveProfile} disabled={saving} style={{ padding: '10px 24px', background: saving ? C.border : C.primary, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save profile'}
              </button>
              <button onClick={handleLogout} style={{ padding: '10px 24px', background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {tab === 'events' && (
          <div style={{ background: C.bg, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>Your Events</h2>
            <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '24px' }}>
              Manage the events you are hosting or have applied to attend, view ticket sales and attendee analytics.
            </p>
            <button 
              onClick={() => window.location.href = '/events?view=my-events'} 
              style={{ padding: '10px 24px', background: C.primary, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Go to Events Dashboard
            </button>
          </div>
        )}

        {/* Security Tab */}
        {tab === 'security' && (
          <div>
            <div style={{ background: C.bg, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}`, marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text, marginBottom: '20px' }}>Two-factor authentication</h2>
              <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '16px' }}>
                {account.totp_enabled ? '2FA is currently enabled.' : 'Add an extra layer of security to your account.'}
              </p>
              <button onClick={() => router.push(account.totp_enabled ? '/auth/2fa/disable' : '/auth/2fa/setup')} style={{ padding: '10px 24px', background: account.totp_enabled ? '#fef2f2' : C.primary, color: account.totp_enabled ? C.error : '#fff', border: account.totp_enabled ? `1px solid #fecaca` : 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                {account.totp_enabled ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            </div>
            <AccountDeletionSection />
          </div>
        )}

        {/* Modules Tab */}
        {tab === 'modules' && (
          <div style={{ background: C.bg, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>Modules</h2>
            <p style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '20px' }}>Enable or disable platform capabilities. Your account stays the same.</p>

            {[
              { code: 'explorer', label: 'Explorer', desc: 'Browse events, discover people, join communities' },
              { code: 'host', label: 'Host', desc: 'Create and manage events, manage attendees, view analytics' },
              { code: 'valueskin', label: 'ValueSkin', desc: 'Create a creator profile, access marketplace and brand deals' },
              { code: 'brand', label: 'Brand', desc: 'Discover creators, create campaigns, negotiate deals' },
              { code: 'community', label: 'Community', desc: 'Create and moderate communities' },
            ].map(mod => {
              const active = account.modules.find(m => m.code === mod.code)?.is_active ?? false;
              return (
                <div key={mod.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{mod.label}</div>
                    <div style={{ fontSize: '12px', color: C.textSecondary }}>{mod.desc}</div>
                  </div>
                  <button
                    onClick={() => handleToggleModule(mod.code, active)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '20px',
                      border: active ? 'none' : `1px solid ${C.border}`,
                      background: active ? C.primary : C.bg,
                      color: active ? '#fff' : C.text,
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {active ? 'Active' : 'Activate'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Brand Tab */}
        {tab === 'brand' && (
          <div style={{ background: C.bg, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>Brand Registration</h2>
            <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '24px' }}>
              Register as a brand to access premium features and collaborate with creators.
            </p>
            <BrandRegistrationSection accountId={account.id} />
          </div>
        )}

        {/* Sessions Tab */}
        {tab === 'sessions' && <SessionList />}
      </div>
    </div>
  );
}

function SessionList() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/account/sessions', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setSessions(data.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRevoke = async (id: string) => {
    try {
      await fetch(`/api/account/sessions/${id}`, { method: 'DELETE', credentials: 'include' });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch {}
  };

  const handleLogoutAll = async () => {
    try {
      await fetch('/api/auth/logout/all', { method: 'POST', credentials: 'include' });
      window.location.href = '/auth/login';
    } catch {}
  };

  if (loading) return <div style={{ color: C.textSecondary }}>Loading sessions...</div>;

  return (
    <div style={{ background: C.bg, borderRadius: '12px', padding: '24px', border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text }}>Active devices</h2>
        <button onClick={handleLogoutAll} style={{ padding: '8px 16px', background: '#fef2f2', color: C.error, border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          Logout everywhere
        </button>
      </div>

      {sessions.length === 0 && (
        <p style={{ fontSize: '14px', color: C.textSecondary }}>No active sessions.</p>
      )}

      {sessions.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>
              {(s.device_info as any)?.user_agent || 'Unknown device'}
              {s.is_current && <span style={{ fontSize: '11px', color: C.primary, marginLeft: '8px' }}>Current</span>}
            </div>
            <div style={{ fontSize: '12px', color: C.textSecondary }}>
              {s.issued_at ? new Date(s.issued_at).toLocaleDateString() : ''}
            </div>
          </div>
          {!s.is_current && (
            <button onClick={() => handleRevoke(s.id)} style={{ padding: '6px 12px', background: 'transparent', color: C.error, border: 'none', fontSize: '13px', cursor: 'pointer' }}>
              Revoke
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function BrandRegistrationSection({ accountId }: { accountId: number }) {
  const [brandStatus, setBrandStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registrationFee, setRegistrationFee] = useState(99900); // Default to ₹999

  useEffect(() => {
    fetch('/api/brand/register/status', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setBrandStatus(data))
      .catch(() => setBrandStatus({ registered: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ color: C.textSecondary }}>Loading brand status...</div>;
  }

  if (brandStatus?.registered) {
    return (
      <div>
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '16px' }}>
          <p style={{ margin: 0, color: C.success, fontSize: '14px', fontWeight: 500 }}>
            ✓ Your brand account is registered and active!
          </p>
          {brandStatus.activatedAt && (
            <p style={{ margin: '4px 0 0', color: C.textSecondary, fontSize: '12px' }}>
              Activated: {new Date(brandStatus.activatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '16px' }}>
          You have access to all brand features including creator search, messaging, and campaign management.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '16px' }}>
        Complete your brand registration to access premium features and discover creators for partnerships.
      </p>

      <div style={{ marginBottom: '20px', padding: '12px 16px', background: '#f9fafb', border: `1px solid ${C.border}`, borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>Registration Fee</div>
            <div style={{ fontSize: '12px', color: C.textSecondary, marginTop: '4px' }}>One-time payment</div>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.primary }}>₹{(registrationFee / 100).toFixed(2)}</div>
        </div>
      </div>

      <button
        onClick={() => window.location.href = '/brand/register'}
        style={{
          width: '100%',
          padding: '12px 24px',
          background: C.primary,
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Complete Registration
      </button>
    </div>
  );
}
