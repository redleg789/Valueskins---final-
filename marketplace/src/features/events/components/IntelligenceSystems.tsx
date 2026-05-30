'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';

const C = {
  bg: '#0f172a', surface: 'rgba(15,23,42,0.86)',
  border: 'rgba(148,163,184,0.18)', text: '#f8fafc',
  textMuted: '#94a3b8', accent: '#38bdf8', accentBg: 'rgba(56,189,248,0.14)',
  success: '#86efac', error: '#fca5a5', warning: '#fbbf24',
};

const card: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24,
  padding: 24, boxShadow: '0 20px 60px rgba(2,6,23,0.28)',
};

function Badge({ children, color = C.accent }: { children: string; color?: string }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999,
      background: `${color}1a`, color, fontSize: 11, fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

// ── Matching Engine ────────────────────────────────────────

interface MatchResult {
  accountId: number; displayName: string; matchScore: number; reason: string;
  tags: string[]; mutuals: number; coEvents: number;
}

function MatchingEngine({ eventId }: { eventId: string }) {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/intelligence/matching/${eventId}`);
      const d = await r.json();
      setMatches(d.matches || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={card}>
      <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>
        People You Should Meet
      </h3>
      <p style={{ color: C.textMuted, fontSize: 12, margin: '0 0 16px' }}>
        AI-matched connections based on interests, attendance history, and network overlap.
      </p>
      {loading ? (
        <div style={{ color: C.textMuted, textAlign: 'center', padding: 20 }}>Loading matches...</div>
      ) : matches.length === 0 ? (
        <div style={{ color: C.textMuted, textAlign: 'center', padding: 20, fontSize: 13 }}>
          No matches found yet. Attend more events to get recommendations.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {matches.map(m => (
            <div key={m.accountId} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderRadius: 16, background: 'rgba(15,23,42,0.6)',
            }}>
              <div>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{m.displayName}</div>
                <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{m.reason}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  {m.tags.map(t => <Badge key={t}>{t}</Badge>)}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  {m.mutuals} mutuals · {m.coEvents} events together
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 18, fontWeight: 800,
                  color: m.matchScore > 80 ? C.success : m.matchScore > 50 ? C.accent : C.textMuted,
                }}>
                  {m.matchScore}%
                </div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Match</div>
                <button style={{
                  marginTop: 8, border: 'none', borderRadius: 999, cursor: 'pointer',
                  padding: '6px 14px', fontSize: 11, fontWeight: 700,
                  background: C.accent, color: '#082f49',
                }}>Connect</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Audience Intelligence ──────────────────────────────────

interface AudienceData {
  totalAttendees: number; roles: { role: string; count: number; pct: number }[];
  communities: { name: string; count: number }[];
  topSegments: { label: string; pct: number }[];
  recommendations: string[];
}

function AudienceIntel({ eventId }: { eventId: string }) {
  const [data, setData] = useState<AudienceData | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/intelligence/audience/${eventId}`);
      const d = await r.json();
      setData(d);
    } catch { /* ignore */ }
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div style={{ ...card, color: C.textMuted, textAlign: 'center', padding: 30 }}>Loading audience data...</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
          Audience Composition
        </h3>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
          {data.totalAttendees} total attendees
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {data.roles.map(r => (
            <div key={r.role} style={{
              padding: '8px 14px', borderRadius: 14,
              background: 'rgba(15,23,42,0.6)', textAlign: 'center', minWidth: 80,
            }}>
              <div style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>{r.pct}%</div>
              <div style={{ color: C.textMuted, fontSize: 11 }}>{r.role}</div>
            </div>
          ))}
        </div>
      </div>

      {data.recommendations.length > 0 && (
        <div style={card}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
            Optimization Recommendations
          </h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {data.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: C.textMuted, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                {r}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.communities.length > 0 && (
        <div style={card}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
            Top Communities
          </h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {data.communities.slice(0, 8).map(c => (
              <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                <span style={{ color: C.text }}>{c.name}</span>
                <span style={{ color: C.textMuted }}>{c.count} people</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Event Memory ───────────────────────────────────────────

interface EventMemory {
  summary: string; stats: Record<string, number>;
  audienceComposition: Record<string, number>;
  promoterLeaderboard: { name: string; tickets: number; revenue: number }[];
  topCommunities: string[];
  engagementHeatmap: { hour: number; count: number }[];
}

function EventMemory({ eventId }: { eventId: string }) {
  const [memory, setMemory] = useState<EventMemory | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/intelligence/memory/${eventId}`);
      const d = await r.json();
      setMemory(d);
    } catch { /* ignore */ }
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`/api/intelligence/memory/${eventId}/generate`, { method: 'POST' });
      const d = await r.json();
      setMemory(d);
    } catch { /* ignore */ }
    setGenerating(false);
  };

  if (!memory) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 30 }}>
        <p style={{ color: C.textMuted, fontSize: 13, margin: '0 0 12px' }}>No event recap yet.</p>
        <button onClick={handleGenerate} disabled={generating} style={{
          border: 'none', borderRadius: 999, fontWeight: 700, cursor: 'pointer',
          padding: '10px 24px', fontSize: 13,
          background: C.accent, color: '#082f49',
        }}>
          {generating ? 'Generating...' : 'Generate Recap'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Event Recap</h3>
        <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>{memory.summary}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {Object.entries(memory.stats).map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center', padding: '8px', borderRadius: 12, background: 'rgba(15,23,42,0.6)' }}>
              <div style={{ color: C.accent, fontSize: 18, fontWeight: 800 }}>{v}</div>
              <div style={{ color: C.textMuted, fontSize: 10 }}>{k.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      {memory.topCommunities.length > 0 && (
        <div style={card}>
          <h4 style={{ color: C.text, fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Top Communities</h4>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {memory.topCommunities.map(c => <Badge key={c}>{c}</Badge>)}
          </div>
        </div>
      )}

      {memory.promoterLeaderboard.length > 0 && (
        <div style={card}>
          <h4 style={{ color: C.text, fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Promoter Leaderboard</h4>
          {memory.promoterLeaderboard.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <span style={{ color: C.text }}>#{i + 1} {p.name}</span>
              <span style={{ color: C.textMuted }}>{p.tickets} tickets · ${(p.revenue / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Network Graph ──────────────────────────────────────────

interface GraphEdge {
  targetId: number; targetName: string; edgeType: string; weight: number; lastSeen: string;
}

function NetworkGraph({ accountId }: { accountId: number }) {
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/intelligence/graph/edges/${accountId}`);
      const d = await r.json();
      setEdges(d.edges || []);
    } catch { /* ignore */ }
  }, [accountId]);
  useEffect(() => { load(); }, [load]);

  const clusters = ['Techno', 'Startups', 'Comedy', 'Art', 'Food'];
  const clusterData = clusters.map(c => ({
    name: c, count: Math.floor(Math.random() * 20) + 5,
  }));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
          Your Network
        </h3>
        {edges.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 12 }}>
            No connections yet. Attend events to build your network.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {edges.slice(0, 10).map(e => (
              <div key={`${e.targetId}-${e.edgeType}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 12, background: 'rgba(15,23,42,0.6)',
              }}>
                <div>
                  <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{e.targetName}</span>
                  <span style={{ color: C.textMuted, fontSize: 11, marginLeft: 8 }}>
                    {e.edgeType.replace(/_/g, ' ')}
                  </span>
                </div>
                <div style={{ color: C.accent, fontSize: 12, fontWeight: 600 }}>
                  {e.weight.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
          Relationship Clusters
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {clusterData.map(c => (
            <div key={c.name} style={{
              padding: '10px 16px', borderRadius: 16, textAlign: 'center',
              background: 'rgba(15,23,42,0.6)', minWidth: 80,
            }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{c.name}</div>
              <div style={{ color: C.textMuted, fontSize: 11 }}>{c.count} people</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Post-Event Connections ─────────────────────────────────

function PostEventConnections({ eventId }: { eventId: string }) {
  const [connections, setConnections] = useState<MatchResult[]>([]);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/intelligence/connections/${eventId}`);
      const d = await r.json();
      setConnections(d.connections || []);
    } catch { /* ignore */ }
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={card}>
      <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>
        People You Met
      </h3>
      <p style={{ color: C.textMuted, fontSize: 12, margin: '0 0 16px' }}>
        Connect with attendees who share your interests.
      </p>
      {connections.length === 0 ? (
        <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 12 }}>
          No connections to show yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {connections.map(c => (
            <div key={c.accountId} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', borderRadius: 14, background: 'rgba(15,23,42,0.6)',
            }}>
              <div>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{c.displayName}</div>
                <div style={{ color: C.textMuted, fontSize: 11 }}>{c.reason}</div>
              </div>
              <button style={{
                border: 'none', borderRadius: 999, cursor: 'pointer',
                padding: '6px 14px', fontSize: 11, fontWeight: 700,
                background: C.accentBg, color: C.accent,
              }}>Connect</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tribe Panel ────────────────────────────────────────────

interface Tribe {
  id: string; name: string; description: string; category: string;
  memberCount: number; eventCount: number; isPublic: boolean;
}

function TribePanel({ eventId, isHost }: { eventId: string; isHost: boolean }) {
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/communities/tribes');
      const d = await r.json();
      setTribes(d.tribes || []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await fetch('/api/communities/tribes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, description: '', category: '', city: '' }),
    });
    setNewName('');
    setShowCreate(false);
    load();
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {isHost && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: 0 }}>Tribe Builder</h3>
            {!showCreate && (
              <button onClick={() => setShowCreate(true)} style={{
                border: 'none', borderRadius: 999, cursor: 'pointer',
                padding: '8px 16px', fontSize: 12, fontWeight: 700,
                background: C.accent, color: '#082f49',
              }}>Create Tribe</button>
            )}
          </div>
          <p style={{ color: C.textMuted, fontSize: 12, margin: 0 }}>
            Events end. Tribes survive. Convert this event series into a persistent community.
          </p>
          {showCreate && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Tribe name (e.g. Friday Techno Tribe)"
                style={{
                  flex: 1, borderRadius: 12, border: `1px solid ${C.border}`,
                  background: 'rgba(15,23,42,0.88)', color: C.text,
                  padding: '10px 14px', fontSize: 13, outline: 'none',
                }} />
              <button onClick={handleCreate} style={{
                border: 'none', borderRadius: 999, cursor: 'pointer',
                padding: '10px 20px', fontSize: 12, fontWeight: 700,
                background: C.success, color: '#052e16',
              }}>Create</button>
              <button onClick={() => setShowCreate(false)} style={{
                border: 'none', borderRadius: 999, cursor: 'pointer',
                padding: '10px 16px', fontSize: 12, fontWeight: 600,
                background: 'transparent', color: C.textMuted,
              }}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {tribes.length > 0 && (
        <div style={card}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Active Tribes</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {tribes.map(t => (
              <div key={t.id} style={{
                padding: '12px 16px', borderRadius: 16, background: 'rgba(15,23,42,0.6)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                    <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{t.description}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: C.textMuted }}>
                      <span>{t.memberCount} members</span>
                      <span>{t.eventCount} events</span>
                      <Badge>{t.category || 'General'}</Badge>
                    </div>
                  </div>
                  <button style={{
                    border: 'none', borderRadius: 999, cursor: 'pointer',
                    padding: '6px 14px', fontSize: 11, fontWeight: 700,
                    background: C.accentBg, color: C.accent,
                  }}>Join</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Host CRM ───────────────────────────────────────────────

function HostCRM({ hostId }: { hostId: number }) {
  const [segmentFilter, setSegmentFilter] = useState('all');
  const segments = [
    { name: 'VIP', criteria: 'high_spender,repeat', count: 12, color: '#fbbf24' },
    { name: 'Frequent', criteria: '3+ events', count: 48, color: C.accent },
    { name: 'At Risk', criteria: 'no show 90d', count: 23, color: C.warning },
    { name: 'High Spender', criteria: 'top 10%', count: 8, color: C.success },
    { name: 'Lapsed', criteria: 'no show 90d+', count: 56, color: C.error },
    { name: 'Loyal', criteria: '10+ events', count: 15, color: '#c084fc' },
  ];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Attendee Segments</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
          {segments.map(s => (
            <button key={s.name} onClick={() => setSegmentFilter(s.name)}
              style={{
                border: `1px solid ${segmentFilter === s.name ? s.color : C.border}`,
                borderRadius: 16, cursor: 'pointer', textAlign: 'center',
                padding: '12px 8px', background: segmentFilter === s.name ? `${s.color}1a` : 'rgba(15,23,42,0.6)',
              }}>
              <div style={{ color: s.color, fontSize: 20, fontWeight: 800 }}>{s.count}</div>
              <div style={{ color: C.text, fontSize: 12, fontWeight: 600, marginTop: 2 }}>{s.name}</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <h4 style={{ color: C.text, fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>
            {segmentFilter === 'all' ? 'All Attendees' : segmentFilter}
          </h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 12, background: 'rgba(15,23,42,0.4)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: C.accentBg, color: C.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>A{i}</div>
                  <div>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Attendee {i}</div>
                    <div style={{ color: C.textMuted, fontSize: 11 }}>
                      {i * 3} events · ${(i * 150).toFixed(2)} spent
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{
                    border: 'none', borderRadius: 999, cursor: 'pointer',
                    padding: '4px 10px', fontSize: 10, fontWeight: 600,
                    background: 'rgba(56,189,248,0.1)', color: C.accent,
                  }}>Note</button>
                  <button style={{
                    border: 'none', borderRadius: 999, cursor: 'pointer',
                    padding: '4px 10px', fontSize: 10, fontWeight: 600,
                    background: 'rgba(134,239,172,0.1)', color: C.success,
                  }}>Invite</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button style={{
            border: 'none', borderRadius: 999, cursor: 'pointer',
            padding: '8px 16px', fontSize: 11, fontWeight: 700,
            background: 'rgba(148,163,184,0.1)', color: C.textMuted,
          }}>Export CSV</button>
          <button style={{
            border: 'none', borderRadius: 999, cursor: 'pointer',
            padding: '8px 16px', fontSize: 11, fontWeight: 700,
            background: 'rgba(148,163,184,0.1)', color: C.textMuted,
          }}>Invite Segment</button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Recent Notes</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { attendee: 'Attendee 1', note: 'VIP guest, prefers front row', label: 'VIP' },
            { attendee: 'Attendee 3', note: 'No-show last 2 events, follow up', label: 'At Risk' },
          ].map((n, i) => (
            <div key={i} style={{
              padding: '10px 14px', borderRadius: 14, background: 'rgba(15,23,42,0.6)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{n.attendee}</span>
                <Badge color={C.warning}>{n.label}</Badge>
              </div>
              <div style={{ color: C.textMuted, fontSize: 12 }}>{n.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Loyalty Engine ─────────────────────────────────────────

function LoyaltyPanel({ accountId }: { accountId: number }) {
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [tier, setTier] = useState('bronze');
  const [badges, setBadges] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const [p, s, v, b] = await Promise.all([
        fetch(`/api/crm-loyalty/points/${accountId}`).then(r => r.json()),
        fetch(`/api/crm-loyalty/streaks/${accountId}`).then(r => r.json()),
        fetch(`/api/crm-loyalty/vip/${accountId}`).then(r => r.json()),
        fetch(`/api/crm-loyalty/badges/${accountId}`).then(r => r.json()),
      ]);
      setPoints(p.points ?? 0);
      setStreak(s.currentStreak ?? 0);
      setTier(v.tier ?? 'bronze');
      setBadges(b.badges?.map((x: { badgeName: string }) => x.badgeName) ?? []);
    } catch { /* ignore */ }
  }, [accountId]);
  useEffect(() => { load(); }, [load]);

  const tierColors: Record<string, string> = {
    bronze: '#cd7f32', silver: '#c0c0c0', gold: '#fbbf24', platinum: '#e2e8f0',
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <div style={{ ...card, textAlign: 'center', padding: 20 }}>
          <div style={{ color: C.accent, fontSize: 28, fontWeight: 800 }}>{points}</div>
          <div style={{ color: C.textMuted, fontSize: 11 }}>Points</div>
        </div>
        <div style={{ ...card, textAlign: 'center', padding: 20 }}>
          <div style={{ color: C.success, fontSize: 28, fontWeight: 800 }}>{streak}</div>
          <div style={{ color: C.textMuted, fontSize: 11 }}>Event Streak</div>
        </div>
        <div style={{ ...card, textAlign: 'center', padding: 20 }}>
          <div style={{ color: tierColors[tier] || C.text, fontSize: 22, fontWeight: 800, textTransform: 'capitalize' }}>
            {tier}
          </div>
          <div style={{ color: C.textMuted, fontSize: 11 }}>VIP Tier</div>
        </div>
      </div>

      {badges.length > 0 && (
        <div style={card}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Badges</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {badges.map(b => <Badge key={b} color={C.warning}>{b}</Badge>)}
          </div>
        </div>
      )}

      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>VIP Progression</h3>
        {['bronze', 'silver', 'gold', 'platinum'].map(t => {
          const thresholds: Record<string, number> = { bronze: 0, silver: 500, gold: 1500, platinum: 5000 };
          return (
            <div key={t} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
              opacity: points >= thresholds[t] ? 1 : 0.4,
            }}>
              <div style={{ color: tierColors[t], fontWeight: 700, fontSize: 13, textTransform: 'capitalize', minWidth: 70 }}>
                {t}
              </div>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(148,163,184,0.15)' }}>
                <div style={{
                  width: `${Math.min(100, (points / thresholds[Object.keys(thresholds).find(k => thresholds[k] === (Object.values(thresholds).find(v => v > thresholds[t]) || 9999))!] || 1) * 100)}%`,
                  height: 6, borderRadius: 3,
                  background: points >= thresholds[t] ? tierColors[t] : C.border,
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ color: C.textMuted, fontSize: 11 }}>{thresholds[t]} pts</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Attendee Reputation ────────────────────────────────────

function ReputationPanel({ accountId }: { accountId: number }) {
  interface RepData { score: number; breakdown: Record<string, number>; badges: string[]; tier: string; }
  const [data, setData] = useState<RepData | null>(null);
  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        fetch(`/api/reputation/score/${accountId}`).then(r => r.json()),
        fetch(`/api/reputation/badges/${accountId}`).then(r => r.json()),
      ]);
      setData({
        score: s.score ?? 75, breakdown: s.breakdown ?? {},
        badges: b.badges?.map((x: { badgeType: string }) => x.badgeType) ?? [],
        tier: s.score >= 80 ? 'Trusted' : s.score >= 50 ? 'Reliable' : s.score >= 20 ? 'Standard' : 'Restricted',
      });
    } catch { /* ignore */ }
  }, [accountId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return null;

  const tierColors: Record<string, string> = {
    Trusted: C.success, Reliable: C.accent, Standard: C.textMuted, Restricted: C.error,
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <div style={{ ...card, textAlign: 'center', padding: 20 }}>
          <div style={{ color: tierColors[data.tier] || C.text, fontSize: 32, fontWeight: 800 }}>{data.score}</div>
          <div style={{ color: C.textMuted, fontSize: 11 }}>Trust Score</div>
        </div>
        <div style={{ ...card, textAlign: 'center', padding: 20 }}>
          <div style={{ color: tierColors[data.tier], fontSize: 18, fontWeight: 800, textTransform: 'capitalize' }}>
            {data.tier}
          </div>
          <div style={{ color: C.textMuted, fontSize: 11 }}>Status</div>
        </div>
      </div>

      {data.badges.length > 0 && (
        <div style={card}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Reputation Badges</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.badges.map(b => <Badge key={b} color={C.success}>{b.replace(/_/g, ' ')}</Badge>)}
          </div>
        </div>
      )}

      {Object.keys(data.breakdown).length > 0 && (
        <div style={card}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Score Breakdown</h3>
          <div style={{ display: 'grid', gap: 4 }}>
            {Object.entries(data.breakdown).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                <span style={{ color: C.textMuted }}>{k.replace(/_/g, ' ')}</span>
                <span style={{ color: v > 0 ? C.success : C.error, fontWeight: 600 }}>{v > 0 ? `+${v}` : v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Event Recommendations ──────────────────────────────────

interface RecResult { eventId: string; name: string; score: number; reason: string; date: string; }
function EventRecommendations({ accountId }: { accountId: number }) {
  const [recs, setRecs] = useState<RecResult[]>([]);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/intelligence/recommendations?accountId=${accountId}`);
      const d = await r.json();
      setRecs(d.recommendations || []);
    } catch { /* ignore */ }
  }, [accountId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={card}>
      <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>
        Events For You
      </h3>
      <p style={{ color: C.textMuted, fontSize: 12, margin: '0 0 16px' }}>
        AI-curated based on your interests, network, and attendance history.
      </p>
      {recs.length === 0 ? (
        <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 12 }}>
          No recommendations yet. Attend more events and set your interests.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {recs.map(r => (
            <div key={r.eventId} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderRadius: 16, background: 'rgba(15,23,42,0.6)',
            }}>
              <div>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{r.reason}</div>
                <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{r.date}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: C.accent, fontWeight: 800, fontSize: 16 }}>{r.score}%</div>
                <button style={{
                  marginTop: 4, border: 'none', borderRadius: 999, cursor: 'pointer',
                  padding: '6px 14px', fontSize: 11, fontWeight: 700,
                  background: C.accentBg, color: C.accent,
                }}>View</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Venue Intelligence ─────────────────────────────────────

function VenueIntel({ venueId }: { venueId: string }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {[
          { label: 'Avg Occupancy', value: '72%', color: C.accent },
          { label: 'Repeat Rate', value: '34%', color: C.success },
          { label: 'No-Show Rate', value: '8%', color: C.error },
          { label: 'Top Category', value: 'Techno', color: C.warning },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: 'center', padding: 16 }}>
            <div style={{ color: s.color, fontSize: 22, fontWeight: 800 }}>{s.value}</div>
            <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
          Ticket Velocity
        </h3>
        <div style={{ display: 'flex', gap: 4, alignItems: 'end', height: 80 }}>
          {[30, 45, 55, 70, 65, 80, 90, 85, 95, 100, 88, 92].map((v, i) => (
            <div key={i} style={{
              flex: 1, height: `${v}%`, borderRadius: '4px 4px 0 0',
              background: i >= 9 ? C.accent : 'rgba(148,163,184,0.3)',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
                fontSize: 9, color: C.textMuted, whiteSpace: 'nowrap',
              }}>
                {i + 1}d
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
          Revenue Trends
        </h3>
        <div style={{ display: 'grid', gap: 6 }}>
          {[
            { month: 'Jan', rev: 1200 }, { month: 'Feb', rev: 1800 },
            { month: 'Mar', rev: 2400 }, { month: 'Apr', rev: 2100 },
          ].map(m => (
            <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ color: C.textMuted, minWidth: 30 }}>{m.month}</span>
              <div style={{ flex: 1, height: 20, borderRadius: 10, background: 'rgba(148,163,184,0.1)' }}>
                <div style={{
                  width: `${(m.rev / 2400) * 100}%`, height: 20, borderRadius: 10,
                  background: C.accentBg, transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ color: C.text, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
                ${m.rev.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Admin Intelligence ─────────────────────────────────────

function AdminIntelligence() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Platform Intelligence</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 24px' }}>
        Top categories, fastest growing cities, community clusters, and retention metrics.
      </p>

      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { label: 'Total Events', value: '1,247' },
            { label: 'Active Users', value: '8,432' },
            { label: 'Repeat Rate', value: '37%' },
            { label: 'Total Revenue', value: '$84K' },
          ].map(s => (
            <div key={s.label} style={{ ...card, textAlign: 'center', padding: 16 }}>
              <div style={{ color: C.accent, fontSize: 24, fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: C.textMuted, fontSize: 11 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Top Categories</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              { name: 'Nightlife', events: 312, rev: 28500, growth: '+12%' },
              { name: 'Comedy', events: 198, rev: 18400, growth: '+8%' },
              { name: 'Music', events: 178, rev: 22300, growth: '+15%' },
              { name: 'Tech', events: 145, rev: 12100, growth: '+22%' },
              { name: 'Art', events: 98, rev: 8400, growth: '+5%' },
            ].map(c => (
              <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span style={{ color: C.text, fontWeight: 600 }}>{c.name}</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: C.textMuted }}>{c.events} events</span>
                  <span style={{ color: C.textMuted }}>${(c.rev / 100).toFixed(2)}</span>
                  <span style={{ color: C.success }}>{c.growth}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Fastest Growing Cities</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              { city: 'Pune', users: 1240, events: 89, growth: '+28%' },
              { city: 'Bangalore', users: 2100, events: 156, growth: '+18%' },
              { city: 'Mumbai', users: 1850, events: 134, growth: '+14%' },
              { city: 'Delhi', users: 980, events: 72, growth: '+22%' },
            ].map(c => (
              <div key={c.city} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span style={{ color: C.text, fontWeight: 600 }}>{c.city}</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: C.textMuted }}>{c.users} users</span>
                  <span style={{ color: C.textMuted }}>{c.events} events</span>
                  <span style={{ color: C.success }}>{c.growth}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
            Retention Metrics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {[
              { label: 'Week 1', value: '64%' },
              { label: 'Week 4', value: '41%' },
              { label: 'Month 3', value: '25%' },
              { label: 'Month 6', value: '16%' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center', padding: '12px', borderRadius: 14, background: 'rgba(15,23,42,0.6)' }}>
                <div style={{ color: C.accent, fontSize: 20, fontWeight: 800 }}>{m.value}</div>
                <div style={{ color: C.textMuted, fontSize: 11 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  MatchingEngine,
  AudienceIntel,
  EventMemory,
  NetworkGraph,
  PostEventConnections,
  TribePanel,
  HostCRM,
  LoyaltyPanel,
  ReputationPanel,
  EventRecommendations,
  VenueIntel,
  AdminIntelligence,
};
