import React from 'react';
import AddressAutocomplete from './AddressAutocomplete';

/**
 * "Local Addresses (Multiple)" — lets the broker add any number of
 * area/locality entries for a project (e.g. "Vijay Nagar", "Bicholi
 * Mardana") and remove any of them. Matches the two-panel layout of the
 * Project form mockup: input + Add on the left, the running list on the right.
 *
 * Country -> State -> City (LocationSelect) stays completely unchanged and
 * still comes first on the form. Once a city is picked, the search/Add input
 * below (see AddressAutocomplete) is backed by every address previously saved
 * for that city — across all of this broker's projects AND leads, via
 * /api/local-addresses:
 *  - Typing filters the suggestion list live.
 *  - Clicking a suggestion (an address that already exists for this city)
 *    just adds it — nothing new is written to the DB.
 *  - Typing something that doesn't match any suggestion and clicking Add (or
 *    pressing Enter) adds it here AND saves it to the DB as a new Local
 *    Address for this city, so it shows up as a suggestion the next time any
 *    project or lead — new or existing — uses this same city.
 *
 * value: string[]
 * city: string — the currently-selected city from LocationSelect
 * onChange: (string[]) => void
 */
export default function LocalAddresses({ value = [], onChange, city, error }) {
  const remove = (addr) => onChange(value.filter((a) => a !== addr));

  return (
    <div className="form-grid" style={{ marginTop: 16 }}>
      <div className={`form-field${error ? ' has-error' : ''}`} style={{ gridColumn: 'span 2' }}>
        <label>Local Addresses (Multiple)<span className="field-required"> *</span></label>
        <div className="cell-sub" style={{ margin: '-2px 0 8px' }}>
          {city ? 'Search a saved address for this city or add a new one' : 'Select a city above first'}
        </div>
        <AddressAutocomplete
          city={city}
          value={value}
          onChange={onChange}
          placeholder="Search or enter area / locality"
        />
        {error && <div className="field-error">{error}</div>}
      </div>

      <div className={`form-field${error ? ' has-error' : ''}`}>
        <label>Added Local Addresses</label>
        <div style={{ border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`, borderRadius: 9, padding: 12, minHeight: 78, background: 'var(--bg)', boxSizing: 'border-box' }}>
          {value.length === 0 ? (
            <div className="cell-sub">No addresses added yet</div>
          ) : (
            <div className="chip-row">
              {value.map((a) => (
                <span key={a} className="chip active" style={{ cursor: 'default' }}>
                  {a}
                  <span onClick={() => remove(a)} title="Remove" style={{ marginLeft: 6, cursor: 'pointer', fontWeight: 700 }}>&times;</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
