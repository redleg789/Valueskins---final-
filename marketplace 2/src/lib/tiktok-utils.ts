export function isValidTiktokUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!u.hostname.includes('tiktok.com')) return false;

    // Web URLs: https://www.tiktok.com/@handle/video/1234567890
    if (/^\/@[^/]+\/video\/[0-9]+/.test(u.pathname)) {
      return true;
    }

    // Short links: https://vm.tiktok.com/XXXXXXXXX
    if (u.hostname === 'vm.tiktok.com' && u.pathname.length > 1) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function extractTiktokVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/video\/([0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function formatTiktokProfileUrl(handle: string): string {
  const clean = handle.startsWith('@') ? handle.slice(1) : handle;
  return `https://www.tiktok.com/@${clean}`;
}

export function formatPublicProfileUrl(handle: string): string {
  const clean = handle.startsWith('@') ? handle.slice(1) : handle;
  return `https://valueskins.com/@${clean}`;
}

