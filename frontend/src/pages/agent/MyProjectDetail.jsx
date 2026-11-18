import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import KpiCard from '../../components/KpiCard';
import Badge from '../../components/Badge';
import ProjectDocuments from '../../components/ProjectDocuments';
import { Icons } from '../../components/icons';
import api, { SERVER_ORIGIN } from '../../api/axios';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'units', label: 'Units' },
  { key: 'plans', label: 'Payment Plans' },
  { key: 'documents', label: 'Documents' },
];

/**
 * Read-only counterpart of broker/ProjectDetail.jsx for the agent panel —
 * same tabs and layout conventions, but no Add Unit, Bulk Price Update,
 * payment-plan create/delete/activate, or document upload/delete anywhere.
 * The backend already enforces this project is one the agent is actually
 * assigned to (GET /projects/:id returns 403 otherwise — see
 * projectController.getOne), so there's nothing further to gate here.
 */
export default function MyProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [summary, setSummary] = useState(null);
  const [units, setUnits] = useState([]);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notAssigned, setNotAssigned] = useState(false);
  const [tab, setTab] = useState('overview');
  const [expandedPlanId, setExpandedPlanId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setNotAssigned(false);
    setExpandedPlanId(null);
    Promise.all([
      api.get(`/projects/${id}`).then(({ data }) => { setProject(data.data); setSummary(data.unitSummary); }),
      api.get(`/projects/${id}/units`).then(({ data }) => setUnits(data.data)),
      api.get(`/projects/${id}/payment-plans`).then(({ data }) => setPaymentPlans(data.data)),
    ])
      .catch((err) => {
        if (err.response?.status === 403 || err.response?.status === 404) setNotAssigned(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const fmt = (v) => (v || v === 0 ? `₹${Number(v).toLocaleString('en-IN')}` : '—');

  if (loading) return <div className="card">Loading project...</div>;
  if (notAssigned || !project) {
    return (
      <div className="card">
        <p className="cell-sub" style={{ margin: 0 }}>
          This project isn't assigned to you, or no longer exists.{' '}
          <span className="link-btn" onClick={() => navigate('/agent/projects')}>Back to My Projects</span>
        </p>
      </div>
    );
  }

  return (
    <>
      <button className="link-btn" style={{ marginBottom: 14 }} onClick={() => navigate('/agent/projects')}>← Back to My Projects</button>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="row-flex" style={{ gap: 14 }}>
            {project.imageUrl && (
              <img
                src={`${SERVER_ORIGIN}${project.imageUrl}`}
                alt={project.name}
                style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
              />
            )}
            <div className="card-title">{project.name}<span>{project.builderName || 'Independent'} · {project.city}</span></div>
          </div>
          <Badge status={project.status} />
        </div>
      </div>

      <div className="kpi-row">
        <KpiCard label="Total Units" value={summary?.totalUnits ?? 0} icon={Icons.properties} color="#2f6fed" bg="var(--blue-100)" />
        <KpiCard label="Available Units" value={summary?.availableUnits ?? 0} icon={Icons.leads} color="#1fb579" bg="var(--green-bg)" />
        <KpiCard label="Booked Units" value={summary?.bookedUnits ?? 0} icon={Icons.reports} color="#7c5cf0" bg="var(--purple-bg)" />
        <KpiCard label="Booked" value={summary?.booked?? 0} icon={Icons.history} color="#e8a13b" bg="var(--amber-bg)" />
      </div>

      <div className="settings-tabs">
        {TABS.map((t) => <div key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</div>)}
      </div>

      {tab === 'overview' && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Basic Information</div>
            <div className="form-grid">
              <div className="form-field"><label>Project Name</label><input value={project.name} disabled /></div>
              <div className="form-field"><label>Builder Name</label><input value={project.builderName || '—'} disabled /></div>
              <div className="form-field"><label>Project Type</label><input value={project.projectType || '—'} disabled /></div>
              <div className="form-field"><label>Project Status</label><div style={{ marginTop: 6 }}><Badge status={project.status} /></div></div>
              <div className="form-field"><label>RERA Number</label><input value={project.reraNumber || '—'} disabled /></div>
              <div className="form-field"><label>City</label><input value={project.city} disabled /></div>
              <div className="form-field"><label>Address</label><input value={project.address || '—'} disabled /></div>
              <div className="form-field"><label>Launch Date</label><input value={project.launchDate || '—'} disabled /></div>
              <div className="form-field"><label>Possession Date</label><input value={project.possessionDate || '—'} disabled /></div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input value={project.description || '—'} disabled /></div>
            </div>
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Pricing</div>
            <div className="form-grid">
              <div className="form-field"><label>Purchase Price</label><input value={fmt(project.maxPrice)} disabled /></div>
            </div>
          </div>
        </>
      )}

      {tab === 'units' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Units<span>Available units in this project. Booked/Sold units aren't shown here.</span></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Unit No.</th><th>Unit Type</th><th>Features</th><th>Size (Sq.Ft.)</th>
                  <th>Total Price</th><th>Payment Plan</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td className="cell-main">{u.unitNo}</td>
                    <td>{u.unitType}</td>
                    <td className="cell-sub">{u.features?.length ? u.features.join(', ') : '—'}</td>
                    <td>{u.sizeSqft || '—'}</td>
                    <td>{fmt(u.totalPrice)}</td>
                    <td>{u.paymentPlanRef?.name || 'Full Payment'}</td>
                    <td><Badge status={u.status} /></td>
                  </tr>
                ))}
                {units.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No available units right now.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 6 }}>Payment Plans</div>
          <div className="cell-sub" style={{ marginBottom: 16 }}>Click a plan to view its installment schedule.</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Plan Name</th><th>Installments</th><th>Total</th><th></th></tr>
              </thead>
              <tbody>
                {paymentPlans.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedPlanId(expandedPlanId === p.id ? null : p.id)}>
                      <td className="cell-main">
                        {p.name}
                        {p.currentCycle > 1 && <span className="badge blue" style={{ marginLeft: 8 }}>Cycle {p.currentCycle}</span>}
                      </td>
                      <td className="cell-sub">{p.installments.map((r) => `${r.name} (${r.percentage}%)`).join(', ')}</td>
                      <td>{p.installments.reduce((s, r) => s + Number(r.percentage), 0)}%</td>
                      <td>
                        <span className="link-btn" onClick={(e) => { e.stopPropagation(); setExpandedPlanId(expandedPlanId === p.id ? null : p.id); }}>
                          {expandedPlanId === p.id ? 'Hide' : 'View'}
                        </span>
                      </td>
                    </tr>
                    {expandedPlanId === p.id && (
                      <tr>
                        <td colSpan={4}>
                          <div className="card" style={{ margin: '4px 0 10px', boxShadow: 'none', background: 'var(--bg)' }}>
                            <table>
                              <thead>
                                <tr><th>#</th><th>Name</th><th>Milestone / Due Condition</th><th>Percentage</th></tr>
                              </thead>
                              <tbody>
                                {p.installments.map((row) => (
                                  <tr key={row.id}>
                                    <td className="cell-sub">{row.sequenceNumber}</td>
                                    <td className="cell-main">{row.name}</td>
                                    <td className="cell-sub">{row.milestone}</td>
                                    <td>{row.percentage}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {paymentPlans.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No payment plans set up for this project yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Documents</div>
          <ProjectDocuments projectId={project.id} readOnly />
        </div>
      )}
    </>
  );
}








