'use client';

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
};

const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
};

export default function EventDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/events/${id}`)
      .then(r => r.json())
      .then(data => {
        setEvent(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.text, fontFamily: 'system-ui' }}>
      Loading...
    </div>
  );

  if (!event) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.text, fontFamily: 'system-ui' }}>
      Event not found
    </div>
  );

  const f = event.form || {};

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '20px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: C.accent, textDecoration: 'none', fontSize: 14, marginBottom: 20, cursor: 'pointer', padding: 0 }}>← Back</button>

        <div style={{ ...card, padding: 32, marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 800 }}>{f.eventName}</h1>
          <p style={{ margin: 0, color: C.textMuted }}>{f.oneLineSummary}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
            <div>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 4 }}>DATE</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{f.eventDate}</div>
            </div>
            <div>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 4 }}>TIME</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{f.startTime} - {f.endTime}</div>
            </div>
            <div>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 4 }}>LOCATION</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{f.venueName}</div>
            </div>
          </div>

          {f.fullDescription && (
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>About</h3>
              <p style={{ margin: 0, color: C.textMuted, lineHeight: 1.6 }}>{f.fullDescription}</p>
            </div>
          )}
        </div>

        {event.form?.featuredPeople && event.form.featuredPeople.length > 0 && (
          <div style={{ ...card, padding: 32, marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700 }}>Featured Creators</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {event.form.featuredPeople.map((person: any) => (
                <div
                  key={person.id}
                  onClick={() => {
                    if (person.tag?.username) {
                      router.push(`/creator/${person.tag.username}`);
                    }
                  }}
                  style={{ ...card, padding: 16, textAlign: 'center', cursor: person.tag?.username ? 'pointer' : 'default', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative' }}
                  onMouseEnter={(e) => {
                    if (person.tag?.username) {
                      (e.currentTarget as any).style.transform = 'translateY(-4px)';
                      (e.currentTarget as any).style.boxShadow = '0 20px 60px rgba(56, 189, 248, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as any).style.transform = 'translateY(0)';
                    (e.currentTarget as any).style.boxShadow = (card as any).boxShadow || 'none';
                  }}
                >
                  {person.tag?.avatarUrl && (
                    <img src={person.tag.avatarUrl} alt="" style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 12 }} />
                  )}
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: person.tag?.userId ? C.accent : C.text }}>{person.tag?.name}</div>
                  <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 8 }}>{person.featuredRole}</div>
                  {person.tag?.descriptor && (
                    <div style={{ color: C.textMuted, fontSize: 12 }}>{person.tag.descriptor}</div>
                  )}
                  {person.tag?.handle && (
                    <div style={{ color: C.accent, fontSize: 12, marginTop: 8, fontFamily: 'monospace' }}>@{person.tag.handle}</div>
                  )}
                  {person.tag?.username && (
                    <div style={{ fontSize: 11, color: C.accent, marginTop: 8, fontStyle: 'italic' }}>View Profile →</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ ...card, padding: 32, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Pricing & Entry</h3>
          <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
            {f.ticketingModel && <div><span style={{ color: C.textMuted }}>Ticketing:</span> {f.ticketingModel}</div>}
            {f.currency && <div><span style={{ color: C.textMuted }}>Currency:</span> {f.currency}</div>}
            {f.pricingTiers && f.pricingTiers.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>PRICING TIERS</div>
                {f.pricingTiers.map((tier: any, idx: number) => (
                  <div key={idx} style={{ background: 'rgba(56, 189, 248, 0.05)', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{tier.name}</div>
                    <div style={{ color: C.textMuted, fontSize: 13 }}>
                      {tier.price ? `${f.currency} ${tier.price}` : 'Free'}
                      {tier.maxTickets && ` • Limited to ${tier.maxTickets} tickets`}
                    </div>
                    {tier.description && <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>{tier.description}</div>}
                  </div>
                ))}
              </div>
            )}
            {f.maxAttendees && <div><span style={{ color: C.textMuted }}>Capacity:</span> {f.maxAttendees} attendees</div>}
            {f.ageRestriction && <div><span style={{ color: C.textMuted }}>Age Requirement:</span> {f.ageRestriction}</div>}
            {f.experienceLevel && <div><span style={{ color: C.textMuted }}>Experience Level:</span> {f.experienceLevel}</div>}
            {f.genderRestriction && <div><span style={{ color: C.textMuted }}>Gender Restriction:</span> {f.genderRestriction}</div>}
          </div>
        </div>

        <div style={{ ...card, padding: 32, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Policies & Restrictions</h3>
          <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
            {f.dressCode && <div><span style={{ color: C.textMuted }}>Dress Code:</span> {f.dressCode}</div>}
            {f.eventVibe && <div><span style={{ color: C.textMuted }}>Vibe:</span> {f.eventVibe}</div>}
            {f.bagPolicy && <div><span style={{ color: C.textMuted }}>Bag Policy:</span> {f.bagPolicy}</div>}
            {f.prohibitedItems && f.prohibitedItems.length > 0 && (
              <div>
                <div style={{ color: C.textMuted, marginBottom: 4 }}>Prohibited Items:</div>
                <div style={{ color: C.textMuted, fontSize: 13 }}>{f.prohibitedItems.join(', ')}</div>
              </div>
            )}
            {f.refundPolicy && <div><span style={{ color: C.textMuted }}>Refund Policy:</span> {f.refundPolicy}</div>}
            {f.cancellationPolicy && <div><span style={{ color: C.textMuted }}>Cancellation Policy:</span> {f.cancellationPolicy}</div>}
          </div>
        </div>

        {(f.specialInstructions || f.parking || f.accessibility) && (
          <div style={{ ...card, padding: 32 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Additional Information</h3>
            <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
              {f.specialInstructions && <div><span style={{ color: C.textMuted }}>Special Instructions:</span> {f.specialInstructions}</div>}
              {f.parking && <div><span style={{ color: C.textMuted }}>Parking:</span> {f.parking}</div>}
              {f.accessibility && <div><span style={{ color: C.textMuted }}>Accessibility:</span> {f.accessibility}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
