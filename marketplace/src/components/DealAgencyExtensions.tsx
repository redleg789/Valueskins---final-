'use client';
import { useState, useEffect } from 'react';

const C = {
  primary: '#0066CC',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  bg: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  border: '#334155',
};

interface DealAgencyExtensionsProps {
  dealId: number;
  dealState: string;
  creatorId?: number;
  brandId?: number;
  isCreator?: boolean;
  isBrand?: boolean;
}

export default function DealAgencyExtensions({
  dealId,
  dealState,
  creatorId,
  brandId,
  isCreator,
  isBrand,
}: DealAgencyExtensionsProps) {
  const [agencySettings, setAgencySettings] = useState<any>(null);
  const [contractStatus, setContractStatus] = useState<any>(null);
  const [qaStatus, setQaStatus] = useState<any>(null);
  const [exclusivityConflicts, setExclusivityConflicts] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Load data on mount
  useEffect(() => {
    if (isCreator && creatorId) {
      loadCreatorData();
    }
    if (isBrand && brandId) {
      loadBrandData();
    }
  }, [dealId, dealState, creatorId, brandId, isCreator, isBrand]);

  const loadCreatorData = async () => {
    try {
      // Load agency settings
      const settingsRes = await fetch('/api/creator/agency-settings', {
        headers: { 'x-user-id': String(creatorId) },
      });
      if (settingsRes.ok) {
        setAgencySettings(await settingsRes.json());
      }

      // Load earnings
      const earningsRes = await fetch('/api/creator/earnings', {
        headers: { 'x-user-id': String(creatorId) },
      });
      if (earningsRes.ok) {
        setEarnings(await earningsRes.json());
      }
    } catch (err) {
      console.error('Error loading creator data:', err);
    }
  };

  const loadBrandData = async () => {
    try {
      // Check exclusivity conflicts
      if (dealState === 'pending' || dealState === 'counter') {
        const exclusRes = await fetch('/api/deals/exclusivity-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorId,
            brandId,
            dealId,
          }),
        });
        if (exclusRes.ok) {
          const data = await exclusRes.json();
          setExclusivityConflicts(data.conflicts || []);
        }
      }

      // Load contract status
      if (['accepted', 'softhold', 'checklist', 'approved'].includes(dealState)) {
        // Contract would be already generated in ACCEPTED phase
        setContractStatus({ generated: true });
      }

      // Load QA status
      if (dealState === 'checklist') {
        setQaStatus({ pendingReview: true });
      }
    } catch (err) {
      console.error('Error loading brand data:', err);
    }
  };

  const generateContract = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deals/contract-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(brandId),
        },
        body: JSON.stringify({ dealId }),
      });

      if (res.ok) {
        setContractStatus({ generated: true });
      }
    } catch (err) {
      console.error('Error generating contract:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitQAReview = async (action: string, issues?: string[]) => {
    setLoading(true);
    try {
      const res = await fetch('/api/deals/quality-assurance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(brandId),
        },
        body: JSON.stringify({
          dealId,
          action,
          issues,
          notes: 'Content reviewed',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setQaStatus({ status: action, message: data.message });
      }
    } catch (err) {
      console.error('Error submitting QA:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
      {/* Creator Section */}
      {isCreator && (
        <>
          {/* Agency Settings Banner */}
          {agencySettings?.minDealValue && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(34, 197, 94, 0.1)',
                border: `1px solid ${C.success}`,
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                color: C.textSecondary,
              }}
            >
              ✓ Agency mode active: Min deal ${agencySettings.minDealValue}, Exclusivity {agencySettings.exclusivityWindow || 30}d
            </div>
          )}

          {/* Earnings Summary */}
          {earnings?.summary && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px' }}>
                Your Earnings
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '12px',
                }}
              >
                <div style={{ padding: '12px', background: C.surface, borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: C.textSecondary }}>Total Earned</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: C.success }}>
                    ${earnings.summary.totalEarned}
                  </div>
                </div>
                <div style={{ padding: '12px', background: C.surface, borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: C.textSecondary }}>Pending</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: C.warning }}>
                    ${earnings.summary.totalPending}
                  </div>
                </div>
                <div style={{ padding: '12px', background: C.surface, borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: C.textSecondary }}>Paid Out</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: C.primary }}>
                    ${earnings.summary.totalPaid}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Brand Section */}
      {isBrand && (
        <>
          {/* Exclusivity Warnings */}
          {exclusivityConflicts.length > 0 && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${C.error}`,
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '12px',
                color: C.textSecondary,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>⚠ Exclusivity Conflicts</div>
              {exclusivityConflicts.map((conflict, idx) => (
                <div key={idx} style={{ fontSize: '11px', marginBottom: '4px' }}>
                  {conflict.type === 'industry_exclusivity'
                    ? `Creator has active deal with ${conflict.brandName} (same industry, expires ${new Date(conflict.expiresAt).toLocaleDateString()})`
                    : `Creator has blocked this brand`}
                </div>
              ))}
            </div>
          )}

          {/* Contract Section */}
          {['accepted', 'softhold', 'checklist', 'approved'].includes(dealState) && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px' }}>
                Contract
              </div>
              {contractStatus?.generated ? (
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: `1px solid ${C.success}`,
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                >
                  ✓ Auto-generated contract ready
                </div>
              ) : (
                <button
                  onClick={generateContract}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: C.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Generating...' : 'Generate Contract'}
                </button>
              )}
            </div>
          )}

          {/* QA Review Section */}
          {dealState === 'checklist' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px' }}>
                Quality Assurance Review
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => submitQAReview('approve')}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: C.success,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  ✓ Approve Content
                </button>
                <button
                  onClick={() => submitQAReview('request_changes', ['Content needs adjustment'])}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: C.warning,
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Request Changes
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Financial Config Info */}
      <div
        style={{
          padding: '12px 16px',
          background: C.surface,
          borderRadius: '8px',
          fontSize: '11px',
          color: C.textSecondary,
          lineHeight: '1.6',
        }}
      >
        Platform handles: contracts, QA review, exclusivity enforcement, earnings tracking, bulk campaigns.
      </div>
    </div>
  );
}
