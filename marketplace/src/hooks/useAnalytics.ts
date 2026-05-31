import { useEffect } from 'react';
import { cookieConsent } from '@/lib/cookie-consent';

/**
 * Hook to conditionally load analytics based on user consent
 * Usage: useAnalytics('google') in _app.tsx
 */
export function useAnalytics(provider: 'google' | 'mixpanel' | 'amplitude') {
  useEffect(() => {
    // Only load if user has consented to analytics
    if (!cookieConsent.isAllowed('analytics')) {
      console.log(`Analytics (${provider}) blocked - user has not consented`);
      return;
    }

    // Load Google Analytics
    if (provider === 'google') {
      loadGoogleAnalytics();
    }

    // Load Mixpanel
    if (provider === 'mixpanel') {
      loadMixpanel();
    }

    // Load Amplitude
    if (provider === 'amplitude') {
      loadAmplitude();
    }

    // Listen for consent changes
    const handleConsentChange = () => {
      if (cookieConsent.isAllowed('analytics')) {
        console.log(`Analytics (${provider}) enabled - user consented`);
        if (provider === 'google') loadGoogleAnalytics();
      } else {
        console.log(`Analytics (${provider}) disabled - user revoked consent`);
      }
    };

    window.addEventListener('cookie-consent-changed', handleConsentChange);
    return () => window.removeEventListener('cookie-consent-changed', handleConsentChange);
  }, [provider]);
}

function loadGoogleAnalytics() {
  if (typeof window === 'undefined') return;
  if (window.gtag) return;

  const ga_id = process.env.NEXT_PUBLIC_GA_ID;
  if (!ga_id) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ga_id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', ga_id);
}

function loadMixpanel() {
  if (typeof window === 'undefined') return;
  if ((window as any).mixpanel) return;

  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) return;

  const script = document.createElement('script');
  script.textContent = `(function(e,b){if(!b.__SV){var a,f,i,g;window.mixpanel=b;b._i=[];b.init=function(a,e,d){function f(b,h){var a=h.split(".");2==a.length&&(b=b[a[0]],h=a[1]);b[h]=function(){b.push([h].concat(Array.prototype.slice.call(arguments,0)))}}var c=b;"undefined"!=typeof d?c=b[d]=[]:d="mixpanel";c.people=c.people||[];c.toString=function(b){var a="mixpanel";"undefined"!=typeof d&&"mixpanel"!=d&&(a+="."+d);b||(a+=" (stub)");return a};c.people.toString=function(){return c.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_tracking_cookie clear_opt_out_tracking_cookie".split(" ");for(g=0;g<i.length;g++)f(c,i[g]);b._i.push([a,e,d])};b.__SV=1.2;}})(document,window.mixpanel||[]);mixpanel.init("${token}");`;
  document.head.appendChild(script);
}

function loadAmplitude() {
  if (typeof window === 'undefined') return;
  if ((window as any).amplitude) return;

  const token = process.env.NEXT_PUBLIC_AMPLITUDE_TOKEN;
  if (!token) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://cdn.amplitude.com/libs/amplitude-8.17.0-min.js.gz';
  script.onload = () => {
    (window as any).amplitude.getInstance().init(token);
  };
  document.head.appendChild(script);
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    mixpanel?: any;
  }
}
