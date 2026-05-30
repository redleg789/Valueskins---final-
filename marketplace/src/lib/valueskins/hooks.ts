// ValueSkins Layer — Separate from marketplace core
// Updated independently without breaking marketplace
// Handles: credentials, stickers, verification, profiles

import { useState, useEffect } from 'react';

export const useValueSkinsCredentials = (userId: string | null, token: string | null) => {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !token) return;
    setLoading(true);

    // Fetch from ValueSkins backend
    fetch(`http://localhost:8000/api/v1/creators/${userId}/credentials`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setCredentials(d.credentials || []);
        localStorage.setItem('user_credentials', JSON.stringify(d.credentials || []));
      })
      .catch(() => {
        // Fallback to localStorage
        const stored = localStorage.getItem('user_credentials');
        setCredentials(stored ? JSON.parse(stored) : []);
      })
      .finally(() => setLoading(false));
  }, [userId, token]);

  return { credentials, loading, setCredentials };
};

export const useValueSkinsSkins = (userId: string | null, token: string | null) => {
  const [skins, setSkins] = useState<any[]>([]);
  const [ownedSkins, setOwnedSkins] = useState<any[]>([]);

  useEffect(() => {
    if (!userId || !token) return;

    // Fetch available skins
    fetch('http://localhost:8000/api/v1/skins', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSkins(d.skins || []))
      .catch(() => setSkins([]));

    // Fetch owned skins
    fetch(`http://localhost:8000/api/v1/creators/${userId}/skins`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setOwnedSkins(d.owned_skins || []))
      .catch(() => setOwnedSkins(JSON.parse(localStorage.getItem('owned_skins') || '[]')));
  }, [userId, token]);

  return { skins, ownedSkins, setSkins, setOwnedSkins };
};
