'use client';
import { useState, useEffect, CSSProperties } from 'react';

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

interface Review {
  id: number;
  dealId: number;
  reviewerId: number;
  revieweeId: number;
  reviewerType: string;
  reviewerName: string;
  reviewerAvatar?: string;
  ratings: {
    quality: number;
    communication: number;
    professionalism: number;
    overall: number;
  };
  comment?: string;
  createdAt: string;
}

interface DealReviewListProps {
  dealId: number;
}

const StarDisplay: React.FC<{ rating: number }> = ({ rating }) => {
  const stars = Math.round(rating);
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map((num) => (
        <span
          key={num}
          style={{
            fontSize: '16px',
            color: num <= stars ? '#fbbf24' : C.border,
          }}
        >
          
        </span>
      ))}
    </div>
  );
};

export default function DealReviewList({ dealId }: DealReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReviews();
  }, [dealId]);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/deals/reviews/${dealId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch reviews');
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: C.textSecondary }}>Loading reviews...</div>;
  }

  if (error) {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#fee2e2',
        color: C.error,
        borderRadius: '8px',
        border: `1px solid #fecaca`,
      }}>
        {error}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div style={{
        padding: '24px',
        background: C.surface,
        borderRadius: '12px',
        textAlign: 'center',
        color: C.textSecondary,
      }}>
        No reviews yet for this deal.
      </div>
    );
  }

  const containerStyle: CSSProperties = {
    display: 'grid',
    gap: '16px',
  };

  const reviewCardStyle: CSSProperties = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: '12px',
    padding: '16px',
  };

  const reviewHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  };

  const avatarStyle: CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: C.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
  };

  const reviewerInfoStyle: CSSProperties = {
    flex: 1,
  };

  const reviewerNameStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: '600',
    color: C.text,
  };

  const reviewTypeStyle: CSSProperties = {
    fontSize: '12px',
    color: C.textSecondary,
  };

  const dateStyle: CSSProperties = {
    fontSize: '12px',
    color: C.textSecondary,
  };

  const ratingsSectionStyle: CSSProperties = {
    display: 'grid',
    gap: '8px',
    marginBottom: '12px',
    padding: '12px',
    background: C.surface,
    borderRadius: '8px',
  };

  const ratingRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
  };

  const commentStyle: CSSProperties = {
    fontSize: '14px',
    color: C.text,
    lineHeight: '1.5',
    fontStyle: 'italic',
    padding: '12px',
    background: C.surface,
    borderRadius: '8px',
    borderLeft: `3px solid ${C.primary}`,
  };

  const overallRatingStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: '600',
    color: C.text,
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', color: C.text, marginBottom: '12px' }}>
        Reviews ({reviews.length})
      </h3>

      {reviews.map((review) => (
        <div key={review.id} style={reviewCardStyle}>
          <div style={reviewHeaderStyle}>
            <div
              style={avatarStyle}
            >
              {review.reviewerName.charAt(0).toUpperCase()}
            </div>
            <div style={reviewerInfoStyle}>
              <div style={reviewerNameStyle}>{review.reviewerName}</div>
              <div style={reviewTypeStyle}>
                {review.reviewerType === 'creator' ? ' Creator' : ' Brand'}
              </div>
            </div>
            <div style={dateStyle}>
              {new Date(review.createdAt).toLocaleDateString()}
            </div>
          </div>

          <div style={ratingsSectionStyle}>
            <div style={{ ...ratingRowStyle, marginBottom: '4px', fontWeight: '600' }}>
              <span>Overall Rating</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <StarDisplay rating={review.ratings.overall} />
                <span style={overallRatingStyle}>{review.ratings.overall.toFixed(1)}</span>
              </div>
            </div>

            <div style={ratingRowStyle}>
              <span>Quality</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <StarDisplay rating={review.ratings.quality} />
                <span>{review.ratings.quality}/5</span>
              </div>
            </div>

            <div style={ratingRowStyle}>
              <span>Communication</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <StarDisplay rating={review.ratings.communication} />
                <span>{review.ratings.communication}/5</span>
              </div>
            </div>

            <div style={ratingRowStyle}>
              <span>Professionalism</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <StarDisplay rating={review.ratings.professionalism} />
                <span>{review.ratings.professionalism}/5</span>
              </div>
            </div>
          </div>

          {review.comment && (
            <div style={commentStyle}>
              "{review.comment}"
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
