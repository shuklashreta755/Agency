import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from '@react-google-maps/api';
import { initials } from './icons';
import { reverseGeocode } from '../utils/geocode';
import { formatCoords, toFiniteNumber } from '../utils/geo';

const containerStyle = { width: '100%', height: '100%' };
// Fallback center used only when no agent has a live location yet.
const DEFAULT_CENTER = { lat: 22.7196, lng: 75.8577 };
const STATUS_COLOR = { online: '#1fb579', idle: '#e8a13b' };

// A simple teardrop pin path (matches the classic map-marker silhouette),
// tinted per agent status and labelled with their initials.
function pinIcon(color) {
  return {
    path: 'M12 0C6.5 0 2 4.5 2 10c0 7 10 22 10 22s10-15 10-22c0-5.5-4.5-10-10-10z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 2,
    scale: 1.3,
    anchor: new window.google.maps.Point(12, 32),
    labelOrigin: new window.google.maps.Point(12, 11),
  };
}

/**
 * Reusable Google Map for plotting a set of agents at their live GPS
 * coordinates. Not specific to any one page — pass any array shaped like
 * [{ id, name, status, location: { lat, lng, areaLabel, updatedAt } }].
 *
 * Hovering OR clicking a marker resolves and shows that agent's current
 * readable address: the backend-provided `areaLabel` is used immediately
 * when present, otherwise the lat/lng is reverse-geocoded on demand (and
 * cached) via utils/geocode. Only one info window is ever open at a time,
 * and it always reflects the marker actually being interacted with.
 *
 * `focusRequest` lets a parent (e.g. an "See Location" button in a table)
 * ask the map to jump to a specific agent without owning any map internals:
 * pass `{ id, token }` where `token` changes on every request (even for the
 * same agent) so re-clicking always re-centers. If that agent currently has
 * a known location the map pans/zooms to it and opens its info window; if
 * not, an inline "Location unavailable" notice is shown over the map instead
 * of moving it.
 */
