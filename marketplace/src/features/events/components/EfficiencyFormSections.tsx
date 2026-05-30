'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { GenderRule, GenderRatio } from '../data/types';
import { GENDER_RULE_OPTIONS, BAG_POLICY_OPTIONS } from '../data/types';
import type { BagPolicy, TableSection, SectionType } from '../data/types';
import { SECTION_TYPE_OPTIONS } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5', success: '#86efac', warning: '#fbbf24',
};

const lbl: CSSProperties = { display: 'grid', gap: 4 };
const lblTitle: CSSProperties = { color: '#cbd5e1', fontSize: 13, fontWeight: 700 };
const inp: CSSProperties = {
  width: '100%', borderRadius: 14, border: `1px solid ${C.border}`,
  background: 'rgba(15, 23, 42, 0.88)', color: C.text, padding: '10px 14px',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const btnBase: CSSProperties = {
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '8px 16px', fontSize: 12,
};

interface Props { value: any; onChange: (vals: any) => void; }

export function GenderEntrySection({ value, onChange }: Props) {
  const g = value as { genderRule: GenderRule; genderRatio: GenderRatio; customEntryRestrictions: string; entryApprovalRequired: boolean };
  const showRatio = g.genderRule === 'ratio_controlled';
  const showCustom = g.genderRule === 'custom';
  const needsApproval = g.genderRule === 'invite_only' || g.genderRule === 'couples_only' || g.entryApprovalRequired;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={lbl}>
        <span style={lblTitle}>Entry rule</span>
        <select value={g.genderRule} onChange={e => onChange({ ...g, genderRule: e.target.value as GenderRule })} style={inp}>
          {GENDER_RULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {g.genderRule !== 'any' && (
        <div style={{
          padding: 14, borderRadius: 16, background: `${C.accent}0d`,
          border: `1px solid ${C.accent}20`, fontSize: 13, color: C.textMuted,
        }}>
          {(g.genderRule === 'couples_only' || g.genderRule === 'women_only' || g.genderRule === 'men_only') && (
            <span>Attendees will see the entry rule before purchasing tickets. Applications may require host approval.</span>
          )}
          {g.genderRule === 'invite_only' && (
            <span>Only invited guests can attend. Host must approve or manually add attendees.</span>
          )}
          {g.genderRule === 'ratio_controlled' && (
            <span>Gender ratio will be enforced at check-in. Configure max percentages below.</span>
          )}
        </div>
      )}

      {showRatio && (
        <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 16, background: 'rgba(15,23,42,0.6)' }}>
          <div style={lbl}>
            <span style={lblTitle}>Max male %</span>
            <input type="number" min={0} max={100} value={g.genderRatio.maleMaxPct || ''}
              onChange={e => onChange({ ...g, genderRatio: { ...g.genderRatio, maleMaxPct: parseInt(e.target.value) || 0 } })}
              style={inp} placeholder="e.g. 60" />
          </div>
          <div style={lbl}>
            <span style={lblTitle}>Min female %</span>
            <input type="number" min={0} max={100} value={g.genderRatio.femaleMinPct || ''}
              onChange={e => onChange({ ...g, genderRatio: { ...g.genderRatio, femaleMinPct: parseInt(e.target.value) || 0 } })}
              style={inp} placeholder="e.g. 40" />
          </div>
        </div>
      )}

      {showCustom && (
        <div style={lbl}>
          <span style={lblTitle}>Custom restrictions</span>
          <textarea value={g.customEntryRestrictions}
            onChange={e => onChange({ ...g, customEntryRestrictions: e.target.value })}
            placeholder="Describe any custom entry restrictions..."
            style={{ ...inp, minHeight: 80, resize: 'vertical' }} />
        </div>
      )}

      {needsApproval && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: C.text, fontSize: 13 }}>
          <input type="checkbox" checked={g.entryApprovalRequired}
            onChange={e => onChange({ ...g, entryApprovalRequired: e.target.checked })} />
          Require host approval for entry
        </label>
      )}
    </div>
  );
}

export function GenderEntryBadge({ genderRule, entryApprovalRequired }: { genderRule: GenderRule; entryApprovalRequired: boolean }) {
  const opt = GENDER_RULE_OPTIONS.find(o => o.value === genderRule);
  if (genderRule === 'any' && !entryApprovalRequired) return null;
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: genderRule === 'women_only' || genderRule === 'couples_only' ? `${C.accent}22` : `${C.warning}22`,
      color: genderRule === 'women_only' || genderRule === 'couples_only' ? C.accent : C.warning,
    }}>
      {opt?.label || genderRule} {entryApprovalRequired ? '(Approval)' : ''}
    </span>
  );
}

// ── Bag + Security Section ─────────────────────────────────

