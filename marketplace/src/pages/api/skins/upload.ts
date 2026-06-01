import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, profession, userId } = req.body;

    if (!imageBase64 || !profession || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For now, return the base64 as a data URL (can be stored in DB later)
    return res.status(200).json({
      success: true,
      imageUrl: imageBase64,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
