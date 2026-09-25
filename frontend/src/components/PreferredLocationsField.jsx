import React, { useEffect, useRef, useState } from 'react';
import { Country, State, City } from 'country-state-city';
import SearchableSelect from './SearchableSelect';
import AddressAutocomplete from './AddressAutocomplete';

const emptyValue = { country: '', state: '', cities: [] };

const ALL_COUNTRIES = Country.getAllCountries(); // [{ name, isoCode, ... }]
const COUNTRY_OPTIONS = ALL_COUNTRIES.map((c) => ({ value: c.isoCode, label: c.name }));
const COUNTRY_BY_NAME = Object.fromEntries(ALL_COUNTRIES.map((c) => [c.name, c]));
const COUNTRY_BY_CODE = Object.fromEntries(ALL_COUNTRIES.map((c) => [c.isoCode, c]));

/**
 * Add Lead form — "Preferred Locations": Country -> State -> multiple Cities,
 * with one or more addresses/areas per selected city.
 *
 * Country/State use the same searchable Country -> State selects as the
 * Project form (components/LocationSelect.jsx, backed by the
 * `country-state-city` package) so the two forms look and behave the same
 * way. Cities stays a multi-select (a lead can have more than one preferred
 * city, unlike a project) — typing filters real cities for the chosen state,
 * and a name with no match can still be added as a custom city, exactly as
 * before. Each selected city gets its own searchable, DB-backed address
 * autocomplete (components/AddressAutocomplete.jsx — the same one the
 * Project form's Local Addresses field uses), replacing the old free-text
 * comma-separated box with real add/select/remove of individual addresses.
 *
 * Like Country/State, `city` values here are plain NAME strings, not ISO
 * codes — ISO codes never leave this component, matching LocationSelect.
 *
 * value: { country, state, cities: [{ city, addresses: string[] }] }
 * onChange: (value) => void
 */
