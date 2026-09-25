import React, { useEffect, useRef, useState } from 'react';

/**
 * A searchable, single-select combobox. Unlike a typical "select trigger + search
 * box in a panel" pattern, THE VISIBLE FIELD ITSELF is the search input — there is
 * only ever one input on screen, never a second/duplicate search box.
 *
 * - Click the field → dropdown opens beneath it, showing every option.
 * - The same field is immediately typable → typing filters the option list live.
 * - Click an option → it's selected, the dropdown closes, and the field displays
 *   the selected label (still the same field — nothing else appears).
 * - A × appears inside the field to clear the selection back to "Unassigned"/"All".
 * - "No results found" shows in the dropdown when nothing matches.
 *
 * `options` always comes from the caller's real, dynamically-loaded API/Redux
 * data — this component never invents or hardcodes any values itself.
 */
export default function SearchableSelect({ value, onChange, options, placeholder = 'All', minWidth = 160, variant = 'toolbar' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const isForm = variant === 'form'; // used inside forms (e.g. New Lead) — matches .form-field styling instead of the toolbar look

  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  const select = (val) => {
    onChange(val);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const openDropdown = () => {
    if (!open) { setOpen(true); setQuery(''); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); }
    if (e.key === 'Enter' && filtered.length === 1) { e.preventDefault(); select(filtered[0].value); }
  };

  // What the single field displays: while open, the raw text being typed (empty
  // until the user types something); while closed, the selected option's label
  // (or blank, showing `placeholder` via the native placeholder attribute).
  const displayValue = open ? query : (selected ? selected.label : '');
  const showClear = !open && !!value;

  const baseStyle = isForm
    ? { border: '1px solid var(--border)', borderRadius: 9, padding: '10px 30px 10px 30px', fontSize: 13, background: 'var(--bg)', width: '100%', color: 'var(--text-900)' }
    : { border: '1px solid var(--border)', borderRadius: 9, padding: '9px 28px 9px 28px', fontSize: 13, background: 'var(--card)', minWidth, color: 'var(--text-900)' };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: isForm ? '100%' : 'auto' }}>
      <div style={{ position: 'relative', width: isForm ? '100%' : 'auto' }}>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-400)" strokeWidth="2.4" strokeLinecap="round"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={displayValue}
          placeholder={placeholder}
          onFocus={openDropdown}
          onClick={openDropdown}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onKeyDown={handleKeyDown}
          style={{ ...baseStyle, boxSizing: 'border-box', outline: open ? '2px solid var(--blue-500)' : 'none', outlineOffset: -1, cursor: open ? 'text' : 'pointer' }}
        />

        {showClear ? (
          <span
            onMouseDown={(e) => { e.preventDefault(); select(''); }}
            title="Clear"
            style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 15, lineHeight: 1, color: 'var(--text-600)', cursor: 'pointer' }}
          >
            &times;
          </span>
        ) : (
          <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-400)', pointerEvents: 'none' }}>
            &#9662;
          </span>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, width: isForm ? '100%' : Math.max(minWidth, 220), maxHeight: 260,
          overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: 'var(--shadow)', zIndex: 60,
        }}>
          <div
            className="cell-sub"
            onMouseDown={(e) => { e.preventDefault(); select(''); }}
            style={{ padding: '9px 12px', cursor: 'pointer', fontWeight: !value ? 600 : 400, color: !value ? 'var(--blue-600)' : 'var(--text-600)' }}
          >
            {placeholder}
          </div>

          {filtered.map((o) => (
            <div
              key={o.value}
              onMouseDown={(e) => { e.preventDefault(); select(o.value); }}
              className="cell-sub"
              style={{
                padding: '9px 12px', cursor: 'pointer', color: 'var(--text-900)',
                background: String(o.value) === String(value) ? 'var(--blue-100)' : 'transparent',
              }}
            >
              {o.label}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-600)', fontSize: 12.5 }}>
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
