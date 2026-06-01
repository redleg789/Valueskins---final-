import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';
import crypto from 'crypto';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId, fileName, fileUrl } = req.body;
    if (!dealId || !fileName || !fileUrl) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const fileId = crypto.randomUUID();
    await query(
      `INSERT INTO deal_files (id, deal_id, file_name, file_url, uploaded_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [fileId, dealId, fileName, fileUrl]
    );

    return res.status(200).json({ fileId, success: true });
  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
}

export default withApiHandler(handler);
