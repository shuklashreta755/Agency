// Reverse-geocoding helper — turns a lat/lng into a human-readable place
// name. Reusable anywhere a coordinate needs to be shown to a user (not
// just Agent Tracking).
//
// Tries the Google Maps JavaScript API's Geocoder first (requires the Maps
// JS script to already be loaded, e.g. via @react-google-maps/api's
// useJsApiLoader, since it uses `window.google`). If that's unavailable or
// fails — commonly because the Geocoding API isn't enabled/billed on the
// Maps API key, which only unlocks the map/markers themselves, not
// geocoding — this falls back to OpenStreetMap's free Nominatim reverse
// endpoint, which needs no API key at all. Either way the caller gets back
// a real place name whenever one exists, rather than raw coordinates.
//
// Results are cached in memory, keyed by coordinate rounded to ~11m
// precision, so hovering/clicking the same marker repeatedly — or several
// agents sitting in the same spot — never re-hits either service for a
// coordinate it has already resolved.
const cache = new Map();

function cacheKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function googleReverseGeocode(lat, lng) {
  if (!window.google?.maps?.Geocoder) return Promise.resolve(null);

  const geocoder = new window.google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        resolve(results[0].formatted_address);
      } else {
        if (status !== 'OK') {
          // Surfaced for debugging only — e.g. "REQUEST_DENIED" almost
          // always means the Geocoding API isn't enabled/billed for this
          // key. We still resolve(null) so the OSM fallback below runs.
          console.warn(`[geocode] Google Geocoder status "${status}" for ${lat},${lng} — trying OpenStreetMap fallback.`);
        }
        resolve(null);
      }
    });
  });
}

function osmReverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=0`;

  return fetch(url, { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => data?.display_name || null)
    .catch(() => null);
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>} human-readable place name, or null if
 *   neither provider could resolve one (e.g. offline, or a spot with no
 *   nearby address data)
 */
export async function reverseGeocode(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key);

  const address = (await googleReverseGeocode(lat, lng)) || (await osmReverseGeocode(lat, lng));
  if (address) cache.set(key, address);
  return address;
}
