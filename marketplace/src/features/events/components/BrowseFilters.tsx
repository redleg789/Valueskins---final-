'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5',
};

const card: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.86)',
  border: `1px solid rgba(148, 163, 184, 0.18)`,
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(15, 23, 42, 0.8)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: 12,
  padding: '10px 14px',
  color: '#f8fafc',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const CATEGORIES = [
  'concert', 'workshop', 'networking', 'party', 'conference',
  'exhibition', 'performance', 'screening', 'festival', 'pop-up', 'other',
] as const;

export interface FilterValues {
  search: string;
  category: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
}

export const DEFAULT_FILTERS: FilterValues = {
  search: '',
  category: '',
  city: '',
  dateFrom: '',
  dateTo: '',
  sort: 'date-asc',
};

interface Props {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}

export function BrowseFilters({ values, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  function update(key: keyof FilterValues, val: string) {
    onChange({ ...values, [key]: val });
  }

  function clearAll() {
    onChange(DEFAULT_FILTERS);
  }

  const hasActiveFilters = values.category || values.city || values.dateFrom || values.dateTo;

  return (
    <div style={{ ...card, padding: 16, display: 'grid', gap: 12 }}>
      {/* Search row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          placeholder="Search events..."
          value={values.search}
          onChange={e => update('search', e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            border: `1px solid ${C.border}`, borderRadius: 12,
            padding: '10px 14px', background: 'rgba(56,189,248,0.08)', color: C.accent,
            cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >
          Filters {hasActiveFilters ? '(active)' : ''}
        </button>
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={{ display: 'block', color: C.textMuted, fontSize: 12, marginBottom: 4 }}>Category</label>
            <select
              value={values.category}
              onChange={e => update('category', e.target.value)}
              style={{ ...inputStyle }}
            >
              <option value="">All categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: C.textMuted, fontSize: 12, marginBottom: 4 }}>City</label>
            <input
              placeholder="e.g. Los Angeles"
              value={values.city}
              onChange={e => update('city', e.target.value)}
              style={{ ...inputStyle }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: C.textMuted, fontSize: 12, marginBottom: 4 }}>From</label>
            <input
              type="date"
              value={values.dateFrom}
              onChange={e => update('dateFrom', e.target.value)}
              style={{ ...inputStyle }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: C.textMuted, fontSize: 12, marginBottom: 4 }}>To</label>
            <input
              type="date"
              value={values.dateTo}
              onChange={e => update('dateTo', e.target.value)}
              style={{ ...inputStyle }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: C.textMuted, fontSize: 12, marginBottom: 4 }}>Sort by</label>
            <select
              value={values.sort}
              onChange={e => update('sort', e.target.value)}
              style={{ ...inputStyle }}
            >
              <option value="date-asc">Date (soonest)</option>
              <option value="date-desc">Date (latest)</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="capacity-asc">Capacity (smallest)</option>
              <option value="capacity-desc">Capacity (largest)</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button
              onClick={clearAll}
              style={{
                border: `1px solid rgba(252,165,165,0.3)`, borderRadius: 12,
                padding: '10px 14px', background: 'rgba(252,165,165,0.08)', color: C.error,
                cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%',
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
