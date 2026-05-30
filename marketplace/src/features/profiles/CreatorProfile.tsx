'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceAlt: '#334155',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  primary: '#38bdf8',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  border: '#334155',
};

interface CreatorProfileData {
  // Identity
  display_name: string;
  username: string;
  bio: string;
  location: string;
  country: string;
  languages: string[];
  niche: string;

  // Social Capital
  instagram: string;
  tiktok: string;
  youtube: string;
  twitter: string;
  linkedin: string;
  website: string;
  followers_count: number;
  engagement_rate: number;

  // Pitch System
  pitch_video_url: string;
  pitch_text: string;

  // Portfolio
  portfolio_items: Array<{
    id: string;
    title: string;
    description: string;
    image_url: string;
    type: 'campaign' | 'project' | 'testimonial';
    stats: string;
  }>;

  // Marketplace
  open_for_work: boolean;
  min_deal_value: number;
  preferred_deal_types: string[];
  availability: string;
  response_time: string;

  // Reputation (read-only from backend)
  trust_score: number;
  completion_rate: number;
  repeat_client_rate: number;
  avg_rating: number;
  verified: boolean;
}

const initialData: CreatorProfileData = {
  display_name: '',
  username: '',
  bio: '',
  location: '',
  country: '',
  languages: [],
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
  portfolio_items: [],
  open_for_work: true,
  min_deal_value: 500,
  preferred_deal_types: ['paid', 'barter'],
  availability: 'available',
  response_time: '24',
  trust_score: 0,
  completion_rate: 0,
  repeat_client_rate: 0,
  avg_rating: 0,
  verified: false,
};

type EditSection = null | 'identity' | 'social' | 'pitch' | 'portfolio' | 'marketplace' | 'reputation';

