'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { VerificationRequest, VerificationDocument } from '../data/types';
import { VERIFICATION_STATUS_OPTIONS } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5', success: '#86efac', warning: '#fbbf24',
};

const card: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24,
  padding: 20, boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const inp: CSSProperties = {
  width: '100%', borderRadius: 14, border: `1px solid ${C.border}`,
  background: 'rgba(15, 23, 42, 0.88)', color: C.text, padding: '10px 14px',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

const btnBase: CSSProperties = {
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '10px 20px', fontSize: 13,
};

const STATUS_COLORS: Record<string, string> = {
  pending: C.warning, under_review: C.accent, approved: C.success, rejected: C.error, revoked: C.error,
};

export function VerifiedHostWorkflow({ profileId, onStatusChange }: { profileId?: string; onStatusChange?: (status: string) => void }) {
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [docType, setDocType] = useState('business_license');
  const [docUrl, setDocUrl] = useState('');
  const [notes, setNotes] = useState('');

  const MY_PROFILE_ID = profileId || 'dev-profile-001';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/efficiency/verify/my-status');
      if (res.ok) {
        const data = await res.json();
        setRequest(data.request);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submitVerification() {
    setShowSubmit(false);
    const docs: VerificationDocument[] = docUrl ? [{ type: docType, url: docUrl, verified: false, notes: '' }] : [];
    const res = await fetch('/api/efficiency/verify/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessProfileId: MY_PROFILE_ID, documents: docs, notes }),
    });
    if (res.ok) {
      const data = await res.json();
      setRequest(data.request);
      onStatusChange?.(data.request.status);
    }
  }

  const status = request?.status || 'none';
  const opt = VERIFICATION_STATUS_OPTIONS.find(o => o.value === status);

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Verified Host</div>
        {status === 'none' && <button onClick={() => setShowSubmit(true)} style={{ ...btnBase, background: C.accent, color: '#082f49', padding: '6px 14px', fontSize: 11 }}>Apply</button>}
      </div>

      {loading ? (
        <p style={{ color: C.textMuted, fontSize: 13 }}>Loading...</p>
      ) : status === 'none' || status === 'rejected' || status === 'revoked' ? (
        <div>
          <p style={{ color: C.textMuted, fontSize: 13, margin: '0 0 12px' }}>
            {status === 'none' ? 'Your venue is not yet verified. Verified hosts get a trust badge, higher visibility, and attendee confidence.' :
             status === 'rejected' ? 'Your verification was rejected. You can re-apply with updated documents.' :
             'Your verification has been revoked. Please re-apply.'}
          </p>
          {showSubmit && (
            <div style={{ display: 'grid', gap: 10 }}>
              <select value={docType} onChange={e => setDocType(e.target.value)} style={inp}>
                <option value="business_license">Business license</option>
                <option value="tax_certificate">Tax certificate</option>
                <option value="insurance">Insurance certificate</option>
                <option value="id_proof">ID proof</option>
                <option value="venue_photos">Venue photos</option>
              </select>
              <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="Document URL" style={inp} />
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
              <button onClick={submitVerification} disabled={!docUrl.trim()} style={{
                ...btnBase, width: '100%',
                background: docUrl.trim() ? C.accent : C.border,
                color: '#fff', cursor: docUrl.trim() ? 'pointer' : 'not-allowed',
              }}>Submit for review</button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 14,
            borderRadius: 16, background: `${(STATUS_COLORS[status] || C.textMuted)}12`,
            marginBottom: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 999,
              background: STATUS_COLORS[status] || C.textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 16,
            }}>{status === 'approved' ? '✓' : status === 'pending' ? '...' : '!'}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: STATUS_COLORS[status] || C.textMuted }}>
                {opt?.label || status}
              </div>
              {request && (
                <div style={{ fontSize: 12, color: C.textMuted }}>
                  {request.verificationLevel && <>Level: {request.verificationLevel}</>}
                  {request.verifiedAt && <> | Verified: {new Date(request.verifiedAt).toLocaleDateString()}</>}
                </div>
              )}
            </div>
          </div>
          {request?.documents && request.documents.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Documents</div>
              {request.documents.map((d, i) => (
                <div key={i} style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>{d.type}: {d.url}</span>
                  <span style={{ color: d.verified ? C.success : C.textMuted, fontSize: 11 }}>
                    {d.verified ? 'Verified' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function VerifiedBadge({ level }: { level?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: 'linear-gradient(135deg, #059669, #0d9488)',
      color: '#fff',
    }}>
      Verified {level === 'premium' ? 'Premium' : level === 'enterprise' ? 'Enterprise' : ''}
    </span>
  );
}
