import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * GET /api/locations/cities?country=IN
 * Returns top cities for a country
 *
 * In production:
 * 1. Load from world-cities library (50k+ cities)
 * 2. Cache popular cities per country
 * 3. Return most populated cities first
 */

interface CityResponse {
  cities: string[];
  country: string;
  total: number;
  cached: boolean;
}

// Curated list of major cities per country
// In production, fetch from world-cities library + cache
const CITIES_BY_COUNTRY: Record<string, string[]> = {
  IN: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Chandigarh', 'Indore', 'Visakhapatnam', 'Kochi', 'Nagpur'],
  US: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Miami', 'Seattle', 'Denver', 'Boston'],
  GB: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Sheffield', 'Bristol', 'Edinburgh', 'Liverpool', 'York', 'Cambridge', 'Oxford'],
  CA: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton', 'Winnipeg', 'Quebec City', 'Hamilton', 'Victoria'],
  AU: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Newcastle', 'Canberra', 'Hobart', 'Darwin'],
  SG: ['Singapore'],
  JP: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kawasaki', 'Saitama'],
  KR: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Ulsan'],
  DE: ['Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig'],
  FR: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Bordeaux', 'Lille', 'Rennes'],
  BR: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Recife', 'Porto Alegre'],
  MX: ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Cancún', 'Playa del Carmen', 'Culiacán', 'Saltillo'],
  AE: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'],
};

export default function handler(req: NextApiRequest, res: NextApiResponse<CityResponse | { error: string }>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { country } = req.query;

  if (!country || typeof country !== 'string') {
    return res.status(400).json({ error: 'country parameter required' });
  }

  try {
    const countryCode = country.toUpperCase();
    const cities = CITIES_BY_COUNTRY[countryCode] || [];

    // TODO: In production
    // 1. Load from world-cities library
    // 2. Check Redis cache first
    // 3. Cache result for 24 hours
    // 4. Return all available cities, not just top 15

    res.status(200).json({
      cities,
      country: countryCode,
      total: cities.length,
      cached: true,
    });
  } catch (err: any) {
    console.error('Error fetching cities:', err);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
}
