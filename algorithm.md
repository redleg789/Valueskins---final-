# Deal Review Algorithm

## Overview

The creator ranking algorithm rewards both **deal completion volume** and **quality of work** by combining review count with average ratings into a single rank score.

## Core Formula

```
rank_score = (total_reviews × 10) + (avg_overall_rating × 5)
```

## Components Explained

### 1. Review Count Component: `total_reviews × 10`

**What it measures**: How many completed deals a creator has done

**Why it matters**: 
- Shows reliability (completed work)
- More reviews = more active creator
- Counts as 10 points each

**Example**: Creator with 50 reviews gets 500 points from this component

### 2. Rating Component: `avg_overall_rating × 5`

**What it measures**: Average quality across all reviews (1-5 scale)

**Why it matters**:
- Shows quality of work
- Perfect 5.0 rating adds only 25 points max
- Scales proportionally with rating

**Example**: Creator with 5.0 average rating gets 25 points from this component

### 3. Overall Rating Calculation

Each review has 3 dimensions:
- Quality (1-5)
- Communication (1-5)  
- Professionalism (1-5)

```
overall_rating = (quality + communication + professionalism) / 3
```

**Example**: Ratings of 5, 4, 5 = (5+4+5)/3 = 4.67 overall

## Complete Ranking Example

**Creator A:**
- 50 completed deals (reviews)
- Average overall rating: 4.8/5

```
rank_score = (50 × 10) + (4.8 × 5)
           = 500 + 24
           = 524 points
Rank: 1st place
```

**Creator B:**
- 100 completed deals
- Average overall rating: 3.2/5

```
rank_score = (100 × 10) + (3.2 × 5)
           = 1000 + 16
           = 1016 points
Rank: Higher (prioritizes volume)
```

## Key Design Decisions

### 1. Why 10× and 5× multipliers?

- **10× for reviews**: Prioritizes deal completion (most important)
- **5× for rating**: Quality matters but can't override volume
- With max rating of 5: 5 × 5 = 25 points max per review
- This ensures prolific creators rank high even with average (3.0) ratings

### 2. Why not pure average?

❌ **Bad**: Pure average (no volume)
```
rank_score = avg_overall_rating
Result: Creator with 1 perfect review ranks same as creator with 100 perfect reviews
```

✅ **Good**: Weighted by volume
```
rank_score = (reviews × 10) + (rating × 5)
Result: 1 review (5.0) = 50 points, 100 reviews (4.8) = 1,024 points
```

### 3. Why 3 rating dimensions?

Captures different aspects of professionalism:
- **Quality**: Did the work meet standards?
- **Communication**: Were they responsive and clear?
- **Professionalism**: Were they reliable and courteous?

Average of all 3 = holistic quality score

## Data Flow

```
1. Deal Completed
   ↓
2. Review Submitted (3 ratings + comment)
   ↓
3. Overall Rating Calculated: (quality + communication + professionalism) / 3
   ↓
4. user_reputation Updated:
   - total_reviews = count of all reviews
   - avg_overall_rating = average of all overall_ratings
   - Individual rating averages (avg_quality_rating, etc.)
   ↓
5. Rank Score Calculated:
   rank_score = (total_reviews × 10) + (avg_overall_rating × 5)
   ↓
6. Creator Appears in Rankings at new position
```

## Edge Cases

### New Creators (0 reviews)
- Rank score: 0
- Don't appear in rankings
- Appear once they complete first deal and get first review

### All 5-star Reviews
- Best case: (reviews × 10) + (5 × 5) = (reviews × 10) + 25
- Example: 100 reviews with 5.0 = 1,000 + 25 = 1,025 points

### Mixed Reviews (3-star average)
- Example: 100 reviews with 3.0 = 1,000 + 15 = 1,015 points
- Still ranks high due to volume

### One Bad Review (1-star) among many 5-stars
- Minimal impact on ranking
- Brings average down slightly (e.g., 4.8 → 4.79)
- Shows platform accounts for all reviews fairly

## Ranking Breakdown

With 1,000 creators on platform:

| Rank | Scenario | Score | Reviews | Avg Rating |
|------|----------|-------|---------|------------|
| 1st | High volume + high quality | 1,025 | 100 | 5.0 |
| 2nd | Very high volume + medium quality | 1,015 | 100 | 3.0 |
| 10th | Good volume + good quality | 505 | 50 | 4.0 |
| 100th | Decent volume + average quality | 185 | 18 | 3.0 |
| 500th | Low volume + good quality | 85 | 8 | 4.0 |

## Why This Works

1. **Transparent**: Formula is simple and understandable
2. **Fair**: Both volume and quality matter
3. **Incentive-aligned**: Creators motivated to complete deals AND do good work
4. **Verifiable**: Everyone can see exact reviews and ratings
5. **Scalable**: Works for 10 creators or 1M creators
6. **Flexible**: Easy to adjust multipliers (10× and 5×) if needed

## Future Tweaks

If needed, multipliers can be adjusted:
- To emphasize quality more: increase rating multiplier from 5× to 7×
- To emphasize volume more: increase review multiplier from 10× to 12×
- Current 10:5 ratio = 2:1 (volume:quality)
