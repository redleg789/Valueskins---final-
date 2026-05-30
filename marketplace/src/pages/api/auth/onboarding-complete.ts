import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface OnboardingPayload {
  role: 'creator' | 'brand';
  bio: string;
  location: {
    city: string;
    country: string;
    countryCode: string;
  };
  interests: string[];
  skills: string[];
  languages: string[];
  contentTypes: string[];
  audienceAge: string;
  audienceGender: string;
  experienceLevel: string;
  socialMediaAccounts: Array<{
    platform: string;
    username: string;
    followerCount: number;
  }>;
  collaborationOpen: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let userId: number = 0;

  try {
    const payload: OnboardingPayload = req.body;

    // Try multiple ways to get user ID
    // 1. From x-user-id header
    const userIdHeader = req.headers['x-user-id'];
    if (userIdHeader) {
      userId = parseInt(userIdHeader as string, 10);
      if (!isNaN(userId)) {
        // Validate user exists
        const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length > 0) {
          // User found, continue
        } else {
          return res.status(404).json({ error: 'User not found in database' });
        }
      }
    }

    // 2. From session cookie
    const sessionToken = req.cookies.valueskins_session;
    if (!userId && sessionToken) {
      const sessionResult = await query(
        'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = true AND expires_at > NOW()',
        [sessionToken]
      );

      if (sessionResult.rows.length > 0) {
        userId = sessionResult.rows[0].user_id;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'No valid authentication found. Please log in again.' });
    }

    // Validation - lenient, allow defaults
    if (!payload.role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    if (!payload.location?.city || !payload.location?.country) {
      return res.status(400).json({ error: 'Location (city & country) is required' });
    }

    // Bio is optional, can be filled later
    // Interests/skills can be empty, filled later
    // Social accounts optional for initial onboarding

    // Get the user's account
    const userResult = await query(
      'SELECT account_id FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accountId = userResult.rows[0].account_id;

    // Get main social media info (optional)
    const mainAccount = payload.socialMediaAccounts?.find((a: any) => a.username);
    const mainFollowers = mainAccount?.followerCount || 0;

    // Update user profile - handle instagram/tiktok/youtube separately
    const updates: any = {
      bio: payload.bio || '',
      location: payload.location.city,
      country: payload.location.country,
      followers_count: mainFollowers,
      niche: payload.contentTypes?.join(', ') || '',
    };

    if (mainAccount?.platform === 'instagram') {
      updates.instagram_handle = mainAccount.username;
      updates.main_platform = 'instagram';
    } else if (mainAccount?.platform === 'tiktok') {
      updates.tiktok_handle = mainAccount.username;
      updates.main_platform = 'tiktok';
    } else if (mainAccount?.platform === 'youtube') {
      updates.youtube_handle = mainAccount.username;
      updates.main_platform = 'youtube';
    }

    const updateFields = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const updateValues = [...Object.values(updates), userId];

    await query(
      `UPDATE users SET ${updateFields}, updated_at = NOW() WHERE id = $${updateValues.length}`,
      updateValues
    );

    // Update account onboarding stage
    await query(
      'UPDATE accounts SET onboarding_stage = $1 WHERE id = $2',
      ['complete', accountId]
    );

    // Activate the appropriate module
    const moduleCode = payload.role === 'brand' ? 'brand' : 'valueskin';

    // Check if module exists
    const moduleCheck = await query(
      'SELECT id FROM account_modules WHERE account_id = $1 AND module_code = $2',
      [accountId, moduleCode]
    );

    if (moduleCheck.rows.length === 0) {
      // Create the module entry
      await query(
        `INSERT INTO account_modules (account_id, module_code, is_active, activated_at)
         VALUES ($1, $2, true, NOW())`,
        [accountId, moduleCode]
      );
    } else {
      // Activate if not already active
      await query(
        'UPDATE account_modules SET is_active = true, activated_at = NOW() WHERE account_id = $1 AND module_code = $2',
        [accountId, moduleCode]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Profile setup complete',
      role: payload.role,
    });
  } catch (err: any) {
    console.error('Error completing onboarding:', {
      message: err.message,
      code: err.code,
      stack: err.stack,
      userId,
    });
    res.status(500).json({
      error: 'Failed to save profile',
      detail: err.message,
      debug: process.env.NODE_ENV === 'development' ? err.code : undefined,
    });
  }
}
