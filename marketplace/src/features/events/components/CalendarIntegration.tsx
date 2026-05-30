'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { CalendarLinks, EventReminder, ReminderType, CalendarPlatform, ReminderChannel } from '../data/types';

const C = {
  bg: '#0f172a', surface: 'rgba(15, 23, 42, 0.86)', border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56, 189, 248, 0.14)',
  error: '#fca5a5', success: '#86efac', warning: '#fbbf24',
};

const card: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24,
  padding: 20, boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
};

const btnBase: CSSProperties = {
  border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer', padding: '10px 20px', fontSize: 13,
};

const REMINDER_OPTIONS: { value: ReminderType; label: string; hours: number }[] = [
  { value: '1h_before', label: '1 hour before', hours: 1 },
  { value: '2h_before', label: '2 hours before', hours: 2 },
  { value: '6h_before', label: '6 hours before', hours: 6 },
  { value: '1d_before', label: '1 day before', hours: 24 },
  { value: '1w_before', label: '1 week before', hours: 168 },
];

const PLATFORM_INFO: { value: CalendarPlatform; label: string; color: string }[] = [
  { value: 'google', label: 'Google Calendar', color: '#4285F4' },
  { value: 'apple', label: 'Apple Calendar', color: '#333' },
  { value: 'outlook', label: 'Outlook', color: '#0078D4' },
];

const CHANNEL_OPTIONS: { value: ReminderChannel; label: string; placeholder: string }[] = [
  { value: 'in_app', label: 'In-app', placeholder: 'Stored on your account' },
  { value: 'email', label: 'Email', placeholder: 'you@example.com' },
  { value: 'whatsapp', label: 'WhatsApp', placeholder: '+14155550123' },
];

export default function CalendarIntegration({ eventId, eventName, eventDate, startTime, endTime, venueName, fullAddress }: {
  eventId: string; eventName: string; eventDate: string; startTime: string;
  endTime: string; venueName: string; fullAddress: string;
}) {
  const [links, setLinks] = useState<CalendarLinks | null>(null);
  const [reminders, setReminders] = useState<EventReminder[]>([]);
  const [reminderType, setReminderType] = useState<ReminderType>('1d_before');
  const [channel, setChannel] = useState<ReminderChannel>('in_app');
  const [destination, setDestination] = useState('');
  const [showReminderForm, setShowReminderForm] = useState(false);

  const loadLinks = useCallback(async () => {
    const res = await fetch(`/api/efficiency/calendar/links/${eventId}`);
    if (res.ok) setLinks(await res.json());
  }, [eventId]);

  const loadReminders = useCallback(async () => {
    const res = await fetch(`/api/efficiency/calendar/reminders?eventId=${eventId}`);
    if (res.ok) setReminders((await res.json()).reminders || []);
  }, [eventId]);

  useEffect(() => { loadLinks(); loadReminders(); }, [loadLinks, loadReminders]);

  async function addReminder() {
    const hoursBefore = REMINDER_OPTIONS.find(r => r.value === reminderType)?.hours || 24;
    const eventDateTime = new Date(`${eventDate}T${startTime || '18:00'}`);
    const remindAt = new Date(eventDateTime.getTime() - hoursBefore * 3600000);
    await fetch('/api/efficiency/calendar/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        reminderType,
        remindAt: remindAt.toISOString(),
        channel,
        destination: channel === 'in_app' ? 'in_app' : destination,
      }),
    });
    setShowReminderForm(false);
    setDestination('');
    setChannel('in_app');
    loadReminders();
  }

  async function deleteReminder(id: string) {
    await fetch(`/api/efficiency/calendar/reminder/${id}`, { method: 'DELETE' });
    loadReminders();
  }

  const weekday = eventDate ? new Date(eventDate + 'T' + (startTime || '00:00')).toLocaleDateString('en-US', { weekday: 'long' }) : '';
  const dateFormatted = eventDate ? new Date(eventDate + 'T' + (startTime || '00:00')).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Add to Calendar</div>

      {/* Calendar Buttons */}
      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {PLATFORM_INFO.map(p => (
          <a key={p.value} href={links?.[p.value] || '#'} target="_blank" rel="noopener noreferrer" style={{
            ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30`,
            textDecoration: 'none', width: '100%',
          }}>
            {p.label}
          </a>
        ))}
      </div>

      {/* ICS Download */}
      {links?.icsDownload && (
        <button onClick={async () => {
          const res = await fetch(`/api/efficiency/calendar/ics/${eventId}`, { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            const blob = new Blob([data.ics], { type: 'text/calendar' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = data.filename;
            a.click(); window.URL.revokeObjectURL(url);
          }
        }} style={{
          ...btnBase, width: '100%', background: 'rgba(148,163,184,0.1)',
          color: C.text, marginBottom: 16,
        }}>
          Download .ICS file
        </button>
      )}

      {/* Event Details for Calendar */}
      <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, padding: '10px 14px', borderRadius: 12, background: 'rgba(15,23,42,0.6)', marginBottom: 12 }}>
        <div><strong style={{ color: '#cbd5e1' }}>{eventName}</strong></div>
        <div>{weekday}, {dateFormatted} | {startTime} - {endTime}</div>
        <div>{venueName}{fullAddress ? `, ${fullAddress}` : ''}</div>
      </div>

      {/* Reminders */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Reminders</div>
        <button onClick={() => setShowReminderForm(!showReminderForm)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, padding: 0 }}>+ Add</button>
      </div>

      {showReminderForm && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <select value={reminderType} onChange={e => setReminderType(e.target.value as ReminderType)} style={{
            borderRadius: 14, border: `1px solid ${C.border}`,
            background: 'rgba(15,23,42,0.88)', color: C.text, padding: '10px 14px',
            fontSize: 14, outline: 'none',
          }}>
            {REMINDER_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select value={channel} onChange={e => setChannel(e.target.value as ReminderChannel)} style={{
            borderRadius: 14, border: `1px solid ${C.border}`,
            background: 'rgba(15,23,42,0.88)', color: C.text, padding: '10px 14px',
            fontSize: 14, outline: 'none',
          }}>
            {CHANNEL_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {channel !== 'in_app' && (
            <input
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder={CHANNEL_OPTIONS.find(c => c.value === channel)?.placeholder || ''}
              style={{
                borderRadius: 14, border: `1px solid ${C.border}`,
                background: 'rgba(15,23,42,0.88)', color: C.text, padding: '10px 14px',
                fontSize: 14, outline: 'none',
              }}
            />
          )}
          <button
            onClick={addReminder}
            disabled={channel !== 'in_app' && !destination.trim()}
            style={{ ...btnBase, background: channel !== 'in_app' && !destination.trim() ? 'rgba(148,163,184,0.25)' : C.accent, color: '#082f49', padding: '10px 16px' }}
          >
            Set
          </button>
        </div>
      )}

      {reminders.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {reminders.map(r => {
            const opt = REMINDER_OPTIONS.find(o => o.value === r.reminderType);
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 10, background: 'rgba(15,23,42,0.5)' }}>
                <span style={{ fontSize: 12, color: r.sent ? C.textMuted : C.text }}>
                  {opt?.label || r.reminderType} via {r.channel} {r.sent ? '(Sent)' : ''}
                </span>
                <button onClick={() => deleteReminder(r.id)} style={{ background: 'none', border: 'none', color: C.error, cursor: 'pointer', fontSize: 12, padding: 0 }}>Delete</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
