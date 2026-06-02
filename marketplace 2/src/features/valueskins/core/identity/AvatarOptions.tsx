'use client';

import { useState, useRef, useCallback } from 'react';
import type { IdentityAttestation, AttestationCategory, CredentialDisplayConfiguration } from '@/lib/credential-protocol';
import { createAttestation, computeAuthenticityIndex, entryToAttestation, attestationToEntry, DEFAULT_DISPLAY_CONFIG } from '@/lib/credential-protocol';
import { STICKER_MANIFEST } from '@/features/valueskins/core/stickers/sticker-manifest';

// ─── Types ───────────────────────────────────────────────────────────

export type ValueSkinSlot = 'hobby' | 'passion' | 'profession';

export const SLOT_LABELS: Record<ValueSkinSlot, string> = {
  hobby:      'Hobby',
  passion:    'Passion',
  profession: 'Profession',
};

export const SLOT_COLORS: Record<ValueSkinSlot, string> = {
  hobby:      '#37474F',   // slate
  passion:    '#880E4F',   // deep pink
  profession: '#0066CC',   // blue
};

// Map of slot → active profession name + editable About Me text
// The optional `attestation` field links to the full credential protocol
// artifact for verification, federation, and trust scoring.
export interface ValueSkinEntry {
  profession: string;
  aboutMe: string;
  attestation?: IdentityAttestation;
}

export type ValueSkinMap = Partial<Record<ValueSkinSlot, ValueSkinEntry>>;

export interface ProfessionBadge {
  id: string;
  label: string;
  abbreviation: string;
  color: string;
  stickerImage?: string;
  emoji?: string;
}

// ─── Profession Definitions ───────────────────────────────────────────

