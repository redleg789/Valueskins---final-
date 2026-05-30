import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * GET /api/locations/search?q=mum&country=IN
 * Autocomplete search for cities worldwide
 *
 * In production:
 * 1. Load world-cities library (50k+ cities)
 * 2. Use fuzzy matching for typos
 * 3. Cache popular searches
 * 4. Rate limit to prevent abuse
 */

interface LocationSearchResult {
  city: string;
  country: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
  population?: number;
}

// Mock data for demonstration
// In production, query world-cities library with fuzzy matching
const ALL_CITIES: Array<LocationSearchResult> = [
  // India
  { city: 'Mumbai', country: 'India', countryCode: 'IN', population: 20961472 },
  { city: 'Delhi', country: 'India', countryCode: 'IN', population: 32939105 },
  { city: 'Bangalore', country: 'India', countryCode: 'IN', population: 11999352 },
  { city: 'Hyderabad', country: 'India', countryCode: 'IN', population: 6809970 },
  { city: 'Chennai', country: 'India', countryCode: 'IN', population: 7088000 },
  { city: 'Kolkata', country: 'India', countryCode: 'IN', population: 14681900 },
  { city: 'Pune', country: 'India', countryCode: 'IN', population: 5057709 },
  { city: 'Ahmedabad', country: 'India', countryCode: 'IN', population: 7214225 },
  { city: 'Jaipur', country: 'India', countryCode: 'IN', population: 3046163 },
  // USA
  { city: 'New York', country: 'United States', countryCode: 'US', population: 8336817 },
  { city: 'Los Angeles', country: 'United States', countryCode: 'US', population: 3979576 },
  { city: 'Chicago', country: 'United States', countryCode: 'US', population: 2693976 },
  // UK
  { city: 'London', country: 'United Kingdom', countryCode: 'GB', population: 9002488 },
  { city: 'Manchester', country: 'United Kingdom', countryCode: 'GB', population: 547627 },
  // Add more cities as needed...
];

export default function handler(req: NextApiRequest, res: NextApiResponse<LocationSearchResult[] | { error: string }>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, country } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'q (query) parameter required' });
  }

  try {
    const query = q.toLowerCase().trim();
    if (query.length < 2) {
      return res.json([]);
    }

    // Filter cities by query and optional country
    let results = ALL_CITIES.filter(city =>
      city.city.toLowerCase().includes(query)
    );

    if (country && typeof country === 'string') {
      results = results.filter(city => city.countryCode === country.toUpperCase());
    }

    // Sort by:
    // 1. Exact match first
    // 2. Then by population (most populated first)
    results.sort((a, b) => {
      const aExact = a.city.toLowerCase() === query ? 0 : 1;
      const bExact = b.city.toLowerCase() === query ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return (b.population || 0) - (a.population || 0);
    });

    // Limit to top 20 results
    res.status(200).json(results.slice(0, 20));
  } catch (err: any) {
    console.error('Error searching locations:', err);
    res.status(500).json({ error: 'Failed to search locations' });
  }
}
