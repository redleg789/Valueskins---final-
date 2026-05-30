'use client';

import React, { useState, useEffect } from 'react';

const C = {
  bg: '#ffffff',
  surface: '#f9fafb',
  text: '#1f2937',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  primary: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

interface TimelineEvent {
  date: string;
  event: string;
  type: 'contract' | 'milestone' | 'deliverable' | 'approval' | 'posting' | 'payment';
  completed: boolean;
  reminder_sent: boolean;
  details?: {
    time?: string;
    location?: string;
    dress_code?: string;
    contact_person?: string;
  };
}

interface Deliverable {
  id: string;
  name: string;
  description: string;
  deadline: string;
  status: 'pending' | 'submitted' | 'revisions_requested' | 'approved';
  revisions_remaining: number;
  submitted_at?: string;
  approved_at?: string;
}

interface Invoice {
  id: string;
  amount: number;
  due_date: string;
  status: 'draft' | 'sent' | 'overdue' | 'paid';
  days_overdue: number;
}

// Timeline display (ACCEPTED phase)
export function TimelineView({ dealId, timeline }: { dealId: string; timeline: TimelineEvent[] }) {
  return (
    <div style={{ padding: '16px', background: C.surface, borderRadius: '8px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>
        Deal Timeline
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {timeline.map((event, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '12px' }}>
            <div
              style={{
                width: '4px',
                background:
                  event.type === 'contract' ? C.primary :
                  event.type === 'milestone' ? C.warning :
                  event.type === 'deliverable' ? C.primary :
                  event.type === 'approval' ? C.success :
                  event.type === 'posting' ? C.primary :
                  event.type === 'payment' ? C.success : C.textMuted,
                borderRadius: '2px',
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: C.text }}>
                {event.event}
              </div>
              <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '4px' }}>
                {new Date(event.date).toLocaleDateString()} {event.details?.time && `@ ${event.details.time}`}
              </div>
              {event.details?.location && (
                <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>
                  📍 {event.details.location}
                </div>
              )}
              {event.completed && (
                <div style={{ fontSize: '11px', color: C.success, marginTop: '4px', fontWeight: 500 }}>
                  ✓ Completed
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Deliverables checklist (SOFTHOLD phase)
export function DeliverablesView({ dealId, deliverables }: { dealId: string; deliverables: Deliverable[] }) {
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');

  const handleSubmit = async (deliverableId: string) => {
    setSubmittingId(deliverableId);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      formData.append('notes', notes);

      const response = await fetch(`/api/deals/workflow-extensions`, {
        method: 'POST',
        headers: { 'x-user-id': localStorage.getItem('userId') || '' },
        body: JSON.stringify({
          action: 'submit-deliverable',
          deal_id: dealId,
          deliverable_id: deliverableId,
          files: files.map(f => f.name),
          notes,
        }),
      });

      if (!response.ok) throw new Error('Submission failed');
      setFiles([]);
      setNotes('');
    } catch (err) {
      console.error('Deliverable submission error:', err);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div style={{ padding: '16px', background: C.surface, borderRadius: '8px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>
        Deliverables
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {deliverables.map(d => (
          <div
            key={d.id}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              padding: '12px',
              background: d.status === 'approved' ? '#f0fdf4' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: C.text }}>
                  {d.name}
                </div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>
                  {d.description}
                </div>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background:
                    d.status === 'approved' ? '#d1fae5' :
                    d.status === 'submitted' ? '#fef3c7' :
                    d.status === 'revisions_requested' ? '#fee2e2' : '#f3f4f6',
                  color:
                    d.status === 'approved' ? C.success :
                    d.status === 'submitted' ? C.warning :
                    d.status === 'revisions_requested' ? C.danger : C.textMuted,
                  fontWeight: 500,
                }}
              >
                {d.status === 'approved' ? '✓ Approved' :
                 d.status === 'submitted' ? 'Awaiting Approval' :
                 d.status === 'revisions_requested' ? 'Revisions Needed' : 'Pending'}
              </div>
            </div>

            <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '8px' }}>
              Due: {new Date(d.deadline).toLocaleDateString()} | {d.revisions_remaining} revisions remaining
            </div>

            {d.status === 'pending' && (
              <div style={{ marginTop: '12px', borderTop: `1px solid ${C.border}`, paddingTop: '12px' }}>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}
                />
                <textarea
                  placeholder="Add notes to your submission..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '60px',
                    padding: '8px',
                    border: `1px solid ${C.border}`,
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    marginBottom: '8px',
                  }}
                />
                <button
                  onClick={() => handleSubmit(d.id)}
                  disabled={submittingId === d.id}
                  style={{
                    padding: '8px 16px',
                    background: C.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: submittingId === d.id ? 'default' : 'pointer',
                    opacity: submittingId === d.id ? 0.6 : 1,
                  }}
                >
                  {submittingId === d.id ? 'Submitting...' : 'Submit Deliverable'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Invoice & payment tracking (CHECKLIST/APPROVED phase)
export function InvoiceView({ dealId, invoice }: { dealId: string; invoice: Invoice }) {
  const [sending, setSending] = useState(false);

  const handleSendInvoice = async () => {
    setSending(true);
    try {
      await fetch(`/api/deals/workflow-extensions`, {
        method: 'POST',
        headers: { 'x-user-id': localStorage.getItem('userId') || '' },
        body: JSON.stringify({
          action: 'send-invoice',
          invoice_id: invoice.id,
          email: '', // Would be filled from deal context
        }),
      });
    } catch (err) {
      console.error('Invoice send error:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: '16px', background: C.surface, borderRadius: '8px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>
        Invoice & Payment
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>
            Amount Due
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>
            ${invoice.amount.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>
            Due Date
          </div>
          <div style={{ fontSize: '14px', color: invoice.days_overdue > 0 ? C.danger : C.text }}>
            {new Date(invoice.due_date).toLocaleDateString()}
            {invoice.days_overdue > 0 && (
              <div style={{ fontSize: '11px', color: C.danger, marginTop: '2px' }}>
                {invoice.days_overdue} days overdue
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '12px',
          background:
            invoice.status === 'paid' ? '#d1fae5' :
            invoice.status === 'overdue' ? '#fee2e2' :
            invoice.status === 'sent' ? '#fef3c7' : '#f3f4f6',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px',
          color:
            invoice.status === 'paid' ? C.success :
            invoice.status === 'overdue' ? C.danger :
            invoice.status === 'sent' ? C.warning : C.textMuted,
          fontWeight: 500,
        }}
      >
        {invoice.status === 'paid' ? '✓ Payment Received' :
         invoice.status === 'overdue' ? '⚠ Payment Overdue' :
         invoice.status === 'sent' ? 'Invoice Sent' : 'Draft'}
      </div>

      {invoice.status === 'draft' && (
        <button
          onClick={handleSendInvoice}
          disabled={sending}
          style={{
            width: '100%',
            padding: '10px',
            background: C.primary,
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: sending ? 'default' : 'pointer',
            opacity: sending ? 0.6 : 1,
          }}
        >
          {sending ? 'Sending...' : 'Send Invoice'}
        </button>
      )}
    </div>
  );
}

// Contract storage (ACCEPTED phase)
export function ContractView({ dealId }: { dealId: string }) {
  const [uploading, setUploading] = useState(false);

  const handleUploadContract = async (file: File) => {
    setUploading(true);
    try {
      await fetch(`/api/deals/workflow-extensions`, {
        method: 'POST',
        headers: { 'x-user-id': localStorage.getItem('userId') || '' },
        body: JSON.stringify({
          action: 'store-contract',
          deal_id: dealId,
          contract_file: file.name,
          terms_text: 'Contract uploaded', // Would parse actual terms
        }),
      });
    } catch (err) {
      console.error('Contract upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '16px', background: C.surface, borderRadius: '8px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>
        Contract & Agreements
      </h3>
      <div
        style={{
          border: `2px dashed ${C.border}`,
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          background: '#fafafa',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: C.text, marginBottom: '8px' }}>
          Upload Contract
        </div>
        <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '12px' }}>
          Upload your signed contract or agreement
        </div>
        <input
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadContract(file);
          }}
          disabled={uploading}
          style={{
            display: 'block',
            margin: '0 auto',
            fontSize: '12px',
            opacity: uploading ? 0.6 : 1,
          }}
        />
      </div>
    </div>
  );
}
