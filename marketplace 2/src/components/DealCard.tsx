'use client';

interface DealCardProps {
  id: string;
  brand: string;
  title: string;
  budget: number;
  deadline: string;
  matchScore: string;
  featured?: boolean;
  onClick: () => void;
}

export default function DealCard({
  id,
  brand,
  title,
  budget,
  deadline,
  matchScore,
  featured,
  onClick,
}: DealCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={(e) => {
        if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>{brand}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginTop: '4px' }}>
            {title}
          </div>
        </div>
        {featured && (
          <span style={{
            background: '#fbbf24',
            color: '#78350f',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
          }}>
            Featured
          </span>
        )}
      </div>

      {/* Details Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>BUDGET</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
            ${budget.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>DEADLINE</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', marginTop: '4px' }}>
            {deadline}
          </div>
        </div>
      </div>

      {/* Match Score */}
      <div style={{
        background: '#dbeafe',
        border: '1px solid #93c5fd',
        borderRadius: '4px',
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>Match Score</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>{matchScore}</span>
      </div>
    </div>
  );
}
