import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Badge from '../components/Badge';
import ActivityResponses from '../components/ActivityResponses';
import LeadResponseModal from '../components/LeadResponseModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { initials } from '../components/icons';
import { leadsResource, agentsResource, projectsResource } from '../store/resources';
import SearchableSelect from '../components/SearchableSelect';
import InterestedInField from '../components/InterestedInField';
import PreferredLocationsField from '../components/PreferredLocationsField';
import PendingLeadsView from './PendingLeadsView';
import api from '../api/axios';
import { LEAD_STAGES } from '../constants/leadEnums';
import FormField from '../components/FormField';
import useFormValidation from '../hooks/useFormValidation';
import { personName, requiredPhone, phone, email, required } from '../utils/validation';

const emptyLead = {
  customerName: '', phone: '', alternatePhone: '', email: '', source: 'Website', priority: 'Medium', projectId: '', agentId: '',
  interestedIn: [],
  preferredLocations: { country: '', state: '', cities: [] },
};

export default function LeadsView({ isAgent }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { items: leads } = useSelector((s) => s.leads);
  const { items: agents } = useSelector((s) => s.agents);
  const { items: projects } = useSelector((s) => s.projects);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyLead);
  const v = useFormValidation(form, {
    customerName: personName('Customer name'),
    phone: requiredPhone('Phone'),
    alternatePhone: phone,
    email,
    source: required('Source'),
    priority: required('Priority'),
  });
  const [stageFilter, setStageFilter] = useState('');
  // "Assigned Leads" (default) / "Unassigned Leads" / — Broker only — "Pending
  // Leads" (Lead Approval Workflow requests, moved here from its own sidebar
  // page; see PendingLeadsView). Agent Panel keeps its original 2: "My
  // Assigned Leads" (strictly their own) vs "Unassigned Leads" (every
  // currently-unassigned lead in the tenant) — "My Pending Leads" stays a
  // separate agent-side page, unchanged.
  const [leadsTab, setLeadsTab] = useState('assigned');
  // Broker only — counts shown on the Unassigned/Pending tab pills. Best-effort:
  // refetched whenever the tab changes so they stay reasonably in sync with
  // actions (approve/reject/assign/delete) taken elsewhere.
  const [tabCounts, setTabCounts] = useState({ unassigned: 0, pending: 0 });
  // Full valid Priority/Source values (from the Lead model's ENUM, via /leads/enums)
  // — used by the Add Lead form's own Priority/Source fields, since a brand-new
  // tenant with zero leads must still see every option, not just ones "in use".
  const [formEnums, setFormEnums] = useState({ priorities: [], sources: [] });

  // Agent "Add Lead" flow — duplicate check (phone & alternate phone) runs before
  // saving. A match blocks the save and shows the existing lead instead; a unique
  // lead is saved as Pending Approval and never touches the Active Leads table.
  const [submitting, setSubmitting] = useState(false);
  const [duplicateLead, setDuplicateLead] = useState(null);
  const [pendingSubmitted, setPendingSubmitted] = useState(null);

  // Bulk selection + assign (broker only) — Agent, Project, and Stage are only ever
  // changed this way (select leads → choose a value → Apply), never via a per-row
  // dropdown sitting open in the table.
  // Lead detail popup ("Projects & Responses") — opened by clicking a lead's
  // name or the "View" link in the Last 5 Responses column. Purely additive;
  // doesn't change the existing "Open" link to the full Lead Detail page.
  const [responseModalLeadId, setResponseModalLeadId] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAgentId, setBulkAgentId] = useState('');
  const [bulkProjectId, setBulkProjectId] = useState('');
  const [bulkStage, setBulkStage] = useState('');
  const [applying, setApplying] = useState(false);

  // CSV/Excel import (broker only)
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const refresh = () => {
    if (leadsTab === 'pending') return; // PendingLeadsView fetches its own data independently
    const params = {};
    if (stageFilter) params.stage = stageFilter;
    if (leadsTab === 'unassigned') params.unassigned = 'true'; // broker-only tab
    if (!isAgent && leadsTab === 'assigned') params.assigned = 'true'; // agent role already scopes to "my own" server-side
    dispatch(leadsResource.fetchAll(params));
  };

  const loadTabCounts = async () => {
    try {
      const pendingRes = await api.get('/leads/pending'); // scoped to "my own" server-side for an agent, tenant-wide for a broker
      const pending = pendingRes.data.total ?? pendingRes.data.data?.length ?? 0;
      if (isAgent) {
        setTabCounts((c) => ({ ...c, pending }));
      } else {
        const unassignedRes = await api.get('/leads', { params: { unassigned: 'true', limit: 1 } });
        setTabCounts({ unassigned: unassignedRes.data.total ?? 0, pending });
      }
    } catch {
      // best-effort — tab labels just show without a count if this fails
    }
  };

  useEffect(() => {
    refresh();
    loadTabCounts();
    dispatch(projectsResource.fetchAll());
    if (!isAgent) dispatch(agentsResource.fetchAll());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, stageFilter, isAgent, leadsTab]);

  useEffect(() => {
    api.get('/leads/enums').then(({ data }) => setFormEnums(data)).catch(() => {});
  }, []);

  const canEdit = (lead) => !isAgent || (lead.createdBy === user?.id && lead.createdByRole === 'agent');

  const setField = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    v.touch(key);
  };

  const closeLeadForm = () => {
    setShowForm(false);
    setDuplicateLead(null);
    setForm(emptyLead);
    v.reset();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;
    const payload = { ...form };
    if (!payload.agentId) delete payload.agentId;
    if (!payload.projectId) delete payload.projectId;
    if (!payload.alternatePhone) delete payload.alternatePhone;

    // Interested In — drop entirely if nothing was selected.
    if (!payload.interestedIn?.length) delete payload.interestedIn;

    // Preferred Locations — each city already carries a clean `addresses`
    // array (picked/added via AddressAutocomplete); just drop the field
    // entirely if no country/cities were picked.
    if (payload.preferredLocations?.country && payload.preferredLocations?.cities?.length) {
      payload.preferredLocations = {
        country: payload.preferredLocations.country,
        state: payload.preferredLocations.state,
        cities: payload.preferredLocations.cities.map((c) => ({
          city: c.city,
          addresses: c.addresses || [],
        })),
      };
    } else {
      delete payload.preferredLocations;
    }

    if (isAgent) {
      setDuplicateLead(null);
      setSubmitting(true);
      try {
        await api.post('/leads', payload);
        closeLeadForm();
        setPendingSubmitted({ customerName: payload.customerName });
      } catch (err) {
        if (err.response?.status === 409 && err.response?.data?.existingLead) {
          setDuplicateLead(err.response.data.existingLead);
        } else {
          window.alert(err.response?.data?.message || 'Could not submit lead.');
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Broker path — blocked with a message if the phone/alternatePhone
    // already belongs to an existing lead (see leadController.create); the
    // 409 rejection message comes straight from the backend.
    try {
      await dispatch(leadsResource.createOne(payload)).unwrap();
      closeLeadForm();
    } catch (err) {
      window.alert(typeof err === 'string' ? err : 'Could not save lead.');
    }
  };

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDelete = (lead) => {
    if (!canEdit(lead)) return;
    setDeleteError('');
    setPendingDelete(lead);
  };

  const runDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await dispatch(leadsResource.removeOne(pendingDelete.id)).unwrap();
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(typeof err === 'string' ? err : 'Could not delete lead.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.length === leads.length ? [] : leads.map((l) => l.id)));
  };

  const handleBulkApply = async () => {
    if (!selectedIds.length || (!bulkAgentId && !bulkProjectId && !bulkStage)) return;
    setApplying(true);
    try {
      await Promise.all(selectedIds.map(async (id) => {
        if (bulkAgentId) await api.post(`/leads/${id}/assign`, { agentId: bulkAgentId });
        if (bulkProjectId) await api.put(`/leads/${id}`, { projectId: bulkProjectId });
        if (bulkStage) await api.patch(`/leads/${id}/stage`, { stage: bulkStage });
      }));
      setSelectedIds([]);
      setBulkAgentId('');
      setBulkProjectId('');
      setBulkStage('');
      refresh();
    } finally {
      setApplying(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/leads/import', formData);
      setImportResult({ ok: data.created > 0, ...data });
      refresh();
    } catch (err) {
      setImportResult({ ok: false, message: err.response?.data?.message || 'Import failed.' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const fmtInterestedIn = (arr) => (arr && arr.length ? arr.join(', ') : '—');
  const fmtPreferredLocations = (pl) => {
    if (!pl || !pl.cities?.length) return '—';
    return pl.cities.map((c) => (c.addresses?.length ? `${c.city} (${c.addresses.join(', ')})` : c.city)).join('; ');
  };

  return (
    <>
      {isAgent && (
        <div className="settings-tabs">
          <div className={leadsTab === 'assigned' ? 'active' : ''} onClick={() => { setLeadsTab('assigned'); setShowForm(false); }}>My Assigned Leads</div>
          <div className={leadsTab === 'pending' ? 'active' : ''} onClick={() => { setLeadsTab('pending'); setShowForm(false); }}>
            My Pending Leads
            {tabCounts.pending > 0 && <span className="tab-count">{tabCounts.pending}</span>}
          </div>
        </div>
      )}

      {!isAgent && (
        <div className="settings-tabs">
          <div className={leadsTab === 'assigned' ? 'active' : ''} onClick={() => { setLeadsTab('assigned'); setShowForm(false); }}>Assigned Leads</div>
          <div className={leadsTab === 'unassigned' ? 'active' : ''} onClick={() => { setLeadsTab('unassigned'); setShowForm(false); }}>
            Unassigned Leads
            {tabCounts.unassigned > 0 && <span className="tab-count">{tabCounts.unassigned}</span>}
          </div>
          <div className={leadsTab === 'pending' ? 'active' : ''} onClick={() => { setLeadsTab('pending'); setShowForm(false); }}>
            Pending Leads
            {tabCounts.pending > 0 && <span className="tab-count">{tabCounts.pending}</span>}
          </div>
        </div>
      )}

      {leadsTab === 'pending' ? (
        <PendingLeadsView isAgent={isAgent} />
      ) : (
      <>
      <div className="toolbar">
        <div className="filters">
          <select className="filter-select" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="">All Stages</option>
            {LEAD_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {isAgent && (
            <span className="cell-sub" style={{ alignSelf: 'center' }}>
              {leads.length} {leadsTab === 'unassigned' ? 'unassigned lead' : 'assigned lead'}{leads.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!isAgent && (
            <>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
              <button className="btn btn-ghost" onClick={handleImportClick} disabled={importing}>
                {importing ? 'Importing...' : 'Import Leads (CSV/Excel)'}
              </button>
            </>
          )}
          {!(isAgent && leadsTab === 'unassigned') && (
            <button className="btn btn-primary" onClick={() => { if (showForm) closeLeadForm(); else { setShowForm(true); setDuplicateLead(null); v.reset(); } }}>+ Add Lead</button>
          )}
        </div>
      </div>

      {pendingSubmitted && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--amber)' }}>
          <div className="row-flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="cell-main">"{pendingSubmitted.customerName}" was submitted for broker approval.</div>
              <div className="cell-sub" style={{ marginTop: 4 }}>You'll be notified once it's approved or rejected. Check "My Pending Leads" for its status.</div>
            </div>
            <button className="link-btn" onClick={() => setPendingSubmitted(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {importResult && (
        <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${importResult.ok ? 'var(--green)' : 'var(--red)'}` }}>
          <div className="row-flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="cell-main">{importResult.message}</div>
              {importResult.detectedColumns && (
                <div className="cell-sub" style={{ marginTop: 4 }}>
                  Columns detected in your file: {importResult.detectedColumns.join(', ') || '(none)'}
                </div>
              )}
              {importResult.errors?.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--text-600)' }}>
                  {importResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  {importResult.errors.length > 10 && <li>...and {importResult.errors.length - 10} more.</li>}
                </ul>
              )}
            </div>
            <button className="link-btn" onClick={() => setImportResult(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {!isAgent && selectedIds.length > 0 && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="cell-main">{selectedIds.length} lead{selectedIds.length === 1 ? '' : 's'} selected</span>
          <select className="filter-select" value={bulkAgentId} onChange={(e) => setBulkAgentId(e.target.value)}>
            <option value="">Assign to Agent...</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="filter-select" value={bulkProjectId} onChange={(e) => setBulkProjectId(e.target.value)}>
            <option value="">Assign to Project...</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="filter-select" value={bulkStage} onChange={(e) => setBulkStage(e.target.value)}>
            <option value="">Change Stage...</option>
            {LEAD_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleBulkApply} disabled={applying || (!bulkAgentId && !bulkProjectId && !bulkStage)}>
            {applying ? 'Applying...' : 'Apply'}
          </button>
          <button className="btn btn-ghost" onClick={() => setSelectedIds([])}>Clear selection</button>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>{isAgent ? 'Add My Lead' : 'New Lead'}</div>

          {isAgent && duplicateLead && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--red)', boxShadow: 'none' }}>
              <div className="cell-main" style={{ marginBottom: 6 }}>A lead with this phone number already exists — not saved.</div>
              <div className="form-grid">
                <div className="form-field"><label>Customer</label><input value={duplicateLead.customerName} disabled /></div>
                <div className="form-field"><label>Phone</label><input value={duplicateLead.phone} disabled /></div>
                <div className="form-field"><label>Project</label><input value={duplicateLead.project?.name || '—'} disabled /></div>
                <div className="form-field"><label>Agent</label><input value={duplicateLead.agent?.name || 'Unassigned'} disabled /></div>
              </div>
              <div style={{ marginTop: 10 }}><span className="link-btn" onClick={() => setDuplicateLead(null)}>Dismiss</span></div>
            </div>
          )}

          <form onSubmit={handleCreate} noValidate>
            <div className="form-grid">
              <FormField label="Customer Name" required error={v.show('customerName')}>
                <input value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} onBlur={() => v.touch('customerName')} />
              </FormField>
              <FormField label="Phone" required error={v.show('phone')}>
                <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} onBlur={() => v.touch('phone')} placeholder="+91 98200 12345" />
              </FormField>
              {isAgent && (
                <FormField label="Alternate Phone (optional)" error={v.show('alternatePhone')}>
                  <input value={form.alternatePhone} onChange={(e) => setField('alternatePhone', e.target.value)} onBlur={() => v.touch('alternatePhone')} placeholder="+91 98200 12345" />
                </FormField>
              )}
              <FormField label="Email" error={v.show('email')}>
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} onBlur={() => v.touch('email')} />
              </FormField>
              <FormField label={isAgent ? 'Project (optional — Unassigned allowed)' : 'Project'}>
                <SearchableSelect
                  variant="form"
                  placeholder={isAgent ? 'Unassigned' : 'Select project'}
                  value={form.projectId}
                  onChange={(val) => setField('projectId', val)}
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                />
              </FormField>
              <FormField label="Source" required error={v.show('source')}>
                <SearchableSelect
                  variant="form"
                  placeholder="Select source"
                  value={form.source}
                  invalid={!!v.show('source')}
                  onBlur={() => v.touch('source')}
                  onChange={(val) => setField('source', val || 'Website')}
                  options={formEnums.sources.map((s) => ({ value: s, label: s }))}
                />
              </FormField>
              <FormField label="Priority" required error={v.show('priority')}>
                <SearchableSelect
                  variant="form"
                  placeholder="Select priority"
                  value={form.priority}
                  invalid={!!v.show('priority')}
                  onBlur={() => v.touch('priority')}
                  onChange={(val) => setField('priority', val || 'Medium')}
                  options={formEnums.priorities.map((p) => ({ value: p, label: p }))}
                />
              </FormField>
              {!isAgent && (
                <FormField label="Assign Agent (optional)">
                  <SearchableSelect
                    variant="form"
                    placeholder="Unassigned"
                    value={form.agentId}
                    onChange={(val) => setField('agentId', val)}
                    options={agents.map((a) => ({ value: a.id, label: a.name }))}
                  />
                </FormField>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <div className="cell-main" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                Interested In
                <span className="badge blue">NEW</span>
              </div>
              <InterestedInField
                value={form.interestedIn}
                onChange={(interestedIn) => setForm({ ...form, interestedIn })}
              />
            </div>

            <div style={{ marginTop: 20 }}>
              <div className="cell-main" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                Preferred Locations
                <span className="badge blue">NEW</span>
              </div>
              <PreferredLocationsField
                value={form.preferredLocations}
                onChange={(preferredLocations) => setForm({ ...form, preferredLocations })}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Save Lead'}</button>{' '}
              <button type="button" className="btn btn-ghost" onClick={closeLeadForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {!isAgent && <th><input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === leads.length} onChange={toggleSelectAll} /></th>}
                <th>Customer</th><th>Phone</th><th>Project</th>
                {!isAgent && <th>Agent</th>}
                {!isAgent && <th>Is Agent Lead</th>}
                <th>Stage</th><th>Priority</th><th>Interested In</th><th>Preferred Location</th><th>Status</th><th>Last 5 Responses</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  {!isAgent && <td><input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggleSelect(l.id)} /></td>}
                  <td
                    className="row-flex"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setResponseModalLeadId(l.id)}
                    title="View projects & responses"
                  >
                    <div className="avatar-sm" style={{ background: 'var(--blue-600)' }}>{initials(l.customerName)}</div><span className="cell-main">{l.customerName}</span>
                  </td>
                  <td className="cell-sub">{l.phone}</td>
                  <td>{l.project?.name || '—'}</td>
                  {!isAgent && <td>{l.agent?.name || 'Unassigned'}</td>}
                  {!isAgent && (
                    <td>
                      {l.createdByRole === 'agent'
                        ? <span title={`Submitted by ${l.creator?.name || 'an agent'}`}>✅ {l.creator?.name || 'Agent'}</span>
                        : <span title="Created directly by the broker">❌ False</span>}
                    </td>
                  )}
                  <td><Badge status={l.stage} /></td>
                  <td><Badge status={l.priority} /></td>
                  <td className="cell-sub" style={{ maxWidth: 180, whiteSpace: 'normal' }}>{fmtInterestedIn(l.interestedIn)}</td>
                  <td className="cell-sub" style={{ maxWidth: 220, whiteSpace: 'normal' }}>{fmtPreferredLocations(l.preferredLocations)}</td>
                  <td><Badge status={l.isBooked ? 'Booked' : 'Not Booked'} /></td>
                  <td>
                    <div className="row-flex" style={{ gap: 10, flexWrap: 'wrap' }}>
                      <ActivityResponses followUps={l.recentFollowUps} />
                      <span className="link-btn" onClick={() => setResponseModalLeadId(l.id)}>View</span>
                    </div>
                  </td>
                  <td>
                    {isAgent && leadsTab === 'unassigned'
                      ? <span className="cell-sub">—</span>
                      : <Link className="link-btn" to={`${isAgent ? '/agent' : '/broker'}/leads/${l.id}`}>Open</Link>}
                    {canEdit(l) && <> · <span className="link-btn" style={{ color: 'var(--red)' }} onClick={() => handleDelete(l)}>Delete</span></>}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={isAgent ? 10 : 13} style={{ textAlign: 'center', color: 'var(--text-600)' }}>
                  {leadsTab === 'unassigned' ? 'No unassigned leads right now.' : !isAgent && leadsTab === 'assigned' ? 'No assigned leads yet.' : 'No leads found.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!isAgent && (
          <div className="cell-sub" style={{ marginTop: 10, paddingLeft: 4 }}>
            ✅ Agent Lead = Lead created by Agent &nbsp;&nbsp; ❌ Not Agent Lead = Lead created by Broker
          </div>
        )}
      </div>
      </>
      )}

      {responseModalLeadId && (
        <LeadResponseModal leadId={responseModalLeadId} onClose={() => setResponseModalLeadId(null)} />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete lead"
          message={`Delete lead "${pendingDelete.customerName}"? This cannot be undone.`}
          busy={deleting}
          error={deleteError}
          onConfirm={runDelete}
          onCancel={() => { if (!deleting) { setPendingDelete(null); setDeleteError(''); } }}
        />
      )}
    </>
  );
}
