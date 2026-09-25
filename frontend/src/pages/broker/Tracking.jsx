import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { initials, Icons } from '../../components/icons';
import AgentLocationMap from '../../components/AgentLocationMap';
import { formatCoords, toFiniteNumber } from '../../utils/geo';
import { fetchAgentLocations } from '../../store/trackingSlice';

export default function Tracking() {
  const dispatch = useDispatch();
  const { agents } = useSelector((s) => s.tracking);

  // Tracks the most recent "See Location" click. `token` is bumped on every
  // click (even for the same agent) so the map re-centers even if it's
  // already showing that agent; the map component owns all the actual pan/
  // zoom/marker logic — this page just asks it to focus someone.
  const [focusRequest, setFocusRequest] = useState(null);

  useEffect(() => { dispatch(fetchAgentLocations()); }, [dispatch]);

  const handleSeeLocation = (agent) => {
    setFocusRequest({ id: agent.id, token: Date.now() });
  };

  // Area column: prefer the backend-provided label, else fall back to the
  // raw coordinates (coerced since Postgres NUMERIC columns arrive as
  // strings) so a real GPS fix is never hidden behind a bare "—".
  const areaText = (location) => {
    if (location?.areaLabel) return location.areaLabel;
    const lat = toFiniteNumber(location?.lat);
    const lng = toFiniteNumber(location?.lng);
    return lat !== null && lng !== null ? formatCoords(lat, lng) : '—';
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="card-title">Live Agent Locations<span>Real-time GPS position of active agents</span></div>
          <button className="link-btn" onClick={() => dispatch(fetchAgentLocations())}>Refresh</button>
        </div>
        <div className="map-box">
          <AgentLocationMap agents={agents} height="100%" focusRequest={focusRequest} />
          <div className="map-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--green)' }} />Online</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--amber)' }} />Idle</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Active Agents<span>Last known location and status</span></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Agent</th><th>Status</th><th>Area</th><th>Last Updated</th><th>Action</th></tr></thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td className="row-flex"><div className="avatar-sm" style={{ background: 'var(--blue-600)' }}>{initials(a.name)}</div><span className="cell-main">{a.name}</span></td>
                  <td><span className={`badge ${a.status === 'online' ? 'green' : a.status === 'idle' ? 'amber' : 'red'}`}>{a.status}</span></td>
                  <td>{areaText(a.location)}</td>
                  <td className="cell-sub">{a.location?.updatedAt ? new Date(a.location.updatedAt).toLocaleTimeString() : '—'}</td>
                  <td>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => handleSeeLocation(a)}
                    >
                      <span style={{ width: 14, height: 14, display: 'inline-flex' }}>{Icons.tracking}</span>
                      See Location
                    </button>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No active agents.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
