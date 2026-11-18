import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Badge from '../../components/Badge';
import LocationSelect from '../../components/LocationSelect';
import LocalAddresses from '../../components/LocalAddresses';
import BuilderSelect from '../../components/BuilderSelect';
import ProjectDocuments from '../../components/ProjectDocuments';
import ProjectImage from '../../components/ProjectImage';
import api, { SERVER_ORIGIN } from '../../api/axios';
import ConfirmDialog from '../../components/ConfirmDialog';
import { projectsResource } from '../../store/resources';
import FormField from '../../components/FormField';
import useFormValidation from '../../hooks/useFormValidation';
import { textName, required, optionalPositiveNumber, latitude, longitude, percentage, isBlank } from '../../utils/validation';

const empty = {
  name: '', builderName: '', projectType: '', reraNumber: '', description: '',
  country: '', state: '', city: '', localAddresses: [],
  maxPrice: '', status: 'Active', latitude: '', longitude: '', launchDate: '', possessionDate: '',
};

// Payment Installment Plans — entered right here on the Add Project form (not a
// separate step). A project can have multiple independently-configurable plans;
// each plan's rows are broker-entered (Name, Milestone/Due Condition, Percentage)
// and must total exactly 100%. Nothing here is hardcoded — plans are saved under
// the project the moment it's created, then loaded dynamically wherever they're
// used (e.g. the Add Unit form).
const emptyRow = () => ({ name: '', milestone: '', percentage: '' });
const emptyPlan = () => ({ name: '', installments: [emptyRow()] });

function planTotal(plan) {
  const total = plan.installments.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0);
  return Math.round(total * 100) / 100;
}

