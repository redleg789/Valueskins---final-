'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { searchCities } from '@/config/cities';
import { C } from '@/theme/colors';

type Step = 'identity' | 'social' | 'content' | 'languages' | 'deal-prefs' | 'pricing' | 'availability' | 'review';

interface CreatorOnboarding {
  // Identity
  displayName: string;
  location: { city: string; country: string; countryCode: string };
  timezone: string;
  languages: string[];
  ageRange: string;

  // Social presence
  socialAccounts: Array<{
    platform: string;
    username: string;
    followerCount: number;
    engagementRate: number;
    audienceDemographics: { ageRanges: string[]; genders: string[] };
  }>;
  website?: string;

  // Content identity
  niches: string[];
  contentStyle: string;
  tone: string;
  keywords: string[];
  archetype: string;
  introVideoUrl?: string;

  // Deal preferences
  collaborationOpenness: 'open' | 'selective' | 'closed';
  dealTypes: string[]; // sponsored post, product placement, UGC, affiliate, etc.

  // Pricing
  rateCard: { [key: string]: number }; // by content type
  minDealValue: number;
  negotiable: boolean;

  // Availability
  workingHours: { start: string; end: string };
  shootAvailability: string[]; // days of week
  travelWilling: boolean;
  travelBudget?: string;

  // Operations & equipment
  turnaroundDays: number;
  revisionLimit: number;
  communicationStyle: string;
  equipment: string[];
  hasStudio: boolean;

  // Agency memory layer
  personalPreferences: {
    clothingSizes?: string;
    foodAllergies?: string;
    hotelPreferences?: string;
    flightClass?: string;
    accessibility?: string;
  };

  // Trust & portfolio
  previousCampaigns: Array<{ brand: string; contentType: string; date: string; link?: string }>;
  testimonials: string[];
  exclusivityRestrictions: string[];
}

