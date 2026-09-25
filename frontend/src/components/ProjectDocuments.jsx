import React, { useEffect, useRef, useState } from 'react';
import api, { SERVER_ORIGIN } from '../api/axios';

const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
const ACCEPTED_ATTR = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
const MAX_SIZE = 10 * 1024 * 1024; // 10MB — mirrors the backend's multer limit

function fmtSize(bytes) {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return '📕';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return '🖼️';
  if (['doc', 'docx'].includes(ext)) return '📄';
  return '📎';
}

/**
 * "Add Documents" field on the Project form. Documents are stored via a
 * generic, polymorphic Document model (backend models/Document.js +
 * controllers/documentsController.js), keyed by (documentableType: 'project',
 * documentableId) — so this same upload / list / view / download / delete
 * setup can be reused for other entities later just by adding their own
 * nested routes and a `projectId`-equivalent prop.
 *
 * Two modes so the exact same UI works for both New and Edit Project:
 *  - `projectId` set (editing an existing project): files upload, list, and
 *    delete immediately against the server.
 *  - `projectId` null (creating a new project — it doesn't exist yet to
 *    attach files to): picked files are staged locally and handed up via
 *    `onPendingFilesChange`; the parent uploads them right after the project
 *    is created (see Projects.jsx handleSubmit) so nothing is lost.
 *
 * `readOnly` (default false) hides the upload dropzone and the delete
 * action — view/download only. Used for the agent's read-only Project
 * Details page; brokers keep full upload/delete as before.
 */
export default function ProjectDocuments({ projectId, pendingFiles = [], onPendingFilesChange, readOnly = false }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!projectId) { setDocuments([]); return; }
    let cancelled = false;
    setLoading(true);
    api.get(`/projects/${projectId}/documents`)
      .then(({ data }) => { if (!cancelled) setDocuments(data.data || []); })
      .catch(() => { if (!cancelled) setDocuments([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const validate = (files) => {
    for (const f of files) {
      const ext = `.${(f.name.split('.').pop() || '').toLowerCase()}`;
      if (!ACCEPTED_EXTENSIONS.includes(ext)) return `"${f.name}" isn't a supported file type. Allowed: PDF, JPG, PNG, DOC, DOCX.`;
      if (f.size > MAX_SIZE) return `"${f.name}" is larger than 10MB.`;
    }
    return '';
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const err = validate(files);
    if (err) { setError(err); return; }
    setError('');

    // No project yet — just stage the files; the parent form uploads them
    // once the project is actually created.
    if (!projectId) {
      onPendingFilesChange([...pendingFiles, ...files]);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('documents', f));
      const { data } = await api.post(`/projects/${projectId}/documents`, fd);
      setDocuments((prev) => [...data.data, ...prev]);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not upload document(s).');
    } finally {
      setUploading(false);
    }
  };

  const removePending = (idx) => onPendingFilesChange(pendingFiles.filter((_, i) => i !== idx));

  const removeUploaded = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"? This can't be undone.`)) return;
    try {
      await api.delete(`/attachments/${doc.id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e) {
      window.alert(e.response?.data?.message || 'Could not delete document.');
    }
  };

  const fileUrl = (doc) => `${SERVER_ORIGIN}${doc.url}`;

  // Unify staged (pre-save) and already-uploaded documents into one list so
  // the same markup renders both, just with view/download hidden for files
  // that don't have a server URL yet.
  const list = projectId
    ? documents
    : pendingFiles.map((f, i) => ({ id: `pending-${i}`, name: f.name, size: f.size, pending: true, _index: i }));

  return (
    <div className="pdoc-card">
      <div className="pdoc-header">
        <span className="pdoc-header-icon">📄</span>
        <div>
          <div className="pdoc-title">Add Documents</div>
          <div className="cell-sub">Upload multiple documents related to this project. (Stored via polymorphic association)</div>
        </div>
      </div>

      <div className="form-grid">
        {!readOnly && (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={`pdoc-dropzone${dragOver ? ' drag' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_ATTR}
              style={{ display: 'none' }}
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />
            <div className="pdoc-dropzone-icon">⬆️</div>
            <div className="pdoc-dropzone-label">{uploading ? 'Uploading...' : 'Click to upload or drag and drop'}</div>
            <div className="cell-sub pdoc-dropzone-hint">PDF, JPG, PNG, DOC, DOCX (Max 10MB each)</div>
          </div>
        )}

        <div>
          <div className="pdoc-list-label">Uploaded Documents ({list.length})</div>
          <div className="pdoc-list">
            {loading && <div className="cell-sub pdoc-empty">Loading documents...</div>}
            {!loading && list.length === 0 && <div className="cell-sub pdoc-empty">No documents uploaded yet</div>}
            {!loading && list.map((doc) => (
              <div key={doc.id} className="pdoc-row">
                <span className="pdoc-icon">{iconFor(doc.name)}</span>
                <div
                  onClick={() => { if (!doc.pending) window.open(fileUrl(doc), '_blank', 'noopener'); }}
                  title={doc.pending ? undefined : 'Click to open'}
                  className="pdoc-name"
                  style={{ cursor: doc.pending ? 'default' : 'pointer' }}
                >
                  <div className={`pdoc-filename${doc.pending ? ' pdoc-filename-pending' : ''}`}>{doc.name}</div>
                  <div className="cell-sub">
                    {(doc.name.split('.').pop() || '').toUpperCase()}{doc.size != null ? ` · ${fmtSize(doc.size)}` : ''}
                    {doc.pending ? ' · will upload on save' : ''}
                  </div>
                </div>
                {(!doc.pending || !readOnly) && (
                  <div className="pdoc-actions">
                    {!doc.pending && (
                      <a href={fileUrl(doc)} download={doc.name} title="Download" className="link-btn" onClick={(e) => e.stopPropagation()}>Download</a>
                    )}
                    {!readOnly && (
                      <span
                        onClick={(e) => { e.stopPropagation(); if (doc.pending) removePending(doc._index); else removeUploaded(doc); }}
                        title="Delete"
                        className="pdoc-delete"
                      >
                        🗑️
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="pdoc-note">{error}</div>}

      {!readOnly && (
        <p className="cell-sub pdoc-footnote">
          Documents are linked to this project using polymorphic association, so they can be reused across other modules later (e.g. projects, leads, clients).
        </p>
      )}
    </div>
  );
}