export default function Projects() {
  const dispatch = useDispatch();
  const { items } = useSelector((s) => s.projects);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null); // null = creating a new project; set = editing that project's own fields

  // Payment plans being built for the new project. Not editable here — an
  // existing project's payment plans are managed on its own Payment Plans tab.
  const [plans, setPlans] = useState([]);
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  // Files picked on the Add Documents field before a new project exists yet —
  // uploaded right after the project is created (see handleSubmit). Not used
  // while editing an existing project; ProjectDocuments talks to the server
  // directly in that case.
  const [documentFiles, setDocumentFiles] = useState([]);
  // Project Image — `imageFile` is a freshly-picked, not-yet-uploaded file
  // (only used before a new project exists); `imageUrl` mirrors the
  // project's saved image once one exists (populated on Edit, or right after
  // a live upload — see ProjectImage's onUploaded).
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const activePlan = plans[activePlanIndex];
  const projectValues = { ...form, planName: activePlan?.name || '' };
  if (activePlan) {
    activePlan.installments.forEach((row, i) => {
      projectValues[`instName${i}`] = row.name;
      projectValues[`instMilestone${i}`] = row.milestone;
      projectValues[`instPct${i}`] = row.percentage;
    });
  }
  const projectRules = {
    name: textName('Project name'),
    country: required('Country'),
    state: required('State'),
    city: required('City'),
    localAddresses: (val) => (!val || !val.length ? 'Add at least one local address.' : ''),
    maxPrice: optionalPositiveNumber('Purchase price'),
    latitude: (val, all) => {
      if (isBlank(val) && isBlank(all.longitude)) return '';
      if (isBlank(val)) return 'Latitude is required when longitude is set.';
      return latitude(val);
    },
    longitude: (val, all) => {
      if (isBlank(val) && isBlank(all.latitude)) return '';
      if (isBlank(val)) return 'Longitude is required when latitude is set.';
      return longitude(val);
    },
    possessionDate: (val, all) => {
      if (!val || !all.launchDate) return '';
      return val < all.launchDate ? 'Possession date cannot be before launch date.' : '';
    },
  };
  if (!editingId && activePlan) {
    projectRules.planName = textName('Plan name');
    activePlan.installments.forEach((_, i) => {
      projectRules[`instName${i}`] = required('Installment name');
      projectRules[`instMilestone${i}`] = required('Due condition');
      projectRules[`instPct${i}`] = percentage('Percentage');
    });
  }
  const v = useFormValidation(projectValues, projectRules);

  useEffect(() => { dispatch(projectsResource.fetchAll()); }, [dispatch]);

  const resetForm = () => {
    setForm(empty);
    setPlans([]);
    setActivePlanIndex(0);
    setDocumentFiles([]);
    setImageFile(null);
    setImageUrl('');
    setFormError('');
    setEditingId(null);
    v.reset();
  };

  const startEdit = (p) => {
    setForm({
      name: p.name || '', builderName: p.builderName || '', projectType: p.projectType || '', reraNumber: p.reraNumber || '',
      description: p.description || '', country: p.country || '', state: p.state || '', city: p.city || '',
      // Legacy projects (edited before this field existed) only have the old
      // single `address` string — fall back to showing that as one entry so
      // it's not silently lost when editing.
      localAddresses: p.localAddresses?.length ? p.localAddresses : (p.address ? [p.address] : []),
      maxPrice: p.maxPrice ?? '', status: p.status || 'Active',
      latitude: p.latitude ?? '', longitude: p.longitude ?? '',
      launchDate: p.launchDate ? p.launchDate.slice(0, 10) : '', possessionDate: p.possessionDate ? p.possessionDate.slice(0, 10) : '',
    });
    setPlans([]);
    setDocumentFiles([]);
    setImageFile(null);
    setImageUrl(p.imageUrl || '');
    setFormError('');
    setEditingId(p.id);
    v.reset();
    setShowForm(true);
  };

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDelete = (p) => {
    setDeleteError('');
    setPendingDelete(p);
  };

  const runDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await dispatch(projectsResource.removeOne(pendingDelete.id)).unwrap();
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(typeof err === 'string' ? err : 'Could not delete project.');
    } finally {
      setDeleting(false);
    }
  };

  const addPlan = () => {
    setPlans((prev) => [...prev, emptyPlan()]);
    setActivePlanIndex(plans.length);
  };
  const removePlan = (i) => {
    setPlans((prev) => prev.filter((_, idx) => idx !== i));
    setActivePlanIndex((prev) => Math.max(0, prev >= i ? prev - 1 : prev));
  };
  const updatePlanName = (i, name) => setPlans((prev) => prev.map((p, idx) => (idx === i ? { ...p, name } : p)));
  const addRow = (i) => setPlans((prev) => prev.map((p, idx) => (idx === i ? { ...p, installments: [...p.installments, emptyRow()] } : p)));
  const removeRow = (i, rowIdx) => setPlans((prev) => prev.map((p, idx) => (idx === i ? { ...p, installments: p.installments.filter((_, r) => r !== rowIdx) } : p)));
  const updateRow = (i, rowIdx, key, val) => setPlans((prev) => prev.map((p, idx) => (
    idx === i ? { ...p, installments: p.installments.map((row, r) => (r === rowIdx ? { ...row, [key]: val } : row)) } : p
  )));

  const setField = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    v.touch(key);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!v.validate()) return;

    if (!editingId) {
      for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        if (!p.name.trim()) { setFormError(`Payment plan ${i + 1}: plan name is required.`); setActivePlanIndex(i); return; }
        if (!p.installments.length) { setFormError(`Payment plan "${p.name}": add at least one installment.`); setActivePlanIndex(i); return; }
        for (const row of p.installments) {
          if (!row.name.trim() || !row.milestone.trim() || row.percentage === '') {
            setFormError(`Payment plan "${p.name}": every installment needs a name, due condition, and percentage.`);
            setActivePlanIndex(i);
            return;
          }
        }
        if (Math.abs(planTotal(p) - 100) > 0.05) {
          setFormError(`Payment plan "${p.name}" totals ${planTotal(p)}% — each plan must total 100%.`);
          setActivePlanIndex(i);
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        await dispatch(projectsResource.updateOne({ id: editingId, ...form })).unwrap();
      } else {
        const created = await dispatch(projectsResource.createOne({ ...form, paymentPlans: plans })).unwrap();
        // Documents picked on the Add Documents field before the project
        // existed — upload them now that we have a real project id. Doesn't
        // block the project itself from being considered saved if this fails.
        if (documentFiles.length) {
          try {
            const fd = new FormData();
            documentFiles.forEach((f) => fd.append('documents', f));
            await api.post(`/projects/${created.id}/documents`, fd);
          } catch (docErr) {
            window.alert(docErr.response?.data?.message || 'Project was saved, but its documents could not be uploaded. You can add them from Edit Project.');
          }
        }
        // Project Image picked before the project existed — upload it now
        // that we have a real project id. Same non-blocking treatment as
        // Documents above.
        if (imageFile) {
          try {
            const fd = new FormData();
            fd.append('image', imageFile);
            await api.post(`/projects/${created.id}/image`, fd);
          } catch (imgErr) {
            window.alert(imgErr.response?.data?.message || 'Project was saved, but its image could not be uploaded. You can add it from Edit Project.');
          }
        }
      }
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(typeof err === 'string' ? err : 'Could not save project.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || (p.city || '').toLowerCase().includes(search.toLowerCase())
  );

  const fmtPrice = (val) => (val ? `₹${Number(val).toLocaleString('en-IN')}` : '—');
  const planPctOk = activePlan ? Math.abs(planTotal(activePlan) - 100) < 0.05 : true;
  const showPlanTotalError = !editingId && activePlan && activePlan.installments.every((r) => r.percentage !== '') && !planPctOk;

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <div className="filter-input">
            <input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { if (showForm) { resetForm(); setShowForm(false); } else { resetForm(); setShowForm(true); } }}>
          {showForm ? 'Cancel' : '+ Add Project'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>{editingId ? 'Edit Project' : 'New Project'}</div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <FormField label="Project Name" required error={v.show('name')}>
                <input value={form.name} onChange={(e) => setField('name', e.target.value)} onBlur={() => v.touch('name')} />
              </FormField>
              <FormField label="Builder Name">
                <BuilderSelect value={form.builderName} onChange={(builderName) => setField('builderName', builderName)} />
              </FormField>
              <FormField label="Project Type">
                <input value={form.projectType} onChange={(e) => setField('projectType', e.target.value)} placeholder="e.g. Residential" />
              </FormField>
              <FormField label="RERA Number">
                <input value={form.reraNumber} onChange={(e) => setField('reraNumber', e.target.value)} />
              </FormField>
            </div>

            <div style={{ border: '1px solid var(--blue-500)', borderRadius: 10, padding: 16, marginTop: 16 }}>
              <div className="form-grid">
                <LocationSelect
                  value={{ country: form.country, state: form.state, city: form.city }}
                  errors={{ country: v.show('country'), state: v.show('state'), city: v.show('city') }}
                  onBlurField={(key) => v.touch(key)}
                  onChange={(loc) => {
                    setForm((f) => ({ ...f, ...loc }));
                    v.touch('country');
                    if (loc.state) v.touch('state');
                    if (loc.city) v.touch('city');
                  }}
                />
              </div>
              <LocalAddresses
                value={form.localAddresses}
                city={form.city}
                error={v.show('localAddresses')}
                onChange={(localAddresses) => { setForm((f) => ({ ...f, localAddresses })); v.touch('localAddresses'); }}
              />
            </div>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <ProjectImage
                projectId={editingId}
                currentUrl={imageUrl}
                file={imageFile}
                onFileChange={setImageFile}
                onUploaded={(url) => { setImageUrl(url); setImageFile(null); }}
              />
            </div>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <FormField label="Launch Date">
                <input type="date" value={form.launchDate} onChange={(e) => setField('launchDate', e.target.value)} />
              </FormField>
              <FormField label="Possession Date" error={v.show('possessionDate')}>
                <input type="date" value={form.possessionDate} onChange={(e) => setField('possessionDate', e.target.value)} onBlur={() => v.touch('possessionDate')} />
              </FormField>
              <FormField label="Purchase Price (₹)" error={v.show('maxPrice')}>
                <input type="number" value={form.maxPrice} onChange={(e) => setField('maxPrice', e.target.value)} onBlur={() => v.touch('maxPrice')} />
              </FormField>
              <FormField label="Status">
                <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  <option>Active</option><option>Upcoming</option><option>Sold Out</option><option>Inactive</option>
                </select>
              </FormField>
              <FormField label="Description" style={{ gridColumn: '1 / -1' }}>
                <input value={form.description} onChange={(e) => setField('description', e.target.value)} />
              </FormField>
              <FormField label="Latitude (optional)" error={v.show('latitude')}>
                <input type="number" step="any" value={form.latitude} onChange={(e) => setField('latitude', e.target.value)} onBlur={() => v.touch('latitude')} placeholder="e.g. 22.7532" />
              </FormField>
              <FormField label="Longitude (optional)" error={v.show('longitude')}>
                <input type="number" step="any" value={form.longitude} onChange={(e) => setField('longitude', e.target.value)} onBlur={() => v.touch('longitude')} placeholder="e.g. 75.8937" />
              </FormField>
              <div className="form-field" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => {
                  navigator.geolocation?.getCurrentPosition((pos) => {
                    setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                    v.touch('latitude');
                    v.touch('longitude');
                  });
                }}>Use my current location</button>
              </div>

            </div>

            <ProjectDocuments
              projectId={editingId}
              pendingFiles={documentFiles}
              onPendingFilesChange={setDocumentFiles}
            />

            {editingId && (
              <div className="cell-sub" style={{ marginTop: 20, padding: '10px 12px', background: 'var(--blue-100)', borderRadius: 8 }}>
                Payment plans aren't edited here — open this project's Payment Plans tab to add, activate, or delete its installment plans.
              </div>
            )}

            {!editingId && (
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <div className="row-flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div className="card-title">Payment Installment Plans</div>
                  <div className="cell-sub" style={{ marginTop: 2 }}>Add multiple payment plans for this project. Each plan must total 100%.</div>
                </div>
                <button type="button" className="btn btn-primary" onClick={addPlan}>+ Add Payment Plan</button>
              </div>

              {plans.length > 0 && (
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 560px', minWidth: 320 }}>
                    <div className="chip-row" style={{ marginBottom: 16 }}>
                      {plans.map((p, i) => (
                        <span key={i} className={`chip${i === activePlanIndex ? ' active' : ''}`} onClick={() => setActivePlanIndex(i)}>
                          {p.name || `Plan ${i + 1}`}
                        </span>
                      ))}
                      <span className="chip" style={{ borderStyle: 'dashed' }} onClick={addPlan}>+ Add Plan</span>
                    </div>

                    {activePlan && (
                      <div>
                        <div className="form-grid" style={{ marginBottom: 14 }}>
                          <FormField label="Plan Name" required error={v.show('planName')}>
                            <input placeholder="e.g. 2 Installment" value={activePlan.name} onChange={(e) => { updatePlanName(activePlanIndex, e.target.value); v.touch('planName'); }} onBlur={() => v.touch('planName')} />
                          </FormField>
                          <FormField label="Total Installments">
                            <input disabled value={activePlan.installments.length} />
                          </FormField>
                        </div>

                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr><th>Installment Name</th><th>Due Condition / Milestone</th><th style={{ width: 130 }}>Percentage (%)</th><th style={{ width: 60 }}></th></tr>
                            </thead>
                            <tbody>
                              {activePlan.installments.map((row, rowIdx) => (
                                <tr key={rowIdx}>
                                  <td>
                                    <input placeholder={`${rowIdx + 1} Installment`} value={row.name} onChange={(e) => { updateRow(activePlanIndex, rowIdx, 'name', e.target.value); v.touch(`instName${rowIdx}`); }} onBlur={() => v.touch(`instName${rowIdx}`)} style={v.show(`instName${rowIdx}`) ? { borderColor: 'var(--red)' } : undefined} />
                                    {v.show(`instName${rowIdx}`) && <div className="field-error">{v.show(`instName${rowIdx}`)}</div>}
                                  </td>
                                  <td>
                                    <input placeholder="e.g. At the time of Booking" value={row.milestone} onChange={(e) => { updateRow(activePlanIndex, rowIdx, 'milestone', e.target.value); v.touch(`instMilestone${rowIdx}`); }} onBlur={() => v.touch(`instMilestone${rowIdx}`)} style={v.show(`instMilestone${rowIdx}`) ? { borderColor: 'var(--red)' } : undefined} />
                                    {v.show(`instMilestone${rowIdx}`) && <div className="field-error">{v.show(`instMilestone${rowIdx}`)}</div>}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <input type="number" min="0.01" step="0.01" style={{ width: 80, borderColor: v.show(`instPct${rowIdx}`) ? 'var(--red)' : undefined }} value={row.percentage} onChange={(e) => { updateRow(activePlanIndex, rowIdx, 'percentage', e.target.value); v.touch(`instPct${rowIdx}`); }} onBlur={() => v.touch(`instPct${rowIdx}`)} />
                                      <span className="cell-sub">%</span>
                                    </div>
                                    {v.show(`instPct${rowIdx}`) && <div className="field-error">{v.show(`instPct${rowIdx}`)}</div>}
                                  </td>
                                  <td>
                                    {activePlan.installments.length > 1 && (
                                      <span className="link-btn" style={{ color: 'var(--red)' }} onClick={() => removeRow(activePlanIndex, rowIdx)} title="Remove installment">Remove</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {showPlanTotalError && <div className="field-error" style={{ marginTop: 8 }}>This plan totals {planTotal(activePlan)}% — each plan must total 100%.</div>}

                        <div className="row-flex" style={{ justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
                          <span className="link-btn" onClick={() => addRow(activePlanIndex)}>+ Add Installment</span>
                          <span className="row-flex" style={{ gap: 14 }}>
                            <span className="cell-main" style={{ color: Math.abs(planTotal(activePlan) - 100) < 0.05 ? 'var(--green)' : 'var(--red)' }}>
                              Total: {planTotal(activePlan)}%
                            </span>
                            <span className="link-btn" style={{ color: 'var(--red)' }} onClick={() => removePlan(activePlanIndex)}>Remove Plan</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: '0 1 280px', minWidth: 240 }}>
                    <div className="card" style={{ boxShadow: 'none', background: 'var(--bg)' }}>
                      <div className="card-title" style={{ marginBottom: 10 }}>Payment Plans Summary</div>
                      {plans.map((p, i) => {
                        const total = planTotal(p);
                        const ok = Math.abs(total - 100) < 0.05;
                        return (
                          <div key={i} className="row-flex" style={{ justifyContent: 'space-between', padding: '7px 0', cursor: 'pointer' }} onClick={() => setActivePlanIndex(i)}>
                            <span className="row-flex" style={{ gap: 8 }}>
                              <span className="cell-main">{p.name || `Plan ${i + 1}`}</span>
                              <span className="chip" style={{ padding: '2px 8px', cursor: 'pointer' }}>{p.installments.length}</span>
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 12.5, color: ok ? 'var(--green)' : 'var(--red)' }}>{total}%</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="card" style={{ marginTop: 12, boxShadow: 'none', background: 'var(--blue-100)' }}>
                      <div className="cell-sub">Note: Total percentage of each plan must be 100%.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {formError && <div className="cell-sub" style={{ color: 'var(--red)', marginTop: 16 }}>{formError}</div>}

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Save Project'}</button>{' '}
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid-cards">
        {filtered.map((p) => (
          <div className="prop-card" key={p.id} style={{ position: 'relative' }}>
            <div className="row-flex" style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, gap: 6 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 12, background: 'var(--card)' }}
                onClick={() => startEdit(p)}
              >
                ✏️ Edit
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 12, background: 'var(--card)', color: 'var(--red)', borderColor: 'var(--red)' }}
                onClick={() => handleDelete(p)}
              >
                🗑️ Delete
              </button>
            </div>
            <Link to={`/broker/projects/${p.id}`} style={{ display: 'block', cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>
              <div
                className="prop-img"
                style={p.imageUrl
                  ? { backgroundImage: `url(${SERVER_ORIGIN}${p.imageUrl})` }
                  : { background: 'linear-gradient(135deg,#dbe6fb,#eef2fb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-400)', fontSize: 12 }}
              >
                {!p.imageUrl && (p.builderName || 'No builder set')}
                <div className="prop-tag">{p.city}</div>
              </div>
              <div className="prop-body">
                <div className="prop-price">{fmtPrice(p.maxPrice)}</div>
                <div className="cell-main">{p.name}</div>
                <div className="prop-loc">📍 {p.address || p.city}</div>
                <div className="prop-meta">
                  <span>{p.builderName || 'Independent'}</span>
                  <span style={{ marginLeft: 'auto' }}><Badge status={p.status} /></span>
                </div>
              </div>
            </Link>
          </div>
        ))}
        {filtered.length === 0 && <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-600)' }}>No projects found.</div>}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${pendingDelete.name}"? This permanently removes its units, bookings, and payment plans, and unassigns any agents from it. Leads that showed interest in it are kept — just unlinked. This can't be undone.`}
          busy={deleting}
          error={deleteError}
          onConfirm={runDelete}
          onCancel={() => { if (!deleting) { setPendingDelete(null); setDeleteError(''); } }}
        />
      )}
    </>
  );
}
