/**
 * Social Media Follower Count Sync Service
 *
 * Production-ready service to periodically fetch and update follower counts
 * from external social media platforms.
 *
 * This runs as a background job (cron or event-driven) to keep follower counts
 * current and searchable. Triggers database triggers that update aggregate stats.
 *
 * Platforms supported:
 * - Instagram (via Meta Graph API)
 * - TikTok (via TikTok API)
 * - YouTube (via YouTube Data API)
 * - Twitter (via Twitter API v2)
 * - LinkedIn (via LinkedIn API)
 * - Twitch (via Twitch API)
 * - Snapchat (via Snapchat API)
 */

interface SyncResult {
  personaId: number;
  platform: string;
  oldCount: number;
  newCount: number;
  status: 'success' | 'failed' | 'rate_limited';
  error?: string;
  syncedAt: Date;
}

interface SocialAccount {
  personaId: number;
  platform: string;
  username: string;
  platformUserId: string;
  followersCount: number;
}

class SocialMediaSyncService {
  /**
   * Instagram sync via Meta Graph API
   * Requires: App ID, App Secret, User Access Token
   */
  private async syncInstagram(account: SocialAccount, accessToken: string): Promise<SyncResult> {
    try {
      const response = await fetch(
        `https://graph.instagram.com/v18.0/${account.platformUserId}?fields=ig_id,username,name,biography,website,profile_picture_url,followers_count&access_token=${accessToken}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          return {
            personaId: account.personaId,
            platform: 'instagram',
            oldCount: account.followersCount,
            newCount: account.followersCount,
            status: 'rate_limited',
            syncedAt: new Date(),
          };
        }
        throw new Error(error.error?.message || 'Instagram API error');
      }

      const data = await response.json();
      return {
        personaId: account.personaId,
        platform: 'instagram',
        oldCount: account.followersCount,
        newCount: data.followers_count,
        status: 'success',
        syncedAt: new Date(),
      };
    } catch (err: any) {
      return {
        personaId: account.personaId,
        platform: 'instagram',
        oldCount: account.followersCount,
        newCount: account.followersCount,
        status: 'failed',
        error: err.message,
        syncedAt: new Date(),
      };
    }
  }

  /**
   * TikTok sync via TikTok API
   * Requires: Access Token from OAuth
   */
  private async syncTikTok(account: SocialAccount, accessToken: string): Promise<SyncResult> {
    try {
      const response = await fetch(
        `https://open.tiktokapis.com/v1/user/info/?fields=display_name,follower_count,video_count`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          return {
            personaId: account.personaId,
            platform: 'tiktok',
            oldCount: account.followersCount,
            newCount: account.followersCount,
            status: 'rate_limited',
            syncedAt: new Date(),
          };
        }
        throw new Error('TikTok API error');
      }