export default function AgentLocationMap({ agents = [], height = 420, focusRequest = null }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  // hoverId closes itself on mouse-out; pinnedId (set by a click) stays open
  // until the marker is clicked again or the info window is explicitly closed.
  const [hoverId, setHoverId] = useState(null);
  const [pinnedId, setPinnedId] = useState(null);
  const [addressById, setAddressById] = useState({});
  const [resolvingId, setResolvingId] = useState(null);
  const [map, setMap] = useState(null);
  const [unavailableNotice, setUnavailableNotice] = useState(null);

  const activeId = pinnedId ?? hoverId;

  // Normalize once here so every consumer below (markers, bounds, panTo,
  // geocoding) can trust `location.lat`/`location.lng` are real numbers.
  const located = useMemo(() => {
    return agents.reduce((acc, a) => {
      const lat = toFiniteNumber(a.location?.lat);
      const lng = toFiniteNumber(a.location?.lng);
      if (lat !== null && lng !== null) acc.push({ ...a, location: { ...a.location, lat, lng } });
      return acc;
    }, []);
  }, [agents]);

  const activeAgent = located.find((a) => a.id === activeId) || null;

  const resolveAddress = useCallback((agent) => {
    if (agent.location.areaLabel || addressById[agent.id]) return;
    setResolvingId(agent.id);
    reverseGeocode(agent.location.lat, agent.location.lng).then((address) => {
      setAddressById((prev) => ({ ...prev, [agent.id]: address }));
      setResolvingId((cur) => (cur === agent.id ? null : cur));
    });
  }, [addressById]);

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    if (located.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      located.forEach((a) => bounds.extend({ lat: a.location.lat, lng: a.location.lng }));
      mapInstance.fitBounds(bounds, 64);
    }
  }, [located]);

  const closeInfoWindow = () => {
    setPinnedId(null);
    setHoverId(null);
  };

  // Handle "See Location" requests from outside the map: center on the
  // requested agent (current position if online, last known if not), or
  // surface an inline notice when no location has ever been recorded.
  useEffect(() => {
    if (!focusRequest?.id) return;

    // Look the agent up in the already-normalized `located` list first —
    // that's the source of truth for "does this agent have a usable
    // lat/lng right now", regardless of what type the API sent them as.
    const target = located.find((a) => a.id === focusRequest.id);
    if (!target) {
      const agent = agents.find((a) => a.id === focusRequest.id);
      setPinnedId(null);
      setUnavailableNotice(agent?.name || null);
      return;
    }

    setUnavailableNotice(null);
    setHoverId(null);
    setPinnedId(target.id);
    resolveAddress(target);
    if (map) {
      map.panTo({ lat: target.location.lat, lng: target.location.lng });
      if (map.getZoom() < 15) map.setZoom(15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, map, located]);

  // Auto-dismiss the "unavailable" notice so it doesn't linger indefinitely.
  useEffect(() => {
    if (!unavailableNotice) return;
    const timer = setTimeout(() => setUnavailableNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [unavailableNotice]);

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-600)', fontSize: 13, textAlign: 'center', padding: 20 }}>
        Google Maps API key is not configured. Set VITE_GOOGLE_MAPS_API_KEY in your .env file.
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-600)', fontSize: 13 }}>
        Couldn't load Google Maps. Check your connection and try again.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-600)', fontSize: 13 }}>
        Loading map…
      </div>
    );
  }

  const center = located.length ? { lat: located[0].location.lat, lng: located[0].location.lng } : DEFAULT_CENTER;

  return (
    <>
    <GoogleMap
      mapContainerStyle={{ ...containerStyle, height }}
      center={center}
      zoom={located.length ? 13 : 11}
      onLoad={onMapLoad}
      options={{ streetViewControl: false, mapTypeControl: true, fullscreenControl: true }}
    >
      {located.map((agent) => (
        <Marker
          key={agent.id}
          position={{ lat: agent.location.lat, lng: agent.location.lng }}
          icon={pinIcon(STATUS_COLOR[agent.status] || STATUS_COLOR.idle)}
          label={{ text: initials(agent.name), color: '#fff', fontSize: '11px', fontWeight: '700' }}
          onMouseOver={() => { setHoverId(agent.id); resolveAddress(agent); }}
          onMouseOut={() => setHoverId((cur) => (cur === agent.id ? null : cur))}
          onClick={() => { setPinnedId((cur) => (cur === agent.id ? null : agent.id)); resolveAddress(agent); }}
        />
      ))}

      {activeAgent && (
        <InfoWindow
          position={{ lat: activeAgent.location.lat, lng: activeAgent.location.lng }}
          onCloseClick={closeInfoWindow}
        >
          <div style={{ minWidth: 180 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: '#0f172a' }}>{activeAgent.name}</div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#5b6478', letterSpacing: '.5px', marginBottom: 2 }}>
              {activeAgent.status === 'online' ? 'Location' : 'Last known location'}
            </div>
            <div style={{ fontSize: 13, color: '#0f172a' }}>
              {activeAgent.location.areaLabel
                || addressById[activeAgent.id]
                || (resolvingId === activeAgent.id ? 'Resolving address…' : formatCoords(activeAgent.location.lat, activeAgent.location.lng))}
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              <a
                href={`https://www.google.com/maps?q=${activeAgent.location.lat},${activeAgent.location.lng}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#2f5fe0', textDecoration: 'none' }}
              >
                Open exact position in Google Maps ↗
              </a>
            </div>
            {activeAgent.status !== 'online' && activeAgent.location.updatedAt && (
              <div style={{ fontSize: 11, color: '#5b6478', marginTop: 4 }}>
                Last updated: {new Date(activeAgent.location.updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>

    {unavailableNotice && (
      <div
        role="status"
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#fff',
          border: '1px solid #f1c0c0',
          color: '#b42318',
          borderRadius: 10,
          padding: '8px 14px',
          fontSize: 12.5,
          fontWeight: 600,
          boxShadow: '0 4px 14px rgba(15,23,42,.12)',
          zIndex: 5,
        }}
      >
        Location unavailable for {unavailableNotice}.
      </div>
    )}
    </>
  );
}