export function BagSecuritySection({ value, onChange }: Props) {
  const b = value as { bagPolicy: BagPolicy; lockerAvailable: boolean; lockerCostCents: number; lockerInfo: string; storageInfo: string; upgradedProhibitedItems: string[] };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={lbl}>
        <span style={lblTitle}>Bag policy</span>
        <select value={b.bagPolicy} onChange={e => onChange({ ...b, bagPolicy: e.target.value as BagPolicy })} style={inp}>
          {BAG_POLICY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {b.bagPolicy !== 'any' && b.bagPolicy !== 'no_restrictions' && (
        <div style={{ padding: 12, borderRadius: 12, background: `${C.warning}15`, border: `1px solid ${C.warning}30`, fontSize: 13, color: C.textMuted }}>
          {b.bagPolicy === 'no_bags' && 'No bags of any size allowed. Only phones and wallets.'}
          {b.bagPolicy === 'small_bags_only' && 'Only small bags/clutches (max 4.5" x 6.5") are permitted.'}
          {b.bagPolicy === 'clear_bags_only' && 'Only clear bags (max 12" x 6" x 12") are permitted for faster security screening.'}
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 16, background: 'rgba(15,23,42,0.6)' }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>Lockers & Storage</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: C.text, fontSize: 13 }}>
          <input type="checkbox" checked={b.lockerAvailable} onChange={e => onChange({ ...b, lockerAvailable: e.target.checked })} />
          Lockers available
        </label>
        {b.lockerAvailable && (
          <>
            <div style={lbl}>
              <span style={lblTitle}>Locker cost (cents)</span>
              <input type="number" min={0} value={b.lockerCostCents} onChange={e => onChange({ ...b, lockerCostCents: parseInt(e.target.value) || 0 })} style={inp} />
            </div>
            <div style={lbl}>
              <span style={lblTitle}>Locker info</span>
              <input value={b.lockerInfo} onChange={e => onChange({ ...b, lockerInfo: e.target.value })} style={inp} placeholder="Location, size, how to rent..." />
            </div>
          </>
        )}
        <div style={lbl}>
          <span style={lblTitle}>Storage info</span>
          <textarea value={b.storageInfo} onChange={e => onChange({ ...b, storageInfo: e.target.value })}
            style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Coat check, bag storage details..." />
        </div>
      </div>
    </div>
  );
}

export function BagSecurityBadge({ bagPolicy }: { bagPolicy: BagPolicy }) {
  const opt = BAG_POLICY_OPTIONS.find(o => o.value === bagPolicy);
  if (bagPolicy === 'any' || bagPolicy === 'no_restrictions') return null;
  return (
    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, background: `${C.warning}22`, color: C.warning }}>
      {opt?.label || bagPolicy}
    </span>
  );
}

// ── Table Seating Section ──────────────────────────────────

export function TableSeatingSection({ value, onChange }: Props) {
  const t = value as { tableSections: TableSection[] };

  function addSection() {
    const newSection: TableSection = {
      id: Math.random().toString(36).substring(2, 9),
      eventId: '',
      name: '',
      sectionType: 'general',
      capacity: 50,
      priceCents: 0,
      description: '',
      sortOrder: t.tableSections.length,
      color: '#38bdf8',
      createdAt: '',
      updatedAt: '',
    };
    onChange({ ...t, tableSections: [...t.tableSections, newSection] });
  }

  function updateSection(idx: number, updates: Partial<TableSection>) {
    const sections = t.tableSections.map((s, i) => i === idx ? { ...s, ...updates } : s);
    onChange({ ...t, tableSections: sections });
  }

  function removeSection(idx: number) {
    onChange({ ...t, tableSections: t.tableSections.filter((_, i) => i !== idx) });
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>Sections</span>
        <button onClick={addSection} style={{ ...btnBase, background: C.accentBg, color: C.accent, padding: '6px 14px', fontSize: 11 }}>+ Add section</button>
      </div>

      {t.tableSections.length === 0 ? (
        <p style={{ color: C.textMuted, fontSize: 13 }}>No sections configured. Add general admission, VIP, or table sections.</p>
      ) : (
        t.tableSections.map((section, idx) => (
          <div key={section.id} style={{
            padding: 14, borderRadius: 16, background: 'rgba(15,23,42,0.6)',
            border: `1px solid ${C.border}`, display: 'grid', gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Section {idx + 1}</span>
              <button onClick={() => removeSection(idx)} style={{ ...btnBase, padding: '4px 10px', fontSize: 11, background: C.error, color: '#fff' }}>Remove</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input value={section.name} onChange={e => updateSection(idx, { name: e.target.value })} placeholder="Section name" style={inp} />
              <select value={section.sectionType} onChange={e => updateSection(idx, { sectionType: e.target.value as SectionType })} style={inp}>
                {SECTION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input type="number" value={section.capacity || ''} onChange={e => updateSection(idx, { capacity: parseInt(e.target.value) || 0 })} placeholder="Capacity" style={inp} />
              <input type="number" value={section.priceCents || ''} onChange={e => updateSection(idx, { priceCents: parseInt(e.target.value) || 0 })} placeholder="Price (cents)" style={inp} />
            </div>
            <textarea value={section.description} onChange={e => updateSection(idx, { description: e.target.value })}
              placeholder="Description" style={{ ...inp, minHeight: 40, resize: 'vertical' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, color: C.textMuted }}>Color:</label>
              <input type="color" value={section.color} onChange={e => updateSection(idx, { color: e.target.value })} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer' }} />
            </div>
          </div>
        ))
      )}

      {t.tableSections.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {t.tableSections.filter(s => s.name).map(s => (
            <span key={s.id} style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: `${s.color}22`, color: s.color,
              border: `1px solid ${s.color}40`,
            }}>
              {s.name} ({s.capacity})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function TableSeatingBadge({ sections }: { sections: TableSection[] }) {
  if (sections.length === 0) return null;
  return (
    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, background: `${C.accent}22`, color: C.accent }}>
      {sections.length} section{sections.length > 1 ? 's' : ''}
    </span>
  );
}
