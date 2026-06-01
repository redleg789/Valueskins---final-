'use client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { C } from '@/theme/colors';

type Step = 'role-select' | 'identity' | 'social' | 'content' | 'languages' | 'deal-prefs' | 'pricing' | 'availability' | 'review';

interface CreatorOnboarding {
  userRole: 'creator' | 'brand' | '';
  displayName: string;
  location: { city: string; country: string; countryCode: string };
  timezone: string;
  languages: string[];
  ageRange: string;
  socialAccounts: Array<{
    platform: string;
    username: string;
    followerCount: number;
    engagementRate: number;
    audienceDemographics: { ageRanges: string[]; genders: string[] };
  }>;
  website?: string;
  niches: string[];
  contentStyle: string;
  tone: string;
  keywords: string[];
  archetype: string;
  introVideoUrl?: string;
  collaborationOpenness: 'open' | 'selective' | 'closed';
  dealTypes: string[];
  rateCard: { [key: string]: number };
  minDealValue: number;
  negotiable: boolean;
  workingHours: { start: string; end: string };
  shootAvailability: string[];
  travelWilling: boolean;
  travelBudget?: string;
  turnaroundDays: number;
  revisionLimit: number;
  communicationStyle: string;
  equipment: string[];
  hasStudio: boolean;
  personalPreferences: {
    clothingSizes?: string;
    foodAllergies?: string;
    hotelPreferences?: string;
    flightClass?: string;
    accessibility?: string;
  };
  previousCampaigns: Array<{ brand: string; contentType: string; date: string; link?: string }>;
  testimonials: string[];
  exclusivityRestrictions: string[];
}

export default function OnboardingCreator() {
  const router = useRouter();
  const { userId: userIdParam } = router.query;
  const [step, setStep] = useState<Step>('role-select');
  const [loading, setLoading] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  const [languageSuggestions, setLanguageSuggestions] = useState<string[]>([]);

  const [data, setData] = useState<CreatorOnboarding>({
    userRole: '',
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
    turnaroundDays: 5,
    revisionLimit: 2,
    communicationStyle: 'professional',
    equipment: [],
    hasStudio: false,
    personalPreferences: {},
    previousCampaigns: [],
    testimonials: [],
    exclusivityRestrictions: [],
  });

  const handleRoleSelect = (role: 'creator' | 'brand') => {
    if (role === 'brand') {
      router.push('/auth/onboarding-brand');
      return;
    }
    setData({ ...data, userRole: 'creator' });
    setStep('identity');
  };

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
          role: data.userRole,
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
      userRole: 'creator',
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
    setStep('identity');
  };

  const steps: Step[] = data.userRole === 'creator' 
    ? ['identity', 'social', 'content', 'languages', 'deal-prefs', 'pricing', 'availability', 'review']
    : [];
  const currentStepIndex = steps.indexOf(step as any);

  if (step === 'role-select') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '60px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px', textAlign: 'center' }}>Welcome to ValueSkins</h1>
          <p style={{ fontSize: '16px', color: C.textSecondary, textAlign: 'center', marginBottom: '48px' }}>Are you a creator or a brand?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <button onClick={() => handleRoleSelect('creator')} style={{ padding: '32px 24px', background: C.surface, border: `2px solid ${C.border}`, borderRadius: '12px', cursor: 'pointer', textAlign: 'center' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = 'rgba(56, 189, 248, 0.05)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>[CREATOR]</div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Creator</div>
              <p style={{ fontSize: '13px', color: C.textSecondary, margin: 0 }}>Share your content and collaborate with brands</p>
            </button>
            <button onClick={() => handleRoleSelect('brand')} style={{ padding: '32px 24px', background: C.surface, border: `2px solid ${C.border}`, borderRadius: '12px', cursor: 'pointer', textAlign: 'center' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = 'rgba(56, 189, 248, 0.05)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>[BRAND]</div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Brand</div>
              <p style={{ fontSize: '13px', color: C.textSecondary, margin: 0 }}>Find creators and launch campaigns</p>
            </button>
          </div>
          <div style={{ marginTop: '48px', textAlign: 'center' }}>
            <button onClick={fillDemoData} style={{ padding: '12px 24px', border: `1px solid ${C.border}`, background: 'transparent', color: C.accent, borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}>Fill Demo Data (Creator)</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {steps.map((_, idx) => (
              <button key={idx} onClick={() => idx < currentStepIndex && setStep(steps[idx])} style={{ flex: 1, height: '4px', background: idx <= currentStepIndex ? C.accent : C.border, border: 'none', borderRadius: '2px', cursor: idx < currentStepIndex ? 'pointer' : 'default' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.textSecondary }}>
            <span>Step {currentStepIndex + 1} of {steps.length}</span>
            <span>{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</span>
          </div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
          {step === 'identity' && <div><h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Tell us about yourself</h2><input type="text" placeholder="Display name" value={data.displayName} onChange={(e) => setData({ ...data, displayName: e.target.value })} style={{ width: '100%', padding: '12px', border: `1px solid ${C.border}`, borderRadius: '8px', background: C.bg, color: C.text, fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' }} /></div>}
          {step === 'social' && <div><h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Social accounts</h2><p style={{ color: C.textSecondary, fontSize: '13px', marginBottom: '16px' }}>Add your social accounts</p></div>}
          {step === 'content' && <div><h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Content style</h2></div>}
          {step === 'languages' && <div><h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Languages</h2><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{data.languages.map((lang) => (<div key={lang} style={{ background: C.accent, color: '#000', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}>{lang}</div>))}</div></div>}
          {step === 'deal-prefs' && <div><h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Deal preferences</h2></div>}
          {step === 'pricing' && <div><h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Pricing</h2></div>}
          {step === 'availability' && <div><h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Availability</h2></div>}
          {step === 'review' && <div><h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Review your profile</h2><div style={{ fontSize: '13px', color: C.textSecondary }}><p>Name: {data.displayName}</p><p>Location: {data.location.city}, {data.location.country}</p></div></div>}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {currentStepIndex > 0 && <button onClick={() => setStep(steps[currentStepIndex - 1])} style={{ flex: 1, padding: '12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: '8px', cursor: 'pointer' }}>Back</button>}
          {currentStepIndex < steps.length - 1 && <button onClick={() => setStep(steps[currentStepIndex + 1])} style={{ flex: 1, padding: '12px', background: C.accent, color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Next</button>}
          {currentStepIndex === steps.length - 1 && <button onClick={handleComplete} style={{ flex: 1, padding: '12px', background: C.accent, color: '#000', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>{loading ? 'Completing...' : 'Complete Setup'}</button>}
          <button onClick={() => setShowSkipWarning(true)} style={{ padding: '12px 20px', border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}>Skip</button>
        </div>

        {showSkipWarning && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ background: C.surface, padding: '24px', borderRadius: '12px', maxWidth: '400px', border: `1px solid ${C.border}` }}><h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Save progress?</h3><p style={{ color: C.textSecondary, fontSize: '13px', marginBottom: '16px' }}>Your draft is auto-saved.</p><div style={{ display: 'flex', gap: '12px' }}><button onClick={() => setShowSkipWarning(false)} style={{ flex: 1, padding: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>Continue</button><button onClick={() => router.push('/demo/marketplace')} style={{ flex: 1, padding: '10px', background: C.accent, color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>Exit</button></div></div></div>}
      </div>
    </div>
  );
}
