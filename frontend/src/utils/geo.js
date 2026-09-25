// Wraps the browser Geolocation API in a Promise. Rejects with a friendly message
// if location access isn't available or was denied.
//
// Deliberately uses watchPosition (and takes its first update) rather than a
// single getCurrentPosition call. On many real-world Android/Chrome builds,
// a bare getCurrentPosition — even with maximumAge: 0 — can still hand back
// a recent cached fix from the OS location service when called again
// shortly after a previous read, instead of actively re-acquiring GPS. That
// is exactly what causes two genuinely different real-world positions (e.g.
// "Customer Picked Up" and "Site Visit Started" taken ~1km apart) to
// sometimes come back as the same coordinates. watchPosition actively
// requests a fresh fix; we take its first callback and immediately stop
// watching, so callers still just get one Promise<{lat,lng}> as before.
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location access is not supported on this device.'));
      return;
    }

    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      reject(new Error(err.code === 1
        ? 'Location access was denied. Please enable it and try again.'
        : 'Could not read your current location. Please try again.'));
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        navigator.geolocation.clearWatch(watchId);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      fail,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// Human-readable "lat, lng" string, rounded to ~1m precision. Shared fallback
// used anywhere we have an exact GPS fix but no resolved street address
// (e.g. reverse geocoding is unavailable) — so the UI always shows *something*
// precise rather than a vague "unavailable" when a real coordinate exists.
export function formatCoords(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// Postgres NUMERIC/DECIMAL columns (lat/lng) come back from the API as
// strings (e.g. "22.7196000") rather than JS numbers, since that's how the
// pg driver + Sequelize serialize them by default. Shared so every consumer
// of a location object checks/coerces it the same way instead of each
// re-deriving (and possibly missing) this quirk.
export function toFiniteNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}
