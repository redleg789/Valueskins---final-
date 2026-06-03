'use client';

import { useState, useEffect } from 'react';
import { C } from '@/theme/colors';

interface ValueSkinEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  valueSkinId: string;
  currentData: {
    name: string;
    description: string;
    pitch: string;
    video: string;
  };
  onSave: (data: any) => Promise<void>;
  isLoading?: boolean;
  userRole: 'creator' | 'brand';
}

export function ValueSkinEditModal({
  isOpen,
  onClose,
  valueSkinId,
  currentData,
  onSave,
  isLoading = false,
  userRole,
}: ValueSkinEditModalProps) {
  const [formData, setFormData] = useState(currentData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setFormData(currentData);
    setError(null);
    setSuccess(false);
  }, [isOpen, currentData]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.name?.trim()) {
      setError('Name/profession is required');
      return false;
    }
    if (formData.name.length > 100) {
      setError('Name must be less than 100 characters');
      return false;
    }
    if (formData.description && formData.description.length > 500) {
      setError('Description must be less than 500 characters');
      return false;
    }
    if (formData.pitch && formData.pitch.length > 1000) {
      setError('Pitch must be less than 1000 characters');
      return false;
    }
    if (formData.video && formData.video.length > 2000) {
      setError('Video URL must be less than 2000 characters');
      return false;
    }
    if (formData.video && !isValidUrl(formData.video)) {
      setError('Please enter a valid video URL');
      return false;
    }
    return true;
  };

  const isValidUrl = (urlString: string) => {
    try {
      new URL(urlString);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setError(null);

    try {
      await onSave({
        profession: formData.name,
        aboutMe: formData.description,
        pitchText: formData.pitch,
        pitchVideo: formData.video,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to save ValueSkin');
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 40,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 50,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: C.text }}>
            Edit {userRole === 'brand' ? 'Brand' : 'Creator'} ValueSkin
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: C.textSecondary }}>
            Customize your profile representation
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
          {/* Name/Profession */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>
              {userRole === 'brand' ? 'Brand Category' : 'Profession'}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={userRole === 'brand' ? 'e.g., Fashion Brand' : 'e.g., Content Creator'}
              maxLength={100}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                background: C.surface,
                color: C.text,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ fontSize: '12px', color: C.textSecondary, marginTop: '4px' }}>
              {formData.name.length}/100
            </div>
          </div>

          {/* Description/About Me */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>
              {userRole === 'brand' ? 'Brand Description' : 'About Me'}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Tell your story..."
              maxLength={500}
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                background: C.surface,
                color: C.text,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: '12px', color: C.textSecondary, marginTop: '4px' }}>
              {formData.description.length}/500
            </div>
          </div>

          {/* Pitch Text */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>
              Pitch Text
            </label>
            <textarea
              value={formData.pitch}
              onChange={(e) => handleChange('pitch', e.target.value)}
              placeholder="Your pitch or message..."
              maxLength={1000}
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                background: C.surface,
                color: C.text,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: '12px', color: C.textSecondary, marginTop: '4px' }}>
              {formData.pitch.length}/1000
            </div>
          </div>

          {/* Video URL */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>
              Pitch Video URL
            </label>
            <input
              type="url"
              value={formData.video}
              onChange={(e) => handleChange('video', e.target.value)}
              placeholder="https://example.com/video.mp4"
              maxLength={2000}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                background: C.surface,
                color: C.text,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ fontSize: '12px', color: C.textSecondary, marginTop: '4px' }}>
              {formData.video.length}/2000 (optional)
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div
            style={{
              padding: '10px 12px',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#991b1b',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              padding: '10px 12px',
              background: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#166534',
              marginBottom: '16px',
            }}
          >
            ✓ Saved successfully!
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              background: C.border,
              color: C.text,
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              background: C.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}
