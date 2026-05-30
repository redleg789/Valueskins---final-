'use client';
import { useState } from 'react';
import { CSSProperties } from 'react';

const C = {
  primary: '#2563EB',
  bg: '#ffffff',
  surface: '#f9fafb',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  error: '#ef4444',
  success: '#22c55e',
};

interface DealReviewFormProps {
  dealId: number;
  revieweeId: number;
  revieweeeName: string;
  onReviewSubmitted: () => void;
  onCancel: () => void;
}

interface StarRatingProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({ label, value, onChange }) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  };

  const labelStyle: CSSProperties = {
    minWidth: '140px',
    fontSize: '14px',
    fontWeight: '500',
    color: C.text,
  };

  const starsContainerStyle: CSSProperties = {
    display: 'flex',
    gap: '8px',
  };

  const starStyle = (filled: boolean): CSSProperties => ({
    fontSize: '24px',
    cursor: 'pointer',
    color: filled ? '#fbbf24' : C.border,
    transition: 'color 0.2s',
  });

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={starsContainerStyle}>
        {[1, 2, 3, 4, 5].map((num) => (
          <span
            key={num}
            onClick={() => onChange(num)}
            style={starStyle(num <= value)}
          >
            ★
          </span>
        ))}
      </div>
      <span style={{ fontSize: '14px', color: C.textSecondary, minWidth: '20px' }}>
        {value}/5
      </span>
    </div>
  );
};

export default function DealReviewForm({
  dealId,
  revieweeId,
  revieweeeName,
  onReviewSubmitted,
  onCancel,
}: DealReviewFormProps) {
  const [ratings, setRatings] = useState({
    quality: 0,
    communication: 0,
    professionalism: 0,
  });
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!ratings.quality || !ratings.communication || !ratings.professionalism) {
      setError('Please rate all dimensions');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/deals/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dealId,
          revieweeId,
          reviewerType: 'creator', // or 'brand' depending on user role
          ratings,
          comment: comment || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit review');
      }

      onReviewSubmitted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: CSSProperties = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: '12px',
    padding: '24px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    color: C.text,
    marginBottom: '8px',
  };

  const subtitleStyle: CSSProperties = {
    fontSize: '14px',
    color: C.textSecondary,
    marginBottom: '24px',
  };

  const textareaStyle: CSSProperties = {
    width: '100%',
    padding: '12px',
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    marginBottom: '16px',
    minHeight: '100px',
  };

  const buttonsContainerStyle: CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  };

  const buttonStyle = (variant: 'primary' | 'secondary'): CSSProperties => ({
    flex: 1,
    padding: '12px 24px',
    background: variant === 'primary' ? C.primary : '#fff',
    color: variant === 'primary' ? '#fff' : C.text,
    border: variant === 'primary' ? 'none' : `1px solid ${C.border}`,
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
  });

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Review {revieweeeName}</div>
      <div style={subtitleStyle}>Rate your experience on this deal</div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fee2e2',
          color: C.error,
          borderRadius: '8px',
          marginBottom: '16px',
          border: `1px solid #fecaca`,
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <StarRating
          label="Quality"
          value={ratings.quality}
          onChange={(val) => setRatings({ ...ratings, quality: val })}
        />
        <StarRating
          label="Communication"
          value={ratings.communication}
          onChange={(val) => setRatings({ ...ratings, communication: val })}
        />
        <StarRating
          label="Professionalism"
          value={ratings.professionalism}
          onChange={(val) => setRatings({ ...ratings, professionalism: val })}
        />
      </div>

      <div>
        <label style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: '600',
          color: C.text,
          marginBottom: '8px',
        }}>
          Additional Comments (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience..."
          style={textareaStyle}
        />
      </div>

      <div style={buttonsContainerStyle}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={buttonStyle('primary')}
        >
          {loading ? 'Submitting...' : 'Submit Review'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          style={buttonStyle('secondary')}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
