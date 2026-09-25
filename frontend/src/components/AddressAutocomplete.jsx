import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';

/**
 * A single-city, DB-backed searchable address input (search box + Add button
 * + dropdown), used everywhere a broker/agent enters "local addresses" /
 * areas for a city — the Project form's Local Addresses field and the Lead
 * form's Preferred Locations field both render one of these per city, so the
 * two forms look and behave identically and share the same saved-address
 * memory (via /api/local-addresses).
 *
 * - Typing filters the dropdown of addresses already saved for this city.
 * - Clicking a suggestion just adds it (it already exists — no DB write).
 * - Typing something new and clicking Add (or pressing Enter) adds it to
 *   `value` immediately AND saves it to the DB in the background, so it's
 *   suggested for this city on every future project/lead.
 *
 * city: string — the field is disabled until this is set
 * value: string[] — addresses already added (rendering the "chips" list is
 *   left to the caller, since the two forms lay that part out differently)
 * onChange: (string[]) => void
 */
export default function AddressAutocomplete({ city, value = [], onChange, placeholder = 'Search or enter area / locality' }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  // Reload the suggestion list whenever the selected city changes. Guards
  // against a slow request for a previous city overwriting a newer one.
  useEffect(() => {
    setText('');
    setOpen(false);
    if (!city) { setSuggestions([]); return; }

    let cancelled = false;
    setLoading(true);
    api.get('/local-addresses', { params: { city } })
      .then(({ data }) => { if (!cancelled) setSuggestions(data.data || []); })
      .catch(() => { if (!cancelled) setSuggestions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [city]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = text.trim().toLowerCase();
  const filteredSuggestions = suggestions.filter((a) => (
    !value.some((v) => v.toLowerCase() === a.toLowerCase()) && (!q || a.toLowerCase().includes(q))
  ));
  const exactExisting = suggestions.find((a) => a.toLowerCase() === q);

  const selectExisting = (addr) => {
    if (!value.some((v) => v.toLowerCase() === addr.toLowerCase())) onChange([...value, addr]);
    setText('');
    setOpen(false);
  };

  // Adds a brand-new address: shows up immediately (so typing-and-adding
  // never feels blocked on the network) and is saved to /api/local-addresses
  // in the background so it's remembered as a suggestion for this city going
  // forward. If that save fails, the address still isn't lost — the Project
  // form backfills this same table when the project itself is saved, and the
  // Lead form's save doesn't depend on it at all.
  const addNew = async (v) => {
    onChange([...value, v]);
    setText('');
    setOpen(false);
    setSaving(true);
    try {
      const { data } = await api.post('/local-addresses', { city, address: v });
      setSuggestions((prev) => (prev.some((a) => a.toLowerCase() === data.data.toLowerCase()) ? prev : [...prev, data.data].sort()));
    } catch (err) {
      console.error('Could not save local address:', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const v = text.trim();
    if (!v || value.some((existing) => existing.toLowerCase() === v.toLowerCase())) return;
    if (exactExisting) selectExisting(exactExisting);
    else addNew(v);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          disabled={!city}
          onFocus={() => city && setOpen(true)}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === 'Escape') setOpen(false); }}
          placeholder={city ? placeholder : 'Select a city first'}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn btn-primary" disabled={!city || !text.trim() || saving} onClick={add}>
          {saving ? 'Adding...' : 'Add'}
        </button>
      </div>

      {open && city && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, width: '100%', maxHeight: 220,
          overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: 'var(--shadow)', zIndex: 60,
        }}>
          {loading && <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text-600)' }}>Loading saved addresses...</div>}

          {!loading && filteredSuggestions.map((a) => (
            <div
              key={a}
              onMouseDown={(e) => { e.preventDefault(); selectExisting(a); }}
              className="cell-sub"
              style={{ padding: '9px 12px', cursor: 'pointer', color: 'var(--text-900)' }}
            >
              {a}
            </div>
          ))}

          {!loading && filteredSuggestions.length === 0 && !q && (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text-600)' }}>No saved addresses for this city yet — type one and click Add.</div>
          )}

          {!loading && q && !exactExisting && (
            <div
              onMouseDown={(e) => { e.preventDefault(); add(); }}
              className="cell-sub"
              style={{ padding: '9px 12px', cursor: 'pointer', color: 'var(--blue-600)', fontWeight: 600, borderTop: filteredSuggestions.length ? '1px solid var(--border)' : 'none' }}
            >
              + Add "{text.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
