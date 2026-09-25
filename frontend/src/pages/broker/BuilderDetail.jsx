import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import KpiCard from '../../components/KpiCard';
import Badge from '../../components/Badge';
import { Icons } from '../../components/icons';
import api from '../../api/axios';

/**
 * Builder Detail — opened by clicking a builder on the Builders page.
 * Total/Active/Completed are computed server-side (see
 * builderController.getOne/projectStats): Total is every project whose
 * Builder Name matches this builder; Active is status === 'Active'; Completed
 * is every project whose Possession Date has already passed, regardless of
 * status (a project can be sold out for sale but still "completed" build-wise).
 */
export default function BuilderDetail() {
  const { id } = useParams();
  const [builder, setBuilder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/builders/${id}`)
      .then(({ data }) => { if (!cancelled) setBuilder(data.data); })
      .catch(() => { if (!cancelled) setBuilder(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="card">Loading builder...</div>;
  if (!builder) return <div className="card">Builder not found.</div>;

  return (
    <>
      <Link to="/broker/builders" className="link-btn" style={{ display: 'inline-block', marginBottom: 16 }}>&larr; Back to builders</Link>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="card-title">{builder.name}<span>{builder.phone || '—'} · {builder.email || '—'}</span></div>
          <Badge status={builder.status} />
        </div>
        {builder.description && <p className="cell-sub" style={{ marginTop: 4 }}>{builder.description}</p>}
      </div>

      <div className="kpi-row">
        <KpiCard label="Total Projects" value={builder.stats.total} icon={Icons.properties} color="var(--blue-600)" bg="var(--blue-100)" />
        <KpiCard label="Active Projects" value={builder.stats.active} icon={Icons.properties} color="var(--green)" bg="var(--green-bg)" />
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head"><div className="card-title">Projects<span>Every project linked to this builder.</span></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Project</th><th>City</th><th>Status</th><th>Possession Date</th></tr></thead>
            <tbody>
              {builder.projects.map((p) => (
                <tr key={p.id}>
                  <td className="cell-main"><Link to={`/broker/projects/${p.id}`}>{p.name}</Link></td>
                  <td className="cell-sub">{p.city || '—'}</td>
                  <td><Badge status={p.status} /></td>
                  <td className="cell-sub">{p.possessionDate ? new Date(p.possessionDate).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {builder.projects.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No projects linked to this builder yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
