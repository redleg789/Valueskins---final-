import { NextApiRequest, NextApiResponse } from 'next';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const {
      role,
      bio,
      location,
      interests,
      skills,
      languages,
      contentTypes,
      audienceAge,
      experienceLevel,
      socialMediaAccounts,
      collaborationOpen,
      creatorProfile,
    } = req.body;

    await query(
      `UPDATE users SET 
        bio = $1,
        location = $2,
        interests = $3,
        skills = $4,
        languages = $5,
        audience_age = $6,
        experience_level = $7,
        collaboration_open = $8,
        profile_data = $9,
        onboarding_completed = TRUE
       WHERE id = $10`,
      [
        bio || '',
        JSON.stringify(location) || '{}',
        JSON.stringify(interests) || '[]',
        JSON.stringify(skills) || '[]',
        JSON.stringify(languages) || '[]',
        audienceAge || '',
        experienceLevel || '',
        collaborationOpen || false,
        JSON.stringify(creatorProfile) || '{}',
        userId,
      ]
    );

    return res.status(200).json({ success: true, message: 'Onboarding completed' });
  } catch (error) {
    console.error('Onboarding error:', error);
    return res.status(500).json({ error: 'Failed to complete onboarding' });
  }
}
