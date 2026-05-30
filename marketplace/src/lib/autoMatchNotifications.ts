// Send notifications to auto-matched creators when a brand creates a deal

import { AutoMatchResult } from './autoMatch';

export interface CreatorNotification {
  id: string;
  creatorHandle: string;
  campaignId: number;
  campaignTitle: string;
  brandName: string;
  matchScore: number;
  reasons: string[];
  timestamp: string;
  read: boolean;
  action: 'matched' | 'applied' | 'accepted' | 'rejected';
}

/**
 * Send auto-match notifications to creators
 * In production, this would send push notifications + in-app notifications
 */
export function sendAutoMatchNotifications(
  campaignId: number,
  campaignTitle: string,
  brandName: string,
  matchedCreators: AutoMatchResult[]
): CreatorNotification[] {
  const notifications: CreatorNotification[] = [];

  for (const match of matchedCreators) {
    const notification: CreatorNotification = {
      id: `notif_${Date.now()}_${match.creatorHandle}`,
      creatorHandle: match.creatorHandle,
      campaignId,
      campaignTitle,
      brandName,
      matchScore: match.matchScore,
      reasons: match.reasons,
      timestamp: new Date().toISOString(),
      read: false,
      action: 'matched',
    };

    notifications.push(notification);

    // In production:
    // - Store in database
    // - Send push notification via Firebase
    // - Send in-app notification via WebSocket
    // - Log to analytics: "Creator X matched with Brand Y at 87% score"
  }

  return notifications;
}

/**
 * Generate notification message for creator
 */
export function getNotificationMessage(notif: CreatorNotification): string {
  return `${notif.brandName} has a ${notif.campaignTitle} opportunity for you (${notif.matchScore}% match)`;
}

/**
 * Create a one-click apply link for auto-matched creators
 * They click "View Deal" → see details → "Apply" → application sent
 */
export function getAutoMatchActionUrl(campaignId: number): string {
  return `/demo/marketplace?campaign=${campaignId}&action=auto-matched`;
}

/**
 * Track auto-match metrics (for analytics)
 */
export interface AutoMatchMetrics {
  campaignId: number;
  campaignTitle: string;
  totalMatchesFound: number;
  applicationsReceived: number;
  acceptanceRate: number;
  avgMatchScore: number;
  conversionTime: number; // ms from notification to application
}

/**
 * Calculate conversion metrics
 */
export function calculateAutoMatchMetrics(
  campaignId: number,
  campaignTitle: string,
  matchedCount: number,
  applicationsCount: number,
  avgScore: number
): AutoMatchMetrics {
  return {
    campaignId,
    campaignTitle,
    totalMatchesFound: matchedCount,
    applicationsReceived: applicationsCount,
    acceptanceRate: matchedCount > 0 ? (applicationsCount / matchedCount) * 100 : 0,
    avgMatchScore: avgScore,
    conversionTime: 0, // Would be calculated from timestamps
  };
}
