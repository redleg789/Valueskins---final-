import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { queryOne, query } from '@/lib/db-pool';
import crypto from 'crypto';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;

  if (req.method === 'POST') {
    // Send verification email
    try {
      const sessionToken = req.cookies.valueskins_session;
      if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

      const session = await queryOne(
        'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE',
        [sessionToken]
      );
      if (!session) return res.status(401).json({ error: 'Session expired' });

      const user = await queryOne('SELECT email, email_verified FROM users WHERE id = $1', [session.user_id]);

      if (user.email_verified) {
        return res.status(200).json({ message: 'Email already verified' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await query(
        `INSERT INTO email_verifications (user_id, token, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3`,
        [session.user_id, token, expiresAt]
      );

      // TODO: Send email with verification link
      // For now, log the token
      console.log(`Verification link: /verify-email?token=${token}`);

      return res.status(200).json({ message: 'Verification email sent' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to send verification' });
    }
  }

  if (req.method === 'GET') {
    // Verify email token
    try {
      const { token } = req.query;
      if (!token) return res.status(400).json({ error: 'Token required' });

      const verification = await queryOne(
        'SELECT user_id, expires_at FROM email_verifications WHERE token = $1',
        [token]
      );

      if (!verification) return res.status(404).json({ error: 'Invalid token' });
      if (new Date(verification.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Token expired' });
      }

      // Mark email as verified
      await query('UPDATE users SET email_verified = TRUE WHERE id = $1', [verification.user_id]);
      await query('DELETE FROM email_verifications WHERE user_id = $1', [verification.user_id]);

      return res.status(200).json({ message: 'Email verified successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Verification failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withApiHandler(handler);
