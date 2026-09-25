// Haversine distance between two lat/lng points, in meters.
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// A location must be at least this far from the previous step's location to count
// as genuinely "different" — accounts for normal GPS drift/jitter when stationary,
// while staying well below realistic agent travel distances (e.g. pickup → project).
const DIFFERENT_LOCATION_THRESHOLD_M = 20;
// How close a reading needs to be to the project's coordinates to count as "at the project".
const PROJECT_MATCH_THRESHOLD_M = 500;

function isDifferentLocation(lat1, lng1, lat2, lng2) {
  return distanceMeters(lat1, lng1, lat2, lng2) > DIFFERENT_LOCATION_THRESHOLD_M;
}

function isNearProject(lat, lng, projectLat, projectLng) {
  return distanceMeters(lat, lng, projectLat, projectLng) <= PROJECT_MATCH_THRESHOLD_M;
}

// Best-effort reverse geocoding via OpenStreetMap's free Nominatim API — no API key
// required. Falls back to a plain coordinate string if the network call fails or
// times out, so this never blocks the actual step-tracking flow.
async function reverseGeocode(lat, lng) {
  const fallback = `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'PropelCRM/1.0' }, signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return fallback;
    const data = await res.json();
    return data.display_name || fallback;
  } catch (err) {
    return fallback;
  }
}

module.exports = {
  distanceMeters, isDifferentLocation, isNearProject, reverseGeocode,
  DIFFERENT_LOCATION_THRESHOLD_M, PROJECT_MATCH_THRESHOLD_M,
};
