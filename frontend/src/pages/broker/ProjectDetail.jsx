import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import KpiCard from '../../components/KpiCard';
import Badge from '../../components/Badge';
import SearchableSelect from '../../components/SearchableSelect';
import ProjectDocuments from '../../components/ProjectDocuments';
import { Icons } from '../../components/icons';
import api, { SERVER_ORIGIN } from '../../api/axios';
import ConfirmDialog from '../../components/ConfirmDialog';
import { UNIT_TYPES, UNIT_FEATURES } from '../../constants/unitEnums';
import FormField from '../../components/FormField';
import useFormValidation from '../../hooks/useFormValidation';
import { required, positiveNumber, optionalPositiveNumber, nonNegativeNumber, isBlank } from '../../utils/validation';

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

  const [customFeatures, setCustomFeatures] = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [featureError, setFeatureError] = useState('');
  const [addingFeature, setAddingFeature] = useState(false);

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
  const [activateErrors, setActivateErrors] = useState({});
  const [bulkError, setBulkError] = useState('');
  const unitV = useFormValidation(unitForm, {
    unitNo: required('Unit no.'),
    totalPrice: positiveNumber('Total price'),
    sizeSqft: optionalPositiveNumber('Size'),
    advanceAmount: (val, all) => {
      const nErr = nonNegativeNumber('Advance amount')(val);
      if (nErr) return nErr;
      if (isBlank(val) || isBlank(all.totalPrice)) return '';
      if (Number(val) > Number(all.totalPrice)) return 'Advance cannot be more than total price.';
      return '';
    },
  });

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
  const loadCustomFeatures = async () => {
    try {
      const { data } = await api.get('/unit-features');
      setCustomFeatures(data.data || []);
    } catch {
      setCustomFeatures([]);
    }
  };

  const customNames = customFeatures
    .map((f) => f.name)
    .filter((name) => !UNIT_FEATURES.some((preset) => preset.toLowerCase() === name.toLowerCase()));
  const featureOptions = [...UNIT_FEATURES, ...customNames];

  useEffect(() => {
    setLoading(true);
    // Project changed → reset any in-progress unit editing / expanded-plan
    // state and reload everything (including payment plans) fresh.
    setExpandedPlanId(null);
    setUnitForm(emptyUnit);
    setCustomInput('');
    setFeatureError('');
    Promise.all([loadProject(), loadUnits(), loadPaymentPlans(), loadCustomFeatures()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const closeDelete = () => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError('');
  };

  const handleDeletePlan = (plan) => {
    setDeleteError('');
    setPendingDelete({
      title: 'Delete payment plan',
      message: `Delete payment plan "${plan.name}"? This cannot be undone.`,
      run: async () => {
        await api.delete(`/payment-plans/${plan.id}`);
        await loadPaymentPlans();
      },
    });
  };

  // Activating a specific installment (2nd onward) applies ONLY to bookings on
  // THIS exact plan — never every booking in the project — and notifies only
  // the agents on the bookings actually affected (see paymentPlanController.js).
  const handleActivateInstallment = async (plan, row) => {
    const key = `${plan.id}-${row.sequenceNumber}`;
    const date = activateDates[key];
    if (!date) {
      setActivateErrors((e) => ({ ...e, [key]: 'Please choose a last payment date.' }));
      return;
    }
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
  const handleStartNextCycle = (plan) => {
    setDeleteError('');
    setPendingDelete({
      title: 'Start new payment cycle',
      confirmLabel: 'Start cycle',
      message: `Start a new payment cycle for "${plan.name}"? This won't change any existing booking — only new bookings made on this plan from now on will follow the new 1st installment onward.`,
      run: async () => {
        setStartingCycleId(plan.id);
        try {
          await api.post(`/payment-plans/${plan.id}/next-cycle`);
          await loadPaymentPlans();
        } finally {
          setStartingCycleId(null);
        }
      },
    });
  };

  const toggleFeature = (f) => {
    setUnitForm((prev) => ({
      ...prev,
      features: prev.features.includes(f) ? prev.features.filter((x) => x !== f) : [...prev.features, f],
    }));
  };

  const addCustomFeature = async () => {
    const name = customInput.trim();
    if (!name) return;
    setAddingFeature(true);
    setFeatureError('');
    try {
      const { data } = await api.post('/unit-features', { name });
      const saved = data.data;
      if (!saved.preset && saved.id) {
        setCustomFeatures((prev) => (
          prev.some((f) => f.id === saved.id) ? prev : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
        ));
      }
      setUnitForm((prev) => {
        const already = prev.features.some((f) => f.toLowerCase() === saved.name.toLowerCase());
        return {
          ...prev,
          features: already
            ? prev.features.map((f) => (f.toLowerCase() === saved.name.toLowerCase() ? saved.name : f))
            : [...prev.features, saved.name],
        };
      });
      setCustomInput('');
    } catch (err) {
      setFeatureError(err.response?.data?.message || 'Could not add that feature.');
    } finally {
      setAddingFeature(false);
    }
  };

  const removeCustomFeature = async (feature) => {
    if (!window.confirm(`Remove "${feature.name}" from the feature list? Units that already use it will keep it.`)) return;
    try {
      await api.delete(`/unit-features/${feature.id}`);
      setCustomFeatures((prev) => prev.filter((f) => f.id !== feature.id));
      setUnitForm((prev) => ({ ...prev, features: prev.features.filter((f) => f !== feature.name) }));
      if (bulkFeature === feature.name) setBulkFeature(UNIT_FEATURES[0]);
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not remove that feature.');
    }
  };

  const setUnitField = (key, val) => {
    setUnitForm((f) => ({ ...f, [key]: val }));
    unitV.touch(key);
  };

  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!unitV.validate()) return;
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
      setCustomInput('');
      setFeatureError('');
      unitV.reset();
      setShowUnitForm(false);
      await Promise.all([loadUnits(), loadProject()]);
      await Promise.all([loadUnits(), loadProject(), loadCustomFeatures()]);
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not save unit.');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteUnit = (unit) => {
    setDeleteError('');
    setPendingDelete({
      title: 'Delete unit',
      message: `Delete unit "${unit.unitNo}"? This cannot be undone.`,
      run: async () => {
        await api.delete(`/units/${unit.id}`);
        await Promise.all([loadUnits(), loadProject()]);
      },
    });
  };

  const runDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await pendingDelete.run();
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Could not delete.');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkPreview = async () => {
    const n = Number(bulkPct);
    if (bulkPct === '' || !Number.isFinite(n) || n === 0) {
      setBulkError('Enter a non-zero percentage, e.g. 20 or -5.');
      return;
    }
    setBulkError('');
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
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not update prices.');
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
        <KpiCard label="Booked " value={summary?.bookedUnits ?? 0} icon={Icons.history} color="#e8a13b" bg="var(--amber-bg)" />
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
            <button className="btn btn-primary" onClick={() => { if (showUnitForm) { setShowUnitForm(false); unitV.reset(); setUnitForm(emptyUnit); } else setShowUnitForm(true); }}>{showUnitForm ? 'Cancel' : '+ Add Unit'}</button>
          </div>

          {showBulk && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title" style={{ marginBottom: 6 }}>Bulk Price Update</div>
              <p className="cell-sub" style={{ marginBottom: 14 }}>Every unit with the selected feature will have its Basic &amp; Total Price adjusted by the given percentage.</p>
              <div className="form-grid">
                <FormField label="Unit Feature">
                  <select value={bulkFeature} onChange={(e) => { setBulkFeature(e.target.value); setBulkPreview(null); }}>
                    {featureOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </FormField>
                <FormField label="Increase / Decrease Percentage" required error={bulkError}>
                  <input type="number" step="any" placeholder="e.g. 20 or -5" value={bulkPct} onChange={(e) => {
                    const next = e.target.value;
                    setBulkPct(next);
                    setBulkPreview(null);
                    const n = Number(next);
                    setBulkError(next === '' || !Number.isFinite(n) || n === 0 ? 'Enter a non-zero percentage, e.g. 20 or -5.' : '');
                  }} />
                </FormField>
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
              <form onSubmit={handleAddUnit} noValidate>
                <div className="form-grid">
                  <FormField label="Unit No." required error={unitV.show('unitNo')}>
                    <input value={unitForm.unitNo} onChange={(e) => setUnitField('unitNo', e.target.value)} onBlur={() => unitV.touch('unitNo')} />
                  </FormField>
                  <FormField label="Unit Type">
                    <select value={unitForm.unitType} onChange={(e) => setUnitField('unitType', e.target.value)}>
                      {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Size (Sq.Ft.)" error={unitV.show('sizeSqft')}>
                    <input type="number" value={unitForm.sizeSqft} onChange={(e) => setUnitField('sizeSqft', e.target.value)} onBlur={() => unitV.touch('sizeSqft')} />
                  </FormField>
                  <FormField label="Payment Plan">
                    <SearchableSelect
                      variant="form"
                      placeholder="Full Payment (no installments)"
                      value={unitForm.paymentPlanId}
                      onChange={(val) => setUnitField('paymentPlanId', val)}
                      options={paymentPlans.map((p) => ({ value: p.id, label: p.name }))}
                    />
                  </FormField>
                  <FormField label="Total Price (₹)" required error={unitV.show('totalPrice')}>
                    <input type="number" value={unitForm.totalPrice} onChange={(e) => setUnitField('totalPrice', e.target.value)} onBlur={() => unitV.touch('totalPrice')} />
                  </FormField>
                  <FormField
                    label="Advance Amount (₹)"
                    error={unitV.show('advanceAmount')}
                    hint={!unitV.show('advanceAmount') ? 'Deducted from the first installment.' : undefined}
                  >
                    <input type="number" min="0" value={unitForm.advanceAmount} onChange={(e) => setUnitField('advanceAmount', e.target.value)} onBlur={() => unitV.touch('advanceAmount')} />
                  </FormField>
                  {unitForm.paymentPlanId && (
                    <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                      <label>Plan Schedule Preview</label>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Installment</th><th>Milestone / Due Condition</th><th>Percentage</th><th>Amount</th></tr></thead>
                          <tbody>
                            {(paymentPlans.find((p) => String(p.id) === String(unitForm.paymentPlanId))?.installments || [])
                              .slice()
                              .sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber))
                              .map((r, i) => {
                              const gross = (Number(unitForm.totalPrice) * Number(r.percentage)) / 100;
                              const net = i === 0 ? Math.max(0, gross - (Number(unitForm.advanceAmount) || 0)) : gross;
                              return (
                                <tr key={r.id}>
                                  <td className="cell-main">{r.name}</td>
                                  <td className="cell-sub">{r.milestone}</td>
                                  <td>{r.percentage}%</td>
                                  <td>{unitForm.totalPrice ? fmt(net) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  <FormField label="Description" style={{ gridColumn: '1 / -1' }}>
                    <input value={unitForm.description} onChange={(e) => setUnitField('description', e.target.value)} />
                  </FormField>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Unit Features</label>
                    <div className="chip-row">
                      {featureOptions.map((f) => {
                        const custom = customFeatures.find((c) => c.name === f);
                        return (
                          <span key={f} className={`chip ${unitForm.features.includes(f) ? 'active' : ''}`} onClick={() => toggleFeature(f)}>
                            {f}
                            {custom && (
                              <button
                                type="button"
                                className="chip-remove"
                                title="Remove from list"
                                onClick={(e) => { e.stopPropagation(); removeCustomFeature(custom); }}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    <div className="feature-add-row">
                      <input
                        value={customInput}
                        placeholder="Add custom feature, e.g. Sea Facing"
                        maxLength={40}
                        onChange={(e) => { setCustomInput(e.target.value); setFeatureError(''); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomFeature(); } }}
                      />
                      <button type="button" className="btn btn-ghost" onClick={addCustomFeature} disabled={addingFeature || !customInput.trim()}>
                        {addingFeature ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                    {featureError
                      ? <div className="feature-error">{featureError}</div>
                      : <div className="feature-hint">Custom features are saved for this brokerage and show up on every unit.</div>}
                  </div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Unit Images</label>
                    <input type="file" accept="image/*" multiple onChange={(e) => setUnitImages(Array.from(e.target.files || []))} />
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" disabled={savingUnit}>{savingUnit ? 'Saving...' : 'Save Unit'}</button>{' '}
                  <button type="button" className="btn btn-ghost" onClick={() => { setShowUnitForm(false); unitV.reset(); setUnitForm(emptyUnit); }}>Cancel</button>
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
                                              style={{ padding: '6px 8px', fontSize: 12.5, borderColor: activateErrors[key] ? 'var(--red)' : undefined }}
                                              value={activateDates[key] || ''}
                                              onChange={(e) => {
                                                const next = e.target.value;
                                                setActivateDates((d) => ({ ...d, [key]: next }));
                                                setActivateErrors((err) => ({ ...err, [key]: next ? '' : 'Please choose a last payment date.' }));
                                              }}
                                            />
                                            {activateErrors[key] && <div className="field-error">{activateErrors[key]}</div>}
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

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.title}
          message={pendingDelete.message}
          confirmLabel={pendingDelete.confirmLabel}
          busy={deleting}
          error={deleteError}
          onConfirm={runDelete}
          onCancel={closeDelete}
        />
      )}
    </>
  );
}















