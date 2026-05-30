export const MAX_FEED_POSTS_PER_PAGE = 10;
export const NOTIFICATION_HOUR_START = 8;
export const NOTIFICATION_HOUR_END = 21;

export function shouldShowLoadMore(offset: number): boolean {
  return offset > 0;
}

export function getNotificationThrottle(): number {
  const now = new Date();
  const hour = now.getHours();
  if (hour < NOTIFICATION_HOUR_START || hour > NOTIFICATION_HOUR_END) {
    return 0;
  }
  return 3600000;
}
