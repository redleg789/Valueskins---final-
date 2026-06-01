'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { C } from '@/theme/colors';

type Step = 'company' | 'campaign' | 'creators' | 'budget' | 'workflow' | 'review';

interface BrandOnboarding {
  // Company
  companyName: string;
  logo?: string;
  industry: string;
  website?: string;
  companySize: string;

  // Campaign
  campaignGoals: string[];
  campaignTypes: string[];
  targetCreatorCategories: string[];
  targetAudience: {
    ageRanges: string[];
    genders: string[];
    geographies: string[];
  };

  // Creator requirements
  minFollowers: number;
  minEngagement: number;
  requiredPlatforms: string[];
  languageRequirements: string[];

  // Budget
  budgetRange: string;
  budgetPerDeal: number;
  paymentStructure: string;
  frequency: string;

  // Workflow
  approvalTime: number;
  revisionLimit: number;
  communicationStyle: string;
  preferredDeadlineTypes: string[];

  // Agency memory
  preferences: {
    sampleProducts?: string;
    eventPreferences?: string;
    timeZonePreference?: string;
    contentStyle?: string;
  };

  // Reputation
  previousCampaigns: number;
  averageCreatorRetention: number;
  testimonials: string[];
}

export default function OnboardingBrand() {
  const router = useRouter();
  const { userId: userIdParam } = router.query;
  const [step, setStep] = useState<Step>('company');
  const [loading, setLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [data, setData] = useState<BrandOnboarding>({
    companyName: '',
    industry: '',
    companySize: '',
    campaignGoals: [],
    campaignTypes: [],
    targetCreatorCategories: [],
    targetAudience: {
      ageRanges: [],
      genders: [],
      geographies: [],
    },
    minFollowers: 10000,
    minEngagement: 0,
    requiredPlatforms: [],
    languageRequirements: ['English'],
    budgetRange: '5k-10k',
    budgetPerDeal: 5000,
    paymentStructure: 'upfront',
    frequency: 'monthly',
    approvalTime: 3,
    revisionLimit: 2,
    communicationStyle: 'professional',
    preferredDeadlineTypes: [],
    preferences: {},
    previousCampaigns: 0,
    averageCreatorRetention: 0,
    testimonials: [],
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
          body: JSON.stringify({ role: 'brand', data, step }),
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
        if (draft.last_saved_step) setStep(draft.last_saved_step);
      }
    } catch (err) {
      console.error('Failed to load draft:', err);
    }
  };

  const steps: Step[] = ['company', 'campaign', 'creators', 'budget', 'workflow', 'review'];
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
          role: 'brand',
          bio: data.companyName,
          location: { city: '', country: '', countryCode: '' },
          interests: data.campaignTypes,
          skills: data.campaignGoals,
          languages: data.languageRequirements,
          contentTypes: data.targetCreatorCategories,
          audienceAge: '',
          audienceGender: '',
          experienceLevel: '',
          socialMediaAccounts: [],
          collaborationOpen: true,
          brandProfile: data,
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

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Brand Account Setup</h1>
          <p style={{ color: C.textSecondary, fontSize: '14px' }}>Tell us about your brand and campaigns. You can complete this later.</p>
          {lastSaved && (
            <div style={{ fontSize: '12px', color: C.success, marginTop: '8px' }}>✓ Saved {lastSaved.toLocaleTimeString()}</div>
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

        {/* Content */}
        <div style={{ background: C.surface, borderRadius: '12px', padding: '24px', marginBottom: '24px', minHeight: '300px' }}>
          {step === 'company' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Your Company</h2>
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Company Name</div>
                <input
                  type="text"
                  value={data.companyName}
                  onChange={e => setData({ ...data, companyName: e.target.value })}
                  placeholder="Your brand name"
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
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Industry</div>
                <select
                  value={data.industry}
                  onChange={e => setData({ ...data, industry: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                >
                  <option value="">Select industry</option>
                  <option value="fashion">Fashion</option>
                  <option value="beauty">Beauty</option>
                  <option value="tech">Technology</option>
                  <option value="food">Food & Beverage</option>
                  <option value="fitness">Fitness</option>
                  <option value="travel">Travel</option>
                  <option value="automotive">Automotive</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Company Size</div>
                <select
                  value={data.companySize}
                  onChange={e => setData({ ...data, companySize: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                >
                  <option value="">Select size</option>
                  <option value="startup">Startup (1-50)</option>
                  <option value="small">Small (50-500)</option>
                  <option value="medium">Medium (500-5000)</option>
                  <option value="large">Large (5000+)</option>
                </select>
              </label>
            </>
          )}

          {step === 'campaign' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Campaign Goals</h2>
              <p style={{ color: C.textSecondary, fontSize: '13px', marginBottom: '16px' }}>What are you looking to achieve?</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {['Brand Awareness', 'Sales/Conversions', 'UGC Content', 'Events', 'Community Building', 'Hiring'].map(goal => (
                  <label key={goal} style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={data.campaignGoals.includes(goal)}
                      onChange={e => {
                        if (e.target.checked) {
                          setData({ ...data, campaignGoals: [...data.campaignGoals, goal] });
                        } else {
                          setData({ ...data, campaignGoals: data.campaignGoals.filter(g => g !== goal) });
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: C.text }}>{goal}</span>
                  </label>
                ))}
              </div>

              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Campaign Types</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['Sponsored Post', 'Product Placement', 'UGC', 'Affiliate', 'Long-term', 'Gifting'].map(type => (
                    <label key={type} style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={data.campaignTypes.includes(type)}
                        onChange={e => {
                          if (e.target.checked) {
                            setData({ ...data, campaignTypes: [...data.campaignTypes, type] });
                          } else {
                            setData({ ...data, campaignTypes: data.campaignTypes.filter(t => t !== type) });
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

          {step === 'creators' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Creator Requirements</h2>
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Minimum Followers</div>
                <input
                  type="number"
                  value={data.minFollowers}
                  onChange={e => setData({ ...data, minFollowers: parseInt(e.target.value) || 0 })}
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
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Target Creator Categories</div>
                <input
                  type="text"
                  placeholder="e.g., Fashion, Beauty, Tech"
                  value={data.targetCreatorCategories.join(', ')}
                  onChange={e => setData({ ...data, targetCreatorCategories: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
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
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Target Geographies</div>
                <input
                  type="text"
                  placeholder="e.g., India, US, UK"
                  value={data.targetAudience.geographies.join(', ')}
                  onChange={e => setData({ ...data, targetAudience: { ...data.targetAudience, geographies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
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
            </>
          )}

          {step === 'budget' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Budget & Payment</h2>
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Budget Per Deal (USD)</div>
                <input
                  type="number"
                  value={data.budgetPerDeal}
                  onChange={e => setData({ ...data, budgetPerDeal: parseInt(e.target.value) || 0 })}
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

              <div style={{ padding: '12px', background: C.bg, borderRadius: '8px', marginTop: '0px', fontSize: '12px', color: C.textSecondary }}>
                All deals use hybrid escrow payment: advance and post-completion amounts held in escrow. Terms negotiated per deal.
              </div>

              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Campaign Frequency</div>
                <select
                  value={data.frequency}
                  onChange={e => setData({ ...data, frequency: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="biannual">Bi-annual</option>
                  <option value="annual">Annual</option>
                  <option value="adhoc">Ad-hoc</option>
                </select>
              </label>
            </>
          )}

          {step === 'workflow' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Workflow Preferences</h2>
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Approval Time (days)</div>
                <input
                  type="number"
                  value={data.approvalTime}
                  onChange={e => setData({ ...data, approvalTime: parseInt(e.target.value) || 3 })}
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
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Revisions Per Deliverable</div>
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

              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>Communication Style</div>
                <select
                  value={data.communicationStyle}
                  onChange={e => setData({ ...data, communicationStyle: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '8px',
                  }}
                >
                  <option value="professional">Professional & Formal</option>
                  <option value="casual">Casual & Friendly</option>
                  <option value="detailed">Very Detailed & Specific</option>
                </select>
              </label>
            </>
          )}

          {step === 'review' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Review Your Setup</h2>
              <div style={{ fontSize: '13px', lineHeight: '1.8', color: C.textSecondary }}>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Company:</span> {data.companyName || '(not provided)'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Industry:</span> {data.industry || '(not provided)'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Goals:</span> {data.campaignGoals.join(', ') || '(not provided)'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Budget Per Deal:</span> ${data.budgetPerDeal}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>Min Creator Followers:</span> {data.minFollowers.toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '12px', background: C.bg, borderRadius: '8px', marginTop: '16px', fontSize: '12px', color: C.textSecondary }}>
                ✓ All set! You can edit this anytime. Start searching for creators now.
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
              {loading ? 'Completing...' : 'Finish Setup'}
            </button>
          )}
          <button
            onClick={() => router.push('/demo/marketplace')}
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
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
