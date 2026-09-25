import React, { useEffect, useRef, useState } from 'react';
import api, { SERVER_ORIGIN } from '../api/axios';

const DEFAULT_ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const DEFAULT_MAX_SIZE_MB = 8; // mirrors the backend's default multer limit

/**
 * Generic "single image" upload field — one entity, one image. Generalized
 * from the Project cover image field (components/ProjectImage.jsx) so any
 * entity (Agent profile photo, etc.) can reuse the same upload UX and
 * staged-file behavior without duplicating the logic.
 *
 * Two modes, same as ProjectImage, so the same field works for both
 * "create new" and "edit existing" forms:
 *  - `uploadUrl` set (the entity already exists): picking a file uploads it
 *    immediately, replacing any previous image; `onUploaded` tells the
 *    parent the new URL so it can update its own copy of the entity.
 *  - `uploadUrl` null/undefined (creating a new entity — it doesn't exist
 *    yet to attach an image to): the picked file is just staged via
 *    `onFileChange`; the parent uploads it right after the entity is
 *    created, same pattern as Projects.jsx handleSubmit.
 */
export default function ImageUploadField({
  label = 'Image',
  fieldName = 'image',
  responseKey = 'imageUrl',
  uploadUrl,
  currentUrl,
  file,
  onFileChange,
  onUploaded,
  shape = 'square',
  acceptedExtensions = DEFAULT_ACCEPTED_EXTENSIONS,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const inputRef = useRef(null);

  const maxSize = maxSizeMB * 1024 * 1024;
  const acceptedAttr = acceptedExtensions.join(',');
  const formatList = acceptedExtensions.map((e) => e.replace('.', '').toUpperCase()).join(', ');

  // Local preview for a freshly-picked (not-yet-uploaded) file.
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = async (fileList) => {
    const picked = fileList && fileList[0];
    if (!picked) return;
    const ext = `.${(picked.name.split('.').pop() || '').toLowerCase()}`;
    if (!acceptedExtensions.includes(ext)) { setError(`Only ${formatList} images are allowed.`); return; }
    if (picked.size > maxSize) { setError(`Image must be ${maxSizeMB}MB or smaller.`); return; }
    setError('');

    if (!uploadUrl) {
      onFileChange(picked);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append(fieldName, picked);
      const { data } = await api.post(uploadUrl, fd);
      onUploaded(data.data[responseKey]);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = previewUrl || (currentUrl ? `${SERVER_ORIGIN}${currentUrl}` : '');
  const radius = shape === 'circle' ? '50%' : 6;

  return (
    <div className="form-field">
      <label>{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragOver ? 'var(--blue-500)' : 'var(--border)'}`, borderRadius: 9, cursor: 'pointer',
          background: dragOver ? 'var(--blue-100)' : 'var(--bg)', overflow: 'hidden', maxWidth: 280,
          display: 'flex', alignItems: 'center', gap: 10, padding: displayUrl ? 8 : '14px 12px',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedAttr}
          style={{ display: 'none' }}
          onChange={(e) => { pick(e.target.files); e.target.value = ''; }}
        />
        {displayUrl ? (
          <>
            <img src={displayUrl} alt={label} style={{ width: 44, height: 44, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>{uploading ? 'Uploading...' : 'Click or drag to replace'}</div>
              <div className="cell-sub" style={{ marginTop: 1, fontSize: 11 }}>{formatList} (Max {maxSizeMB}MB)</div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: 15 }}>🖼️</div>
            <div style={{ fontWeight: 600, marginTop: 3, fontSize: 12.5 }}>{uploading ? 'Uploading...' : 'Click to upload or drag and drop'}</div>
            <div className="cell-sub" style={{ marginTop: 1, fontSize: 11 }}>{formatList} (Max {maxSizeMB}MB)</div>
          </div>
        )}
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
