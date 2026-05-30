import { query } from '@/lib/db';

export async function getSessionUserId(cookie: string): Promise<number | null> {
  const match = cookie.match(/valueskins_session=([^;]+)/);
  if (!match) return null;

  const sessionToken = match[1];

  const result = await query(
    `SELECT user_id FROM auth_sessions
     WHERE id = $1 AND is_active = true AND expires_at > NOW()`,
    [sessionToken]
  );

  if (result.rows.length === 0) return null;
  return Number(result.rows[0].user_id);
}

export async function getAccountId(cookie: string): Promise<number | null> {
  const userId = await getSessionUserId(cookie);
  if (!userId) return null;

  const result = await query(
    'SELECT account_id FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length > 0 && result.rows[0].account_id) {
    return Number(result.rows[0].account_id);
  }

  const uResult = await query(
    'SELECT username, display_name FROM users WHERE id = $1',
    [userId]
  );
  const displayName = uResult.rows[0]?.display_name || uResult.rows[0]?.username || `User-${userId}`;

  const aResult = await query(
    'INSERT INTO accounts (display_name) VALUES ($1) RETURNING id',
    [displayName]
  );
  const accountId = aResult.rows[0].id;

  await query(
    'UPDATE users SET account_id = $1 WHERE id = $2',
    [accountId, userId]
  );

  return Number(accountId);
}

export async function getUserDisplay(userId: number): Promise<string> {
  const result = await query(
    'SELECT display_name, username FROM users WHERE id = $1',
    [userId]
  );
  if (result.rows.length === 0) return 'User';
  return result.rows[0].display_name || result.rows[0].username || 'User';
}
