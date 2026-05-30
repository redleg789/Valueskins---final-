'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useState, useMemo, useRef, useEffect } from 'react';
import type {
  CreateEventFormState, EventCategory, EventType, EventVisibility,
  IndoorOutdoor, AddressRevealTiming, TicketingModel, ExperienceLevel,
  Level, ThirdPartyRole, ThirdPartyTag, TicketTier, FAQEntry, FeaturedPerson,
  ScheduleItem,
} from '../data/types';
import {
  emptyFormState, EVENT_CATEGORIES, INDOOR_OPTIONS, ADDRESS_REVEAL_OPTIONS,
  EXPERIENCE_OPTIONS, LEVEL_OPTIONS, FEATURED_ROLE_OPTIONS,
} from '../data/types';
import { SingleImageUpload, MultiImageUpload } from './ImageUpload';
import { GenderEntrySection, BagSecuritySection, TableSeatingSection } from './EfficiencyFormSections';
import PromoterManagementSection from './PromotermanagementSection';
import PromoterAnalyticsSection from './PromoterAnalyticsSection';
import { GENDER_RULE_OPTIONS, BAG_POLICY_OPTIONS, SECTION_TYPE_OPTIONS } from '../data/types';

const TIMEZONES = [
  'UTC', 'Africa/Abidjan','Africa/Accra','Africa/Addis_Ababa','Africa/Algiers','Africa/Cairo','Africa/Casablanca','Africa/Dar_es_Salaam',
  'Africa/Johannesburg','Africa/Lagos','Africa/Nairobi','Africa/Tunis','America/Argentina/Buenos_Aires','America/Bogota','America/Caracas',
  'America/Chicago','America/Denver','America/Edmonton','America/Halifax','America/Lima','America/Los_Angeles','America/Mexico_City',
  'America/New_York','America/Panama','America/Phoenix','America/Santiago','America/Sao_Paulo','America/St_Johns','America/Toronto',
  'America/Vancouver','America/Winnipeg','Asia/Bangkok','Asia/Colombo','Asia/Dhaka','Asia/Dubai','Asia/Ho_Chi_Minh','Asia/Hong_Kong',
  'Asia/Jakarta','Asia/Karachi','Asia/Kathmandu','Asia/Kolkata','Asia/Kuala_Lumpur','Asia/Manila','Asia/Seoul','Asia/Shanghai',
  'Asia/Singapore','Asia/Taipei','Asia/Tashkent','Asia/Tokyo','Asia/Yangon','Atlantic/Reykjavik','Australia/Adelaide','Australia/Brisbane',
  'Australia/Darwin','Australia/Hobart','Australia/Melbourne','Australia/Perth','Australia/Sydney','Europe/Amsterdam','Europe/Athens',
  'Europe/Berlin','Europe/Brussels','Europe/Bucharest','Europe/Budapest','Europe/Copenhagen','Europe/Dublin','Europe/Helsinki',
  'Europe/Istanbul','Europe/Kyiv','Europe/Lisbon','Europe/London','Europe/Madrid','Europe/Moscow','Europe/Oslo','Europe/Paris',
  'Europe/Prague','Europe/Riga','Europe/Rome','Europe/Stockholm','Europe/Tallinn','Europe/Vienna','Europe/Vilnius','Europe/Warsaw',
  'Europe/Zurich','Pacific/Auckland','Pacific/Fiji','Pacific/Guam','Pacific/Honolulu','Pacific/Samoa',
];

const REFUND_OPTIONS = [
  { value: 'full-24h', label: 'Full refund up to 24 hours before' },
  { value: 'full-48h', label: 'Full refund up to 48 hours before' },
  { value: 'full-7d', label: 'Full refund up to 7 days before' },
  { value: 'half-24h', label: '50% refund up to 24 hours before' },
  { value: 'half-48h', label: '50% refund up to 48 hours before' },
  { value: 'none', label: 'No refunds under any circumstances' },
];

const CANCEL_OPTIONS = [
  { value: 'host-cancel', label: 'Host may cancel with full refund to attendees' },
  { value: 'host-cancel-partial', label: 'Host may cancel with partial refund' },
  { value: 'weather-cancel', label: 'Cancelled only due to weather/natural causes' },
  { value: 'no-cancel', label: 'Event will happen regardless — no cancellations' },
];

const PROHIBITED_ITEMS = [
  'Weapons / firearms', 'Illegal substances', 'Glass bottles', 'Outside alcohol',
  'Professional cameras', 'Recording equipment', 'Laptops / tablets', 'Selfie sticks',
  'Large bags / backpacks', 'Fireworks / explosives', 'Laser pointers', 'Pets (except service animals)',
  'Skateboards / hoverboards', 'Drones', 'Flags / banners on poles', 'Confetti / glitter',
  'Smoking devices / vapes', 'Coolers / large containers', 'Umbrellas (large)', 'Political signage',
];

function hasSocialBypass(text: string): boolean {
  const patterns = [
    /@\w+/g, /instagram\.com\/\w+/i, /twitter\.com\/\w+/i, /x\.com\/\w+/i,
    /t\.me\/\w+/i, /wa\.me\/\d+/i, /discord\.gg\/\w+/i, /tiktok\.com\/@\w+/i,
    /snapchat\.com\/\w+/i, /facebook\.com\/\w+/i, /youtube\.com\/@\w+/i,
    /\b\d{10,}\b/, /\b[\w.]+@[\w.]+\.\w{2,}\b/,
  ];
  return patterns.some(p => p.test(text));
}

const C = {
  bg: '#0f172a',
  surface: 'rgba(15, 23, 42, 0.86)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5',
  errorBg: 'rgba(252, 165, 165, 0.12)',
  success: '#86efac',
  gradient: 'linear-gradient(135deg, #f97316, #fb7185)',
};

const card: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const inp: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: `1px solid ${C.border}`,
  background: 'rgba(15, 23, 42, 0.88)',
  color: C.text,
  padding: '12px 16px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const btnBase: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '14px 28px',
};

const checkboxRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  cursor: 'pointer',
  color: C.text,
  fontSize: 14,
};

const tagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 12px',
  borderRadius: 999,
  background: C.accentBg,
  color: C.accent,
  fontSize: 12,
  fontWeight: 600,
};

interface SectionProps {
  label: string;
  completed: boolean;
  children: ReactNode;
  defaultOpen?: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  pricing: 'Pricing & Tickets',
  basic: 'Basic Information',
  datetime: 'Date & Time',
  location: 'Location',
  ticketing: 'Ticketing',
  audience: 'Audience',
  people: 'Featured People',
  vibe: 'Vibe & Experience',
  rules: 'Rules',
  gender: 'Gender & Entry Rules',
  bag: 'Bag & Security Rules',
  tables: 'Table & Seating',
  faq: 'FAQ',
  contact: 'Contact',
  postEvent: 'Post-Event',
  schedule: 'Schedule',
  logistics: 'Logistics',
};