export const PROFESSION_BADGES: Record<string, ProfessionBadge> = {
  'Software Engineer':      { id: 'swe',  label: 'Software Engineer',      abbreviation: 'SWE', color: '#0066CC', emoji: '💻' },
  'Data Scientist':         { id: 'ds',   label: 'Data Scientist',         abbreviation: 'DS',  color: '#4A90E2', emoji: '📊' },
  'Product Manager':        { id: 'pm',   label: 'Product Manager',        abbreviation: 'PM',  color: '#1A73E8', emoji: '🗂️' },
  'DevOps Engineer':        { id: 'dev',  label: 'DevOps Engineer',        abbreviation: 'DEV', color: '#5F27CD', emoji: '⚙️' },
  'UX/UI Designer':         { id: 'ux',   label: 'UX/UI Designer',         abbreviation: 'UX',  color: '#D63384', emoji: '🖌️' },
  'Actor':                  { id: 'act',  label: 'Actor',                  abbreviation: 'ACT', color: '#E65100', emoji: '🎭' },
  'Comedian':               { id: 'cmd',  label: 'Comedian',               abbreviation: 'COM', color: '#FF6F00', emoji: '🎤' },
  'Musician':               { id: 'mus',  label: 'Musician',               abbreviation: 'MUS', color: '#C62828', emoji: '🎸' },
  'Producer':               { id: 'prd',  label: 'Producer',               abbreviation: 'PRD', color: '#AD1457', emoji: '🎛️' },
  'Director':               { id: 'dir',  label: 'Director',               abbreviation: 'DIR', color: '#6A1B9A', emoji: '🎬' },
  'Screenwriter':           { id: 'sw',   label: 'Screenwriter',           abbreviation: 'SCW', color: '#4527A0', emoji: '📝' },
  'Animator':               { id: 'anm',  label: 'Animator',               abbreviation: 'ANM', color: '#283593', emoji: '🎞️' },
  'Voice Actor':            { id: 'va',   label: 'Voice Actor',            abbreviation: 'VA',  color: '#1565C0', emoji: '🎙️' },
  'Doctor':                 { id: 'md',   label: 'Doctor',                 abbreviation: 'MD',  color: '#00897B', emoji: '🩺' },
  'Surgeon':                { id: 'srg',  label: 'Surgeon',                abbreviation: 'SRG', color: '#00695C', emoji: '🔬' },
  'Nurse':                  { id: 'rn',   label: 'Nurse',                  abbreviation: 'RN',  color: '#26A69A', emoji: '💉' },
  'Pharmacist':             { id: 'rx',   label: 'Pharmacist',             abbreviation: 'RX',  color: '#00838F', emoji: '💊' },
  'Therapist':              { id: 'thp',  label: 'Therapist',              abbreviation: 'THP', color: '#558B2F', emoji: '🛋️' },
  'Nutritionist':           { id: 'nut',  label: 'Nutritionist',           abbreviation: 'NUT', color: '#2E7D32', emoji: '🥗' },
  'Lawyer':                 { id: 'jd',   label: 'Lawyer',                 abbreviation: 'JD',  color: '#1A237E', emoji: '⚖️' },
  'Attorney':               { id: 'atty', label: 'Attorney',               abbreviation: 'ATY', color: '#283593', emoji: '⚖️' },
  'Judge':                  { id: 'jdg',  label: 'Judge',                  abbreviation: 'JDG', color: '#1A237E', emoji: '🔨' },
  'Corporate Lawyer':       { id: 'claw', label: 'Corporate Lawyer',       abbreviation: 'CLW', color: '#311B92', emoji: '📜' },
  'CEO':                    { id: 'ceo',  label: 'CEO',                    abbreviation: 'CEO', color: '#263238', emoji: '🏢' },
  'Entrepreneur':           { id: 'ent',  label: 'Entrepreneur',           abbreviation: 'ENT', color: '#37474F', emoji: '🚀' },
  'Tech Entrepreneur':      { id: 'tent', label: 'Tech Entrepreneur',      abbreviation: 'TEC', color: '#263238', emoji: '🚀' },
  'Operations Manager':     { id: 'ops',  label: 'Operations Manager',     abbreviation: 'OPS', color: '#37474F', emoji: '📋' },
  'Consultant':             { id: 'con',  label: 'Consultant',             abbreviation: 'CON', color: '#BF360C', emoji: '📌' },
  'Teacher':                { id: 'edu',  label: 'Teacher',                abbreviation: 'EDU', color: '#1565C0', emoji: '📚' },
  'Professor':              { id: 'prof', label: 'Professor',              abbreviation: 'PRF', color: '#0D47A1', emoji: '🎓' },
  'Tutor':                  { id: 'tut',  label: 'Tutor',                  abbreviation: 'TUT', color: '#1565C0', emoji: '✏️' },
  'Graphic Designer':       { id: 'gd',   label: 'Graphic Designer',       abbreviation: 'GD',  color: '#AD1457', emoji: '🖊️' },
  'Digital Artist':         { id: 'art',  label: 'Digital Artist',         abbreviation: 'ART', color: '#880E4F', emoji: '🎨' },
  'Illustrator':            { id: 'ill',  label: 'Illustrator',            abbreviation: 'ILL', color: '#6A1B9A', emoji: '🖋️' },
  'Photographer':           { id: 'pht',  label: 'Photographer',           abbreviation: 'PHT', color: '#455A64', emoji: '📷' },
  'Chef':                   { id: 'chf',  label: 'Chef',                   abbreviation: 'CHF', color: '#E65100', emoji: '🔪' },
  'Pastry Chef':            { id: 'pchf', label: 'Pastry Chef',            abbreviation: 'PST', color: '#E64A19', emoji: '🧁' },
  'Food Critic':            { id: 'fc',   label: 'Food Critic',            abbreviation: 'FC',  color: '#BF360C', emoji: '🍽️' },
  'Food Photographer':      { id: 'fpht', label: 'Food Photographer',      abbreviation: 'FPH', color: '#6D4C41', emoji: '📸' },
  'Restaurant Owner':       { id: 'rest', label: 'Restaurant Owner',       abbreviation: 'RST', color: '#4E342E', emoji: '🍳' },
  'Sommelier':              { id: 'som',  label: 'Sommelier',              abbreviation: 'SOM', color: '#880E4F', emoji: '🍷' },
  'Professional Athlete':   { id: 'ath',  label: 'Professional Athlete',   abbreviation: 'ATH', color: '#2E7D32', emoji: '🏅' },
  'Fitness Coach':          { id: 'fit',  label: 'Fitness Coach',          abbreviation: 'FIT', color: '#388E3C', emoji: '🏋️' },
  'Yoga Instructor':        { id: 'yog',  label: 'Yoga Instructor',        abbreviation: 'YOG', color: '#558B2F', emoji: '🧘' },
  'Sports Manager':         { id: 'spm',  label: 'Sports Manager',         abbreviation: 'SPM', color: '#1B5E20', emoji: '📋' },
  'Commercial Pilot':       { id: 'cpl',  label: 'Commercial Pilot',       abbreviation: 'CPL', color: '#01579B', emoji: '✈️' },
  'Air Traffic Controller': { id: 'atc',  label: 'Air Traffic Controller', abbreviation: 'ATC', color: '#0277BD', emoji: '🛩️' },
  'Aircraft Engineer':      { id: 'ace',  label: 'Aircraft Engineer',      abbreviation: 'ACE', color: '#01579B', emoji: '🔧' },
  'Aviation Student':       { id: 'avs',  label: 'Aviation Student',       abbreviation: 'AVS', color: '#0288D1', emoji: '✈️' },
  'Cabin Crew Manager':     { id: 'ccm',  label: 'Cabin Crew Manager',     abbreviation: 'CCM', color: '#0277BD', emoji: '🛫' },
  'Real Estate Agent':      { id: 'rea',  label: 'Real Estate Agent',      abbreviation: 'REA', color: '#4E342E', emoji: '🏠' },
  'Real Estate Developer':  { id: 'red',  label: 'Real Estate Developer',  abbreviation: 'RED', color: '#3E2723', emoji: '🏗️' },
  'Financial Advisor':      { id: 'fin',  label: 'Financial Advisor',      abbreviation: 'FIN', color: '#006064', emoji: '📈' },
  'Trader':                 { id: 'trd',  label: 'Trader',                 abbreviation: 'TRD', color: '#1B5E20', emoji: '📉' },
  'Investment Banker':      { id: 'ib',   label: 'Investment Banker',      abbreviation: 'IB',  color: '#1B5E20', emoji: '💹' },
  'Crypto Analyst':         { id: 'web3', label: 'Crypto Analyst',         abbreviation: 'W3',  color: '#4A148C', emoji: '⛓️' },
  'Finance Student':        { id: 'fins', label: 'Finance Student',        abbreviation: 'FST', color: '#006064', emoji: '📊' },
  'AI/ML Specialist':       { id: 'ai',   label: 'AI/ML Specialist',       abbreviation: 'AI',  color: '#311B92', emoji: '🤖' },
  'Security Researcher':    { id: 'sec',  label: 'Security Researcher',    abbreviation: 'SEC', color: '#B71C1C', emoji: '🔐' },
  'EdTech Creator':         { id: 'etc',  label: 'EdTech Creator',         abbreviation: 'ETC', color: '#1A237E', emoji: '🖥️' },
  'Culinary Student':       { id: 'cust', label: 'Culinary Student',       abbreviation: 'CUS', color: '#E65100', emoji: '👨‍🍳' },
};

