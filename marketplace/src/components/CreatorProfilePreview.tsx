'use client';

import { useState } from 'react';
import {
  type ValueSkinMap,
  ProfileCardDisplay,
  ValueskinAvatarToggle,
  ProfilePhotoWithLongPress,
} from './AvatarOptions';

interface InstagramProfilePreviewProps {
  displayName: string;
  username: string;
  followers: number;
  posts: number;
  following: number;
  level: number;
  reputationScore: number;
  bio: string;
  valueSkins?: ValueSkinMap;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
  avatarUrl: string;
  isFollowing?: boolean;
  onFollowToggle?: () => void;
  onLevelClick?: () => void;
  onReputationClick?: () => void;
}

const COLORS = {
  primary: '#0066CC',
  bg: '#0A0A0A',
  surface: '#141414',
  text: '#E0E0E0',
  textSecondary: '#888',
  border: '#262626',
};

export function InstagramProfilePreview({
  displayName,
  username,
  followers,
  posts,
  following,
  level,
  reputationScore,
  bio,
  valueSkins = {},
  onValueSkinsChange,
  avatarUrl,
  isFollowing = false,
  onFollowToggle,
  onLevelClick,
  onReputationClick,
}: InstagramProfilePreviewProps) {
  const [valueskinAvatarEnabled, setValueskinAvatarEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div style={{
      maxWidth: '470px', background: COLORS.bg, borderRadius: '12px',
      overflow: 'hidden', border: `1px solid ${COLORS.border}`,
    }}>
      {/* Header */}
      <div style={{
        height: '60px', borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: '20px', paddingRight: '20px', background: COLORS.surface,
      }}>
        <span style={{ fontWeight: '600', fontSize: '16px', color: COLORS.text }}>{username}</span>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: '8px',
            padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: COLORS.primary, cursor: 'pointer',
          }}
        >
          Avatar Style
        </button>
      </div>

      {/* Avatar Settings Panel */}
      {showSettings && (
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
          <ValueskinAvatarToggle
            enabled={valueskinAvatarEnabled}
            onChange={(v) => { setValueskinAvatarEnabled(v); setShowSettings(false); }}
          />
        </div>
      )}

      {/* Profile Info */}
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '24px' }}>
          {/* Profile photo — always real photo, long-press shows viewer */}
          <div style={{ marginRight: '40px', flexShrink: 0 }}>
            <ProfilePhotoWithLongPress
              showValueskinAvatar={valueskinAvatarEnabled}
              level={level}
              valueSkins={valueSkins}
              avatarUrl={avatarUrl}
              displayName={displayName}
              size={86}
              onValueSkinsChange={onValueSkinsChange}
            />
          </div>

          {/* Stats & Actions */}
          <div style={{ flex: 1 }}>
            {/* Name row with custom profile card if available */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, marginBottom: '8px', color: COLORS.text }}>
                  {displayName}
                </h2>
                <button
                  onClick={onLevelClick}
                  style={{
                    background: COLORS.primary, color: 'white', fontSize: '11px',
                    fontWeight: '800', padding: '4px 10px', borderRadius: '12px',
                    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  LVL {level}
                </button>
              </div>
              {valueSkins.profession?.customImage && (
                <ProfileCardDisplay
                  valueSkins={valueSkins}
                  onValueSkinsChange={onValueSkinsChange}
                  displayName={displayName}
                  level={level}
                />
              )}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', fontSize: '14px' }}>
              <div style={{ textAlign: 'center', color: COLORS.text }}>
                <strong>{posts}</strong>
                <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>posts</div>
              </div>
              <button
                onClick={onLevelClick}
                style={{ background: 'none', border: 'none', color: COLORS.text, padding: 0, cursor: 'pointer', textAlign: 'center' }}
              >
                <strong>{followers >= 1000 ? `${(followers / 1000).toFixed(0)}k` : followers}</strong>
                <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>followers</div>
              </button>
              <div style={{ textAlign: 'center', color: COLORS.text }}>
                <strong>{following}</strong>
                <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>following</div>
              </div>
            </div>

            <button
              onClick={onFollowToggle}
              style={{
                background: isFollowing ? '#262626' : COLORS.primary,
                border: `1px solid ${isFollowing ? '#333' : COLORS.primary}`,
                borderRadius: '8px', color: '#fff', padding: '8px 24px',
                fontWeight: '600', fontSize: '14px', cursor: 'pointer',
              }}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>

        {/* Bio */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: '600', marginBottom: '4px', color: COLORS.text }}>{displayName}</div>
          <div style={{ color: COLORS.textSecondary, fontSize: '14px', lineHeight: '1.5', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
            {bio}
          </div>

          <button
            onClick={onReputationClick}
            style={{
              width: '100%', padding: '12px', background: 'rgba(0,102,204,0.08)',
              border: '1px solid rgba(0,102,204,0.2)', borderRadius: '12px',
              display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,102,204,0.15)'; e.currentTarget.style.borderColor = COLORS.primary; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,102,204,0.08)'; e.currentTarget.style.borderColor = 'rgba(0,102,204,0.2)'; }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: COLORS.primary }}>Valueskins Verified</div>
              <div style={{ fontSize: '11px', color: COLORS.textSecondary }}>{reputationScore} / 1000 Score</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export { COLORS as PROFESSIONAL_COLORS };