export default function CreateEventForm({
  onBack,
  onCreated,
  initialData,
  eventId,
}: {
  onBack: () => void;
  onCreated: (id: string) => void;
  initialData?: CreateEventFormState;
  eventId?: string;
}) {
  const [f, setF] = useState<CreateEventFormState>(() =>
    initialData ? { ...emptyFormState(), ...initialData } : emptyFormState()
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['pricing']));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (f.currency !== 'USD') return;
    const controller = new AbortController();
    fetch('https://ipapi.co/json/', { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        const cc = (data.country_code || data.countryCode || '').toUpperCase();
        if (cc && COUNTRY_CURRENCY[cc] && COUNTRY_CURRENCY[cc] !== 'USD') {
          setF(prev => ({ ...prev, currency: COUNTRY_CURRENCY[cc] }));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function set<K extends keyof CreateEventFormState>(k: K, v: CreateEventFormState[K]) {
    setF(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  }

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function sectionCompleted(id: string): boolean {
    switch (id) {
      case 'pricing': return f.ticketingModel === 'free' || (f.ticketTiers.length > 0 && f.ticketTiers.some(t => t.priceCents > 0));
      case 'basic': return !!f.eventName.trim() && !!f.oneLineSummary.trim();
      case 'datetime': return !!f.eventDate && !!f.startTime && !!f.endTime;
      case 'location': return !!f.venueName.trim() && !!f.fullAddress.trim();
      case 'ticketing': return true;
      case 'audience': return true;
      case 'people': return true;
      case 'vibe': return true;
      case 'rules': return true;
      case 'gender': return true;
      case 'bag': return true;
      case 'tables': return true;
      case 'faq': return true;
      case 'contact': return !!f.hostContact.trim();
      case 'postEvent': return true;
      case 'schedule': return f.schedule.length > 0;
      case 'logistics': return f.whatToBring.length > 0 || !!f.foodAndDrink || !!f.accessibility || !!f.eventWebsite || !!f.language;
      default: return false;
    }
  }

  const fieldToSection: Record<string, string> = {
    eventName: 'basic', oneLineSummary: 'basic',
    eventDate: 'datetime', startTime: 'datetime', endTime: 'datetime',
    venueName: 'location', fullAddress: 'location',
    hostContact: 'contact',
  };

  const errorOrder = ['eventName','oneLineSummary','eventDate','startTime','endTime','venueName','fullAddress','hostContact','supportContact'];

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!f.eventName.trim()) errs.eventName = 'Event name is required';
    if (!f.oneLineSummary.trim()) errs.oneLineSummary = 'Summary is required';
    if (!f.eventDate) errs.eventDate = 'Date is required';
    else {
      const today = new Date();
      const [year, month, day] = f.eventDate.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);
      selectedDate.setHours(0,0,0,0);
      const todayDate = new Date(today);
      todayDate.setHours(0,0,0,0);
      if (selectedDate < todayDate) {
        errs.eventDate = 'Event date cannot be in the past';
      } else if (selectedDate.getTime() === todayDate.getTime() && f.startTime) {
        const [hours, minutes] = f.startTime.split(':').map(Number);
        const selectedTime = new Date(today);
        selectedTime.setHours(hours, minutes, 0, 0);
        if (selectedTime < today) {
          errs.startTime = 'Start time cannot be in the past';
        }
      }
    }
    if (!f.startTime && !errs.startTime) errs.startTime = 'Start time is required';
    if (!f.endTime) errs.endTime = 'End time is required';
    if (!f.venueName.trim()) errs.venueName = 'Venue name is required';
    if (!f.fullAddress.trim()) errs.fullAddress = 'Address is required';
    if (f.maxAttendees < 1) errs.maxAttendees = 'Must allow at least 1 attendee';
    if (!f.hostContact.trim()) errs.hostContact = 'Host contact is required';
    if (!f.supportContact.trim()) errs.supportContact = 'Support contact is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.supportContact.trim())) errs.supportContact = 'Enter a valid email address';

    const keys = Object.keys(errs);
    if (keys.length > 0) {
      errs.submit = 'Please fill out all required fields marked in red above.';
    }
    setErrors(errs);

    if (keys.length > 0) {
      const sections = new Set(keys.map(k => fieldToSection[k]).filter(Boolean));
      setOpenSections(prev => {
        const n = new Set(prev);
        for (const s of sections) n.add(s);
        return n;
      });
      setTimeout(() => {
        const firstKey = errorOrder.find(k => errs[k] && k !== 'submit');
        if (firstKey) {
          const el = document.getElementById(`field-${firstKey}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }

    return keys.length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setIsSubmitting(true);
    setErrors({}); // Clear previous errors
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ form: f }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('POST /api/events failed:', res.status, err);
        setIsSubmitting(false);
        setErrors(prev => ({ ...prev, submit: `Server error: ${err}` }));
        return;
      }

      const data = await res.json();
      console.log('Event created successfully:', data.id);

      if (!data.id) {
        setIsSubmitting(false);
        setErrors(prev => ({ ...prev, submit: 'Server error: No ID returned' }));
        return;
      }

      // Success - navigate immediately without updating state (component will unmount)
      onCreated(data.id);
    } catch (e: any) {
      console.error('Event creation error:', e);
      setIsSubmitting(false);
      setErrors(prev => ({ ...prev, submit: `Error: ${e.message}` }));
    }
  }

  function fillDemoData() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    set('eventName', 'Demo Event: Tech Networking Mixer');
    set('oneLineSummary', 'Join us for an evening of tech talks and networking');
    set('eventCategory', 'networking');
    set('eventType', 'in-person');
    set('eventDate', dateStr);
    set('startTime', '18:00');
    set('endTime', '22:00');
    set('doorsOpenTime', '17:30');
    set('venueName', 'Tech Hub Downtown');
    set('fullAddress', '123 Innovation St, San Francisco, CA 94105');
    set('timezone', 'America/Los_Angeles');
    set('indoorOutdoor', 'indoor');
    set('maxAttendees', 200);
    set('unlimitedTickets', false);
    set('ticketingModel', 'free');
    set('hostContact', 'host@valueskins.io');
    set('supportContact', 'support@valueskins.io');
    set('eventVisibility', 'public');
    set('dressCode', 'Smart casual');
    set('eventVibe', 'Relaxed and professional');
    set('musicGenre', 'Electronic, Indie');
    set('networkingLevel', 'high');
    set('energyLevel', 'medium');
    set('idRequired', false);
    set('reentryAllowed', true);
    set('tags', ['tech', 'networking', 'startup']);
  }

  const totalSections = Object.keys(SECTION_LABELS).length;
  const completedCount = Object.keys(SECTION_LABELS).filter(sectionCompleted).length;

  return (
    <div style={{ display: 'grid', gap: 20, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ ...card, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <BackButton onClick={onBack} />
          <button onClick={fillDemoData} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Fill Demo Data
          </button>
        </div>
        <h2 style={{ margin: '12px 0 4px', fontSize: 24, fontWeight: 800 }}>Create Event</h2>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>
          Fill in all the details. Only the sections you complete will be published.
        </p>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
            <span>Progress</span>
            <span>{completedCount} / {totalSections}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.15)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: C.gradient, width: `${(completedCount / totalSections) * 100}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Sections */}

      <AccordionSection
        label={SECTION_LABELS.pricing}
        completed={sectionCompleted('pricing')}
        open={openSections.has('pricing')}
        onToggle={() => toggleSection('pricing')}
      >
        <PricingSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.basic}
        completed={sectionCompleted('basic')}
        open={openSections.has('basic')}
        onToggle={() => toggleSection('basic')}
      >
        <BasicInfoSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.datetime}
        completed={sectionCompleted('datetime')}
        open={openSections.has('datetime')}
        onToggle={() => toggleSection('datetime')}
      >
        <DateTimeSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.location}
        completed={sectionCompleted('location')}
        open={openSections.has('location')}
        onToggle={() => toggleSection('location')}
      >
        <LocationSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.ticketing}
        completed={sectionCompleted('ticketing')}
        open={openSections.has('ticketing')}
        onToggle={() => toggleSection('ticketing')}
      >
        <TicketingSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.audience}
        completed={sectionCompleted('audience')}
        open={openSections.has('audience')}
        onToggle={() => toggleSection('audience')}
      >
        <AudienceSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.people}
        completed={sectionCompleted('people')}
        open={openSections.has('people')}
        onToggle={() => toggleSection('people')}
      >
        <FeaturedPeopleSection f={f} set={set} errors={errors} />
      </AccordionSection>

      {eventId && (
        <AccordionSection
          label="Promoters"
          completed={false}
          open={openSections.has('promoters')}
          onToggle={() => toggleSection('promoters')}
        >
          <PromoterManagementSection eventId={eventId} />
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 12 }}>PROMOTER PERFORMANCE</div>
            <PromoterAnalyticsSection eventId={eventId} />
          </div>
        </AccordionSection>
      )}

      <AccordionSection
        label={SECTION_LABELS.vibe}
        completed={sectionCompleted('vibe')}
        open={openSections.has('vibe')}
        onToggle={() => toggleSection('vibe')}
      >
        <VibeSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.rules}
        completed={sectionCompleted('rules')}
        open={openSections.has('rules')}
        onToggle={() => toggleSection('rules')}
      >
        <RulesSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.gender}
        completed={sectionCompleted('gender')}
        open={openSections.has('gender')}
        onToggle={() => toggleSection('gender')}
      >
        <GenderEntrySection
          value={{ genderRule: f.genderRule, genderRatio: f.genderRatio, customEntryRestrictions: f.customEntryRestrictions, entryApprovalRequired: f.entryApprovalRequired }}
          onChange={vals => { setF(p => ({ ...p, ...vals })); }}
        />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.bag}
        completed={sectionCompleted('bag')}
        open={openSections.has('bag')}
        onToggle={() => toggleSection('bag')}
      >
        <BagSecuritySection
          value={{ bagPolicy: f.bagPolicy, lockerAvailable: f.lockerAvailable, lockerCostCents: f.lockerCostCents, lockerInfo: f.lockerInfo, storageInfo: f.storageInfo, upgradedProhibitedItems: f.upgradedProhibitedItems }}
          onChange={vals => { setF(p => ({ ...p, ...vals })); }}
        />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.tables}
        completed={sectionCompleted('tables')}
        open={openSections.has('tables')}
        onToggle={() => toggleSection('tables')}
      >
        <TableSeatingSection
          value={{ tableSections: f.tableSections }}
          onChange={vals => { setF(p => ({ ...p, ...vals })); }}
        />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.faq}
        completed={sectionCompleted('faq')}
        open={openSections.has('faq')}
        onToggle={() => toggleSection('faq')}
      >
        <FAQSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.contact}
        completed={sectionCompleted('contact')}
        open={openSections.has('contact')}
        onToggle={() => toggleSection('contact')}
      >
        <ContactSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.postEvent}
        completed={sectionCompleted('postEvent')}
        open={openSections.has('postEvent')}
        onToggle={() => toggleSection('postEvent')}
      >
        <PostEventSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.schedule}
        completed={sectionCompleted('schedule')}
        open={openSections.has('schedule')}
        onToggle={() => toggleSection('schedule')}
      >
        <ScheduleSection f={f} set={set} errors={errors} />
      </AccordionSection>

      <AccordionSection
        label={SECTION_LABELS.logistics}
        completed={sectionCompleted('logistics')}
        open={openSections.has('logistics')}
        onToggle={() => toggleSection('logistics')}
      >
        <LogisticsSection f={f} set={set} errors={errors} />
      </AccordionSection>

      {/* Submit */}
      {errors.submit && (
        <div style={{ padding: '12px', background: 'rgba(252, 165, 165, 0.1)', color: C.error, borderRadius: 12, marginBottom: 12, textAlign: 'center', fontSize: 14 }}>
          {errors.submit}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button type="button" onClick={onBack} disabled={isSubmitting} style={{ ...btnBase, background: 'transparent', border: `1px solid ${C.border}`, color: C.text, fontSize: 15, padding: '16px', opacity: isSubmitting ? 0.5 : 1 }}>
          Cancel
        </button>
        <button type="button" onClick={handleSubmit} disabled={isSubmitting} style={{ ...btnBase, background: C.gradient, color: '#fff7ed', fontSize: 15, padding: '16px', opacity: isSubmitting ? 0.5 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
          {isSubmitting ? (initialData ? 'Saving...' : 'Creating Event...') : (initialData ? 'Save Event' : 'Create Event')}
        </button>
      </div>
    </div>
  );
}

// ── Searchable Select ─────────────────────────────────────

function SearchableSelect({ options, value, onChange, placeholder }: {
  options: string[]; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() =>
    options.filter(o => o.toLowerCase().includes(query.toLowerCase())).slice(0, 50),
    [options, query]
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={open ? query : value}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        placeholder={placeholder}
        style={inp}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          maxHeight: 240, overflow: 'auto', borderRadius: 14, marginTop: 4,
          background: C.surface, border: `1px solid ${C.border}`,
          boxShadow: '0 20px 60px rgba(2,6,23,0.5)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 12, color: C.textMuted, fontSize: 13, textAlign: 'center' }}>No matches</div>
          ) : filtered.map(o => (
            <button
              key={o}
              onClick={() => { onChange(o); setOpen(false); setQuery(''); }}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
                background: o === value ? C.accentBg : 'transparent', color: C.text, fontSize: 13,
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = o === value ? C.accentBg : 'transparent')}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Accordion Section Wrapper ──────────────────────────────

function AccordionSection({
  label, completed, open, onToggle, children,
}: {
  label: string; completed: boolean; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: C.text, fontSize: 16, fontWeight: 700, textAlign: 'left',
        }}
      >
        <span>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          {completed && <span style={{ color: C.success }}>Done</span>}
          <span style={{ color: C.textMuted, fontSize: 18, display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            ^
          </span>
        </span>
      </button>
      {open && <div style={{ padding: '0 24px 24px', display: 'grid', gap: 16 }}>{children}</div>}
    </div>
  );
}

const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', UY: 'UYU',
  GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR',
  IE: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR', MT: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR',
  LT: 'EUR', HR: 'EUR', CY: 'EUR', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK',
  PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN', RS: 'RSD', TR: 'TRY',
  RU: 'RUB', UA: 'UAH', BY: 'BYN', MD: 'MDL', GE: 'GEL', AM: 'AMD', AZ: 'AZN', KZ: 'KZT',
  JP: 'JPY', CN: 'CNY', KR: 'KRW', IN: 'INR', SG: 'SGD', HK: 'HKD', TW: 'TWD',
  TH: 'THB', VN: 'VND', ID: 'IDR', MY: 'MYR', PH: 'PHP', PK: 'PKR', BD: 'BDT',
  LK: 'LKR', NP: 'NPR', KH: 'KHR', LA: 'LAK', MM: 'MMK', MN: 'MNT', BN: 'BND',
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD', LB: 'LBP',
  IL: 'ILS', IQ: 'IQD', IR: 'IRR', SY: 'SYP', YE: 'YER',
  AU: 'AUD', NZ: 'NZD', FJ: 'FJD', PG: 'PGK', SB: 'SBD', VU: 'VUV', WS: 'WST', TO: 'TOP',
  ZA: 'ZAR', NG: 'NGN', KE: 'KES', EG: 'EGP', GH: 'GHS', MA: 'MAD', TN: 'TND', DZ: 'DZD',
  ET: 'ETB', TZ: 'TZS', UG: 'UGX', RW: 'RWF', ZM: 'ZMW', MZ: 'MZN', BW: 'BWP', NA: 'NAD',
  MU: 'MUR', SC: 'SCR', MG: 'MGA', MW: 'MWK', AO: 'AOA', CM: 'XAF', CI: 'XOF', SN: 'XOF',
  ML: 'XOF', BF: 'XOF', BJ: 'XOF', NE: 'XOF', TG: 'XOF', CG: 'XAF', GA: 'XAF', GQ: 'XAF',
  CF: 'XAF', TD: 'XAF', CD: 'CDF', SD: 'SDG', SO: 'SOS', DJ: 'DJF', ER: 'ERN', SS: 'SSP',
  LY: 'LYD', MR: 'MRU', SL: 'SLE', LR: 'LRD', GM: 'GMD', CV: 'CVE', ST: 'STN', GW: 'XOF',
  SZ: 'SZL', LS: 'LSL', KM: 'KMF', YT: 'EUR', RE: 'EUR', GF: 'EUR', GP: 'EUR', MQ: 'EUR',
  AS: 'USD', GU: 'USD', MP: 'USD', PR: 'USD', VI: 'USD', TC: 'USD',
  VG: 'USD', KY: 'KYD', BS: 'BSD', BB: 'BBD', BZ: 'BZD', TT: 'TTD', JM: 'JMD', HT: 'HTG',
  DO: 'DOP', CU: 'CUP', AW: 'AWG', CW: 'ANG', SX: 'ANG', AN: 'ANG', GD: 'XCD', VC: 'XCD',
  LC: 'XCD', DM: 'XCD', AG: 'XCD', KN: 'XCD', MS: 'XCD', AI: 'XCD',
  MV: 'MVR', BT: 'BTN', TL: 'USD',
  FO: 'DKK', GL: 'DKK', GI: 'GIP', IM: 'IMP', JE: 'JEP', GG: 'GGP', SH: 'SHP', FK: 'FKP',
  PN: 'NZD', CK: 'NZD', NU: 'NZD', TK: 'NZD', NF: 'AUD', CX: 'AUD', CC: 'AUD',
  MO: 'MOP', PS: 'ILS', EH: 'MAD', TF: 'EUR', PM: 'EUR', BL: 'EUR', MF: 'EUR',
  WF: 'XPF', PF: 'XPF', NC: 'XPF',
};

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$' },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$' },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/' },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn' },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин' },
  { code: 'ISK', name: 'Icelandic Krona', symbol: 'kr' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs' },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸' },
  { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm' },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD' },
  { code: 'OMR', name: 'Omani Rial', symbol: '﷼' },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'JD' },
  { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل' },
  { code: 'XOF', name: 'West African CFA', symbol: 'CFA' },
  { code: 'XAF', name: 'Central African CFA', symbol: 'FCFA' },
  { code: 'MUR', name: 'Mauritian Rupee', symbol: 'Rs' },
  { code: 'TTD', name: 'Trinidad Dollar', symbol: 'TT$' },
  { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$' },
  { code: 'BSD', name: 'Bahamian Dollar', symbol: 'B$' },
  { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$' },
  { code: 'KYD', name: 'Cayman Dollar', symbol: 'CI$' },
  { code: 'AWG', name: 'Aruban Florin', symbol: 'Afl' },
  { code: 'ANG', name: 'Netherlands Antillean Guilder', symbol: 'NAf' },
  { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$' },
  { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K' },
  { code: 'WST', name: 'Samoan Tala', symbol: 'WS$' },
  { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$' },
  { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT' },
  { code: 'SBD', name: 'Solomon Dollar', symbol: 'SI$' },
  { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: 'Rf' },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛' },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭' },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'Ks' },
  { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮' },
  { code: 'BND', name: 'Brunei Dollar', symbol: 'B$' },
  { code: 'SCR', name: 'Seychellois Rupee', symbol: 'SR' },
  { code: 'MGA', name: 'Malagasy Ariary', symbol: 'Ar' },
  { code: 'CDF', name: 'Congolese Franc', symbol: 'FC' },
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw' },
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK' },
  { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT' },
  { code: 'BWP', name: 'Botswana Pula', symbol: 'P' },
  { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$' },
  { code: 'ZWL', name: 'Zimbabwean Dollar', symbol: 'Z$' },
  { code: 'AFN', name: 'Afghan Afghani', symbol: '؋' },
  { code: 'IRR', name: 'Iranian Rial', symbol: '﷼' },
  { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د' },
  { code: 'SYP', name: 'Syrian Pound', symbol: '£S' },
  { code: 'YER', name: 'Yemeni Rial', symbol: '﷼' },
  { code: 'SDG', name: 'Sudanese Pound', symbol: 'ج.س' },
  { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج' },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت' },
  { code: 'LYD', name: 'Libyan Dinar', symbol: 'ل.د' },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾' },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏' },
  { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼' },
  { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br' },
  { code: 'MDL', name: 'Moldovan Leu', symbol: 'L' },
  { code: 'KGS', name: 'Kyrgyzstani Som', symbol: 'сом' },
  { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'SM' },
  { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'T' },
  { code: 'XCD', name: 'East Caribbean Dollar', symbol: 'EC$' },
  { code: 'BZD', name: 'Belize Dollar', symbol: 'BZ$' },
  { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q' },
  { code: 'HNL', name: 'Honduran Lempira', symbol: 'L' },
  { code: 'NIO', name: 'Nicaraguan Cordoba', symbol: 'C$' },
  { code: 'CRC', name: 'Costa Rican Colon', symbol: '₡' },
  { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.' },
  { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$' },
  { code: 'HTG', name: 'Haitian Gourde', symbol: 'G' },
  { code: 'PYG', name: 'Paraguayan Guarani', symbol: '₲' },
  { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'GIP', name: 'Gibraltar Pound', symbol: '£' },
  { code: 'IMP', name: 'Isle of Man Pound', symbol: '£' },
  { code: 'JEP', name: 'Jersey Pound', symbol: '£' },
  { code: 'GGP', name: 'Guernsey Pound', symbol: '£' },
  { code: 'FKP', name: 'Falkland Islands Pound', symbol: '£' },
  { code: 'SHP', name: 'St Helena Pound', symbol: '£' },
  { code: 'CUP', name: 'Cuban Peso', symbol: '$' },
  { code: 'MRU', name: 'Mauritanian Ouguiya', symbol: 'UM' },
  { code: 'STN', name: 'Sao Tome Dobra', symbol: 'Db' },
  { code: 'SLE', name: 'Sierra Leonean Leone', symbol: 'Le' },
  { code: 'ERN', name: 'Eritrean Nakfa', symbol: 'Nfk' },
  { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj' },
  { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh' },
  { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu' },
  { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK' },
  { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz' },
  { code: 'MOP', name: 'Macanese Pataca', symbol: 'MOP$' },
];

const GENDER_RULE_LABELS: Record<string, string> = {
  any: 'Any gender',
  couples_only: 'Couples only',
  women_only: 'Women only',
  men_only: 'Men only',
  invite_only: 'Invite only',
  ratio_controlled: 'Specific ratio',
  custom: 'Custom',
};

// ── Pricing & Tickets ──────────────────────────────────────

function SearchableCurrencySelect({
  value, onChange,
}: {
  value: string; onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = CURRENCIES.find(c => c.code === value) || CURRENCIES[0];

  const filtered = query
    ? CURRENCIES.filter(c =>
        c.code.toLowerCase().includes(query.toLowerCase()) ||
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : CURRENCIES;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ ...inp, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 16 }}>{selected.symbol}</span>
        <span>{selected.code}</span>
        <span style={{ color: C.textMuted, fontSize: 12, flex: 1 }}>{selected.name}</span>
        <span style={{ color: C.textMuted, fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4,
          background: '#1e293b', border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
            <input
              autoFocus
              placeholder="Search currencies..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ ...inp, padding: '8px 12px', fontSize: 13 }}
            />
          </div>
          <div style={{ maxHeight: 220, overflow: 'auto' }}>
            {filtered.map(c => (
              <button
                key={c.code}
                onClick={() => { onChange(c.code); setOpen(false); setQuery(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px',
                  border: 'none', background: c.code === value ? C.accentBg : 'transparent',
                  color: c.code === value ? C.accent : C.text, cursor: 'pointer', fontSize: 13,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14 }}>{c.symbol}</span>
                <span style={{ fontWeight: 600, minWidth: 36 }}>{c.code}</span>
                <span style={{ color: C.textMuted, fontSize: 12 }}>{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 16, color: C.textMuted, fontSize: 13, textAlign: 'center' }}>No currencies found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PricingSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  const currencySymbol = CURRENCIES.find(c => c.code === f.currency)?.symbol || '$';

  function defaultTier(priceCents = 0): TicketTier {
    const quantity = f.unlimitedTickets ? 999999 : Math.max(f.maxAttendees, 1);
    return {
      id: crypto.randomUUID(),
      name: 'General Admission',
      type: 'general',
      priceCents,
      quantity,
      remaining: quantity,
      description: '',
      benefits: [],
      saleStartDate: '',
      saleEndDate: '',
    };
  }

  function setPaidMode() {
    set('ticketingModel', 'paid');
    if (f.ticketTiers.length === 0) {
      set('ticketTiers', [defaultTier()]);
    }
  }

  const dollarPrice = f.ticketingModel === 'free'
    ? ''
    : f.ticketTiers[0]?.priceCents
    ? (f.ticketTiers[0].priceCents / 100).toFixed(2)
    : '0.00';

  function setDollarPrice(val: string) {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      set('ticketingModel', 'free');
      set('ticketTiers', []);
      return;
    }
    const cents = Math.round(num * 100);
    setPaidMode();
    set('ticketTiers', f.ticketTiers.length > 0
      ? [{ ...f.ticketTiers[0], priceCents: cents }]
      : [defaultTier(cents)]
    );
  }

  const genderDesc = GENDER_RULE_LABELS[f.genderRule] || 'Any gender';

  return (
    <>
      <Field label="Currency">
        <SearchableCurrencySelect value={f.currency} onChange={v => set('currency', v)} />
      </Field>

      <Field label="How much does this cost?">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 18, color: C.textMuted }}>{currencySymbol}</span>
          <input
            type="number"
            min={0}
            step={f.currency === 'JPY' ? '1' : '0.01'}
            value={dollarPrice}
            onFocus={() => {
              if (f.ticketingModel === 'free') setPaidMode();
            }}
            onChange={e => setDollarPrice(e.target.value)}
            placeholder={f.ticketingModel === 'free' ? 'Click Paid to enter price' : '0.00'}
            style={{ ...inp, flex: 1, fontSize: 18, fontWeight: 700 }}
          />
          <button
            onClick={setPaidMode}
            style={{
              ...btnBase, padding: '10px 18px', fontSize: 13,
              background: f.ticketingModel === 'paid' ? C.accent : 'rgba(15,23,42,0.88)',
              border: `1px solid ${C.border}`,
              color: f.ticketingModel === 'paid' ? '#082f49' : C.text,
            }}
          >
            Paid
          </button>
          <button
            onClick={() => {
              set('ticketingModel', 'free');
              set('ticketTiers', []);
            }}
            style={{
              ...btnBase, padding: '10px 18px', fontSize: 13,
              background: f.ticketingModel === 'free' ? C.accent : 'rgba(15,23,42,0.88)',
              border: `1px solid ${C.border}`,
              color: f.ticketingModel === 'free' ? '#082f49' : C.text,
            }}
          >
            Free
          </button>
        </div>
      </Field>

      <Field label="How many tickets?">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            min={1}
            value={f.unlimitedTickets ? 0 : f.maxAttendees}
            onChange={e => set('maxAttendees', parseInt(e.target.value) || 0)}
            disabled={f.unlimitedTickets}
            style={{ ...inp, flex: 1, opacity: f.unlimitedTickets ? 0.4 : 1 }}
          />
          <label style={{ ...checkboxRow, whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={f.unlimitedTickets}
              onChange={e => set('unlimitedTickets', e.target.checked)}
              style={{ accentColor: C.accent }}
            />
            Unlimited
          </label>
        </div>
      </Field>

      <div style={{
        padding: '14px 16px', borderRadius: 14, background: 'rgba(15,23,42,0.6)',
        border: `1px solid ${C.border}`, marginTop: 4,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.textMuted }}>Gender ratio</span>
          <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{genderDesc}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['any', 'women_only', 'men_only', 'couples_only', 'ratio_controlled'] as const).map(rule => (
            <button
              key={rule}
              onClick={() => set('genderRule', rule)}
              style={{
                ...btnBase, padding: '6px 12px', fontSize: 12,
                background: f.genderRule === rule ? C.accent : 'rgba(15,23,42,0.88)',
                border: `1px solid ${C.border}`,
                color: f.genderRule === rule ? '#082f49' : C.text,
              }}
            >
              {GENDER_RULE_LABELS[rule]}
            </button>
          ))}
        </div>
        {f.genderRule === 'ratio_controlled' && (
          <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>Female</span>
            <input
              type="number" min={0} max={100}
              value={f.genderRatio.femaleMinPct ?? 50}
              onChange={e => set('genderRatio', { ...f.genderRatio, femaleMinPct: parseInt(e.target.value) || 0 })}
              style={{ ...inp, width: 60, padding: '6px 10px', textAlign: 'center' }}
            />
            <span style={{ fontSize: 12, color: C.textMuted }}>%</span>
            <span style={{ fontSize: 14, color: C.textMuted }}>|</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>Male</span>
            <input
              type="number" min={0} max={100}
              value={f.genderRatio.maleMaxPct ?? 50}
              onChange={e => set('genderRatio', { ...f.genderRatio, maleMaxPct: parseInt(e.target.value) || 0 })}
              style={{ ...inp, width: 60, padding: '6px 10px', textAlign: 'center' }}
            />
            <span style={{ fontSize: 12, color: C.textMuted }}>% max</span>
          </div>
        )}
      </div>
    </>
  );
}

// ── Basic Information ──────────────────────────────────────

function BasicInfoSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  const [newTag, setNewTag] = useState('');
  const generatedSlug = (f.eventSlug || f.eventName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const customUrl = generatedSlug ? `valueskins.app/e/${generatedSlug}` : 'valueskins.app/e/your-event';

  function addTag() {
    const t = newTag.trim();
    if (t && !f.tags.includes(t)) {
      set('tags', [...f.tags, t]);
      setNewTag('');
    }
  }

  function removeTag(t: string) {
    set('tags', f.tags.filter(x => x !== t));
  }

  return (
    <>
      <Field label="Event name" error={errors.eventName}>
        <input id="field-eventName" value={f.eventName} onChange={e => set('eventName', e.target.value)} placeholder="Sunset Launch Party" style={inp} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Category">
          <select value={f.eventCategory} onChange={e => set('eventCategory', e.target.value as EventCategory)} style={inp}>
            {EVENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select value={f.eventType} onChange={e => set('eventType', e.target.value as EventType)} style={inp}>
            <option value="in-person">In-person</option>
            <option value="virtual">Virtual</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </Field>
      </div>

      <Field label="Cover image">
        <SingleImageUpload value={f.coverImage} onChange={v => set('coverImage', v)} label="Upload cover image" />
      </Field>

      <Field label="Gallery images">
        <MultiImageUpload values={f.galleryImages} onChange={v => set('galleryImages', v)} label="Add gallery images" />
      </Field>

      <Field label="One-line summary" error={errors.oneLineSummary}>
        <input id="field-oneLineSummary" onChange={e => set('oneLineSummary', e.target.value)} placeholder="An unforgettable night of music and connection" style={inp} />
      </Field>

      <Field label="Custom event URL">
        <input value={f.eventSlug} onChange={e => set('eventSlug', e.target.value)} placeholder="sunset-launch-party" style={inp} />
        <div style={{ color: C.textMuted, fontSize: 11, marginTop: 6 }}>Live URL: {customUrl}</div>
      </Field>

      <Field label="Full description">
        <textarea value={f.fullDescription} onChange={e => set('fullDescription', e.target.value)} placeholder="Tell people what to expect..." style={{ ...inp, minHeight: 100, resize: 'vertical' }} />
      </Field>

      <Field label="Venue Tags">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {f.tags.map(t => {
            const bypass = hasSocialBypass(t);
            return (
              <span key={t} style={{
                ...tagStyle,
                ...(bypass ? { border: '1px solid #fca5a5', background: 'rgba(252,165,165,0.12)' } : {}),
              }}>
                {t}
                {bypass && <span style={{ color: C.error, fontSize: 10, marginLeft: 4 }}>!</span>}
                <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontSize: 14 }}>x</button>
              </span>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newTag} onChange={e => { setNewTag(e.target.value); }} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="e.g. rooftop, jazz, networking, open-bar..." style={{ ...inp, flex: 1 }} />
          <button onClick={() => {
            if (hasSocialBypass(newTag)) { alert('Contact info not allowed in venue tags. Use Featured People for collaborators.'); return; }
            addTag();
          }} disabled={!newTag.trim()} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px' }}>Add</button>
        </div>
        <div style={{ color: C.textMuted, fontSize: 11, marginTop: 4 }}>
          Tags describe the event/venue vibe (e.g. rooftop, jazz). NOT for people or contact info.
        </div>
      </Field>

      <Field label="Visibility">
        <select value={f.eventVisibility} onChange={e => set('eventVisibility', e.target.value as EventVisibility)} style={inp}>
          <option value="public">Public</option>
          <option value="private">Private</option>
          <option value="invite-only">Invite-only</option>
        </select>
      </Field>
    </>
  );
}

// ── Date & Time ────────────────────────────────────────────

function DateTimeSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  function setQuickDate(type: 'tomorrow' | 'dayAfter' | 'weekend') {
    const d = new Date();
    if (type === 'tomorrow') d.setDate(d.getDate() + 1);
    else if (type === 'dayAfter') d.setDate(d.getDate() + 2);
    else if (type === 'weekend') {
      const diff = 6 - d.getDay();
      d.setDate(d.getDate() + (diff >= 0 ? diff : 6));
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    set('eventDate', `${y}-${m}-${day}`);
  }

  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const btnStyle = { ...btnBase, padding: '6px 12px', fontSize: 12, background: 'rgba(56,189,248,0.1)', color: '#38bdf8' };

  return (
    <>
      <Field label="Event date" error={errors.eventDate}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setQuickDate('tomorrow')} style={btnStyle}>Tomorrow</button>
          <button type="button" onClick={() => setQuickDate('dayAfter')} style={btnStyle}>Day After</button>
          <button type="button" onClick={() => setQuickDate('weekend')} style={btnStyle}>This Weekend</button>
        </div>
        <input id="field-eventDate" type="date" min={minDate} value={f.eventDate} onChange={e => set('eventDate', e.target.value)} style={inp} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Start time" error={errors.startTime}>
          <input id="field-startTime" type="time" value={f.startTime} onChange={e => set('startTime', e.target.value)} style={inp} />
        </Field>
        <Field label="End time" error={errors.endTime}>
          <input id="field-endTime" type="time" value={f.endTime} onChange={e => set('endTime', e.target.value)} style={inp} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Doors open">
          <input type="time" value={f.doorsOpenTime} onChange={e => set('doorsOpenTime', e.target.value)} style={inp} />
        </Field>
        <Field label="Last entry">
          <input type="time" value={f.lastEntryTime} onChange={e => set('lastEntryTime', e.target.value)} style={inp} />
        </Field>
      </div>
      <Field label="Timezone">
        <SearchableSelect
          options={TIMEZONES}
          value={f.timezone}
          onChange={v => set('timezone', v)}
          placeholder="Search timezone..."
        />
      </Field>
    </>
  );
}

// ── Location ───────────────────────────────────────────────

function LocationSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  return (
    <>
      <Field label="Venue name" error={errors.venueName}>
        <input id="field-venueName" value={f.venueName} onChange={e => set('venueName', e.target.value)} placeholder="Moonlit Courtyard" style={inp} />
      </Field>
      <Field label="Full address" error={errors.fullAddress}>
        <input id="field-fullAddress" value={f.fullAddress} onChange={e => set('fullAddress', e.target.value)} placeholder="42 Sunset Blvd, Mumbai" style={inp} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Latitude (optional)">
          <input type="number" value={f.latitude ?? ''} onChange={e => set('latitude', e.target.value ? parseFloat(e.target.value) : null)} placeholder="19.0760" style={inp} />
        </Field>
        <Field label="Longitude (optional)">
          <input type="number" value={f.longitude ?? ''} onChange={e => set('longitude', e.target.value ? parseFloat(e.target.value) : null)} placeholder="72.8777" style={inp} />
        </Field>
      </div>
      <Field label="Landmark (optional)">
        <input value={f.landmark} onChange={e => set('landmark', e.target.value)} placeholder="Near Gateway of India" style={inp} />
      </Field>
      <Field label="Indoor / Outdoor">
        <select value={f.indoorOutdoor} onChange={e => set('indoorOutdoor', e.target.value as IndoorOutdoor)} style={inp}>
          {INDOOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Address reveal">
        <select value={f.addressReveal} onChange={e => set('addressReveal', e.target.value as AddressRevealTiming)} style={inp}>
          {ADDRESS_REVEAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gap: 12 }}>
        <Checkbox checked={f.parkingAvailable} onChange={v => set('parkingAvailable', v)} label="Parking available" />
        {f.parkingAvailable && (
          <div style={{ display: 'grid', gap: 8, paddingLeft: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Cars">
                <input type="number" min={0} value={f.parkingCarCapacity || ''} onChange={e => set('parkingCarCapacity', parseInt(e.target.value) || 0)} placeholder="Car spots" style={inp} />
              </Field>
              <Field label="Bikes">
                <input type="number" min={0} value={f.parkingBikeCapacity || ''} onChange={e => set('parkingBikeCapacity', parseInt(e.target.value) || 0)} placeholder="Bike spots" style={inp} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ ...checkboxRow, fontSize: 12 }}>
                <input type="checkbox" checked={f.parkingAtOwnersRisk} onChange={e => set('parkingAtOwnersRisk', e.target.checked)} style={{ accentColor: C.accent }} />
                May or may not be there, parking at owner's risk
              </label>
              <input value={f.parkingDetails} onChange={e => set('parkingDetails', e.target.value)} placeholder="Details (cost, location...)" style={inp} />
            </div>
          </div>
        )}
        <Checkbox checked={f.valetAvailable} onChange={v => set('valetAvailable', v)} label="Valet available" />
        {f.valetAvailable && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 24 }}>
            <input type="number" min={0} value={f.valetCapacity || ''} onChange={e => set('valetCapacity', parseInt(e.target.value) || 0)} placeholder="Capacity" style={inp} />
            <input value={f.valetDetails} onChange={e => set('valetDetails', e.target.value)} placeholder="Details (cost, hours...)" style={inp} />
          </div>
        )}
        <Checkbox checked={f.publicTransportNearby} onChange={v => set('publicTransportNearby', v)} label="Public transport nearby" />
        {f.publicTransportNearby && (
          <div style={{ paddingLeft: 24 }}>
            <input value={f.transportDetails} onChange={e => set('transportDetails', e.target.value)} placeholder="Details (station names, routes...)" style={inp} />
          </div>
        )}
      </div>
    </>
  );
}

// ── Ticketing ──────────────────────────────────────────────

function TicketingSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  const currencySymbol = CURRENCIES.find(c => c.code === f.currency)?.symbol || '$';

  function createTier(priceCents = 0): TicketTier {
    const quantity = f.unlimitedTickets ? 999999 : Math.max(f.maxAttendees, 1);
    return {
      id: crypto.randomUUID(),
      name: '',
      type: 'general',
      priceCents,
      quantity,
      remaining: quantity,
      description: '',
      benefits: [],
      saleStartDate: '',
      saleEndDate: '',
    };
  }

  function addTier() {
    set('ticketTiers', [...f.ticketTiers, createTier()]);
  }

  function updateTier(id: string, partial: Partial<TicketTier>) {
    set('ticketTiers', f.ticketTiers.map(t => t.id === id ? { ...t, ...partial } : t));
  }

  function removeTier(id: string) {
    set('ticketTiers', f.ticketTiers.filter(t => t.id !== id));
  }

  return (
    <>
      <Field label="Ticketing model">
        <div style={{ display: 'flex', gap: 12 }}>
          {(['free', 'paid'] as TicketingModel[]).map(m => (
            <button
              key={m}
              onClick={() => {
                set('ticketingModel', m);
                if (m === 'paid' && f.ticketTiers.length === 0) {
                  set('ticketTiers', [createTier()]);
                }
                if (m === 'free') {
                  set('ticketTiers', []);
                }
              }}
              style={{
                ...btnBase, flex: 1, padding: '12px',
                background: f.ticketingModel === m ? C.accent : 'rgba(15,23,42,0.88)',
                border: `1px solid ${C.border}`,
                color: f.ticketingModel === m ? '#082f49' : C.text,
                fontSize: 14,
              }}
            >
              {m === 'free' ? 'Free' : 'Paid'}
            </button>
          ))}
        </div>
      </Field>

      {f.ticketingModel === 'paid' && (
        <>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: C.textMuted, fontSize: 13, fontWeight: 700 }}>Ticket tiers</span>
              <button onClick={addTier} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '8px 16px' }}>+ Add tier</button>
            </div>
            {f.ticketTiers.map(tier => (
              <div key={tier.id} style={{ padding: 16, borderRadius: 16, background: 'rgba(15,23,42,0.6)', border: `1px solid ${C.border}`, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={tier.name} onChange={e => updateTier(tier.id, { name: e.target.value })} placeholder="General Admission" style={{ ...inp, flex: 1 }} />
                  <select value={tier.type} onChange={e => updateTier(tier.id, { type: e.target.value as any })} style={{ ...inp, width: 'auto', minWidth: 120 }}>
                    <option value="general">General</option>
                    <option value="early-bird">Early Bird</option>
                    <option value="vip">VIP</option>
                    <option value="group">Group</option>
                    <option value="couple">Couple</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Field label="Price">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: C.textMuted, fontSize: 14 }}>{currencySymbol}</span>
                      <input type="number" min={0} step="0.01" value={(tier.priceCents / 100).toFixed(2)} onChange={e => updateTier(tier.id, { priceCents: Math.round(parseFloat(e.target.value) * 100) || 0 })} style={inp} />
                    </div>
                  </Field>
                  <Field label="Quantity">
                    <input
                      type="number"
                      min={1}
                      value={tier.quantity}
                      onChange={e => {
                        const quantity = parseInt(e.target.value, 10) || 0;
                        updateTier(tier.id, { quantity, remaining: quantity });
                      }}
                      style={inp}
                    />
                  </Field>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Field label="Sale start">
                    <input type="date" value={tier.saleStartDate} onChange={e => updateTier(tier.id, { saleStartDate: e.target.value })} style={inp} />
                  </Field>
                  <Field label="Sale end">
                    <input type="date" value={tier.saleEndDate} onChange={e => updateTier(tier.id, { saleEndDate: e.target.value })} style={inp} />
                  </Field>
                </div>
                <Field label="Description">
                  <input value={tier.description} onChange={e => updateTier(tier.id, { description: e.target.value })} placeholder="Includes access to main area" style={inp} />
                </Field>
                <button onClick={() => removeTier(tier.id)} style={{ ...btnBase, background: C.errorBg, color: C.error, fontSize: 12, padding: '8px', alignSelf: 'start' }}>Remove</button>
              </div>
            ))}
          </div>
        </>
      )}

      {f.ticketingModel === 'paid' && (
        <Field label="Ticket sales end date">
          <input type="date" value={f.ticketSalesEndDate} onChange={e => set('ticketSalesEndDate', e.target.value)} style={inp} />
        </Field>
      )}

      <Field label="Refunds allowed?">
        <div style={{ display: 'flex', gap: 12 }}>
          {[true, false].map(v => (
            <button
              key={String(v)}
              onClick={() => set('refundAllowed', v)}
              style={{
                ...btnBase, flex: 1, padding: '10px',
                background: f.refundAllowed === v ? C.accent : 'rgba(15,23,42,0.88)',
                border: `1px solid ${C.border}`, color: f.refundAllowed === v ? '#082f49' : C.text,
                fontSize: 13,
              }}
            >
              {v ? 'Refunds available' : 'No refunds'}
            </button>
          ))}
        </div>
      </Field>
      {f.refundAllowed && (
        <Field label="Refund policy">
          <select value={f.refundPolicy} onChange={e => set('refundPolicy', e.target.value)} style={inp}>
            {REFUND_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: C.bg, color: C.text }}>{o.label}</option>)}
          </select>
        </Field>
      )}
      <Field label="Cancellation policy">
        <select value={f.cancellationPolicy} onChange={e => set('cancellationPolicy', e.target.value)} style={inp}>
          {CANCEL_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: C.bg, color: C.text }}>{o.label}</option>)}
        </select>
      </Field>
    </>
  );
}

// ── Audience ───────────────────────────────────────────────

function AudienceSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  const [newComm, setNewComm] = useState('');
  const [newInt, setNewInt] = useState('');

  function addCommunity() {
    const v = newComm.trim();
    if (v && !f.communitiesTargeted.includes(v)) { set('communitiesTargeted', [...f.communitiesTargeted, v]); setNewComm(''); }
  }

  function addInterest() {
    const v = newInt.trim();
    if (v && !f.interestsTargeted.includes(v)) { set('interestsTargeted', [...f.interestsTargeted, v]); setNewInt(''); }
  }

  return (
    <>
      <Field label="Intended audience">
        <input value={f.intendedAudience} onChange={e => set('intendedAudience', e.target.value)} placeholder="Music lovers, creatives, entrepreneurs" style={inp} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Age restriction (0 = none)">
          <input type="number" min={0} max={100} value={f.ageRestriction} onChange={e => set('ageRestriction', parseInt(e.target.value) || 0)} style={inp} />
        </Field>
        <Field label="Gender preferences">
          <select value={f.genderPreferences} onChange={e => set('genderPreferences', e.target.value as any)} style={inp}>
            <option value="any">Any</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
          </select>
        </Field>
      </div>
      <Field label="Communities targeted">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {f.communitiesTargeted.map(c => (
            <span key={c} style={tagStyle}>
              {c}
              <button onClick={() => set('communitiesTargeted', f.communitiesTargeted.filter(x => x !== c))} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontSize: 14 }}>x</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newComm} onChange={e => setNewComm(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCommunity())} placeholder="Electronic music community..." style={{ ...inp, flex: 1 }} />
          <button onClick={addCommunity} disabled={!newComm.trim()} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px' }}>Add</button>
        </div>
      </Field>
      <Field label="Interests targeted">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {f.interestsTargeted.map(i => (
            <span key={i} style={tagStyle}>
              {i}
              <button onClick={() => set('interestsTargeted', f.interestsTargeted.filter(x => x !== i))} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontSize: 14 }}>x</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newInt} onChange={e => setNewInt(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addInterest())} placeholder="Tech, fashion, art..." style={{ ...inp, flex: 1 }} />
          <button onClick={addInterest} disabled={!newInt.trim()} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px' }}>Add</button>
        </div>
      </Field>
      <Field label="Experience level">
        <select value={f.experienceLevel} onChange={e => set('experienceLevel', e.target.value as ExperienceLevel)} style={inp}>
          {EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
    </>
  );
}

// ── Featured People ────────────────────────────────────────

function FeaturedPeopleSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  const [valueskinSearch, setValueskinSearch] = useState('');
  const [featuredRole, setFeaturedRole] = useState('DJ');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);

  async function searchValueskins(term: string) {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/valueskins/search-for-tagging?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e) {
      setSearchResults([]);
    }
  }

  function addPerson() {
    if (!selectedResult) return;
    const tag: ThirdPartyTag = {
      id: crypto.randomUUID(),
      personaId: 0,
      userId: selectedResult.userId,
      name: selectedResult.displayName || selectedResult.username,
      role: featuredRole as ThirdPartyRole,
      handle: selectedResult.valueskinCode,
      avatarUrl: selectedResult.avatarUrl,
      verified: false,
      followersCount: 0,
      descriptor: `${selectedResult.professionName} — ${selectedResult.professionCategory}`,
      hasValueSkin: true,
      valueskins: [selectedResult.valueskinCode],
      approvalState: 'pending',
      isPublic: true,
      autoApprove: false,
    };
    const person: FeaturedPerson = {
      id: crypto.randomUUID(),
      tag,
      featuredRole: featuredRole,
      sortOrder: f.featuredPeople.length,
    };
    set('featuredPeople', [...f.featuredPeople, person]);
    setValueskinSearch('');
    setSelectedResult(null);
    setSearchResults([]);
  }

  function removePerson(id: string) {
    set('featuredPeople', f.featuredPeople.filter(p => p.id !== id));
  }

  return (
    <>
      <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>
        Tag creators by their ValueSkin ID. Search by ValueSkin code or profession name.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="ValueSkin ID (search)">
          <input
            value={valueskinSearch}
            onChange={e => {
              setValueskinSearch(e.target.value);
              searchValueskins(e.target.value);
            }}
            placeholder="VS-XXXXXXXX-XXXX or profession name..."
            style={inp}
          />
          {searchResults.length > 0 && (
            <div style={{ marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 8, maxHeight: 200, overflow: 'auto' }}>
              {searchResults.map(result => (
                <div
                  key={result.valueskinId}
                  onClick={() => {
                    setSelectedResult(result);
                    setValueskinSearch('');
                    setSearchResults([]);
                  }}
                  style={{
                    padding: '10px 12px',
                    borderBottom: `1px solid ${C.border}`,
                    cursor: 'pointer',
                    background: selectedResult?.valueskinId === result.valueskinId ? C.accentBg : 'transparent',
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{result.valueskinCode}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{result.displayName} — {result.professionName}</div>
                </div>
              ))}
            </div>
          )}
        </Field>
        <Field label="Role">
          <select value={featuredRole} onChange={e => setFeaturedRole(e.target.value)} style={inp}>
            {FEATURED_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </div>
      {selectedResult && (
        <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>{selectedResult.displayName}</div>
          <div style={{ color: C.textMuted }}>{selectedResult.professionName} • {selectedResult.valueskinCode}</div>
        </div>
      )}
      <button onClick={addPerson} disabled={!selectedResult} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px', width: '100%' }}>+ Add person</button>
      {f.featuredPeople.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {f.featuredPeople.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 14, background: 'rgba(15, 23, 42, 0.6)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.tag.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{p.featuredRole} — {p.tag.handle}</div>
                {p.tag.descriptor && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{p.tag.descriptor}</div>}
              </div>
              <button onClick={() => removePerson(p.id)} style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', fontSize: 13 }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Vibe & Experience ──────────────────────────────────────

function VibeSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  return (
    <>
      <Field label="Dress code">
        <input value={f.dressCode} onChange={e => set('dressCode', e.target.value)} placeholder="Black tie, Casual, Beachwear, Neon..." style={inp} />
      </Field>
      <Field label="Event vibe">
        <input value={f.eventVibe} onChange={e => set('eventVibe', e.target.value)} placeholder="Intimate, High-energy, Laid-back, Luxe..." style={inp} />
      </Field>
      <Field label="Music genres">
        <input value={f.musicGenre} onChange={e => set('musicGenre', e.target.value)} placeholder="House, Techno, Hip-hop, Jazz..." style={inp} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Networking level">
          <select value={f.networkingLevel} onChange={e => set('networkingLevel', e.target.value as Level)} style={inp}>
            {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Energy level">
          <select value={f.energyLevel} onChange={e => set('energyLevel', e.target.value as Level)} style={inp}>
            {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
    </>
  );
}

// ── Rules ──────────────────────────────────────────────────

function RulesSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  const [newItem, setNewItem] = useState('');

  function addItem() {
    const v = newItem.trim();
    if (v && !f.prohibitedItems.includes(v)) {
      set('prohibitedItems', [...f.prohibitedItems, v]);
      setNewItem('');
    }
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Checkbox checked={f.idRequired} onChange={v => set('idRequired', v)} label="ID required for entry" />
        <Checkbox checked={f.reentryAllowed} onChange={v => set('reentryAllowed', v)} label="Re-entry allowed" />
      </div>
      <Field label="Alcohol rules">
        <input value={f.alcoholRules} onChange={e => set('alcoholRules', e.target.value)} placeholder="21+ with valid ID. Bar closes at 1 AM" style={inp} />
      </Field>
      <Field label="Guest rules">
        <input value={f.guestRules} onChange={e => set('guestRules', e.target.value)} placeholder="Each guest must be accompanied by a ticket holder" style={inp} />
      </Field>
      <Field label="Photography rules">
        <input value={f.photographyRules} onChange={e => set('photographyRules', e.target.value)} placeholder="No flash photography. Phones allowed." style={inp} />
      </Field>
      <Field label="Security rules">
        <textarea value={f.securityRules} onChange={e => set('securityRules', e.target.value)} placeholder="Bag checks at entrance. No large bags allowed." style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
      </Field>
      <Field label="Prohibited items">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {PROHIBITED_ITEMS.map(item => {
            const selected = f.prohibitedItems.includes(item);
            return (
              <button
                key={item}
                onClick={() => {
                  if (selected) {
                    set('prohibitedItems', f.prohibitedItems.filter(x => x !== item));
                  } else {
                    set('prohibitedItems', [...f.prohibitedItems, item]);
                  }
                }}
                style={{
                  ...btnBase, padding: '6px 12px', fontSize: 12,
                  background: selected ? C.accent : 'rgba(15,23,42,0.6)',
                  border: `1px solid ${selected ? C.accent : C.border}`,
                  color: selected ? '#082f49' : C.text,
                }}
              >
                {selected ? '✓ ' : ''}{item}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())} placeholder="Custom item..." style={{ ...inp, flex: 1 }} />
          <button onClick={addItem} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px', cursor: 'pointer' }}>Add custom</button>
        </div>
      </Field>
    </>
  );
}

// ── FAQ ────────────────────────────────────────────────────

function FAQSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  const [q, setQ] = useState('');
  const [a, setA] = useState('');

  function addFaq() {
    if (!q.trim() || !a.trim()) return;
    const entry: FAQEntry = { id: crypto.randomUUID(), question: q.trim(), answer: a.trim() };
    set('faqEntries', [...f.faqEntries, entry]);
    setQ('');
    setA('');
  }

  function removeFaq(id: string) {
    set('faqEntries', f.faqEntries.filter(e => e.id !== id));
  }

  return (
    <>
      <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>
        Answer common questions attendees might ask.
      </p>
      {f.faqEntries.map(e => (
        <div key={e.id} style={{ padding: 14, borderRadius: 16, background: 'rgba(15,23,42,0.6)', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
            <strong style={{ fontSize: 14 }}>{e.question}</strong>
            <button onClick={() => removeFaq(e.id)} style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', fontSize: 12, padding: 2 }}>Remove</button>
          </div>
          <p style={{ margin: 0, color: C.textMuted, fontSize: 13, whiteSpace: 'pre-wrap' }}>{e.answer}</p>
        </div>
      ))}
      <div style={{ display: 'grid', gap: 10, padding: 16, borderRadius: 16, background: 'rgba(15,23,42,0.4)', border: `1px dashed ${C.border}` }}>
        <Field label="Question">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="What should I bring?" style={inp} />
        </Field>
        <Field label="Answer">
          <textarea value={a} onChange={e => setA(e.target.value)} placeholder="Bring your ID and ticket confirmation." style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
        </Field>
        <button onClick={addFaq} disabled={!q.trim() || !a.trim()} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px', width: '100%' }}>Add to FAQ</button>
      </div>
    </>
  );
}

// ── Contact ────────────────────────────────────────────────

function ContactSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  const [manager, setManager] = useState('');

  function addManager() {
    const value = manager.trim();
    if (!value || f.checkInManagers.includes(value)) return;
    set('checkInManagers', [...f.checkInManagers, value]);
    setManager('');
  }

  return (
    <>
      <Field label="Host contact" error={errors.hostContact}>
        <input id="field-hostContact" value={f.hostContact} onChange={e => set('hostContact', e.target.value)} placeholder="Your email or phone" style={inp} />
      </Field>
      <Field label="Support contact" error={errors.supportContact}>
        <input id="field-supportContact" value={f.supportContact} onChange={e => set('supportContact', e.target.value)} placeholder="support@email.com or phone" style={inp} />
      </Field>
      <Field label="Emergency contact">
        <input value={f.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} placeholder="On-site emergency number" style={inp} />
      </Field>
      <Field label="Check-in managers">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {f.checkInManagers.map((item) => (
            <span key={item} style={tagStyle}>
              {item}
              <button onClick={() => set('checkInManagers', f.checkInManagers.filter((x) => x !== item))} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontSize: 14 }}>x</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={manager} onChange={e => setManager(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManager())} placeholder="name@email.com" style={{ ...inp, flex: 1 }} />
          <button onClick={addManager} disabled={!manager.trim()} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px' }}>Add</button>
        </div>
      </Field>
      <Field label="Calendar admins included">
        <input type="number" min={1} max={5} value={f.calendarAdminCount} onChange={e => set('calendarAdminCount', Number(e.target.value) || 1)} style={inp} />
      </Field>
      <Checkbox checked={f.collectGuestNamesSeparately} onChange={v => set('collectGuestNamesSeparately', v)} label="Collect first and last names separately" />
    </>
  );
}

// ── Post-Event ─────────────────────────────────────────────

function PostEventSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <Checkbox checked={f.eventChatEnabled} onChange={v => set('eventChatEnabled', v)} label="Enable event chat" />
      <Checkbox checked={f.attendeeVisibilityEnabled} onChange={v => set('attendeeVisibilityEnabled', v)} label="Show attendee list" />
      <Checkbox checked={f.photoSharingEnabled} onChange={v => set('photoSharingEnabled', v)} label="Enable photo sharing" />
      <Checkbox checked={f.networkingEnabled} onChange={v => set('networkingEnabled', v)} label="Enable networking" />
      <Checkbox checked={f.followUpsEnabled} onChange={v => set('followUpsEnabled', v)} label="Enable follow-ups" />
    </div>
  );
}

// ── Schedule / Agenda ─────────────────────────────────────

function ScheduleSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  function addItem() {
    if (!time.trim() || !title.trim()) return;
    const item: ScheduleItem = { id: crypto.randomUUID(), time: time.trim(), title: title.trim(), description: desc.trim() };
    set('schedule', [...f.schedule, item]);
    setTime('');
    setTitle('');
    setDesc('');
  }

  function removeItem(id: string) {
    set('schedule', f.schedule.filter(s => s.id !== id));
  }

  return (
    <>
      <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>
        Build a timeline of what happens and when. Doors open, opener, main act, afterparty.
      </p>

      {f.schedule.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {f.schedule.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(15,23,42,0.6)' }}>
              <div style={{ minWidth: 60, fontWeight: 700, fontSize: 14, color: C.accent }}>{item.time}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                {item.description && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{item.description}</div>}
              </div>
              <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', fontSize: 12 }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gap: 10, padding: 16, borderRadius: 16, background: 'rgba(15,23,42,0.4)', border: `1px dashed ${C.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <Field label="Time">
            <input value={time} onChange={e => setTime(e.target.value)} placeholder="9:00 PM" style={inp} />
          </Field>
          <Field label="Title">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Doors open" style={inp} />
          </Field>
        </div>
        <Field label="Description (optional)">
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Venue opens, check-in begins" style={inp} />
        </Field>
        <button onClick={addItem} disabled={!time.trim() || !title.trim()} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px', width: '100%' }}>+ Add to schedule</button>
      </div>
    </>
  );
}

// ── Logistics ─────────────────────────────────────────────

function LogisticsSection({
  f, set, errors,
}: {
  f: CreateEventFormState; set: (k: any, v: any) => void; errors: Record<string, string>;
}) {
  const [bringItem, setBringItem] = useState('');
  const [linkItem, setLinkItem] = useState('');

  function addBring() {
    const v = bringItem.trim();
    if (v && !f.whatToBring.includes(v)) { set('whatToBring', [...f.whatToBring, v]); setBringItem(''); }
  }

  function addLink() {
    const v = linkItem.trim();
    if (v && !f.socialLinks.includes(v)) { set('socialLinks', [...f.socialLinks, v]); setLinkItem(''); }
  }

  return (
    <>
      <Field label="What to bring">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {f.whatToBring.map(item => (
            <span key={item} style={tagStyle}>
              {item}
              <button onClick={() => set('whatToBring', f.whatToBring.filter(x => x !== item))} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontSize: 14 }}>x</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={bringItem} onChange={e => setBringItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBring())} placeholder="Ticket, ID, comfortable shoes..." style={{ ...inp, flex: 1 }} />
          <button onClick={addBring} disabled={!bringItem.trim()} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px' }}>Add</button>
        </div>
      </Field>

      <Field label="Food & drink">
        <textarea value={f.foodAndDrink} onChange={e => set('foodAndDrink', e.target.value)} placeholder="Open bar, vegetarian options, catering by..." style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
      </Field>

      <Field label="Accessibility">
        <textarea value={f.accessibility} onChange={e => set('accessibility', e.target.value)} placeholder="Wheelchair accessible, hearing loops, sensory-friendly area, sign language interpreter..." style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
      </Field>

      <Field label="Weather contingency">
        <textarea value={f.weatherContingency} onChange={e => set('weatherContingency', e.target.value)} placeholder="Moves indoors in case of rain. Refunds available if cancelled." style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
      </Field>

      <Field label="Social links / hashtag">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {f.socialLinks.map(link => (
            <span key={link} style={tagStyle}>
              {link}
              <button onClick={() => set('socialLinks', f.socialLinks.filter(x => x !== link))} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontSize: 14 }}>x</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={linkItem} onChange={e => setLinkItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLink())} placeholder="Instagram, event hashtag, Discord link..." style={{ ...inp, flex: 1 }} />
          <button onClick={addLink} disabled={!linkItem.trim()} style={{ ...btnBase, background: C.accentBg, color: C.accent, fontSize: 13, padding: '12px 20px' }}>Add</button>
        </div>
      </Field>

      <Field label="Event website">
        <input value={f.eventWebsite} onChange={e => set('eventWebsite', e.target.value)} placeholder="https://myevent.com" style={inp} />
      </Field>

      <Field label="Language">
        <input value={f.language} onChange={e => set('language', e.target.value)} placeholder="English, Hindi, Marathi, etc." style={inp} />
      </Field>
    </>
  );
}

// ── Shared Components ─────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: 0, textAlign: 'left', width: 'fit-content' }}>
      Back
    </button>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>{label}</span>
        {error && <span style={{ color: C.error, fontSize: 12, fontWeight: 600 }}>{error}</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={checkboxRow}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: C.accent, width: 16, height: 16 }} />
      {label}
    </label>
  );
}
