import React, { useState } from 'react';
import { INTEREST_OPTIONS } from '../constants/leadEnums';

/**
 * Add Lead form — "Interested In" multi-select.
 * Shows the predefined property-type options (with a short description each),
 * lets the user select/deselect any number of them, and also lets them add any
 * custom interest not in the list. Selected values are shown as removable chips.
 *
 * value: string[] — e.g. ['Residential Land', 'Farm Land']
 * onChange: (string[]) => void
 */
export default function InterestedInField({ value = [], onChange }) {
  const [query, setQuery] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  const toggle = (val) => {
    onChange(value.includes(val) ? value.filter((v) => v !== val) : [...value, val]);
  };
  const remove = (val) => onChange(value.filter((v) => v !== val));

  const q = query.trim().toLowerCase();
  const filteredOptions = q
    ? INTEREST_OPTIONS.filter((o) => o.value.toLowerCase().includes(q) || o.description.toLowerCase().includes(q))
    : INTEREST_OPTIONS;

  const addCustom = () => {
    const text = customText.trim();
    if (text && !value.includes(text)) onChange([...value, text]);
    setCustomText('');
    setAddingCustom(false);
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or select interests..."
          style={{
            width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 9,
            padding: '10px 30px 10px 12px', fontSize: 13, background: 'var(--bg)', color: 'var(--text-900)',
          }}
        />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-400)', pointerEvents: 'none' }}>
          &#9662;
        </span>
      </div>

      {value.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {value.map((v) => (
            <span key={v} className="chip active" style={{ cursor: 'default' }}>
              {v}
              <span onClick={() => remove(v)} title="Remove" style={{ marginLeft: 6, cursor: 'pointer', fontWeight: 700 }}>&times;</span>
            </span>
          ))}
        </div>
      )}

      <div className="cell-sub" style={{ fontWeight: 600, marginBottom: 8 }}>Popular Options</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filteredOptions.map((opt) => {
          const selected = value.includes(opt.value);
          return (
            <div
              key={opt.value}
              onClick={() => toggle(opt.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                background: selected ? 'var(--blue-100)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{opt.icon}</span>
              <div>
                <div className="cell-main" style={{ fontSize: 13 }}>{opt.value}</div>
                <div className="cell-sub" style={{ fontSize: 11.5 }}>{opt.description}</div>
              </div>
            </div>
          );
        })}
        {filteredOptions.length === 0 && (
          <div className="cell-sub" style={{ padding: '10px 6px' }}>No matching options — add it as a custom interest below.</div>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        {addingCustom ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
                if (e.key === 'Escape') { setAddingCustom(false); setCustomText(''); }
              }}
              placeholder="e.g. Beachfront Land"
              style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, background: 'var(--bg)', color: 'var(--text-900)' }}
            />
            <button type="button" className="btn btn-primary" onClick={addCustom}>Add</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setAddingCustom(false); setCustomText(''); }}>Cancel</button>
          </div>
        ) : (
          <span className="link-btn" onClick={() => setAddingCustom(true)}>+ Add Custom Interest</span>
        )}
      </div>
    </div>
  );
}