// ─── Default About Me text per profession ────────────────────────────

export function defaultAboutMe(profession: string): string {
  const defaults: Record<string, string> = {
    'Software Engineer': 'Full-stack engineer with 5+ years building scalable products. I specialize in React, TypeScript, and distributed systems. Known for shipping clean, well-tested code on time.',
    'Data Scientist': 'Data scientist with deep expertise in ML pipelines, NLP, and predictive modeling. I turn messy datasets into clear business insights.',
    'Product Manager': 'Product manager who has taken 3 products from 0 to 1. I bridge engineering, design, and business stakeholders to ship features that users love.',
    'Musician': 'Multi-genre musician with 10 years of live performance and studio recording experience.',
    'Photographer': 'Documentary and portrait photographer. 8 years shooting for editorial and commercial clients.',
    'Fitness Coach': 'Certified personal trainer specializing in strength and mobility for busy professionals.',
  };
  return defaults[profession] ?? `${profession} — click Edit to write your story and explain why someone should work with you.`;
}

// ─── Profession Sticker (clickable — opens About Me panel) ───────────
// Shows badge abbreviation + a tiny slot label underneath.

export function ProfessionSticker({
  profession,
  slot,
  size = 'default',
  valueSkins,
  onValueSkinsChange,
  clickable = true,
  level,
}: {
  profession: string;
  slot: ValueSkinSlot;
  size?: 'small' | 'default' | 'large';
  valueSkins?: ValueSkinMap;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
  clickable?: boolean;
  level?: number;
}) {
  const defined = PROFESSION_BADGES[profession];
  const badge: ProfessionBadge = defined ?? {
    id: profession.toLowerCase().replace(/\s+/g, '_'),
    label: profession,
    abbreviation: profession.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3),
    color: SLOT_COLORS[slot],
  };
  const [showPanel, setShowPanel] = useState(false);

  const badgeDims   = { small: 20, default: 24, large: 32 };
  const badgeFonts  = { small: '7px', default: '8px', large: '10px' };
  const labelFonts  = { small: '6px', default: '7px', large: '8px' };
  const dim         = badgeDims[size];
  const fontSize    = badgeFonts[size];
  const labelSize   = labelFonts[size];

  const handleAboutMeChange = (text: string) => {
    if (!onValueSkinsChange || !valueSkins) return;
    onValueSkinsChange({
      ...valueSkins,
      [slot]: { profession, aboutMe: text },
    });
  };

  const currentAboutMe = valueSkins?.[slot]?.aboutMe ?? defaultAboutMe(profession);

  return (
    <>
      <div
        title={clickable ? `${SLOT_LABELS[slot]}: ${badge.label} — click to view` : badge.label}
        onClick={clickable ? () => setShowPanel(true) : undefined}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          cursor: clickable ? 'pointer' : 'default',
          flexShrink: 0,
        }}
      >
        {/* Sticker — no shape, no border, no background. Just the raw icon floating free. */}
        {(badge.stickerImage || STICKER_MANIFEST[profession]) ? (
          <img
            src={badge.stickerImage || STICKER_MANIFEST[profession]}
            alt={badge.label}
            draggable={false}
            style={{ width: `${dim}px`, height: `${dim}px`, objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />
        ) : (
          <span style={{ fontSize, fontWeight: 700, color: badge.color, letterSpacing: '-0.3px', lineHeight: 1, flexShrink: 0 }}>
            {badge.abbreviation}
          </span>
        )}
      </div>

      {showPanel && (
        <AboutMePanel
          slot={slot}
          profession={profession}
          badge={badge}
          valueSkins={valueSkins ?? {}}
          onValueSkinsChange={onValueSkinsChange}
          onClose={() => setShowPanel(false)}
          level={level}
        />
      )}
    </>
  );
}

