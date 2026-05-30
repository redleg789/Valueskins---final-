const DEMO_TOKEN_KEY = 'vs_demo_token';

export function getDemoToken(): string {
  if (typeof window === 'undefined') return 'demo-token';
  return localStorage.getItem(DEMO_TOKEN_KEY) || 'demo-token';
}

export function setDemoToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_TOKEN_KEY, token);
}

export function clearDemoSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEMO_TOKEN_KEY);
}