export default function CreatorProfile() {
  const router = useRouter();
  const { account } = useAuth();
  const [profile, setProfile] = useState<CreatorProfileData>(initialData);
  const [editing, setEditing] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (account) {
      fetchProfile();
    }
  }, [account]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile/creator', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProfile({ ...initialData, ...data });
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/creator', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || 'Failed to save');
        return;
      }

      setMessage('Profile saved successfully');
      setEditing(null);
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      setMessage(err.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (!account) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text }}>
        <div>Loading...</div>
      </div>
    );
  }

  const completionPercentage = Math.round(
    ((profile.display_name ? 1 : 0) +
      (profile.bio ? 1 : 0) +
      (profile.location ? 1 : 0) +
      (profile.instagram || profile.tiktok ? 1 : 0) +
      (profile.pitch_text || profile.pitch_video_url ? 1 : 0) +
      (profile.portfolio_items.length > 0 ? 1 : 0)) /
      6 *
      100
  );

  const TrustBadge = ({ score }: { score: number }) => {
    const tier = score >= 90 ? 'Trusted Pro' : score >= 75 ? 'Reliable' : score >= 60 ? 'Growing' : 'New';
    const color = score >= 90 ? C.success : score >= 75 ? C.primary : score >= 60 ? C.warning : C.textMuted;
    return (
      <div style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '20px', background: `${color}20`, border: `1px solid ${color}`, color, fontSize: '12px', fontWeight: 600 }}>
        {tier} • {score}%
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${C.bg} 0%, #111827 100%)`, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {message && (
          <div style={{ padding: '12px 16px', background: message.includes('success') ? `${C.success}20` : `${C.danger}20`, border: `1px solid ${message.includes('success') ? C.success : C.danger}`, borderRadius: '8px', color: message.includes('success') ? C.success : C.danger, marginBottom: '20px', fontSize: '14px' }}>
            {message}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0 }}>Creator Profile</h1>
            <button
              onClick={() => router.push('/')}
              style={{ padding: '10px 20px', background: 'transparent', color: C.primary, border: `1px solid ${C.primary}`, borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            >
              Back
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <TrustBadge score={profile.trust_score} />
            <div style={{ padding: '10px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '13px' }}>
              Completion: <strong>{completionPercentage}%</strong>
            </div>
            {profile.verified && <div style={{ padding: '10px 16px', background: `${C.success}20`, border: `1px solid ${C.success}`, borderRadius: '8px', color: C.success, fontSize: '13px', fontWeight: 600 }}>Verified</div>}
          </div>
        </div>

        {/* Identity Section */}
        <Section title="Identity" isOpen={editing === 'identity'} onToggle={() => setEditing(editing === 'identity' ? null : 'identity')}>
          {editing !== 'identity' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Name</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{profile.display_name || 'Not set'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Username</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>@{profile.username || 'Not set'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Niche</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{profile.niche || 'Not specified'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Location</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{profile.location ? `${profile.location}, ${profile.country}` : 'Not set'}</div>
              </div>
            </div>
          ) : (
            <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <InputField label="Display Name" value={profile.display_name} onChange={v => setProfile({ ...profile, display_name: v })} />
              <InputField label="Username" value={profile.username} onChange={v => setProfile({ ...profile, username: v })} placeholder="no spaces" />
              <InputField label="Niche (e.g., Tech, Fashion, Fitness)" value={profile.niche} onChange={v => setProfile({ ...profile, niche: v })} />
              <InputField label="City" value={profile.location} onChange={v => setProfile({ ...profile, location: v })} />
              <InputField label="Country" value={profile.country} onChange={v => setProfile({ ...profile, country: v })} />
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Bio</label>
                <textarea
                  value={profile.bio}
                  onChange={e => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell brands about yourself, your expertise, and why they should work with you"
                  style={{ width: '100%', padding: '12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, minHeight: '100px', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px' }}
                />
              </div>
              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}
        </Section>

        {/* Social Capital */}
        <Section title="Social Capital" isOpen={editing === 'social'} onToggle={() => setEditing(editing === 'social' ? null : 'social')}>
          {editing !== 'social' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <StatBox label="Followers" value={`${(profile.followers_count / 1000).toFixed(1)}K`} />
              <StatBox label="Engagement" value={`${profile.engagement_rate}%`} />
              {profile.instagram && <SocialHandle platform="Instagram" handle={profile.instagram} />}
              {profile.tiktok && <SocialHandle platform="TikTok" handle={profile.tiktok} />}
              {profile.youtube && <SocialHandle platform="YouTube" handle={profile.youtube} />}
            </div>
          ) : (
            <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <InputField type="number" label="Follower Count" value={String(profile.followers_count)} onChange={v => setProfile({ ...profile, followers_count: parseInt(v) || 0 })} />
              <InputField type="number" label="Engagement Rate (%)" value={String(profile.engagement_rate)} onChange={v => setProfile({ ...profile, engagement_rate: parseInt(v) || 0 })} />
              <InputField label="Instagram Handle" value={profile.instagram} onChange={v => setProfile({ ...profile, instagram: v })} placeholder="username (no @)" />
              <InputField label="TikTok Handle" value={profile.tiktok} onChange={v => setProfile({ ...profile, tiktok: v })} placeholder="username (no @)" />
              <InputField label="YouTube Channel" value={profile.youtube} onChange={v => setProfile({ ...profile, youtube: v })} placeholder="channel name" />
              <InputField label="Twitter/X Handle" value={profile.twitter} onChange={v => setProfile({ ...profile, twitter: v })} placeholder="username (no @)" />
              <InputField label="LinkedIn Profile" value={profile.linkedin} onChange={v => setProfile({ ...profile, linkedin: v })} placeholder="username" />
              <InputField label="Personal Website" value={profile.website} onChange={v => setProfile({ ...profile, website: v })} placeholder="https://..." type="url" />
              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}
        </Section>

        {/* Pitch Section */}
        <Section title="Pitch Link & Text" isOpen={editing === 'pitch'} onToggle={() => setEditing(editing === 'pitch' ? null : 'pitch')}>
          {editing !== 'pitch' ? (
            <div>
              {profile.pitch_video_url && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '8px', textTransform: 'uppercase' }}>Pitch Video Link</div>
                  <a href={profile.pitch_video_url} target="_blank" rel="noopener noreferrer" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', wordBreak: 'break-all' }}>
                    {profile.pitch_video_url}
                  </a>
                </div>
              )}
              {profile.pitch_text && (
                <div>
                  <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '8px', textTransform: 'uppercase' }}>Pitch</div>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>{profile.pitch_text}</div>
                </div>
              )}
              {!profile.pitch_video_url && !profile.pitch_text && <div style={{ color: C.textMuted }}>No pitch added yet. Add a cloud link (Google Drive, Dropbox, OneDrive) or text explaining why brands should work with you.</div>}
            </div>
          ) : (
            <form>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '8px', textTransform: 'uppercase' }}>Pitch Video Link</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/... or https://dropbox.com/..."
                  value={profile.pitch_video_url}
                  onChange={e => setProfile({ ...profile, pitch_video_url: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px' }}
                />
                <div style={{ fontSize: '12px', color: C.textMuted }}>Share a link to your pitch video from Google Drive, Dropbox, OneDrive, or similar cloud storage</div>
                {profile.pitch_video_url && <div style={{ fontSize: '12px', color: C.success, marginTop: '8px' }}>✓ Link added</div>}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Pitch Text</label>
                <textarea
                  value={profile.pitch_text}
                  onChange={e => setProfile({ ...profile, pitch_text: e.target.value })}
                  placeholder="Why should brands hire you? What's your unique value?"
                  style={{ width: '100%', padding: '12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, minHeight: '80px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}
        </Section>

        {/* Reputation Section (read-only) */}
        <Section title="Reputation & Trust" isOpen={editing === 'reputation'} onToggle={() => setEditing(editing === 'reputation' ? null : 'reputation')} canEdit={false}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <StatBox label="Trust Score" value={`${profile.trust_score}%`} color={profile.trust_score >= 75 ? C.success : C.warning} />
            <StatBox label="Completion Rate" value={`${profile.completion_rate}%`} color={C.primary} />
            <StatBox label="Repeat Client Rate" value={`${profile.repeat_client_rate}%`} color={C.success} />
            <StatBox label="Average Rating" value={`${profile.avg_rating}/5`} color={C.warning} />
          </div>
        </Section>

        {/* Marketplace Section */}
        <Section title="Marketplace & Availability" isOpen={editing === 'marketplace'} onToggle={() => setEditing(editing === 'marketplace' ? null : 'marketplace')}>
          {editing !== 'marketplace' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Status</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: profile.open_for_work ? C.success : C.danger }}>
                  {profile.open_for_work ? 'Open for Work' : 'Not Available'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Min Deal Value</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>${profile.min_deal_value}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Response Time</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{profile.response_time} hours</div>
              </div>
            </div>
          ) : (
            <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={profile.open_for_work}
                  onChange={e => setProfile({ ...profile, open_for_work: e.target.checked })}
                />
                <span style={{ fontSize: '14px' }}>Open for work</span>
              </label>

              <InputField type="number" label="Minimum Deal Value ($)" value={String(profile.min_deal_value)} onChange={v => setProfile({ ...profile, min_deal_value: parseInt(v) || 500 })} />

              <InputField type="number" label="Typical Response Time (hours)" value={String(profile.response_time)} onChange={v => setProfile({ ...profile, response_time: v })} />

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '8px', textTransform: 'uppercase' }}>Preferred Deal Types</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['paid', 'barter', 'equity', 'ambassador'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const updated = profile.preferred_deal_types.includes(type)
                          ? profile.preferred_deal_types.filter(t => t !== type)
                          : [...profile.preferred_deal_types, type];
                        setProfile({ ...profile, preferred_deal_types: updated });
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: `2px solid ${profile.preferred_deal_types.includes(type) ? C.primary : C.border}`,
                        background: profile.preferred_deal_types.includes(type) ? `${C.primary}20` : 'transparent',
                        color: profile.preferred_deal_types.includes(type) ? C.primary : C.textMuted,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, isOpen, onToggle, canEdit = true, children }: { title: string; isOpen: boolean; onToggle: () => void; canEdit?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', marginBottom: '20px', overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: C.text }}>{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {canEdit && <span style={{ fontSize: '12px', color: C.textMuted }}>Edit</span>}
          <span style={{ fontSize: '20px', color: C.textMuted, transform: `rotate(${isOpen ? 180 : 0}deg)`, transition: 'transform 0.3s' }}>▼</span>
        </div>
      </button>
      {isOpen && <div style={{ padding: '20px', paddingTop: 0, borderTop: `1px solid ${C.border}` }}>{children}</div>}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder = '', type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '14px', boxSizing: 'border-box' }}
      />
    </label>
  );
}

function StatBox({ label, value, color = C.primary }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
      <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '8px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function SocialHandle({ platform, handle }: { platform: string; handle: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px' }}>
      <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>{platform}</div>
      <div style={{ fontSize: '14px', fontWeight: 600 }}>@{handle}</div>
    </div>
  );
}

function SaveButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '12px 24px',
        background: C.primary,
        color: '#000',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        fontSize: '14px',
      }}
    >
      {loading ? 'Saving...' : 'Save Changes'}
    </button>
  );
}