// ─── About Me Panel — shows all 3 slots, edit any ────────────────────

function AboutMePanel({
  slot: initialSlot,
  profession,
  badge,
  valueSkins,
  onValueSkinsChange,
  onClose,
  level,
}: {
  slot: ValueSkinSlot;
  profession: string;
  badge: ProfessionBadge;
  valueSkins: ValueSkinMap;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
  onClose: () => void;
  level?: number;
}) {
  const [editingSlot, setEditingSlot] = useState<ValueSkinSlot | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (s: ValueSkinSlot) => {
    setDraft(valueSkins[s]?.aboutMe ?? defaultAboutMe(valueSkins[s]?.profession ?? ''));
    setEditingSlot(s);
  };

  const save = () => {
    if (!editingSlot || !onValueSkinsChange) return;
    onValueSkinsChange({
      ...valueSkins,
      [editingSlot]: { ...valueSkins[editingSlot]!, aboutMe: draft },
    });
    setEditingSlot(null);
  };

  const discard = () => setEditingSlot(null);

  const slots: ValueSkinSlot[] = ['profession', 'passion', 'hobby'];

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div style={{
        width: '100%', maxWidth: '600px',
        background: '#141414',
        borderRadius: '16px 16px 0 0',
        border: '1px solid #262626',
        borderBottom: 'none',
        padding: '24px',
        maxHeight: '85vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '17px', color: '#E0E0E0' }}>About Me</div>
            <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
              Your story across all three ValueSkin slots
            </div>
          </div>
          {level !== undefined && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(0,102,204,0.1)', borderRadius: '10px',
              padding: '8px 14px', marginRight: '12px',
            }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{
                    width: '14px', height: '5px', borderRadius: '3px',
                    background: i <= level ? '#0066CC' : '#333',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0066CC' }}>
                LVL {level}
              </span>
            </div>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Each slot */}
        {slots.map((s) => {
          const entry = valueSkins[s];
          if (!entry) {
            // Slot not filled — show empty placeholder
            return (
              <div key={s} style={{
                marginBottom: '16px',
                padding: '14px',
                background: '#1A1A1A',
                borderRadius: '10px',
                border: '1px solid #262626',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px',
                    textTransform: 'uppercase', color: SLOT_COLORS[s],
                  }}>
                    {SLOT_LABELS[s]}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#444', fontStyle: 'italic' }}>
                  No {SLOT_LABELS[s].toLowerCase()} badge active. Visit the Store to add one.
                </div>
              </div>
            );
          }

          const slotBadge = PROFESSION_BADGES[entry.profession];
          const isEditing = editingSlot === s;

          return (
            <div key={s} style={{
              marginBottom: '16px',
              padding: '14px',
              background: '#1A1A1A',
              borderRadius: '10px',
              border: `1px solid ${isEditing ? '#0066CC' : '#262626'}`,
              transition: 'border-color 0.15s',
            }}>
              {/* Slot header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                {slotBadge && (
                  (slotBadge.stickerImage || STICKER_MANIFEST[entry.profession]) ? (
                    <img
                      src={slotBadge.stickerImage || STICKER_MANIFEST[entry.profession]}
                      alt={slotBadge.label}
                      draggable={false}
                      style={{ width: '28px', height: '28px', borderRadius: '7px', imageRendering: 'pixelated', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '7px',
                      background: slotBadge.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ color: '#fff', fontSize: '8px', fontWeight: 700 }}>
                        {slotBadge.abbreviation}
                      </span>
                    </div>
                  )
                )}
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: SLOT_COLORS[s] }}>
                    {SLOT_LABELS[s]}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#C0C0C0' }}>
                    {entry.profession}
                  </div>
                </div>
                {!isEditing && onValueSkinsChange && (
                  <button
                    onClick={() => startEdit(s)}
                    style={{
                      marginLeft: 'auto', padding: '5px 10px',
                      background: 'transparent', border: '1px solid #333',
                      borderRadius: '6px', color: '#666', fontSize: '12px',
                      fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                )}
              </div>

              {/* About Me text or textarea */}
              {isEditing ? (
                <>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%', minHeight: '100px',
                      background: '#111', border: '1px solid #0066CC',
                      borderRadius: '8px', color: '#E0E0E0',
                      fontSize: '13px', lineHeight: '1.6',
                      padding: '10px', fontFamily: 'inherit',
                      resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={save}
                      style={{
                        flex: 1, padding: '8px', background: '#0066CC',
                        border: 'none', borderRadius: '7px', color: '#fff',
                        fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={discard}
                      style={{
                        padding: '8px 14px', background: '#1A1A1A',
                        border: '1px solid #333', borderRadius: '7px',
                        color: '#888', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ color: '#AAA', fontSize: '13px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {entry.aboutMe}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Row of up to 3 stickers (Profession / Passion / Hobby) ──────────

export function ValueSkinStickers({
  valueSkins,
  onValueSkinsChange,
  size = 'default',
  level,
  onSkinClick,
}: {
  valueSkins: ValueSkinMap;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
  size?: 'small' | 'default' | 'large';
  level?: number;
  onSkinClick?: (profession: string) => void;
}) {
  const slots: ValueSkinSlot[] = ['profession', 'passion', 'hobby'];
  const active = slots.filter((s) => valueSkins[s]);
  if (active.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', flexShrink: 0 }}>
      {active.map((s) => (
        <div key={s} onClick={onSkinClick ? (e) => { e.stopPropagation(); onSkinClick(valueSkins[s]!.profession); } : undefined} style={onSkinClick ? { cursor: 'pointer' } : undefined}>
          <ProfessionSticker
            profession={valueSkins[s]!.profession}
            slot={s}
            size={size}
            valueSkins={valueSkins}
            onValueSkinsChange={onValueSkinsChange}
            level={level}
            clickable={!onSkinClick}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Valueskins Avatar Overlay (shown in long-press viewer) ──────────

export function ValueskinAvatarOverlay({
  level,
  valueSkins,
  size = 220,
}: {
  level: number;
  valueSkins?: ValueSkinMap;
  size?: number;
}) {
  const professionEntry = valueSkins?.profession;
  const badge = professionEntry ? PROFESSION_BADGES[professionEntry.profession] : null;

  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%',
      background: '#0066CC',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#fff', border: '3px solid #2A2A2A',
      boxShadow: '0 2px 24px rgba(0,60,120,0.45)',
      userSelect: 'none',
    }}>
      <svg width={size * 0.28} height={size * 0.28} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span style={{ fontSize: `${Math.max(size * 0.1, 10)}px`, fontWeight: 700, letterSpacing: '0.5px', marginTop: '4px', textTransform: 'uppercase' }}>
        Level {level}
      </span>
      {badge && (
        <span style={{ fontSize: `${Math.max(size * 0.07, 9)}px`, fontWeight: 600, marginTop: '2px', opacity: 0.85 }}>
          {badge.abbreviation}
        </span>
      )}
    </div>
  );
}

// ─── Long-Press Avatar Viewer ─────────────────────────────────────────

export function AvatarLongPressViewer({
  visible,
  onClose,
  showValueskinAvatar,
  level,
  valueSkins,
  avatarUrl,
  displayName,
  onValueSkinsChange,
}: {
  visible: boolean;
  onClose: () => void;
  showValueskinAvatar: boolean;
  level: number;
  valueSkins: ValueSkinMap;
  avatarUrl: string;
  displayName: string;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
}) {
  if (!visible) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, cursor: 'pointer',
      }}
    >
      <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#555', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}>
        ×
      </button>

      <div style={{ marginBottom: '20px' }}>
        {showValueskinAvatar ? (
          <ValueskinAvatarOverlay level={level} valueSkins={valueSkins} size={220} />
        ) : (
          <img src={avatarUrl} alt={displayName} style={{ width: '220px', height: '220px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.12)', objectFit: 'cover' }} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ color: '#E0E0E0', fontSize: '18px', fontWeight: 600 }}>{displayName}</span>
        <ValueSkinStickers valueSkins={valueSkins} onValueSkinsChange={onValueSkinsChange} size="large" />
      </div>

      {showValueskinAvatar && (
        <div style={{ fontSize: '12px', color: '#0066CC', fontWeight: 600, marginBottom: '4px' }}>
          Valueskins Avatar Active
        </div>
      )}
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>
        Tap outside to close
      </span>
    </div>
  );
}

// ─── Profile Photo with Long-Press Detection ─────────────────────────

const LONG_PRESS_MS = 400;

export function ProfilePhotoWithLongPress({
  showValueskinAvatar,
  level,
  valueSkins,
  avatarUrl,
  displayName,
  size = 86,
  onValueSkinsChange,
}: {
  showValueskinAvatar: boolean;
  level: number;
  valueSkins: ValueSkinMap;
  avatarUrl: string;
  displayName: string;
  size?: number;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
}) {
  const [showViewer, setShowViewer] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const startPress = useCallback(() => {
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowViewer(true);
    }, LONG_PRESS_MS);
  }, []);

  const endPress = useCallback(() => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }, []);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }, []);

  const hasAnyValueSkin = Object.keys(valueSkins).length > 0;

  return (
    <>
      <div
        onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={cancelPress}
        onTouchStart={startPress} onTouchEnd={endPress} onTouchCancel={cancelPress}
        style={{ cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', position: 'relative' }}
      >
        {/* Profile photo — always the real photo */}
        <img
          src={avatarUrl} alt={displayName} draggable={false}
          style={{
            width: `${size}px`, height: `${size}px`, borderRadius: '50%',
            border: '2px solid #333',
            objectFit: 'cover',
          }}
        />
        {/* Small Valueskins indicator when avatar mode is active */}
        {showValueskinAvatar && (
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: `${Math.round(size * 0.28)}px`, height: `${Math.round(size * 0.28)}px`,
            borderRadius: '50%', background: '#0066CC', border: '2px solid #0A0A0A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={Math.round(size * 0.14)} height={Math.round(size * 0.14)} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      <AvatarLongPressViewer
        visible={showViewer} onClose={() => setShowViewer(false)}
        showValueskinAvatar={showValueskinAvatar}
        level={level} valueSkins={valueSkins} avatarUrl={avatarUrl} displayName={displayName}
        onValueSkinsChange={onValueSkinsChange}
      />
    </>
  );
}

// ─── Valueskins Avatar Toggle ─────────────────────────────────────────

export function ValueskinAvatarToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#E0E0E0', marginBottom: '2px' }}>
        Valueskins Avatar
      </span>
      <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px', lineHeight: 1.5 }}>
        When enabled, long-pressing your profile shows your Valueskins badge instead of the Instagram animated avatar. Your profile photo is never changed.
      </p>
      {(['default', 'valueskins'] as const).map((opt) => {
        const active = opt === 'valueskins' ? enabled : !enabled;
        return (
          <label key={opt} style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px',
            borderRadius: '8px', cursor: 'pointer',
            border: `2px solid ${active ? '#0066CC' : '#333'}`,
            background: active ? 'rgba(0,102,204,0.08)' : '#1A1A1A',
            transition: 'all 0.15s',
          }}>
            <input
              type="radio" name="valueskin-avatar"
              checked={active} onChange={() => onChange(opt === 'valueskins')}
              style={{ marginTop: '2px', accentColor: '#0066CC' }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#E0E0E0' }}>
                {opt === 'default' ? 'Default Avatar' : 'Valueskins Avatar'}
              </div>
              <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.4, marginTop: '2px' }}>
                {opt === 'default'
                  ? 'Instagram shows your standard animated avatar on long-press.'
                  : 'Long-press shows your Valueskins verified level badge instead.'}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
