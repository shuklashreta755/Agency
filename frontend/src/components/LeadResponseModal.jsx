import React, { useEffect, useState } from 'react';
import Badge from './Badge';
import ActivityResponses from './ActivityResponses';
import { initials, activityIcon } from './icons';
import api from '../api/axios';

function fmtDateTime(d) {
  return new Date(d).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * "Projects & Responses" popup for a single lead — opened by clicking a lead
 * row (or its "View" link) on the Leads table. Shows every project associated
 * with the lead, each with its own last-5-responses column, and lets the user
 * drill into any one project's full latest-5 list below.
 *
 * Purely additive: does not touch any existing Leads table behavior.
 */
export default function LeadResponseModal({ leadId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get(`/leads/${leadId}/project-responses`)
      .then(({ data }) => {
        if (cancelled) return;
        setData(data.data);
        setSelectedProjectId(data.data.projects[0]?.project.id || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message || 'Could not load project responses.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leadId]);

  // Close on Escape, same as the notification dropdown's convention elsewhere.
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const selectedProject = data?.projects.find((p) => p.project.id === selectedProjectId) || null;

  return (
    <div className="lead-resp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lead-resp-modal">
        <button className="lead-resp-close" onClick={onClose} aria-label="Close">&times;</button>

        {loading && <div className="lead-resp-body"><div className="cell-sub">Loading...</div></div>}
        {!loading && error && <div className="lead-resp-body"><div className="auth-error">{error}</div></div>}

        {!loading && !error && data && (
          <div className="lead-resp-body">
            <div className="lead-resp-header">
              <div className="avatar-sm" style={{ background: 'var(--blue-600)', width: 44, height: 44, fontSize: 15, marginRight: 14 }}>
                {initials(data.lead.customerName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="card-title" style={{ fontSize: 16 }}>{data.lead.customerName}</div>
                <div className="cell-sub">{data.lead.phone}</div>
              </div>
              <Badge status={data.lead.stage} />
            </div>

            <div className="card-title" style={{ marginTop: 22, marginBottom: 2 }}>Projects &amp; Responses</div>
            <div className="cell-sub" style={{ marginBottom: 14 }}>This section shows all projects related to this lead and their last 5 responses.</div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>5 Responses</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((p) => (
                    <tr key={p.project.id}>
                      <td>
                        <span className="cell-main">{p.project.name}</span>
                        {p.project.city && <div className="cell-sub">{p.project.city}</div>}
                      </td>
                      <td>{p.stage ? <Badge status={p.stage} /> : <span className="cell-sub">—</span>}</td>
                      <td><Badge status={p.isBooked ? 'Booked' : 'Not Booked'} /></td>
                      <td>
                        {p.responses.length > 0
                          ? <ActivityResponses followUps={p.responses} />
                          : <span className="cell-sub">No Responses</span>}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setSelectedProjectId(p.project.id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.projects.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No projects associated with this lead yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {data.projects.length > 0 && (
              <div className="lead-resp-detail">
                <div className="lead-resp-detail-head">
                  <div>
                    <div className="card-title" style={{ fontSize: 14 }}>Last 5 Responses<span>(For this project only)</span></div>
                  </div>
                  <select
                    className="filter-select"
                    value={selectedProjectId || ''}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    {data.projects.map((p) => (
                      <option key={p.project.id} value={p.project.id}>{p.project.name}</option>
                    ))}
                  </select>
                </div>

                {selectedProject && selectedProject.responses.length === 0 && (
                  <div className="cell-sub" style={{ padding: '18px 4px' }}>No Responses</div>
                )}

                {selectedProject && selectedProject.responses.length > 0 && (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th><th>Activity Type</th><th>Response</th><th>Notes</th><th>Date &amp; Time</th><th>Agent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProject.responses.map((r, i) => (
                          <tr key={r.id}>
                            <td className="cell-sub">{i + 1}</td>
                            <td className="row-flex">
                              <span className="activity-icon-wrap" style={{ marginRight: 8 }}>{activityIcon(r.activityType)}</span>
                              {r.activityType}
                            </td>
                            <td>{r.response ? <Badge status={r.response} /> : <span className="cell-sub">—</span>}</td>
                            <td className="cell-sub" style={{ maxWidth: 260, whiteSpace: 'normal' }}>{r.description || '—'}</td>
                            <td className="cell-sub">{fmtDateTime(r.createdAt)}</td>
                            <td className="cell-sub">{r.agent?.name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
