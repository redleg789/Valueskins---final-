'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { BusinessProfile, SocialLink } from '../data/types';
import { emptyBusinessProfile } from '../data/types';
import { MultiImageUpload } from './ImageUpload';

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5',
  success: '#86efac',
};

const card: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  padding: 24,
  boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const inp: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: `1px solid ${C.border}`,
  background: 'rgba(15, 23, 42, 0.88)',
  color: C.text,
  padding: '12px 16px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const btnBase: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '14px 28px',
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  paddingBottom: 20,
  borderBottom: `1px solid ${C.border}`,
  marginBottom: 20,
};

const labelStyle: CSSProperties = {
  color: '#cbd5e1', fontSize: 13, fontWeight: 700,
};

const rowStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
};

const tagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 12px',
  borderRadius: 999,
  background: C.accentBg,
  color: C.accent,
  fontSize: 12,
  fontWeight: 600,
};

interface Props {
  initial?: BusinessProfile;
  onBack: () => void;
  onSaved: (profile: BusinessProfile) => void;
}

export default function BusinessProfileForm({ initial, onBack, onSaved }: Props) {
  const [f, setF] = useState<BusinessProfile>(initial || emptyBusinessProfile());
  const [saving, setSaving] = useState(false);
  const [newAmenity, setNewAmenity] = useState('');
  const [newMusic, setNewMusic] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newSocialPlatform, setNewSocialPlatform] = useState('');
  const [newSocialUrl, setNewSocialUrl] = useState('');

  function update<K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) {
    setF(prev => ({ ...prev, [k]: v }));
  }

  function addTag(list: keyof BusinessProfile, val: string, setter: (v: string) => void) {
    const arr = f[list] as string[];
    if (val.trim() && !arr.includes(val.trim())) {
      update(list, [...arr, val.trim()] as any);
    }
    setter('');
  }

  function removeTag(list: keyof BusinessProfile, val: string) {
    const arr = f[list] as string[];
    update(list, arr.filter(x => x !== val) as any);
  }

  function addSocial() {
    if (newSocialPlatform.trim() && newSocialUrl.trim()) {
      update('socialLinks', [...f.socialLinks, { platform: newSocialPlatform.trim(), url: newSocialUrl.trim() }]);
      setNewSocialPlatform('');
      setNewSocialUrl('');
    }
  }

  async function handleSubmit() {
    if (!f.businessName.trim()) return;
    setSaving(true);
    try {
      const isNew = !f.id;
      const url = isNew ? '/api/business-profiles' : `/api/business-profiles/${f.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      if (!res.ok) throw new Error('Failed to save');
      const saved = await res.json();
      onSaved(saved);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20, paddingBottom: 40 }}>
      <div style={card}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: 0, textAlign: 'left' }}>
          Back
        </button>
        <h2 style={{ margin: '12px 0 4px', fontSize: 24, fontWeight: 800 }}>
          {initial ? 'Edit Venue Profile' : 'Create Venue Profile'}
        </h2>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>
          Set up your venue profile once. Reuse it for every event.
        </p>
      </div>

      {/* Basic Info */}
      <div style={card}>
        <div style={sectionStyle}>
          <div style={labelStyle}>Basic Information</div>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Business name</div>
              <input value={f.businessName} onChange={e => update('businessName', e.target.value)} placeholder="Club XYZ" style={inp} />
            </div>
            <div>
              <div style={labelStyle}>Capacity</div>
              <input type="number" value={f.capacity || ''} onChange={e => update('capacity', parseInt(e.target.value) || 0)} style={inp} />
            </div>
          </div>
          <div>
            <div style={labelStyle}>Description</div>
            <textarea value={f.description} onChange={e => update('description', e.target.value)} placeholder="Tell people about your venue..." style={{ ...inp, minHeight: 80, resize: 'vertical' }} />
          </div>
        </div>

        {/* Location */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Location</div>
          <div>
            <div style={labelStyle}>Address</div>
            <input value={f.address} onChange={e => update('address', e.target.value)} placeholder="42 Sunset Boulevard" style={inp} />
          </div>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>City</div>
              <input value={f.city} onChange={e => update('city', e.target.value)} placeholder="Los Angeles" style={inp} />
            </div>
            <div>
              <div style={labelStyle}>State</div>
              <input value={f.state} onChange={e => update('state', e.target.value)} placeholder="CA" style={inp} />
            </div>
          </div>
          <div>
            <div style={labelStyle}>Google Maps URL</div>
            <input value={f.googleMapsUrl} onChange={e => update('googleMapsUrl', e.target.value)} placeholder="https://maps.google.com/?q=..." style={inp} />
          </div>
        </div>

        {/* Contact */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Contact</div>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Phone</div>
              <input value={f.contactPhone} onChange={e => update('contactPhone', e.target.value)} placeholder="+1 (310) 555-0142" style={inp} />
            </div>
            <div>
              <div style={labelStyle}>Email</div>
              <input value={f.contactEmail} onChange={e => update('contactEmail', e.target.value)} placeholder="bookings@clubxyz.com" style={inp} />
            </div>
          </div>
          <div>
            <div style={labelStyle}>Website</div>
            <input value={f.website} onChange={e => update('website', e.target.value)} placeholder="https://clubxyz.com" style={inp} />
          </div>
        </div>

        {/* Social Links */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Social Links</div>
          {f.socialLinks.map((sl, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ ...tagStyle, flex: 1 }}>{sl.platform}: {sl.url}</span>
              <button onClick={() => update('socialLinks', f.socialLinks.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', fontSize: 14 }}>x</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newSocialPlatform} onChange={e => setNewSocialPlatform(e.target.value)} placeholder="instagram" style={{ ...inp, flex: 1 }} />
            <input value={newSocialUrl} onChange={e => setNewSocialUrl(e.target.value)} placeholder="https://instagram.com/..." style={{ ...inp, flex: 2 }} />
            <button onClick={addSocial} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px' }}>Add</button>
          </div>
        </div>

        {/* Amenities */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Amenities</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {f.amenities.map(a => (
              <span key={a} style={tagStyle}>{a}<button onClick={() => removeTag('amenities', a)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontSize: 14 }}>x</button></span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newAmenity} onChange={e => setNewAmenity(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('amenities', newAmenity, setNewAmenity))} placeholder="VIP Section" style={{ ...inp, flex: 1 }} />
            <button onClick={() => addTag('amenities', newAmenity, setNewAmenity)} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px' }}>Add</button>
          </div>
        </div>

        {/* Parking */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Parking</div>
          <textarea value={f.parkingInfo} onChange={e => update('parkingInfo', e.target.value)} placeholder="Valet parking, street parking available..." style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
        </div>

        {/* Defaults */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Venue Defaults</div>
          <div>
            <div style={labelStyle}>Dress code</div>
            <input value={f.dressCodeDefault} onChange={e => update('dressCodeDefault', e.target.value)} placeholder="Upscale casual" style={inp} />
          </div>
          <div>
            <div style={labelStyle}>Age restriction</div>
            <input type="number" value={f.ageRestrictionDefault || ''} onChange={e => update('ageRestrictionDefault', parseInt(e.target.value) || 0)} style={inp} />
          </div>
          <div>
            <div style={labelStyle}>Venue policies</div>
            <textarea value={f.venuePolicies} onChange={e => update('venuePolicies', e.target.value)} placeholder="Management reserves the right to refuse entry..." style={{ ...inp, minHeight: 80, resize: 'vertical' }} />
          </div>
        </div>

        {/* Music */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Music Preferences</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {f.musicPreferences.map(m => (
              <span key={m} style={tagStyle}>{m}<button onClick={() => removeTag('musicPreferences', m)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontSize: 14 }}>x</button></span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newMusic} onChange={e => setNewMusic(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('musicPreferences', newMusic, setNewMusic))} placeholder="House, Techno..." style={{ ...inp, flex: 1 }} />
            <button onClick={() => addTag('musicPreferences', newMusic, setNewMusic)} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px' }}>Add</button>
          </div>
        </div>

        {/* Tags */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Default Tags</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {f.defaultTags.map(t => (
              <span key={t} style={tagStyle}>{t}<button onClick={() => removeTag('defaultTags', t)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontSize: 14 }}>x</button></span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('defaultTags', newTag, setNewTag))} placeholder="nightclub, dance..." style={{ ...inp, flex: 1 }} />
            <button onClick={() => addTag('defaultTags', newTag, setNewTag)} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px' }}>Add</button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!f.businessName.trim() || saving}
          style={{
            ...btnBase,
            background: f.businessName.trim() && !saving ? C.accent : C.border,
            color: '#fff', fontSize: 15, padding: '16px', width: '100%',
            cursor: f.businessName.trim() && !saving ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Saving...' : initial ? 'Update Profile' : 'Create Profile'}
        </button>
      </div>
    </div>
  );
}
