import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import KpiCard from '../../components/KpiCard';
import Badge from '../../components/Badge';
import SearchableSelect from '../../components/SearchableSelect';
import ProjectDocuments from '../../components/ProjectDocuments';
import { Icons } from '../../components/icons';
import api, { SERVER_ORIGIN } from '../../api/axios';
import { UNIT_TYPES, UNIT_FEATURES } from '../../constants/unitEnums';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'units', label: 'Units' },
  { key: 'plans', label: 'Payment Plans' },
  { key: 'documents', label: 'Documents' },
];

const emptyUnit = {
  unitNo: '', unitType: '2 BHK', features: [], sizeSqft: '', totalPrice: '',
  advanceAmount: '', paymentPlanId: '', description: '',
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [summary, setSummary] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const [showUnitForm, setShowUnitForm] = useState(false);
  const [unitForm, setUnitForm] = useState(emptyUnit);
  const [unitImages, setUnitImages] = useState([]);
  const [savingUnit, setSavingUnit] = useState(false);

  const [showBulk, setShowBulk] = useState(false);
  const [bulkFeature, setBulkFeature] = useState(UNIT_FEATURES[0]);
  const [bulkPct, setBulkPct] = useState('');
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Project Payment Plans — a project can have multiple independently-configurable
  // plans (2, 3, 4+ installments each). Always loaded fresh for THIS project only;
  // reset/reloaded automatically whenever `id` (the project) changes below.
  const [paymentPlans, setPaymentPlans] = useState([]);
  // Clicking a plan expands its installment details inline. From the 2nd
  // installment onward, the broker can Activate it (with a "last date") —
  // scoped to only bookings using that specific plan (see
  // handleActivateInstallment). Plans themselves are created/edited only via
  // the Add Project form now — this tab is view + activate only.
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [activateDates, setActivateDates] = useState({});
  const [activatingKey, setActivatingKey] = useState(null);
  const [activateResult, setActivateResult] = useState({});

  const loadProject = async () => {
    const { data } = await api.get(`/projects/${id}`);
    setProject(data.data);
    setSummary(data.unitSummary);
  };
  const loadUnits = async () => {
    const { data } = await api.get(`/projects/${id}/units`);
    setUnits(data.data);
  };
  const loadPaymentPlans = async () => {
    const { data } = await api.get(`/projects/${id}/payment-plans`);
    setPaymentPlans(data.data);
  };

  useEffect(() => {
    setLoading(true);
    // Project changed → reset any in-progress unit editing / expanded-plan
    // state and reload everything (including payment plans) fresh.
    setExpandedPlanId(null);
    setUnitForm(emptyUnit);
    Promise.all([loadProject(), loadUnits(), loadPaymentPlans()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Delete payment plan "${plan.name}"?`)) return;
    try {
      await api.delete(`/payment-plans/${plan.id}`);
      await loadPaymentPlans();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not delete payment plan.');
    }
  };

  // Activating a specific installment (2nd onward) applies ONLY to bookings on
  // THIS exact plan — never every booking in the project — and notifies only
  // the agents on the bookings actually affected (see paymentPlanController.js).
  const handleActivateInstallment = async (plan, row) => {
    const key = `${plan.id}-${row.sequenceNumber}`;
    const date = activateDates[key];
    if (!date) { window.alert('Please choose a date first.'); return; }
    setActivatingKey(key);
    try {
      const { data } = await api.post(`/payment-plans/${plan.id}/installments/${row.sequenceNumber}/activate`, { date });
      setActivateResult((r) => ({ ...r, [key]: data.message }));
      await loadPaymentPlans(); // refresh so this row now shows "Activated on <date>" instead of the form
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not activate installment.');
    } finally {
      setActivatingKey(null);
    }
  };

  // Payment Plan Cycle Reset — once every booking on a plan has fully paid the
  // current cycle (plan.cycleCompleted from the API), this starts a fresh one:
  // every installment row resets to Locked (except the 1st) and every booking
  // on the plan gets a brand-new schedule, starting again at the 1st.
  const [startingCycleId, setStartingCycleId] = useState(null);
  const handleStartNextCycle = async (plan) => {
    if (!window.confirm(`Start a new payment cycle for "${plan.name}"? This won't change any existing booking — only new bookings made on this plan from now on will follow the new 1st installment onward.`)) return;
    setStartingCycleId(plan.id);
    try {
      await api.post(`/payment-plans/${plan.id}/next-cycle`);
      await loadPaymentPlans();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not start a new cycle.');
    } finally {
      setStartingCycleId(null);
    }
  };

  const toggleFeature = (f) => {
    setUnitForm((prev) => ({
      ...prev,
      features: prev.features.includes(f) ? prev.features.filter((x) => x !== f) : [...prev.features, f],
    }));
  };

  const handleAddUnit = async (e) => {
    e.preventDefault();
    setSavingUnit(true);
    try {
      const formData = new FormData();
      Object.entries(unitForm).forEach(([k, v]) => {
        if (k === 'features') v.forEach((f) => formData.append('features', f));
        else formData.append(k, v);
      });
      unitImages.forEach((file) => formData.append('images', file));
      await api.post(`/projects/${id}/units`, formData);
      setUnitForm(emptyUnit);
      setUnitImages([]);
      setShowUnitForm(false);
      await Promise.all([loadUnits(), loadProject()]);
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteUnit = async (unit) => {
    if (!window.confirm(`Delete unit "${unit.unitNo}"? This cannot be undone.`)) return;
    await api.delete(`/units/${unit.id}`);
    await Promise.all([loadUnits(), loadProject()]);
  };

  const handleBulkPreview = async () => {
    if (!bulkPct) return;
    setBulkBusy(true);
    try {
      const { data } = await api.post(`/projects/${id}/units/bulk-price-preview`, { feature: bulkFeature, percentage: Number(bulkPct) });
      setBulkPreview(data);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkApply = async () => {
    if (!bulkPreview) return;
    setBulkBusy(true);
    try {
      await api.post(`/projects/${id}/units/bulk-price-apply`, { feature: bulkFeature, percentage: Number(bulkPct) });
      setBulkPreview(null);
      setBulkPct('');
      setShowBulk(false);
      await loadUnits();
    } finally {
      setBulkBusy(false);
    }
  };

  const fmt = (v) => (v || v === 0 ? `₹${Number(v).toLocaleString('en-IN')}` : '—');

  if (loading) return <div className="card">Loading project...</div>;
  if (!project) return <div className="card">Project not found.</div>;

  return (
    <>
      <button className="link-btn" style={{ marginBottom: 14 }} onClick={() => navigate(-1)}>← Back to projects</button>

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
        <KpiCard label="Sold Units" value={summary?.soldUnits ?? 0} icon={Icons.reports} color="#7c5cf0" bg="var(--purple-bg)" />
        <KpiCard label="Booked / On Hold" value={summary?.bookedOrOnHoldUnits ?? 0} icon={Icons.history} color="#e8a13b" bg="var(--amber-bg)" />
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
        <>
          <div className="toolbar">
            <div className="filters">
              <button className="btn btn-ghost" onClick={() => setShowBulk(!showBulk)}>Bulk Price Update</button>
            </div>
            <button className="btn btn-primary" onClick={() => setShowUnitForm(!showUnitForm)}>{showUnitForm ? 'Cancel' : '+ Add Unit'}</button>
          </div>

          {showBulk && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title" style={{ marginBottom: 6 }}>Bulk Price Update</div>
              <p className="cell-sub" style={{ marginBottom: 14 }}>Every unit with the selected feature will have its Basic &amp; Total Price adjusted by the given percentage.</p>
              <div className="form-grid">
                <div className="form-field"><label>Unit Feature</label>
                  <select value={bulkFeature} onChange={(e) => { setBulkFeature(e.target.value); setBulkPreview(null); }}>
                    {UNIT_FEATURES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Increase / Decrease Percentage</label>
                  <input type="number" step="any" placeholder="e.g. 20 or -5" value={bulkPct} onChange={(e) => { setBulkPct(e.target.value); setBulkPreview(null); }} />
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={handleBulkPreview} disabled={bulkBusy || !bulkPct}>Preview</button>{' '}
                {bulkPreview && (
                  <button className="btn btn-primary" onClick={handleBulkApply} disabled={bulkBusy || bulkPreview.count === 0}>
                    Apply to {bulkPreview.count} unit{bulkPreview.count === 1 ? '' : 's'}
                  </button>
                )}
              </div>

              {bulkPreview && (
                <div className="table-wrap" style={{ marginTop: 16 }}>
                  <table>
                    <thead><tr><th>Unit No.</th><th>Current Total Price</th><th>New Total Price</th></tr></thead>
                    <tbody>
                      {bulkPreview.data.map((u) => (
                        <tr key={u.id}><td className="cell-main">{u.unitNo}</td><td>{fmt(u.currentTotalPrice)}</td><td>{fmt(u.newTotalPrice)}</td></tr>
                      ))}
                      {bulkPreview.count === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No units have this feature.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {showUnitForm && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>New Unit</div>
              <form onSubmit={handleAddUnit}>
                <div className="form-grid">
                  <div className="form-field"><label>Unit No.</label><input required value={unitForm.unitNo} onChange={(e) => setUnitForm({ ...unitForm, unitNo: e.target.value })} /></div>
                  <div className="form-field"><label>Unit Type</label>
                    <select value={unitForm.unitType} onChange={(e) => setUnitForm({ ...unitForm, unitType: e.target.value })}>
                      {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-field"><label>Size (Sq.Ft.)</label><input type="number" value={unitForm.sizeSqft} onChange={(e) => setUnitForm({ ...unitForm, sizeSqft: e.target.value })} /></div>
                  <div className="form-field"><label>Payment Plan</label>
                    <SearchableSelect
                      variant="form"
                      placeholder="Full Payment (no installments)"
                      value={unitForm.paymentPlanId}
                      onChange={(val) => setUnitForm({ ...unitForm, paymentPlanId: val })}
                      options={paymentPlans.map((p) => ({ value: p.id, label: p.name }))}
                    />
                  </div>
                  <div className="form-field"><label>Total Price (₹)</label><input required type="number" value={unitForm.totalPrice} onChange={(e) => setUnitForm({ ...unitForm, totalPrice: e.target.value })} /></div>
                  <div className="form-field"><label>Advance Amount (₹)</label><input type="number" value={unitForm.advanceAmount} onChange={(e) => setUnitForm({ ...unitForm, advanceAmount: e.target.value })} /></div>
                  {unitForm.paymentPlanId && (
                    <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                      <label>Plan Schedule Preview</label>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Installment</th><th>Milestone / Due Condition</th><th>Percentage</th></tr></thead>
                          <tbody>
                            {(paymentPlans.find((p) => p.id === unitForm.paymentPlanId)?.installments || []).map((r) => (
                              <tr key={r.id}><td className="cell-main">{r.name}</td><td className="cell-sub">{r.milestone}</td><td>{r.percentage}%</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input value={unitForm.description} onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })} /></div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Unit Features</label>
                    <div className="chip-row">
                      {UNIT_FEATURES.map((f) => (
                        <span key={f} className={`chip ${unitForm.features.includes(f) ? 'active' : ''}`} onClick={() => toggleFeature(f)}>{f}</span>
                      ))}
                    </div>
                  </div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Unit Images</label>
                    <input type="file" accept="image/*" multiple onChange={(e) => setUnitImages(Array.from(e.target.files || []))} />
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" disabled={savingUnit}>{savingUnit ? 'Saving...' : 'Save Unit'}</button>{' '}
                  <button type="button" className="btn btn-ghost" onClick={() => setShowUnitForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Unit No.</th><th>Unit Type</th><th>Features</th><th>Size (Sq.Ft.)</th>
                    <th>Basic Price</th><th>Total Price</th><th>Payment Plan</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td className="cell-main">{u.unitNo}</td>
                      <td>{u.unitType}</td>
                      <td className="cell-sub">{u.features?.length ? u.features.join(', ') : '—'}</td>
                      <td>{u.sizeSqft || '—'}</td>
                      <td>{fmt(u.basicPrice)}</td>
                      <td>{fmt(u.totalPrice)}</td>
                      <td>{u.paymentPlanRef?.name || 'Full Payment'}</td>
                      <td><Badge status={u.status} /></td>
                      <td>
                        <Link className="link-btn" to={`/broker/units/${u.id}`}>View</Link>
                        {' · '}<Link className="link-btn" to={`/broker/units/${u.id}`}>Edit</Link>
                        {' · '}<span className="link-btn" style={{ color: 'var(--red)' }} onClick={() => handleDeleteUnit(u)}>Delete</span>
                      </td>
                    </tr>
                  ))}
                  {units.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No units added yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'plans' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 6 }}>Payment Plans</div>
          <div className="cell-sub" style={{ marginBottom: 16 }}>
            Plans are created from the Add Project form. Click a plan to view its installments — from the 2nd installment onward, you can
            activate it (with a last payment date) for every ready booking on that specific plan; any booking still behind on the previous
            installment catches up automatically the moment it's paid. Only the assigned agents on affected bookings are notified.
            Once every booking on a plan has fully paid every installment, the plan is marked Completed and you can start a fresh cycle for it.
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Plan Name</th><th>Installments</th><th>Total</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {paymentPlans.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedPlanId(expandedPlanId === p.id ? null : p.id)}>
                      <td className="cell-main">
                        {p.name}
                        {p.currentCycle > 1 && <span className="badge blue" style={{ marginLeft: 8 }}>Cycle {p.currentCycle}</span>}
                        {p.cycleCompleted && <span className="badge green" style={{ marginLeft: 8 }}>Completed</span>}
                      </td>
                      <td className="cell-sub">{p.installments.map((r) => `${r.name} (${r.percentage}%)`).join(', ')}</td>
                      <td>{p.installments.reduce((s, r) => s + Number(r.percentage), 0)}%</td>
                      <td>
                        <span className="link-btn" onClick={(e) => { e.stopPropagation(); setExpandedPlanId(expandedPlanId === p.id ? null : p.id); }}>
                          {expandedPlanId === p.id ? 'Hide' : 'View'}
                        </span>
                        {' · '}
                        <span className="link-btn" style={{ color: 'var(--red)' }} onClick={(e) => { e.stopPropagation(); handleDeletePlan(p); }}>Delete</span>
                      </td>
                    </tr>

                    {expandedPlanId === p.id && (
                      <tr>
                        <td colSpan={4}>
                          <div className="card" style={{ margin: '4px 0 10px', boxShadow: 'none', background: 'var(--bg)' }}>
                            {p.cycleCompleted && (
                              <div className="cell-sub" style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--green-bg)', borderRadius: 8, color: 'var(--green)' }}>
                                Every booking in cycle {p.currentCycle} ({p.cycleBookingsCount}) has fully paid — they're done and won't be touched. Start a new cycle below to collect installments from bookings made on this plan going forward.
                              </div>
                            )}
                            <table>
                              <thead>
                                <tr><th>#</th><th>Name</th><th>Milestone / Due Condition</th><th>Percentage</th><th>Last Date</th><th>Action</th></tr>
                              </thead>
                              <tbody>
                                {p.installments.map((row) => {
                                  const key = `${p.id}-${row.sequenceNumber}`;
                                  return (
                                    <tr key={row.id}>
                                      <td className="cell-sub">{row.sequenceNumber}</td>
                                      <td className="cell-main">{row.name}</td>
                                      <td className="cell-sub">{row.milestone}</td>
                                      <td>{row.percentage}%</td>
                                      {p.cycleCompleted ? (
                                        <td className="cell-sub" colSpan={2}>
                                          <span className="badge green">Completed</span>{' '}
                                          Cannot activate again — start a new cycle below.
                                        </td>
                                      ) : row.sequenceNumber === 1 ? (
                                        <td className="cell-sub" colSpan={2}>Always active from booking — no action needed.</td>
                                      ) : row.status === 'Activated' ? (
                                        <td className="cell-sub" colSpan={2}>
                                          <span className="badge green">Activated</span>{' '}
                                          on {new Date(row.activatedDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </td>
                                      ) : (
                                        <>
                                          <td>
                                            <input
                                              type="date"
                                              style={{ padding: '6px 8px', fontSize: 12.5 }}
                                              value={activateDates[key] || ''}
                                              onChange={(e) => setActivateDates((d) => ({ ...d, [key]: e.target.value }))}
                                            />
                                          </td>
                                          <td>
                                            <button
                                              className="btn btn-primary"
                                              style={{ padding: '6px 14px', fontSize: 12.5 }}
                                              disabled={activatingKey === key}
                                              onClick={() => handleActivateInstallment(p, row)}
                                            >
                                              {activatingKey === key ? 'Activating...' : 'Activate'}
                                            </button>
                                            {activateResult[key] && <div className="cell-sub" style={{ marginTop: 4 }}>{activateResult[key]}</div>}
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>

                            {p.cycleCompleted && (
                              <div style={{ marginTop: 14 }}>
                                <button
                                  className="btn btn-primary"
                                  disabled={startingCycleId === p.id}
                                  onClick={() => handleStartNextCycle(p)}
                                >
                                  {startingCycleId === p.id ? 'Starting...' : 'Activate Next Installment'}
                                </button>
                                <div className="cell-sub" style={{ marginTop: 6 }}>
                                  Starts cycle {p.currentCycle + 1} for this plan. It won't change any of the {p.cycleBookingsCount} completed booking{p.cycleBookingsCount === 1 ? '' : 's'} above — only new bookings made on this plan from now on will follow the new 1st → {p.installments.length}
                                  {p.installments.length === 2 ? 'nd' : p.installments.length === 3 ? 'rd' : 'th'} installment sequence.
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {paymentPlans.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No payment plans yet — add one from the Add Project form.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Documents</div>
          <ProjectDocuments projectId={project.id} pendingFiles={[]} onPendingFilesChange={() => {}} />
        </div>
      )}
    </>
  );
}















