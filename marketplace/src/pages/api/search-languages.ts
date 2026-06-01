import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.length < 1) return res.status(200).json({ languages: [] });

    const query_lower = q.toLowerCase();

    const countriesRes = await fetch('https://restcountries.com/v3.1/all');
    if (!countriesRes.ok) return res.status(500).json({ error: 'Failed to fetch data' });

    const countries = await countriesRes.json();
    const languagesSet = new Set<string>();

    for (const country of countries) {
      if (country.languages && typeof country.languages === 'object') {
        for (const lang of Object.values(country.languages)) {
          if (typeof lang === 'string') {
            languagesSet.add(lang);
          }
        }
      }
    }

    const allLanguages = Array.from(languagesSet).sort();
    const results = allLanguages.filter(lang => lang.toLowerCase().includes(query_lower));

    return res.status(200).json({ languages: results.slice(0, 100) });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ languages: [] });
  }
}

export default withApiHandler(handler);
