# Deal Review System - Integration Guide

## Quick Start

### 1. Import Components

```typescript
import DealReviewForm from '@/components/DealReviewForm';
import DealReviewList from '@/components/DealReviewList';
```

### 2. Display Reviews for a Deal

```typescript
interface DealDetailPageProps {
  dealId: number;
}

export default function DealDetailPage({ dealId }: DealDetailPageProps) {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [deal, setDeal] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Fetch deal details
  const fetchDeal = async () => {
    const res = await fetch(`/api/deals/${dealId}`, { credentials: 'include' });
    const data = await res.json();
    setDeal(data);
  };

  useEffect(() => {
    fetchDeal();
  }, [dealId]);

  return (
    <div>
      <h1>{deal?.title}</h1>
      
      {/* Show review form only if deal is completed */}
      {deal?.status === 'completed' && (
        <>
          {!showReviewForm ? (
            <button onClick={() => setShowReviewForm(true)}>
              Leave a Review
            </button>
          ) : (
            <DealReviewForm
              dealId={dealId}
              revieweeId={deal.creatorId}
              revieweeeName={deal.creatorName}
              onReviewSubmitted={() => {
                setShowReviewForm(false);
                fetchDeal(); // Refresh deal data
              }}
              onCancel={() => setShowReviewForm(false)}
            />
          )}
        </>
      )}

      {/* Show reviews for this deal */}
      <DealReviewList dealId={dealId} />
    </div>
  );
}
```

### 3. Access Creator Rankings

From anywhere in your app:

```typescript
import { useRouter } from 'next/router';

export default function SomeComponent() {
  const router = useRouter();

  return (
    <button onClick={() => router.push('/deals/rankings')}>
      View Creator Rankings
    </button>
  );
}
```

### 4. Show User Review History

To display a user's reviews (given and received):

```typescript
async function fetchUserReviewHistory(userId: number, type: 'received' | 'given') {
  const res = await fetch(
    `/api/deals/user/${userId}/reviews?role=${type}&limit=20`,
    { credentials: 'include' }
  );
  const data = await res.json();
  return data.reviews;
}
```

## API Reference

### Submit Review

```javascript
const response = await fetch('/api/deals/reviews/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    dealId: 123,
    revieweeId: 456,
    reviewerType: 'creator', // or 'brand'
    ratings: {
      quality: 5,
      communication: 4,
      professionalism: 5,
    },
    comment: 'Great experience working together!',
  }),
});

const review = await response.json();
// Returns: { id, dealId, revieweeId, ratings, overallRating, comment, createdAt }
```

### Fetch Deal Reviews

```javascript
const response = await fetch('/api/deals/reviews/123', {
  credentials: 'include',
});

const data = await response.json();
// Returns: { reviews: [...] }
// Each review has: id, dealId, reviewerId, reviewerName, reviewerAvatar, ratings, comment, createdAt
```

### Fetch Creator Rankings

```javascript
const response = await fetch('/api/deals/rankings/creators?limit=50&offset=0', {
  credentials: 'include',
});

const data = await response.json();
// Returns: { rankings: [...], total, limit, offset }
// Each ranking entry has: rank, creatorId, name, avatar, username, reviewCount, 
//   dealsCompleted, ratings (overall/quality/communication/professionalism), rankScore
```

### Fetch User Review History

```javascript
// Reviews received by user
const response = await fetch('/api/deals/user/456/reviews?role=received&limit=20', {
  credentials: 'include',
});

// Reviews given by user
const response = await fetch('/api/deals/user/456/reviews?role=given&limit=20', {
  credentials: 'include',
});

const data = await response.json();
// Returns: { reviews: [...] }
```

## Component Props Reference

### DealReviewForm

```typescript
interface DealReviewFormProps {
  dealId: number;              // ID of the deal being reviewed
  revieweeId: number;          // ID of the person being reviewed
  revieweeeName: string;       // Name of the person being reviewed
  onReviewSubmitted: () => void; // Callback when review is successfully submitted
  onCancel: () => void;        // Callback when user clicks cancel
}
```

### DealReviewList

```typescript
interface DealReviewListProps {
  dealId: number; // ID of the deal whose reviews to display
}
```

## Styling

All components use dark theme (matching app design) with these colors:

```typescript
const C = {
  primary: '#2563EB',        // Blue
  bg: '#0f172a' or '#ffffff', // Dark/Light background
  surface: '#1e293b' or '#f9fafb', // Dark/Light surface
  text: '#f8fafc' or '#1f2937', // Light/Dark text
  textSecondary: '#cbd5e1' or '#6b7280', // Light/Dark secondary text
  border: '#334155' or '#e5e7eb', // Borders
  error: '#ef4444',          // Error red
  success: '#22c55e',        // Success green
};
```

To customize colors, you can:
1. Modify the `C` object at the top of each component
2. Pass style props if you refactor components
3. Use CSS modules for overrides

## Error Handling

All components handle errors gracefully:

```typescript
// DealReviewForm shows error message
{error && (
  <div style={{...errorStyle}}>
    {error}
  </div>
)}

// DealReviewList shows error message or "No reviews yet"
if (error) return <div>{error}</div>;
if (reviews.length === 0) return <div>No reviews yet</div>;
```

## Validation Rules

Reviews can only be submitted if:
- Deal exists and has status = 'completed'
- Current user is a participant in the deal
- Reviewee is also a participant in the deal
- User is not reviewing themselves
- All three ratings are provided and are 1-5

## Testing the System

### Manual Testing Flow

1. Create a deal between creator and brand
2. Complete the deal (set status to 'completed')
3. Both parties can now leave reviews
4. Click "Leave a Review"
5. Rate each dimension 1-5
6. Add optional comment
7. Submit review
8. Check DealReviewList to see review appear
9. Go to /deals/rankings to see updated rankings

### Test Endpoints with curl

```bash
# Submit a review
curl -X POST http://localhost:3000/api/deals/reviews/submit \
  -H "Content-Type: application/json" \
  -d '{
    "dealId": 1,
    "revieweeId": 2,
    "reviewerType": "creator",
    "ratings": {"quality": 5, "communication": 4, "professionalism": 5},
    "comment": "Excellent experience"
  }'

# Get reviews for a deal
curl http://localhost:3000/api/deals/reviews/1

# Get creator rankings
curl http://localhost:3000/api/deals/rankings/creators?limit=10

# Get user review history
curl http://localhost:3000/api/deals/user/2/reviews?role=received
```

## Performance Considerations

- Reviews are indexed on deal_id, reviewer_id, and reviewee_id
- Ranking query uses ROW_NUMBER for efficient pagination
- User reputation metrics are updated atomically with review submission
- Consider caching rankings if > 10K creators on platform

## Security Notes

- All endpoints require authentication (checked in session middleware)
- Authorization enforced: only deal participants can review
- SQL injection prevented with parameterized queries
- Rate limiting should be added for review endpoints
- Consider email notifications when reviewed

## Future Integrations

- Add review notification emails
- Add review moderation dashboard
- Add review filtering on profile pages
- Add review response capability
- Add review helpfulness voting
- Add review moderation tools
