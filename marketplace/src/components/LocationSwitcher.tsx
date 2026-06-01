import React, { useState, useEffect } from 'react';

interface LocationSwitcherProps {
  parentBrandId: string;
  onSelect: (locationId: string) => void;
}

export default function LocationSwitcher({ parentBrandId, onSelect }: LocationSwitcherProps) {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/brand/locations?parentBrandId=${parentBrandId}`)
      .then(r => r.json())
      .then(d => {
        setLocations(d.locations || []);
        if (d.locations?.[0]) {
          setSelectedLocation(d.locations[0].location_id);
          onSelect(d.locations[0].location_id);
        }
        setLoading(false);
      });
  }, [parentBrandId, onSelect]);

  if (loading) return <div>Loading locations...</div>;
  if (locations.length === 0) return <div style={{ fontSize: '14px', color: '#6b7280' }}>No locations</div>;

  return (
    <div>
      <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
        Select Location
      </label>
      <select
        value={selectedLocation}
        onChange={(e) => {
          setSelectedLocation(e.target.value);
          onSelect(e.target.value);
        }}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      >
        {locations.map(loc => (
          <option key={loc.location_id} value={loc.location_id}>
            {loc.name} - {loc.city} (Balance: ${loc.balance})
          </option>
        ))}
      </select>
    </div>
  );
}
