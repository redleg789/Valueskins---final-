import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Just return success - role is already set by registration
    return res.status(200).json({ success: true, message: 'Onboarding completed' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
