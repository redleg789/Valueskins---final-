'use client';

interface DealDetailModalProps {
  deal: {
    id: string;
    brand: string;
    title: string;
    description: string;
    budget: number;
    deadline: string;
    deliverables: Array<{ type: string; count: number; dueDate: string }>;
    requirements: string[];
    usageRights: string;
    exclusivity: string;
  };
  onClose: () => void;
  onApply: () => void;
}

export default function DealDetailModal({ deal, onClose, onApply }: DealDetailModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Brand</div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '8px 0 0 0' }}>
              {deal.title}
            </h2>
            <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>{deal.brand}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Budget & Deadline */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>BUDGET</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981', marginTop: '8px' }}>
                ${deal.budget.toLocaleString()}
              </div>
            </div>
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>DEADLINE</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706', marginTop: '8px' }}>
                {deal.deadline}
              </div>
            </div>
          </div>

          {/* Description */}
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
              About This Deal
            </h3>
            <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6' }}>
              {deal.description}
            </p>
          </section>

          {/* Deliverables */}
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', marginBottom: '12px' }}>
              Deliverables
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {deal.deliverables.map((del, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>
                      {del.type}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                      Qty: {del.count} · Due: {del.dueDate}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Requirements */}
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', marginBottom: '12px' }}>
              Requirements
            </h3>
            <ul style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.8', paddingLeft: '20px' }}>
              {deal.requirements.map((req, idx) => (
                <li key={idx}>{req}</li>
              ))}
            </ul>
          </section>

          {/* Terms */}
          <div style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '24px',
            fontSize: '12px',
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#1f2937' }}>Usage Rights:</strong>{' '}
              <span style={{ color: '#6b7280' }}>{deal.usageRights}</span>
            </div>
            <div>
              <strong style={{ color: '#1f2937' }}>Exclusivity:</strong>{' '}
              <span style={{ color: '#6b7280' }}>{deal.exclusivity}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              background: '#ffffff',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#1f2937',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            style={{
              padding: '10px 24px',
              background: '#2563eb',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Apply Now
          </button>
        </div>
      </div>
    </div>
  );
}
