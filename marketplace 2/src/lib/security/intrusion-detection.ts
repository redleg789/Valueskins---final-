import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

interface AnomalyScore {
  score: number;
  factors: string[];
  isAnomaly: boolean;
}

interface UserBehavior {
  lastSeenIp: string;
  lastSeenUserAgent: string;
  avgRequestsPerHour: number;
  lastActivityTime: number;
  countries: Set<string>;
  devices: Set<string>;
}

const userProfiles = new Map<string, UserBehavior>();

const ANOMALY_THRESHOLD = 7; // out of 10

export function calculateAnomalyScore(req: NextApiRequest, userId: string): AnomalyScore {
  const factors: string[] = [];
  let score = 0;

  const currentIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
  const currentUserAgent = req.headers['user-agent'] || '';
  const now = Date.now();

  const profile = userProfiles.get(userId);

  if (!profile) {
    userProfiles.set(userId, {
      lastSeenIp: currentIp,
      lastSeenUserAgent: currentUserAgent,
      avgRequestsPerHour: 1,
      lastActivityTime: now,
      countries: new Set(),
      devices: new Set(),
    });

    return { score: 0, factors: ['new_user'], isAnomaly: false };
  }

  // IP change detection
  if (profile.lastSeenIp !== currentIp) {
    score += 3;
    factors.push('ip_changed');
    profile.lastSeenIp = currentIp;
  }

  // User agent change
  if (profile.lastSeenUserAgent !== currentUserAgent) {
    score += 2;
    factors.push('device_changed');
    profile.lastSeenUserAgent = currentUserAgent;
  }

  // Impossible travel (same user from 2 countries within seconds)
  const timeSinceLastActivity = (now - profile.lastActivityTime) / 1000;
  if (timeSinceLastActivity < 60 && profile.lastSeenIp !== currentIp) {
    score += 4;
    factors.push('impossible_travel');
  }

  // Unusual time of day (if user usually active during business hours, late night access)
  const hour = new Date().getHours();
  if ((hour < 6 || hour > 22) && profile.avgRequestsPerHour > 10) {
    score += 1;
    factors.push('unusual_time');
  }

  // Rapid request pattern
  if (profile.avgRequestsPerHour > 100) {
    score += 2;
    factors.push('high_velocity');
  }

  profile.lastActivityTime = now;

  return {
    score: Math.min(score, 10),
    factors,
    isAnomaly: score >= ANOMALY_THRESHOLD,
  };
}

export function intrusionDetection(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    next();
    return;
  }

  const anomaly = calculateAnomalyScore(req, userId);

  res.setHeader('X-Anomaly-Score', anomaly.score.toString());

  if (anomaly.isAnomaly) {
    console.warn(`INTRUSION ALERT: User ${userId}`, anomaly.factors);

    if (anomaly.score >= 9) {
      res.status(403).json({
        error: 'Suspicious activity detected. Please verify your identity.',
        challengeRequired: true,
      });
      return;
    }

    res.setHeader('X-Security-Challenge', 'true');
  }

  next();
}

export function clearOldProfiles() {
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

  for (const [userId, profile] of userProfiles.entries()) {
    if (now - profile.lastActivityTime > maxAge) {
      userProfiles.delete(userId);
    }
  }
}

setInterval(clearOldProfiles, 24 * 60 * 60 * 1000);
