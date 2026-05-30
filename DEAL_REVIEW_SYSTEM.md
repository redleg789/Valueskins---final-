# Deal Review System Documentation

## Overview

The deal review system enables brands and creators to leave reviews for each other after completing a deal. Reviews are tied to specific deals and calculate creator reputation metrics used for ranking.

## Features Implemented

### 1. Backend API (`/api/deals/[[...path]].ts`)

**Database Schema**
- `deal_reviews` table with fields:
  - `id`: Primary key
  - `deal_id`: Reference to specific deal
  - `reviewer_id`: Who left the review
  - `reviewee_id`: Who is being reviewed
  - `reviewer_type`: 'creator' or 'brand'
  - `rating_quality`, `rating_communication`, `rating_professionalism`: 1-5 scale
  - `overall_rating`: Auto-calculated average of 3 dimensions
  - `comment`: Optional text feedback
  - `created_at`, `updated_at`: Timestamps
  - Unique constraint: (deal_id, reviewer_id) - prevents duplicate reviews per deal per person

**Endpoints**

1. **GET `/api/deals/reviews/:dealId`**
   - Fetch all reviews for a specific deal
   - Returns: Array of reviews with reviewer info and ratings

2. **POST `/api/deals/reviews/submit`**
   - Submit or update a review for a deal
   - Required fields: dealId, revieweeId, reviewerType, ratings
   - Optional fields: comment
   - Validations:
     - Deal must exist and be marked as 'completed'
     - Reviewer must be a participant in the deal
     - Reviewee must be a participant in the deal
     - Cannot review yourself
     - Ratings must be 1-5
   - Side effects:
     - Updates user_reputation table with metrics
     - Calculates creator rank score = (review_count * 10) + (avg_overall_rating * 5)

3. **GET `/api/deals/rankings/creators`**
   - Get top creators ranked by rank score
   - Query params: limit (default 50, max 100), offset (default 0)
   - Returns: Paginated creator rankings with ratings and review count
   - Ranking calculation: (total_reviews * 10) + (avg_overall_rating * 5)

4. **GET `/api/deals/user/:userId/reviews`**
   - Get review history for a user
   - Query params: role ('received' or 'given', default 'received'), limit (default 20, max 100)
   - Returns: Reviews received by user or given by user with pagination

### 2. Frontend Components

**DealReviewForm.tsx**
- Component for submitting reviews
- Features:
  - 5-star rating inputs for Quality, Communication, Professionalism
  - Optional comment field
  - Form validation
  - Loading state
  - Error handling
  - Props:
    - dealId: number
    - revieweeId: number
    - revieweeeName: string
    - onReviewSubmitted: callback
    - onCancel: callback

**DealReviewList.tsx**
- Display all reviews for a deal
- Features:
  - Shows reviewer info (name, avatar, type)
  - Displays all three rating dimensions
  - Shows calculated overall rating
  - Optional comment display
  - Responsive grid layout
  - Loading and error states
  - Props:
    - dealId: number

**Creator Rankings Page (`/deals/rankings`)**
- Public leaderboard of top creators
- Features:
  - Sorted by rank score (deals completed + ratings)
  - Shows medal emojis for top 3
  - Displays review count, deals completed, individual ratings
  - Pagination support
  - Click creator to view profile
  - Dark theme matching app design
  - Stats shown:
    - Rank position
    - Creator name & username
    - Review count (deals completed)
    - Deals completed
    - Overall rating (with star display)
    - Quality, Communication, Professionalism ratings
    - Rank score

**Deals Feed Page (`/deals/feed`)**
- Placeholder page for viewing active deals
- Includes link to creator rankings

### 3. Navigation Updates

**Feed Page (`/feed`)**
- Updated to show navigation cards for:
  - Deals Feed
  - Creator Rankings
  - Location Search

## Key Business Logic

### Review Constraints
- Reviews can ONLY be submitted for deals with status = 'completed'
- Each deal gets ONE review per reviewer (can be updated if same reviewer submits again)
- Reviews are tied to specific deals, never general user reviews

### Ranking Algorithm
```
rank_score = (total_reviews * 10) + (avg_overall_rating * 5)
```

This emphasizes both:
- Deal completion (more reviews = more completed deals)
- Quality (higher ratings increase score)

### Creator Reputation Metrics
When a review is submitted, the user_reputation table is updated with:
- `total_reviews`: Count of reviews received
- `avg_quality_rating`: Average of quality ratings
- `avg_communication_rating`: Average of communication ratings
- `avg_professionalism_rating`: Average of professionalism ratings
- `avg_overall_rating`: Average of overall ratings
- `creator_rank_score`: Calculated score used for ranking
- `deals_completed`: Count of completed deals (same as total_reviews in this system)

## Database Indexes

For performance at scale:
- `idx_deal_reviews_deal`: Query reviews for a specific deal
- `idx_deal_reviews_reviewer`: Query reviews given by a user
- `idx_deal_reviews_reviewee`: Query reviews received by a user
- `idx_deal_reviews_overall`: Sort by overall rating (for rankings)

## Usage Flow

1. **User Completes Deal**
   - Deal status changes to 'completed'
   - Review button appears on deal detail page

2. **User Submits Review**
   - Rates 3 dimensions (Quality, Communication, Professionalism)
   - Adds optional comment
   - System validates deal is completed and user is participant
   - Review saved to database

3. **Creator Reputation Updates**
   - user_reputation table updated with aggregate metrics
   - Rank score recalculated
   - Creator may move up/down in rankings

4. **View Rankings**
   - Creators can view themselves on leaderboard
   - Sorting by rank score shows top performers
   - Displays all rating details transparently

## Security Considerations

- Parameterized queries (no SQL injection)
- Authentication required (verify session user)
- Authorization checks (only participants can review, can't review self)
- Rate limiting (prevent spam reviews)
- Validation on all inputs (ratings 1-5, required fields)

## Future Enhancements

1. Review disputes/appeals
2. Review moderation (remove fake reviews)
3. Response to reviews (reviewee can reply)
4. Review filters (by rating, date, reviewer type)
5. Email notifications when reviewed
6. Review visibility permissions
7. Verified purchase badge
8. Review helpfulness voting
