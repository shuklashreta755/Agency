import React, { useEffect } from 'react';

// In-app confirm box. Replaces the browser's native "localhost says" dialog
// for deletes, so the prompt matches the rest of the CRM.
export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', busy, error, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="confirm-modal" role="dialog" aria-modal="true">
        <div className="card-title">{title}</div>
        <p className="confirm-message">{message}</p>
        {error && <div className="auth-error">{error}</div>}
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