export default function PreferredLocationsField({ value, onChange }) {
  const v = value && value.country !== undefined ? value : emptyValue;
  const [cityQuery, setCityQuery] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const cityBoxRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (cityBoxRef.current && !cityBoxRef.current.contains(e.target)) setCityOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const countryCode = v.country ? COUNTRY_BY_NAME[v.country]?.isoCode : '';
  const statesRaw = countryCode ? State.getStatesOfCountry(countryCode) : [];
  const stateOptions = statesRaw.map((s) => ({ value: s.isoCode, label: s.name }));
  const stateCode = v.state ? statesRaw.find((s) => s.name === v.state)?.isoCode : '';

  const setCountry = (isoCode) => onChange({ country: COUNTRY_BY_CODE[isoCode]?.name || '', state: '', cities: [] });
  const setState = (isoCode) => onChange({ ...v, state: statesRaw.find((s) => s.isoCode === isoCode)?.name || '', cities: [] });

  const citiesRaw = countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode) : [];
  const availableCities = citiesRaw.map((c) => c.name); // cities have no ISO code, same as LocationSelect
  const selectedCityNames = v.cities.map((c) => c.city);
  const q = cityQuery.trim().toLowerCase();
  const filteredCities = availableCities.filter((c) => !selectedCityNames.includes(c) && (!q || c.toLowerCase().includes(q)));
  const exactMatchExists = availableCities.some((c) => c.toLowerCase() === q) || selectedCityNames.some((c) => c.toLowerCase() === q);

  const addCity = (city) => {
    const trimmed = city.trim();
    if (!trimmed || selectedCityNames.includes(trimmed)) return;
    onChange({ ...v, cities: [...v.cities, { city: trimmed, addresses: [] }] });
    setCityQuery('');
    setCityOpen(false);
  };
  const removeCity = (city) => onChange({ ...v, cities: v.cities.filter((c) => c.city !== city) });
  const setCityAddresses = (city, addresses) =>
    onChange({ ...v, cities: v.cities.map((c) => (c.city === city ? { ...c, addresses } : c)) });
  const removeCityAddress = (city, addr) =>
    onChange({ ...v, cities: v.cities.map((c) => (c.city === city ? { ...c, addresses: c.addresses.filter((a) => a !== addr) } : c)) });

  const clearAll = () => onChange(emptyValue);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
      <div className="form-grid">
        <div className="form-field">
          <label>Country</label>
          <SearchableSelect
            variant="form"
            placeholder="Select country"
            options={COUNTRY_OPTIONS}
            value={countryCode}
            onChange={setCountry}
          />
        </div>
        <div className="form-field">
          <label>State</label>
          <SearchableSelect
            variant="form"
            placeholder={v.country ? 'Select state' : 'Select a country first'}
            options={stateOptions}
            value={stateCode}
            onChange={setState}
          />
        </div>
        <div className="form-field">
          <label>Cities</label>
          <div ref={cityBoxRef} style={{ position: 'relative' }}>
            <div
              onClick={() => v.state && setCityOpen(true)}
              style={{
                border: '1px solid var(--border)', borderRadius: 9, padding: '6px 28px 6px 8px', minHeight: 40,
                display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', boxSizing: 'border-box',
                background: v.state ? 'var(--bg)' : 'var(--card)', cursor: v.state ? 'text' : 'not-allowed',
              }}
            >
              {v.cities.map((c) => (
                <span key={c.city} className="chip active" style={{ cursor: 'default' }}>
                  {c.city}
                  <span onClick={(e) => { e.stopPropagation(); removeCity(c.city); }} title="Remove" style={{ marginLeft: 5, cursor: 'pointer', fontWeight: 700 }}>&times;</span>
                </span>
              ))}
              <input
                value={cityQuery}
                disabled={!v.state}
                onFocus={() => setCityOpen(true)}
                onChange={(e) => { setCityQuery(e.target.value); setCityOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && cityQuery.trim()) { e.preventDefault(); addCity(cityQuery.trim()); } }}
                placeholder={v.cities.length ? '' : (v.state ? 'Select cities...' : 'Select a state first')}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, flex: 1, minWidth: 80, color: 'var(--text-900)' }}
              />
              <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-400)', pointerEvents: 'none' }}>
                &#9662;
              </span>
            </div>

            {cityOpen && v.state && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, width: '100%', maxHeight: 220,
                overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: 'var(--shadow)', zIndex: 60,
              }}>
                {filteredCities.map((c) => (
                  <div
                    key={c}
                    onMouseDown={(e) => { e.preventDefault(); addCity(c); }}
                    className="cell-sub"
                    style={{ padding: '9px 12px', cursor: 'pointer', color: 'var(--text-900)' }}
                  >
                    {c}
                  </div>
                ))}
                {cityQuery.trim() && !exactMatchExists && (
                  <div
                    onMouseDown={(e) => { e.preventDefault(); addCity(cityQuery.trim()); }}
                    className="link-btn"
                    style={{ padding: '9px 12px', cursor: 'pointer', display: 'block' }}
                  >
                    + Add "{cityQuery.trim()}"
                  </div>
                )}
                {filteredCities.length === 0 && !cityQuery.trim() && (
                  <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-600)', fontSize: 12.5 }}>
                    No more cities — type to add a custom one.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {v.cities.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="cell-sub" style={{ fontWeight: 600, marginBottom: 8 }}>Enter Multiple Addresses for Each City</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {v.cities.map((c) => (
              <div key={c.city} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="chip active" style={{ cursor: 'default' }}>{c.city}</span>
                  <span className="link-btn" style={{ color: 'var(--red)' }} onClick={() => removeCity(c.city)}>&times; Remove</span>
                </div>

                <AddressAutocomplete
                  city={c.city}
                  value={c.addresses}
                  onChange={(addresses) => setCityAddresses(c.city, addresses)}
                  placeholder="e.g. Baner, Wakad, Kharadi, Hadapsar, Kothrud"
                />

                {c.addresses.length > 0 && (
                  <div className="chip-row" style={{ marginTop: 10 }}>
                    {c.addresses.map((a) => (
                      <span key={a} className="chip active" style={{ cursor: 'default' }}>
                        {a}
                        <span onClick={() => removeCityAddress(c.city, a)} title="Remove" style={{ marginLeft: 6, cursor: 'pointer', fontWeight: 700 }}>&times;</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <span className="link-btn" style={{ color: 'var(--red)' }} onClick={clearAll}>Clear All</span>
          </div>
        </div>
      )}

      <p className="cell-sub" style={{ marginTop: 12, marginBottom: 0 }}>
        Select a country, then a state, add cities, and search or add addresses for each.
      </p>
    </div>
  );
}
