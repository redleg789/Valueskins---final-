// Production-ready selectable options for search optimization
// Location data uses world-cities npm package (50k+ cities, automatically updated)
// Other data is curated but can be extended dynamically from database

/**
 * Location data is loaded dynamically from world-cities library
 * This provides 50,000+ world cities without hardcoding
 * To use: npm install world-cities
 *
 * Fallback: If library unavailable, fetch from API at:
 * - Nominatim (OpenStreetMap) — free, no auth needed
 * - GeoNames API — large database
 * - Database query to recently-used locations (cached)
 */

export const INTERESTS = [
  'Music', 'Fashion', 'Fitness', 'Tech', 'Gaming', 'Art & Design', 'Food & Cooking',
  'Travel', 'Beauty & Makeup', 'Entertainment', 'Sports', 'Education', 'Business',
  'Lifestyle', 'Comedy', 'Dance', 'Photography', 'Wellness', 'DIY & Crafts',
  'Parenting', 'Finance', 'Self-Improvement', 'Mental Health', 'Entrepreneurship',
  'Social Issues', 'Environment', 'Books', 'Movies & TV', 'Anime & Manga',
  'Automobiles', 'Home & Garden', 'Pets', 'Relationships', 'Career',
];

export const SKILLS = [
  'Photography', 'Videography', 'Video Editing', 'Graphic Design', 'Animation', 'Copywriting',
  'Social Media Marketing', 'Content Creation', 'Podcast Production', 'Music Production', 'Modeling',
  'Acting', 'Singing', 'Dancing', 'Comedy', 'Public Speaking', 'Teaching', 'Consulting',
  'Product Photography', 'Fashion Styling', 'Makeup', 'Fitness Training', 'Cooking',
  'Writing', 'Storytelling', 'UX/UI Design', 'Web Development', 'App Development', 'SEO',
  'Brand Strategy', 'Event Planning', 'Influencer Marketing', 'Community Management', 'Analytics',
];

export const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner (0-1 year)', description: 'Just starting out' },
  { value: 'intermediate', label: 'Intermediate (1-3 years)', description: 'Some experience' },
  { value: 'advanced', label: 'Advanced (3-5 years)', description: 'Significant experience' },
  { value: 'expert', label: 'Expert (5+ years)', description: 'Highly skilled & recognized' },
];

export const CONTENT_TYPES = [
  'Reels/Shorts', 'Long-form Videos', 'Carousels', 'Stories', 'Static Posts', 'Live Streams',
  'Podcasts', 'Blogs', 'Streams', 'Collaborations', 'Tutorials', 'Reviews',
];

export const AUDIENCE_AGE_RANGES = [
  '13-17', '18-24', '25-34', '35-44', '45-54', '55+', 'All ages',
];

export const AUDIENCE_GENDERS = [
  { value: 'mixed', label: 'Mixed (equally male & female)' },
  { value: 'female-majority', label: 'Mostly Female (60%+)' },
  { value: 'male-majority', label: 'Mostly Male (60%+)' },
  { value: 'non-binary', label: 'All genders equally' },
];

export const LANGUAGES = [
  'English', 'Hindi', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian',
  'Chinese (Mandarin)', 'Japanese', 'Korean', 'Arabic', 'Turkish', 'Dutch', 'Swedish',
  'Norwegian', 'Danish', 'Polish', 'Thai', 'Vietnamese', 'Indonesian', 'Tagalog', 'Bengali',
  'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Punjabi', 'Urdu',
];

export const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'youtube', label: 'YouTube', icon: '▶️' },
  { value: 'twitter', label: 'Twitter/X', icon: '𝕏' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'twitch', label: 'Twitch', icon: '🎮' },
  { value: 'snapchat', label: 'Snapchat', icon: '👻' },
];

/**
 * LOCATION DATA STRATEGY
 *
 * Instead of hardcoding, fetch locations dynamically:
 *
 * 1. **On Startup**: Load world-cities library (50k+ cities)
 *    npm install world-cities
 *    import { cities } from 'world-cities';
 *
 * 2. **On Search**: Query cities by country + autocomplete
 *    fetch('/api/locations/search?country=IN&query=mum')
 *    Returns: [Mumbai, Mum Pradesh, Mumbra, etc.]
 *
 * 3. **Backend caches**: Popular locations in DB for speed
 *    SELECT city, country FROM popular_locations
 *    WHERE country = ? ORDER BY search_count DESC
 *
 * 4. **Fallback**: If library unavailable, use:
 *    - Nominatim API (OpenStreetMap) — free, no auth
 *    - Database of historical entries (user-provided)
 */

export interface LocationSearchResult {
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  population?: number;
}

/**
 * Fetch cities for a specific country
 * Backend implementation uses world-cities library
 */
export async function fetchCountryCities(countryCode: string): Promise<string[]> {
  const response = await fetch(`/api/locations/cities?country=${countryCode}`);
  if (!response.ok) throw new Error('Failed to fetch cities');
  const data = await response.json();
  return data.cities;
}

/**
 * Search locations with autocomplete
 * Backend queries world-cities library
 */
export async function searchLocations(query: string, country?: string): Promise<LocationSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (country) params.append('country', country);

  const response = await fetch(`/api/locations/search?${params}`);
  if (!response.ok) throw new Error('Failed to search locations');
  return response.json();
}

/**
 * Get all countries
 * Backend uses world-cities library or custom DB
 */
export async function fetchAllCountries(): Promise<Array<{ code: string; name: string }>> {
  const response = await fetch('/api/locations/countries');
  if (!response.ok) throw new Error('Failed to fetch countries');
  return response.json();
}
