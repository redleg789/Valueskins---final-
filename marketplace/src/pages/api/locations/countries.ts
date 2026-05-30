import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * GET /api/locations/countries
 * Returns list of all countries with codes
 *
 * In production, this should:
 * 1. Load from world-cities library: npm install world-cities
 * 2. Cache in memory/Redis for fast access
 * 3. Return frequently-used countries first
 */

interface CountryResponse {
  code: string;
  name: string;
  population?: number;
}

// For now, return a curated list of major countries
// In production, load from world-cities library
const MAJOR_COUNTRIES: CountryResponse[] = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AE', name: 'United Arab Emirates' },
  // Add more as needed
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // TODO: In production, load all countries from world-cities library
    // const allCountries = await loadWorldCities();
    // Sort by frequency (most popular creators first)
    // Cache for 24 hours

    res.status(200).json(MAJOR_COUNTRIES);
  } catch (err: any) {
    console.error('Error fetching countries:', err);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
}
