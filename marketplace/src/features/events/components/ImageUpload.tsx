'use client';

import type { CSSProperties } from 'react';
import { useRef, useState } from 'react';

const C = {
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  accentBg: 'rgba(56, 189, 248, 0.14)',
  surface: 'rgba(15, 23, 42, 0.86)',
};

const dropZoneStyle: CSSProperties = {
  border: `2px dashed ${C.border}`,
  borderRadius: 16,
  padding: 32,
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.2s, background 0.2s',
  background: 'rgba(15, 23, 42, 0.4)',
};

const protectOverlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 2,
  cursor: 'pointer',
};

const imgProtect: CSSProperties = {
  pointerEvents: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  MozUserSelect: 'none',
  msUserSelect: 'none',
  WebkitTouchCallout: 'none',
};

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  accept?: string;
}

export function SingleImageUpload({ value, onChange, label, accept = 'image/*' }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const uid = useRef(`img-${crypto.randomUUID()}`).current;

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return;
    const blobUrl = URL.createObjectURL(file);
    onChange(blobUrl);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
    e.target.value = '';
  }

  return (
    <div>
      {previewOpen && value && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
          onClick={() => setPreviewOpen(false)}
          onContextMenu={e => e.preventDefault()}
        >
          <img
            src={value}
            alt="Preview"
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 12, ...imgProtect }}
            draggable={false}
          />
        </div>
      )}
      <input
        ref={inputRef}
        id={uid}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />
      {value ? (
        <div
          style={{ position: 'relative', userSelect: 'none' }}
          onContextMenu={e => e.preventDefault()}
        >
          <img
            src={value}
            alt="Cover"
            style={{
              width: '100%', maxHeight: 300, borderRadius: 16,
              objectFit: 'cover',
              border: `1px solid ${C.border}`,
              pointerEvents: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
            draggable={false}
          />
          <div
            style={protectOverlay}
            onClick={() => setPreviewOpen(true)}
          />
          <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 6, zIndex: 3 }}>
            <button
              onClick={() => setPreviewOpen(true)}
              style={{
                background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 999, color: '#fff', cursor: 'pointer',
                padding: '6px 14px', fontSize: 12,
              }}
            >
              View
            </button>
            <button
              onClick={() => { URL.revokeObjectURL(value); onChange(null); }}
              style={{
                background: 'rgba(252,165,165,0.8)', border: 'none', borderRadius: 999,
                color: '#000', cursor: 'pointer', padding: '6px 14px', fontSize: 12,
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label htmlFor={uid} style={{ display: 'block' }}>
          <div
            style={dropZoneStyle}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
            <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{label}</div>
            <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>Click or drag to upload</div>
          </div>
        </label>
      )}
    </div>
  );
}

interface MultiImageUploadProps {
  values: string[];
  onChange: (urls: string[]) => void;
  label: string;
}

export function MultiImageUpload({ values, onChange, label }: MultiImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const uid = useRef(`mimg-${crypto.randomUUID()}`).current;

  function handleFiles(files: FileList) {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);
    const urls = valid.map(f => URL.createObjectURL(f));
    onChange([...values, ...urls]);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    e.target.value = '';
  }

  return (
    <div>
      {previewIdx !== null && values[previewIdx] && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
          onClick={() => setPreviewIdx(null)}
          onContextMenu={e => e.preventDefault()}
        >
          <img
            src={values[previewIdx]}
            alt="Preview"
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 12, ...imgProtect }}
            draggable={false}
          />
          <div style={{ position: 'absolute', bottom: 24, display: 'flex', gap: 12, zIndex: 3 }}>
            <button
              onClick={e => { e.stopPropagation(); setPreviewIdx(prev => prev !== null && prev > 0 ? prev - 1 : values.length - 1); }}
              style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, color: '#fff', cursor: 'pointer', padding: '8px 18px', fontSize: 14 }}
            >
              Previous
            </button>
            <span style={{ color: '#fff', fontSize: 14, alignSelf: 'center' }}>
              {previewIdx !== null ? previewIdx + 1 : 0} / {values.length}
            </span>
            <button
              onClick={e => { e.stopPropagation(); setPreviewIdx(prev => prev !== null && prev < values.length - 1 ? prev + 1 : 0); }}
              style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, color: '#fff', cursor: 'pointer', padding: '8px 18px', fontSize: 14 }}
            >
              Next
            </button>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        id={uid}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />
      {values.length > 0 && (
        <div
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, userSelect: 'none' }}
          onContextMenu={e => e.preventDefault()}
        >
          {values.map((url, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img
                src={url}
                alt={`Gallery ${i}`}
                style={{
                  width: 100, height: 100, borderRadius: 12,
                  objectFit: 'cover',
                  border: `1px solid ${C.border}`,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                }}
                draggable={false}
              />
              <div
                style={{ position: 'absolute', inset: 0, zIndex: 1, cursor: 'pointer' }}
                onClick={() => setPreviewIdx(i)}
              />
              <button
                onClick={() => { values[i]?.startsWith('blob:') && URL.revokeObjectURL(values[i]); onChange(values.filter((_, j) => j !== i)); }}
                style={{
                  position: 'absolute', top: -4, right: -4, zIndex: 2,
                  background: 'rgba(252,165,165,0.9)', border: 'none', borderRadius: 999,
                  color: '#000', cursor: 'pointer', padding: '2px 8px', fontSize: 11, lineHeight: 1.2,
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
      <label htmlFor={uid} style={{ display: 'block' }}>
        <div
          style={{ ...dropZoneStyle, padding: 16 }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files; if (f) handleFiles(f); }}
        >
          {values.length === 0 ? (
            <span style={{ color: C.accent, fontSize: 13, fontWeight: 600 }}>+ {label}</span>
          ) : (
            <span style={{ color: C.accent, fontSize: 13, fontWeight: 600 }}>+ Add more</span>
          )}
        </div>
      </label>
    </div>
  );
}
