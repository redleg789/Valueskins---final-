'use client';
import { useState, useEffect, CSSProperties } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const C = {
  primary: '#2563EB',
  bg: '#ffffff',
  surface: '#f9fafb',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  error: '#ef4444',
  success: '#22c55e',
};

interface Location {
  id?: number;
  city: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

const cardStyle: CSSProperties = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: '12px',
  padding: '20px',
};

export default function LocationsSettings() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Location>({ city: '', state: '', country: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/settings/locations', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch locations');
      const data = await res.json();
      setLocations(data.locations || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = () => {
    setEditingId(null);
    setFormData({ city: '', state: '', country: '' });
  };

  const handleEditLocation = (location: Location) => {
    setEditingId(location.id || null);
    setFormData(location);
  };

  const handleSaveLocation = async () => {
    if (!formData.city || !formData.country) {
      setError('City and country are required');
      return;
    }

    setSaving(true);
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId ? `/api/settings/locations/${editingId}` : '/api/settings/locations';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save location');
      setSuccess('Location saved successfully');
      await fetchLocations();
      setFormData({ city: '', state: '', country: '' });
      setEditingId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (!confirm('Delete this location?')) return;

    try {
      const res = await fetch(`/api/settings/locations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete location');
      setSuccess('Location deleted');
      await fetchLocations();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Manage Locations - ValueSkins</title>
      </Head>

      <div style={{ minHeight: '100vh', background: C.surface, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '24px' }}>
            📍 Your Locations
          </h1>

          <p style={{ color: C.textSecondary, marginBottom: '24px' }}>
            Add multiple locations to help brands find you and to indicate where you're available for collaborations.
          </p>

          {error && (
            <div style={{ padding: '12px 16px', background: '#fee2e2', color: C.error, borderRadius: '8px', marginBottom: '16px', border: `1px solid #fecaca` }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: '12px 16px', background: '#f0fdf4', color: C.success, borderRadius: '8px', marginBottom: '16px', border: `1px solid #bbf7d0` }}>
              {success}
            </div>
          )}

          {/* Existing Locations */}
          {locations.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>
                Your Locations ({locations.length})
              </h2>

              <div style={{ display: 'grid', gap: '12px' }}>
                {locations.map((location) => (
                  <div
                    key={location.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      background: C.surface,
                      borderRadius: '8px',
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: C.text }}>
                        {location.city}, {location.state && location.state + ', '}{location.country}
                      </div>
                      {location.latitude && location.longitude && (
                        <div style={{ fontSize: '12px', color: C.textSecondary }}>
                          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEditLocation(location)}
                        style={{
                          padding: '6px 12px',
                          background: C.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => location.id && handleDeleteLocation(location.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#fee2e2',
                          color: C.error,
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add/Edit Form */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>
              {editingId ? 'Edit Location' : 'Add New Location'}
            </h2>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>
                  City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g., Mumbai"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${C.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>
                  State/Province
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="e.g., Maharashtra"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${C.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>
                  Country *
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="e.g., India"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${C.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>
                    Latitude (optional)
                  </label>
                  <input
                    type="number"
                    value={formData.latitude || ''}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="e.g., 19.0760"
                    step="0.0001"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${C.border}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>
                    Longitude (optional)
                  </label>
                  <input
                    type="number"
                    value={formData.longitude || ''}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="e.g., 72.8777"
                    step="0.0001"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${C.border}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button
                  onClick={handleSaveLocation}
                  disabled={saving}
                  style={{
                    padding: '10px 24px',
                    background: saving ? C.border : C.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : editingId ? 'Update Location' : 'Add Location'}
                </button>

                {editingId && (
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ city: '', state: '', country: '' });
                    }}
                    style={{
                      padding: '10px 24px',
                      background: '#fff',
                      color: C.text,
                      border: `1px solid ${C.border}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={() => router.push('/account/settings')}
              style={{
                padding: '10px 24px',
                background: '#fff',
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← Back to Settings
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