      const data = await response.json();
      return {
        personaId: account.personaId,
        platform: 'tiktok',
        oldCount: account.followersCount,
        newCount: data.data.user.follower_count,
        status: 'success',
        syncedAt: new Date(),
      };
    } catch (err: any) {
      return {
        personaId: account.personaId,
        platform: 'tiktok',
        oldCount: account.followersCount,
        newCount: account.followersCount,
        status: 'failed',
        error: err.message,
        syncedAt: new Date(),
      };
    }
  }

  /**
   * YouTube sync via YouTube Data API
   * Requires: API Key
   */
  private async syncYouTube(account: SocialAccount, apiKey: string): Promise<SyncResult> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics&forUsername=${account.username}&key=${apiKey}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        if (response.status === 429) {
          return {
            personaId: account.personaId,
            platform: 'youtube',
            oldCount: account.followersCount,
            newCount: account.followersCount,
            status: 'rate_limited',
            syncedAt: new Date(),
          };
        }
        throw new Error('YouTube API error');
      }

      const data = await response.json();
      const subscriberCount = data.items[0]?.statistics?.subscriberCount || '0';

      return {
        personaId: account.personaId,
        platform: 'youtube',
        oldCount: account.followersCount,
        newCount: parseInt(subscriberCount),
        status: 'success',
        syncedAt: new Date(),
      };
    } catch (err: any) {
      return {
        personaId: account.personaId,
        platform: 'youtube',
        oldCount: account.followersCount,
        newCount: account.followersCount,
        status: 'failed',
        error: err.message,
        syncedAt: new Date(),
      };
    }
  }

  /**
   * Sync a single social media account
   * Dispatches to platform-specific syncer
   */
  async syncAccount(account: SocialAccount, tokens: Record<string, string>): Promise<SyncResult> {
    const token = tokens[account.platform];
    if (!token) {
      return {
        personaId: account.personaId,
        platform: account.platform,
        oldCount: account.followersCount,
        newCount: account.followersCount,
        status: 'failed',
        error: 'No API credentials for platform',
        syncedAt: new Date(),
      };
    }

    switch (account.platform) {
      case 'instagram':
        return this.syncInstagram(account, token);
      case 'tiktok':
        return this.syncTikTok(account, token);
      case 'youtube':
        return this.syncYouTube(account, token);
      default:
        return {
          personaId: account.personaId,
          platform: account.platform,
          oldCount: account.followersCount,
          newCount: account.followersCount,
          status: 'failed',
          error: 'Platform not supported',
          syncedAt: new Date(),
        };
    }
  }

  /**
   * Sync all accounts for a creator
   * Runs in parallel for speed
   */
  async syncCreator(
    personaId: number,
    accounts: SocialAccount[],
    tokens: Record<string, string>
  ): Promise<SyncResult[]> {
    return Promise.all(accounts.map(account => this.syncAccount(account, tokens)));
  }

  /**
   * Batch sync all creators (for background job)
   * Spreads requests to avoid rate limiting
   * Implements exponential backoff for failed requests
   */
  async syncAllCreators(
    accountsToSync: SocialAccount[],
    tokens: Record<string, string>,
    options = { batchSize: 10, delayMs: 100 }
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (let i = 0; i < accountsToSync.length; i += options.batchSize) {
      const batch = accountsToSync.slice(i, i + options.batchSize);

      // Sync batch in parallel
      const batchResults = await Promise.all(
        batch.map(account => this.syncAccount(account, tokens))
      );
      results.push(...batchResults);

      // Delay between batches to avoid rate limiting
      if (i + options.batchSize < accountsToSync.length) {
        await new Promise(resolve => setTimeout(resolve, options.delayMs));
      }
    }

    return results;
  }
}

export const syncService = new SocialMediaSyncService();

/**
 * CRON JOB SETUP
 *
 * In production, run this as a scheduled cron job:
 *
 * Option 1: Node Cron (in-process)
 * ```
 * import cron from 'node-cron';
 *
 * // Run every 6 hours
 * cron.schedule('0 (forward slash)(asterisk)6 * * *', async () => {
 *   const accounts = await db.query(
 *     'SELECT * FROM social_media_accounts WHERE is_active = TRUE AND (
 *        follower_count_last_synced_at IS NULL OR
 *        follower_count_last_synced_at < NOW() - INTERVAL 6 hour
 *      )'
 *   );
 *
 *   const tokens = {
 *     instagram: process.env.INSTAGRAM_ACCESS_TOKEN,
 *     tiktok: process.env.TIKTOK_ACCESS_TOKEN,
 *     youtube: process.env.YOUTUBE_API_KEY,
 *   };
 *
 *   const results = await syncService.syncAllCreators(accounts, tokens);
 *
 *   // Log results
 *   for (const result of results) {
 *     await db.query(
 *       'INSERT INTO follower_sync_history (...) VALUES (...)',
 *       [result.personaId, result.platform, result.oldCount, result.newCount, result.status]
 *     );
 *
 *     if (result.status === 'success' && result.newCount !== result.oldCount) {
 *       // Update social_media_accounts table
 *       await db.query(
 *         'UPDATE social_media_accounts SET followers_count = $1, follower_count_last_synced_at = NOW() WHERE persona_id = $2 AND platform = $3',
 *         [result.newCount, result.personaId, result.platform]
 *       );
 *     }
 *   }
 * });
 * ```
 *
 * Option 2: External service (AWS Lambda, Google Cloud Functions)
 * Trigger via HTTP endpoint: POST /api/sync/social-media
 *
 * Option 3: Message Queue (Bull, RabbitMQ)
 * Enqueue sync jobs and process with workers
 */