export default function OnboardingCreator() {
  const router = useRouter();
  const { userId: userIdParam } = router.query;
  const [step, setStep] = useState<Step>('identity');
  const [loading, setLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  const [languageSuggestions, setLanguageSuggestions] = useState<string[]>([]);

  const [data, setData] = useState<CreatorOnboarding>({
    displayName: '',
    location: { city: '', country: '', countryCode: '' },
    timezone: 'UTC',
    languages: [],
    ageRange: '',
    socialAccounts: [{ platform: 'instagram', username: '', followerCount: 0, engagementRate: 0, audienceDemographics: { ageRanges: [], genders: [] } }],
    niches: [],
    contentStyle: '',
    tone: '',
    keywords: [],
    archetype: '',
    collaborationOpenness: 'open',
    dealTypes: [],
    rateCard: {},
    minDealValue: 0,
    negotiable: true,
    workingHours: { start: '09:00', end: '18:00' },
    shootAvailability: [],
    travelWilling: false,
    turnaroundDays: 7,
    revisionLimit: 2,
    communicationStyle: 'professional',
    equipment: [],
    hasStudio: false,
    personalPreferences: {},
    previousCampaigns: [],
    testimonials: [],
    exclusivityRestrictions: [],
  });

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const userId = localStorage.getItem('user_id') || userIdParam;
      if (!userId) return;

      try {
        await fetch('/api/auth/onboarding-draft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId as string,
          },
          body: JSON.stringify({ role: 'creator', data, step, lastSavedStep: step }),
        });
        setLastSaved(new Date());
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [data, step, userIdParam]);

  // Load draft on mount
  useEffect(() => {
    if (userIdParam) {
      localStorage.setItem('user_id', userIdParam as string);
      loadDraft(userIdParam as string);
    }
  }, [userIdParam]);

  const loadDraft = async (userId: string) => {
    try {
      const res = await fetch('/api/auth/onboarding-draft', {
        headers: { 'x-user-id': userId },
      });
      if (res.ok) {
        const draft = await res.json();
        setData(draft.data);
        if (draft.lastSavedStep) setStep(draft.lastSavedStep);
      }
    } catch (err) {
      console.error('Failed to load draft:', err);
    }
  };

  const steps: Step[] = ['identity', 'social', 'content', 'languages', 'deal-prefs', 'pricing', 'availability', 'review'];
  const currentStepIndex = steps.indexOf(step);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const userId = localStorage.getItem('user_id') || userIdParam;
      const res = await fetch('/api/auth/onboarding-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId as string,
        },
        credentials: 'include',
        body: JSON.stringify({
          role: 'creator',
          bio: `${data.displayName} - ${data.niches.join(', ')}`,
          location: data.location,
          interests: data.niches,
          skills: data.equipment,
          languages: data.languages,
          contentTypes: Object.keys(data.rateCard),
          audienceAge: data.ageRange,
          audienceGender: '',
          experienceLevel: data.archetype,
          socialMediaAccounts: data.socialAccounts,
          collaborationOpen: data.collaborationOpenness !== 'closed',
          creatorProfile: data,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to complete onboarding');
      }

      // Delete draft
      await fetch('/api/auth/onboarding-draft', {
        method: 'DELETE',
        headers: { 'x-user-id': userId as string },
      }).catch(() => {});

      router.push('/demo/marketplace');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  const fillDemoData = () => {
    setData({
      ...data,
      displayName: 'Demo Creator',
      location: { city: 'Mumbai', country: 'India', countryCode: 'IN' },
      timezone: 'IST',
      languages: ['English', 'Hindi'],
      ageRange: '25-34',
      socialAccounts: [{
        platform: 'instagram',
        username: 'democreator',
        followerCount: 50000,
        engagementRate: 5.2,
        audienceDemographics: { ageRanges: ['18-24', '25-34'], genders: ['Female', 'Male'] }
      }],
      niches: ['Fashion', 'Lifestyle'],
      contentStyle: 'Minimalist',
      tone: 'Friendly',
      keywords: ['sustainable', 'eco-friendly'],
      archetype: 'lifestyle',
      collaborationOpenness: 'open',
      dealTypes: ['sponsored post', 'product placement'],
      rateCard: { post: 5000, story: 2000, reel: 7500 },
      minDealValue: 1000,
      negotiable: true,
      workingHours: { start: '09:00', end: '18:00' },
      shootAvailability: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      travelWilling: true,
      travelBudget: '5000',
      turnaroundDays: 5,
      revisionLimit: 2,
      communicationStyle: 'professional',
      equipment: ['camera', 'lights', 'tripod'],
      hasStudio: true,
      personalPreferences: { clothingSizes: 'M', foodAllergies: 'None' },
      previousCampaigns: [{ brand: 'Nike', contentType: 'sponsored post', date: '2026-01-15' }],
      testimonials: ['Great to work with!'],
      exclusivityRestrictions: ['Competing brands'],
    });
  };

  const handleSkip = () => {
    setShowSkipWarning(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Creator Profile Setup</h1>
          <p style={{ color: C.textSecondary, fontSize: '14px' }}>Complete your profile to unlock brand collaborations. You can finish this later.</p>
          {lastSaved && (
            <div style={{ fontSize: '12px', color: C.success, marginTop: '8px' }}>✓ Saved</div>
          )}
        </div>

        {/* Progress */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
            {steps.map((_, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: '6px',
                  background: idx <= currentStepIndex ? C.primary : C.border,
                  borderRadius: '3px',
                  cursor: idx < currentStepIndex ? 'pointer' : 'default',
                }}
                onClick={() => idx < currentStepIndex && setStep(steps[idx])}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.textSecondary }}>
            <span>Step {currentStepIndex + 1} of {steps.length}</span>
            <span>{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</span>
          </div>
        </div>

        {/* Step Content */}
        <div style={{ background: C.surface, borderRadius: '12px', padding: '24px', marginBottom: '24px', minHeight: '300px' }}>
          {step === 'identity' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Your Identity</h2>
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Display Name</div>
                <input
                  type="text"
                  value={data.displayName}
                  onChange={e => setData({ ...data, displayName: e.target.value })}
                  placeholder="Your public name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Which city are you from?</div>
                <input
                  type="text"
                  defaultValue={data.location.city ? `${data.location.city}, ${data.location.country}` : ''}
                  onChange={e => {
                    const query = e.target.value;
                    if (query.length === 0) {
                      setCitySuggestions([]);
                      return;
                    }
                    const suggestions = searchCities(query);
                    setCitySuggestions(suggestions);
                  }}
                  placeholder="e.g., Mumbai, India or New York, USA"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
                {citySuggestions.length > 0 && (
                  <div style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}>
                    {citySuggestions.slice(0, 10).map((city, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setData({ ...data, location: { city: city.city, country: city.country, countryCode: city.countryCode } });
                          setCitySuggestions([]);
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: C.text,
                          borderBottom: `1px solid ${C.border}`,
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.border}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                      >
                        {city.city}, {city.country}
                      </div>
                    ))}
                  </div>
                )}
              </label>
            </>
          )}

          {step === 'social' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Social Media Presence</h2>
              <p style={{ color: C.textSecondary, fontSize: '13px', marginBottom: '16px' }}>Add your social accounts. These help brands understand your reach.</p>

              {data.socialAccounts.map((acc, idx) => (
                <div key={idx} style={{ marginBottom: '16px', padding: '12px', background: C.bg, borderRadius: '8px' }}>
                  <select
                    value={acc.platform}
                    onChange={e => {
                      const updated = [...data.socialAccounts];
                      updated[idx].platform = e.target.value;
                      setData({ ...data, socialAccounts: updated });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginBottom: '8px',
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                      color: C.text,
                      borderRadius: '6px',
                    }}
                  >
                    <option>Instagram</option>
                    <option>YouTube</option>
                    <option>TikTok</option>
                    <option>X/Twitter</option>
                    <option>LinkedIn</option>
                  </select>
                  <input
                    type="text"
                    placeholder="@username"
                    value={acc.username}
                    onChange={e => {
                      const updated = [...data.socialAccounts];
                      updated[idx].username = e.target.value;
                      setData({ ...data, socialAccounts: updated });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginBottom: '8px',
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                      color: C.text,
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Follower count"
                    value={acc.followerCount || ''}
                    onChange={e => {
                      const updated = [...data.socialAccounts];
                      updated[idx].followerCount = parseInt(e.target.value) || 0;
                      setData({ ...data, socialAccounts: updated });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                      color: C.text,
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  />
                </div>
              ))}
            </>
          )}

          {step === 'content' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Content Identity</h2>
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Your Niches</div>
                <input
                  type="text"
                  placeholder="e.g., Fashion, Beauty, Fitness"
                  value={data.niches.join(', ')}
                  onChange={e => setData({ ...data, niches: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Content Style</div>
                <input
                  type="text"
                  placeholder="e.g., Minimalist, Bold, Educational"
                  value={data.contentStyle}
                  onChange={e => setData({ ...data, contentStyle: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                />
              </label>

              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Archetype</div>
                <select
                  value={data.archetype}
                  onChange={e => setData({ ...data, archetype: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                >
                  <option value="">Select archetype</option>
                  <option value="expert">Expert / Educator</option>
                  <option value="entertainer">Entertainer</option>
                  <option value="lifestyle">Lifestyle Creator</option>
                  <option value="micro">Micro-influencer</option>
                  <option value="thought-leader">Thought Leader</option>
                </select>
              </label>
            </>
          )}

                    {step === 'languages' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Languages You Speak</h2>
              <p style={{ color: C.textSecondary, fontSize: '13px', marginBottom: '16px' }}>Type any language. Search works letter-by-letter.</p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px' }}>Add Language</div>
                  <input
                    type="text"
                    placeholder="Type language name..."
                    onChange={async (e) => {
                      const query = e.target.value;
                      if (query.length < 1) {
                        setLanguageSuggestions([]);
                        return;
                      }
                      
                      try {
                        const res = await fetch(`/api/search-languages?q=${encodeURIComponent(query)}`);
                        const data_langs = await res.json();
                        setLanguageSuggestions(data_langs.languages || []);
                      } catch (err) {
                        console.error('Error fetching languages:', err);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: `1px solid ${C.border}`,
                      background: C.bg,
                      color: C.text,
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  />
                </label>
              </div>

              {languageSuggestions.length > 0 && (
                <div style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  marginBottom: '16px',
                }}>
                  {languageSuggestions.map((lang, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (!data.languages.includes(lang)) {
                          setData({ ...data, languages: [...data.languages, lang] });
                        }
                        setLanguageSuggestions([]);
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: C.text,
                        borderBottom: `1px solid ${C.border}`,
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.border}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                    >
                      {lang}
                    </div>
                  ))}
                </div>
              )}

              {data.languages.length > 0 && (
                <div style={{ padding: '12px', background: C.bg, borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '8px' }}>Selected Languages:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {data.languages.map((lang, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '6px 12px',
                          background: C.primary,
                          color: '#fff',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {lang}
                        <button
                          onClick={() => setData({ ...data, languages: data.languages.filter((_, i) => i !== idx) })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '0',
                            lineHeight: '1',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}



          {step === 'deal-prefs' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Deal Preferences</h2>
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>How open are you to collaborations?</div>
                <select
                  value={data.collaborationOpenness}
                  onChange={e => setData({ ...data, collaborationOpenness: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                >
                  <option value="open">Very open - I explore all opportunities</option>
                  <option value="selective">Selective - Must align with my brand</option>
                  <option value="closed">Closed - Only for dream brands</option>
                </select>
              </label>

              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Deal Types You're Interested In</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['Sponsored Post', 'Product Placement', 'UGC', 'Affiliate', 'Long-term Partnership', 'Event Appearance'].map(type => (
                    <label key={type} style={{ display: 'flex', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={data.dealTypes.includes(type)}
                        onChange={e => {
                          if (e.target.checked) {
                            setData({ ...data, dealTypes: [...data.dealTypes, type] });
                          } else {
                            setData({ ...data, dealTypes: data.dealTypes.filter(t => t !== type) });
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', color: C.text }}>{type}</span>
                    </label>
                  ))}
                </div>
              </label>
            </>
          )}

          {step === 'pricing' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Pricing & Rates</h2>
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Minimum Deal Value (USD)</div>
                <input
                  type="number"
                  value={data.minDealValue}
                  onChange={e => setData({ ...data, minDealValue: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 500"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                />
              </label>

              <label style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={data.negotiable}
                  onChange={e => setData({ ...data, negotiable: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: C.text, cursor: 'pointer' }}>I'm open to negotiating rates</span>
              </label>

              <div style={{ padding: '12px', background: C.bg, borderRadius: '8px', fontSize: '12px', color: C.textSecondary }}>
                You'll set detailed rate card (per post type) after completing onboarding.
              </div>
            </>
          )}

          {step === 'availability' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Availability & Operations</h2>
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Typical Turnaround Time (days)</div>
                <input
                  type="number"
                  value={data.turnaroundDays}
                  onChange={e => setData({ ...data, turnaroundDays: parseInt(e.target.value) || 7 })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Revision Limit (per deliverable)</div>
                <input
                  type="number"
                  value={data.revisionLimit}
                  onChange={e => setData({ ...data, revisionLimit: parseInt(e.target.value) || 2 })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                />
              </label>

              <label style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={data.travelWilling}
                  onChange={e => setData({ ...data, travelWilling: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: C.text, cursor: 'pointer' }}>I'm willing to travel for shoots</span>
              </label>

            </>
          )}

          {step === 'review' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Review Your Profile</h2>
              <div style={{ fontSize: '13px', lineHeight: '1.8', color: C.textSecondary }}>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Name:</span> {data.displayName || '(not provided)'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Location:</span> {data.location.city}, {data.location.country}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Niches:</span> {data.niches.join(', ') || '(not provided)'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Languages:</span> {data.languages.length > 0 ? data.languages.join(', ') : '(not provided)'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Social Accounts:</span> {data.socialAccounts.filter(a => a.username).length} connected
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Min Deal Value:</span> ${data.minDealValue}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Turnaround:</span> {data.turnaroundDays} days
                </div>
              </div>
              <div style={{ padding: '12px', background: C.bg, borderRadius: '8px', marginTop: '16px', fontSize: '12px', color: C.textSecondary }}>
                ✓ You can edit this profile anytime. Complete now to start receiving brand opportunities.
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {currentStepIndex > 0 && (
            <button
              onClick={() => setStep(steps[currentStepIndex - 1])}
              style={{
                flex: 1,
                padding: '12px',
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.text,
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Back
            </button>
          )}
          {step !== 'review' ? (
            <button
              onClick={() => setStep(steps[currentStepIndex + 1])}
              style={{
                flex: 1,
                padding: '12px',
                background: C.primary,
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                background: loading ? C.border : C.primary,
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {loading ? 'Completing...' : 'Complete Setup'}
            </button>
          )}
          <button
            onClick={fillDemoData}
            style={{
              padding: '12px 20px',
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.accent,
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
            }}
          >
            Fill Demo Data
          </button>
          <button
            onClick={handleSkip}
            style={{
              padding: '12px 20px',
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.textSecondary,
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
            }}
          >
            Skip
          </button>
        </div>

        {/* Skip Warning Modal */}
        {showSkipWarning && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              background: C.surface,
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '400px',
              border: `1px solid ${C.border}`,
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginBottom: '12px' }}>Save progress?</h3>
              <p style={{ color: C.textSecondary, fontSize: '13px', marginBottom: '16px' }}>
                Your draft is auto-saved. You can complete your profile anytime from your account settings.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowSkipWarning(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `1px solid ${C.border}`,
                    background: 'transparent',
                    color: C.text,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Continue Editing
                </button>
                <button
                  onClick={() => router.push('/demo/marketplace')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: C.primary,
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Exit & Save Draft
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
