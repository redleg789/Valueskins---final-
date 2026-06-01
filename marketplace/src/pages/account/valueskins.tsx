'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { C } from '@/theme/colors';

interface OwnedSkin {
  value_skin: string;
  purchased_at: string;
  image_url?: string;
}

export default function ValueSkinsSettings() {
  const { account } = useAuth();
  const [ownedSkins, setOwnedSkins] = useState<OwnedSkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSkin, setEditingSkin] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!account?.id) return;

    const fetchSkins = async () => {
      try {
        const res = await fetch(`/api/skins/manage?userId=${account.id}`);
        if (res.ok) {
          const data = await res.json();
          setOwnedSkins(data.skins || []);
        }
      } catch (err) {
        console.error('Failed to fetch skins:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSkins();
  }, [account?.id]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, skinName: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        alert('Image must be less than 500KB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setEditingSkin(skinName);
    }
  };

  const handleSaveImage = async (skinName: string) => {
    if (!account?.id || !imagePreview) return;

    setUploading(true);
    try {
      const res = await fetch('/api/skins/update-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: account.id,
          valueSkin: skinName,
          imageBase64: imagePreview,
        }),
      });

      if (res.ok) {
        alert('Image updated successfully!');
        setOwnedSkins(prev => prev.map(s => 
          s.value_skin === skinName ? { ...s, image_url: imagePreview } : s
        ));
        setEditingSkin(null);
        setImagePreview(null);
      } else {
        alert('Failed to update image');
      }
    } catch (err) {
      console.error('Update failed:', err);
      alert('Failed to update image');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <p style={{ color: C.textSecondary }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <Link href="/account/settings" style={{ color: C.accent, textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
            Back to Settings
          </Link>
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: '800', color: C.text, marginBottom: '12px' }}>
          ValueSkins
        </h1>
        <p style={{ fontSize: '16px', color: C.textSecondary, marginBottom: '32px' }}>
          Manage your custom ValueSkin images. Upload or update images for each profession you've unlocked.
        </p>

        {ownedSkins.length === 0 ? (
          <div style={{ padding: '32px', background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
            <p style={{ color: C.textSecondary, marginBottom: '16px' }}>
              You haven't unlocked any ValueSkins yet.
            </p>
            <Link 
              href="/valueskins/store"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: C.primary,
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              Go to Store
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {ownedSkins.map((skin) => {
              const isEditing = editingSkin === skin.value_skin;

              return (
                <div
                  key={skin.value_skin}
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: '12px',
                    padding: '24px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '20px', fontWeight: '700', color: C.text, marginBottom: '8px' }}>
                        {skin.value_skin}
                      </h3>
                      <p style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '16px' }}>
                        Unlocked: {new Date(skin.purchased_at).toLocaleDateString()}
                      </p>

                      {isEditing ? (
                        <div style={{ marginBottom: '16px' }}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageSelect(e, skin.value_skin)}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: `1px solid ${C.border}`,
                              borderRadius: '6px',
                              fontSize: '12px',
                              marginBottom: '8px',
                            }}
                          />
                          {imagePreview && (
                            <div style={{ marginBottom: '12px' }}>
                              <img
                                src={imagePreview}
                                alt="Preview"
                                style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                              />
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleSaveImage(skin.value_skin)}
                              disabled={!imagePreview || uploading}
                              style={{
                                padding: '8px 16px',
                                background: imagePreview && !uploading ? C.primary : C.textSecondary,
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: imagePreview && !uploading ? 'pointer' : 'not-allowed',
                              }}
                            >
                              {uploading ? 'Saving...' : 'Save Image'}
                            </button>
                            <button
                              onClick={() => { setEditingSkin(null); setImagePreview(null); }}
                              disabled={uploading}
                              style={{
                                padding: '8px 16px',
                                background: 'transparent',
                                color: C.text,
                                border: `1px solid ${C.border}`,
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingSkin(skin.value_skin)}
                          style={{
                            padding: '8px 16px',
                            background: C.primary,
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          {skin.image_url ? 'Change Image' : 'Upload Image'}
                        </button>
                      )}
                    </div>

                    {!isEditing && skin.image_url && (
                      <div style={{ width: '120px', height: '120px' }}>
                        <img
                          src={skin.image_url}
                          alt={skin.value_skin}
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '8px',
                            objectFit: 'cover',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
