export type ConsentChoice = 'accepted' | 'rejected' | 'pending';

export interface CookiePreferences {
  essential: boolean; // Always true, can't be rejected
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

const CONSENT_KEY = 'valueskins_cookie_consent';
const PREFERENCES_KEY = 'valueskins_cookie_preferences';

export const cookieConsent = {
  // Get user's consent choice
  getChoice(): ConsentChoice {
    if (typeof window === 'undefined') return 'pending';
    const choice = localStorage.getItem(CONSENT_KEY);
    return (choice as ConsentChoice) || 'pending';
  },

  // Get detailed preferences
  getPreferences(): CookiePreferences {
    if (typeof window === 'undefined') {
      return {
        essential: true,
        analytics: false,
        marketing: false,
        preferences: false,
      };
    }

    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }

    return {
      essential: true, // Always required
      analytics: false,
      marketing: false,
      preferences: false,
    };
  },

  // Accept all cookies
  acceptAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CONSENT_KEY, 'accepted');
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        essential: true,
        analytics: true,
        marketing: true,
        preferences: true,
      })
    );
    window.dispatchEvent(new Event('cookie-consent-changed'));
  },

  // Reject non-essential cookies
  rejectAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CONSENT_KEY, 'rejected');
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        essential: true,
        analytics: false,
        marketing: false,
        preferences: false,
      })
    );
    window.dispatchEvent(new Event('cookie-consent-changed'));
  },

  // Set custom preferences
  setPreferences(prefs: Partial<CookiePreferences>): void {
    if (typeof window === 'undefined') return;
    const current = this.getPreferences();
    const updated = { ...current, essential: true, ...prefs };
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
    localStorage.setItem(
      CONSENT_KEY,
      updated.analytics || updated.marketing ? 'accepted' : 'rejected'
    );
    window.dispatchEvent(new Event('cookie-consent-changed'));
  },

  // Check if specific cookie type is allowed
  isAllowed(type: 'analytics' | 'marketing' | 'preferences'): boolean {
    const prefs = this.getPreferences();
    return prefs[type] === true;
  },

  // Clear consent (user can reset)
  reset(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CONSENT_KEY);
    localStorage.removeItem(PREFERENCES_KEY);
    window.dispatchEvent(new Event('cookie-consent-changed'));
  },
};

// Hook to use in React components
export function useCookieConsent() {
  const [choice, setChoice] = React.useState<ConsentChoice>('pending');
  const [prefs, setPrefs] = React.useState<CookiePreferences>(
    cookieConsent.getPreferences()
  );

  React.useEffect(() => {
    setChoice(cookieConsent.getChoice());
    setPrefs(cookieConsent.getPreferences());

    const handleChange = () => {
      setChoice(cookieConsent.getChoice());
      setPrefs(cookieConsent.getPreferences());
    };

    window.addEventListener('cookie-consent-changed', handleChange);
    return () => window.removeEventListener('cookie-consent-changed', handleChange);
  }, []);

  return { choice, prefs };
}
