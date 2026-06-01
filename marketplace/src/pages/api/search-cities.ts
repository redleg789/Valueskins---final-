import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') return res.status(400).json({ error: 'Query required' });

    const query = q.toLowerCase();

    const citiesRes = await fetch('https://restcountries.com/v3.1/all', {
      headers: { Accept: 'application/json' }
    });

    if (!citiesRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch countries' });
    }

    const countries = await citiesRes.json();
    const results: any[] = [];

    for (const country of countries) {
      const name = country.name?.common || '';
      const code = country.cca2 || '';

      if (name.toLowerCase().includes(query)) {
        results.push({
          city: name,
          country: name,
          countryCode: code,
          region: country.region || 'Unknown'
        });
      }

      if (results.length >= 50) break;
    }

    try {
      const citiesDbRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=50`);
      if (citiesDbRes.ok) {
        const cities = await citiesDbRes.json();
        for (const city of cities) {
          if (city.address?.city || city.address?.town || city.address?.village) {
            const cityName = city.address.city || city.address.town || city.address.village;
            const countryName = city.address.country || '';
            
            if (!results.find(r => r.city.toLowerCase() === cityName.toLowerCase())) {
              results.push({
                city: cityName,
                country: countryName,
                countryCode: city.address.country_code?.toUpperCase() || '',
                region: city.address.state || ''
              });
            }

            if (results.length >= 100) break;
          }
        }
      }
    } catch (err) {
      console.error('Nominatim error:', err);
    }

    return res.status(200).json({ cities: results.slice(0, 100) });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
}

export default withApiHandler(handler);
