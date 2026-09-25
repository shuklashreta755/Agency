import React from 'react';
import SearchableSelect from './SearchableSelect';
import { Country, State, City } from 'country-state-city';

const ALL_COUNTRIES = Country.getAllCountries(); // [{ name, isoCode, ... }]
const COUNTRY_OPTIONS = ALL_COUNTRIES.map((c) => ({ value: c.isoCode, label: c.name }));
const COUNTRY_BY_NAME = Object.fromEntries(ALL_COUNTRIES.map((c) => [c.name, c]));
const COUNTRY_BY_CODE = Object.fromEntries(ALL_COUNTRIES.map((c) => [c.isoCode, c]));

/**
 * Country -> State -> City cascading searchable selects for the Project form,
 * backed by the `country-state-city` package. Selecting a country loads all
 * of its states; selecting a state loads all of its cities; selecting a city
 * completes the location. Changing a field always resets everything below it.
 *
 * The library's State/City lookups require ISO codes (State.getStatesOfCountry
 * needs the country's ISO code; City.getCitiesOfState needs both ISO codes),
 * so codes are used internally to query it. But `value` / `onChange` here
 * always deal in plain, human-readable NAMES ("Algeria", "Algiers") — not
 * codes — since that's what gets saved on the project and shown everywhere
 * else in the app (city already was a name before this feature existed).
 * ISO codes never leak out of this component.
 *
 * value: { country, state, city } (each a plain NAME string, or '')
 * onChange: (nextValue) => void
 */
export default function LocationSelect({ value, onChange }) {
  const { country, state, city } = value;

  const countryCode = country ? COUNTRY_BY_NAME[country]?.isoCode : '';

  const statesRaw = countryCode ? State.getStatesOfCountry(countryCode) : [];
  const stateOptions = statesRaw.map((s) => ({ value: s.isoCode, label: s.name }));
  const stateCode = state ? statesRaw.find((s) => s.name === state)?.isoCode : '';

  const citiesRaw = countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode) : [];
  const cityOptions = citiesRaw.map((c) => ({ value: c.name, label: c.name })); // cities have no ISO code

  return (
    <>
      <div className="form-field">
        <label>Country</label>
        <SearchableSelect
          variant="form"
          placeholder="Select country"
          options={COUNTRY_OPTIONS}
          value={countryCode}
          onChange={(isoCode) => onChange({ country: COUNTRY_BY_CODE[isoCode]?.name || '', state: '', city: '' })}
        />
      </div>
      <div className="form-field">
        <label>State</label>
        <SearchableSelect
          variant="form"
          placeholder={country ? 'Select state' : 'Select a country first'}
          options={stateOptions}
          value={stateCode}
          onChange={(isoCode) => onChange({ country, state: statesRaw.find((s) => s.isoCode === isoCode)?.name || '', city: '' })}
        />
      </div>
      <div className="form-field">
        <label>City</label>
        <SearchableSelect
          variant="form"
          placeholder={state ? 'Select city' : 'Select a state first'}
          options={cityOptions}
          value={city}
          onChange={(v) => onChange({ country, state, city: v })}
        />
      </div>
    </>
  );
}
