import React, { useEffect, useRef, useState } from 'react';
import api, { SERVER_ORIGIN } from '../api/axios';

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const ACCEPTED_ATTR = '.jpg,.jpeg,.png,.webp';
const MAX_SIZE = 8 * 1024 * 1024; // 8MB — mirrors the backend's multer limit

/**
 * "Project Image" field on the Add/Edit Project form — a single cover image,
 * shown afterward on the project card and detail page (project.imageUrl).
 *
 * Two modes so the same field works for both New and Edit Project:
 *  - `projectId` set (editing an existing project): picking a file uploads it
 *    immediately, replacing any previous image; `onUploaded` tells the parent
 *    the new URL so it can update its own copy of the project.
 *  - `projectId` null (creating a new project — it doesn't exist yet to
 *    attach an image to): the picked file is just staged via `onFileChange`;
 *    the parent uploads it right after the project is created (see
 *    Projects.jsx handleSubmit), same pattern as the Add Documents field.
 */
export default function ProjectImage({ projectId, currentUrl, file, onFileChange, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const inputRef = useRef(null);

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
    if (!ACCEPTED_EXTENSIONS.includes(ext)) { setError('Only JPG, PNG, and WEBP images are allowed.'); return; }
    if (picked.size > MAX_SIZE) { setError('Image must be 8MB or smaller.'); return; }
    setError('');

    if (!projectId) {
      onFileChange(picked);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', picked);
      const { data } = await api.post(`/projects/${projectId}/image`, fd);
      onUploaded(data.data.imageUrl);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = previewUrl || (currentUrl ? `${SERVER_ORIGIN}${currentUrl}` : '');

  return (
    <div className="form-field">
      <label>Project Image</label>
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
          accept={ACCEPTED_ATTR}
          style={{ display: 'none' }}
          onChange={(e) => { pick(e.target.files); e.target.value = ''; }}
        />
        {displayUrl ? (
          <>
            <img src={displayUrl} alt="Project" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>{uploading ? 'Uploading...' : 'Click or drag to replace'}</div>
              <div className="cell-sub" style={{ marginTop: 1, fontSize: 11 }}>JPG, PNG, WEBP (Max 8MB)</div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: 15 }}>🖼️</div>
            <div style={{ fontWeight: 600, marginTop: 3, fontSize: 12.5 }}>{uploading ? 'Uploading...' : 'Click to upload or drag and drop'}</div>
            <div className="cell-sub" style={{ marginTop: 1, fontSize: 11 }}>JPG, PNG, WEBP (Max 8MB)</div>
          </div>
        )}
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
