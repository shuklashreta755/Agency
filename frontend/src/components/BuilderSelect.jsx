import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';

/**
 * Project form's "Builder Name" field — a searchable autocomplete select
 * backed by every builder name this broker's team has ever saved (via
 * /api/builders), with an Add button for ones that don't exist yet:
 *
 *  - Typing filters the list of saved builders live.
 *  - Clicking a suggestion selects it — nothing new is written to the DB.
 *  - Typing a name that doesn't match any suggestion and clicking Add (or
 *    pressing Enter) selects it here AND saves it to the DB as a new
 *    Builder, so it's suggested on every future project.
 *
 * value: string — the currently-selected/typed builder name
 * onChange: (string) => void
 */
export default function BuilderSelect({ value = '', onChange }) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [builders, setBuilders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/builders')
      .then(({ data }) => { if (!cancelled) setBuilders(data.data || []); })
      .catch(() => { if (!cancelled) setBuilders([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Keep the field's text in sync when `value` changes from outside (e.g. the
  // form resetting, or Edit Project loading an existing project's builder).
  useEffect(() => { if (!open) setText(value || ''); }, [value, open]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setText(value || ''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value]);

  const q = text.trim().toLowerCase();
  const filtered = builders.filter((b) => !q || b.toLowerCase().includes(q));
  const exactExisting = builders.find((b) => b.toLowerCase() === q);

  const selectExisting = (name) => {
    onChange(name);
    setText(name);
    setOpen(false);
  };

  // Saves a brand-new builder: selected immediately, and saved to
  // /api/builders in the background so it's remembered going forward. If
  // that save fails, the project itself still saves fine with this builder
  // name — the backend backfills this same table when the project is saved.
  const addNew = async (name) => {
    onChange(name);
    setText(name);
    setOpen(false);
    setSaving(true);
    try {
      const { data } = await api.post('/builders', { name });
      setBuilders((prev) => (prev.some((b) => b.toLowerCase() === data.data.toLowerCase()) ? prev : [...prev, data.data].sort()));
    } catch (err) {
      console.error('Could not save builder:', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (exactExisting) selectExisting(exactExisting);
    else addNew(v);
  };

  const clear = () => { onChange(''); setText(''); setOpen(false); };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            value={open ? text : value}
            onFocus={() => { setText(value || ''); setOpen(true); }}
            onChange={(e) => { setText(e.target.value); setOpen(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === 'Escape') { setOpen(false); setText(value || ''); } }}
            placeholder="Search or add a builder"
            style={{ width: '100%', boxSizing: 'border-box', paddingRight: value ? 28 : undefined }}
          />
          {!open && value && (
            <span
              onMouseDown={(e) => { e.preventDefault(); clear(); }}
              title="Clear"
              style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 15, lineHeight: 1, color: 'var(--text-600)', cursor: 'pointer' }}
            >
              &times;
            </span>
          )}
        </div>
        <button type="button" className="btn btn-primary" disabled={!text.trim() || saving} onClick={add}>
          {saving ? 'Adding...' : 'Add'}
        </button>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, width: '100%', maxHeight: 220,
          overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: 'var(--shadow)', zIndex: 60,
        }}>
          {loading && <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text-600)' }}>Loading builders...</div>}

          {!loading && filtered.map((b) => (
            <div
              key={b}
              onMouseDown={(e) => { e.preventDefault(); selectExisting(b); }}
              className="cell-sub"
              style={{ padding: '9px 12px', cursor: 'pointer', color: 'var(--text-900)', background: b === value ? 'var(--blue-100)' : 'transparent' }}
            >
              {b}
            </div>
          ))}

          {!loading && filtered.length === 0 && !q && (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text-600)' }}>No builders saved yet — type one and click Add.</div>
          )}

          {!loading && q && !exactExisting && (
            <div
              onMouseDown={(e) => { e.preventDefault(); add(); }}
              className="cell-sub"
              style={{ padding: '9px 12px', cursor: 'pointer', color: 'var(--blue-600)', fontWeight: 600, borderTop: filtered.length ? '1px solid var(--border)' : 'none' }}
            >
              + Add "{text.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
