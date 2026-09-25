import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import KpiCard from '../../components/KpiCard';
import Badge from '../../components/Badge';
import { Icons } from '../../components/icons';
import api from '../../api/axios';
import { projectsResource } from '../../store/resources';

/**
 * Read-only "My Projects" for the agent panel. The underlying /projects list
 * (projectsResource) already scopes to only this agent's assigned projects
 * server-side (see projectController.list) — nothing here needs its own
 * filtering, and there's no add/edit/delete anywhere on this page or the
 * project detail page it links to.
 */
export default function MyProjects() {
  const dispatch = useDispatch();
  const { items } = useSelector((s) => s.projects);
  const [search, setSearch] = useState('');
  // Per-project unit counts (total/available/booked) — not part of the list
  // endpoint's response, so fetched per project via the same GET /projects/:id
  // every project detail page already uses (see MyProjectDetail). Assigned
  // project counts are small, so a handful of parallel calls is cheap.
  const [unitSummaries, setUnitSummaries] = useState({});
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  useEffect(() => { dispatch(projectsResource.fetchAll({ limit: 200 })); }, [dispatch]);

  useEffect(() => {
    if (!items.length) { setUnitSummaries({}); return; }
    let cancelled = false;
    setLoadingSummaries(true);
    Promise.all(items.map((p) => api.get(`/projects/${p.id}`).then(({ data }) => [p.id, data.unitSummary]).catch(() => [p.id, null])))
      .then((pairs) => { if (!cancelled) setUnitSummaries(Object.fromEntries(pairs)); })
      .finally(() => { if (!cancelled) setLoadingSummaries(false); });
    return () => { cancelled = true; };
  }, [items]);

  const totals = useMemo(() => {
    const summaries = Object.values(unitSummaries).filter(Boolean);
    return {
      projects: items.length,
      totalUnits: summaries.reduce((s, u) => s + (u.totalUnits || 0), 0),
      availableUnits: summaries.reduce((s, u) => s + (u.availableUnits || 0), 0),
      bookedUnits: summaries.reduce((s, u) => s + (u.bookedUnits || 0), 0),
    };
  }, [items, unitSummaries]);

  const filtered = items.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
    || (p.builderName || '').toLowerCase().includes(search.toLowerCase())
    || (p.city || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Assigned Projects" value={totals.projects} icon={Icons.properties} color="#2f6fed" bg="var(--blue-100)" />
        <KpiCard label="Total Units (Assigned)" value={loadingSummaries ? '—' : totals.totalUnits} icon={Icons.myleads} color="#1fb579" bg="var(--green-bg)" />
        <KpiCard label="Available Units" value={loadingSummaries ? '—' : totals.availableUnits} icon={Icons.bookings} color="#e8a13b" bg="var(--amber-bg)" />
        <KpiCard label="Booked Units" value={loadingSummaries ? '—' : totals.bookedUnits} icon={Icons.reports} color="#7c5cf0" bg="var(--purple-bg)" />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Assigned Projects<span>Projects assigned to you by your broker.</span></div>
          <div className="filter-input" style={{ minWidth: 220 }}>
            <input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project Name</th><th>Builder</th><th>Project Type</th><th>City</th>
                <th>Total Units</th><th>Available Units</th><th>Booked Units</th><th>Status</th><th>View Units</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const summary = unitSummaries[p.id];
                return (
                  <tr key={p.id}>
                    <td className="row-flex">
                      <div className="avatar-sm" style={{ background: 'var(--blue-600)' }}>{(p.name || '?')[0]}</div>
                      <div>
                        <div className="cell-main">{p.name}</div>
                        <div className="cell-sub">{p.reraNumber || '—'}</div>
                      </div>
                    </td>
                    <td>{p.builderName || 'Independent'}</td>
                    <td>{p.projectType || '—'}</td>
                    <td>{p.city || '—'}</td>
                    <td>{summary ? summary.totalUnits : '—'}</td>
                    <td>{summary ? summary.availableUnits : '—'}</td>
                    <td>{summary ? summary.bookedUnits : '—'}</td>
                    <td><Badge status={p.status} /></td>
                    <td>
                      <Link className="btn btn-primary" style={{ fontSize: 12.5, padding: '7px 14px' }} to={`/agent/projects/${p.id}`}>
                        View Units →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No projects assigned to you yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
