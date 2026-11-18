import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { initials, badgeColor } from '../components/icons';
import Badge from '../components/Badge';
import api from '../api/axios';
import { fetchFollowUpsForLead, addFollowUp, clearTimeline } from '../store/followUpsSlice';
import { projectsResource } from '../store/resources';
import { LEAD_STAGES, ACTIVITY_TYPES } from '../constants/leadEnums';
import SiteVisitTracker from '../components/SiteVisitTracker';
import SearchableSelect from '../components/SearchableSelect';
import { getCurrentPosition } from '../utils/geo';
import FormField from '../components/FormField';
import useFormValidation from '../hooks/useFormValidation';
import { required, isBlank } from '../utils/validation';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'followups', label: 'Follow-up History' },
  { key: 'sitevisits', label: 'Site Visits' },
];

const emptyFollowUpForm = { stage: '', activityType: 'Call', response: 'neutral', description: '', nextFollowUpAt: '', reminderEnabled: false, projectId: '' };

// Only agents log follow-ups. Brokers can view the full history for oversight,
// but must not be able to add/edit entries on an agent's behalf.
export default function LeadDetail({ isAgent }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { timeline } = useSelector((s) => s.followUps);
  // Only the projects assigned to this agent — same list the dropdown below
  // is built from — reusing the generic /projects endpoint, which already
  // scopes to the logged-in agent's assignments server-side.
  const { items: myProjects } = useSelector((s) => s.projects);

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const activeTab = searchParams.get('tab') || 'overview';

  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [fuForm, setFuForm] = useState(emptyFollowUpForm);
  const [savingFu, setSavingFu] = useState(false);
  const fuV = useFormValidation(fuForm, {
    stage: required('Lead stage'),
    activityType: required('Activity type'),
    response: required('Response'),
    nextFollowUpAt: (val, all) => (all.reminderEnabled && isBlank(val) ? 'Next follow-up date is required when a reminder is set.' : ''),
  });

  const loadLead = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/leads/${id}`);
      setLead(data.data);
      setFuForm((f) => ({ ...f, stage: data.data.stage }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLead();
    dispatch(fetchFollowUpsForLead(id));
    // A generous limit so the dropdown has every project assigned to this
    // agent, not just the first page of the default-paginated list.
    if (isAgent) dispatch(projectsResource.fetchAll({ limit: 200 }));
    return () => dispatch(clearTimeline());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setTab = (key) => setSearchParams({ tab: key });

  const setFuField = (key, val) => {
    setFuForm((f) => ({ ...f, [key]: val }));
    fuV.touch(key);
  };

  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    if (!fuV.validate()) return;
    setSavingFu(true);
    try {
      let gps = {};
      if (fuForm.activityType === 'Site Visit') {
        // Auto-capture GPS for the Site Visit Tracker's first step ("Site Visit
        // Scheduled") — best-effort; the follow-up still saves fine without it,
        // the tracker just won't auto-complete step 0 in that case.
        try {
          const { lat, lng } = await getCurrentPosition();
          gps = { lat, lng };
        } catch {
          // ignore — GPS is optional at this point, the tracker can be started manually
        }
      }
      await dispatch(addFollowUp({
        leadId: id,
        stage: fuForm.stage,
        activityType: fuForm.activityType,
        response: fuForm.response,
        description: fuForm.description,
        nextFollowUpAt: fuForm.nextFollowUpAt || null,
        reminderEnabled: fuForm.reminderEnabled,
        // Optional for every activity type — the agent can tag any follow-up
        // (Call, WhatsApp, Meeting, Site Visit, etc.) with the project it
        // concerns. Powers project-wise response tracking on the Leads page.
        projectId: fuForm.projectId || null,
        ...gps,
      }));
      setFuForm((f) => ({ ...emptyFollowUpForm, stage: f.stage }));
      fuV.reset();
      setShowFollowUpForm(false);
      await loadLead();
      setTab(fuForm.activityType === 'Site Visit' ? 'sitevisits' : 'followups');
    } finally {
      setSavingFu(false);
    }
  };

  if (loading) return <div className="card">Loading lead...</div>;
  if (!lead) return <div className="card">Lead not found.</div>;

  const siteVisits = timeline.filter((f) => f.activityType === 'Site Visit');

  return (
    <>
      <div className="row-flex" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <button className="link-btn" onClick={() => navigate(-1)}>← Back to leads</button>
        {isAgent && (
          <button className="btn btn-primary" onClick={() => { if (showFollowUpForm) { setShowFollowUpForm(false); fuV.reset(); } else setShowFollowUpForm(true); }}>
            {showFollowUpForm ? 'Cancel' : '+ Add Follow-up'}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="card-title row-flex">
            <div className="avatar-sm" style={{ background: 'var(--blue-600)', width: 38, height: 38, fontSize: 14 }}>{initials(lead.customerName)}</div>
            <div>{lead.customerName}<span>{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</span></div>
          </div>
          <Badge status={lead.stage} />
        </div>
      </div>

      {isAgent && showFollowUpForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Add Follow-up</div>
          <form onSubmit={handleSaveFollowUp} noValidate>
            <div className="form-grid">
              <FormField label="Status (Lead Stage)" required error={fuV.show('stage')}>
                <select value={fuForm.stage} onChange={(e) => setFuField('stage', e.target.value)} onBlur={() => fuV.touch('stage')}>
                  {LEAD_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Activity Type" required error={fuV.show('activityType')}>
                <select value={fuForm.activityType} onChange={(e) => setFuField('activityType', e.target.value)}>
                  {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </FormField>
              <FormField label="Project (optional)" hint={myProjects.length === 0 ? 'No projects are assigned to you yet.' : undefined}>
                <SearchableSelect
                  variant="form"
                  placeholder="Select a project…"
                  value={fuForm.projectId}
                  onChange={(val) => setFuField('projectId', val)}
                  options={myProjects.map((p) => ({ value: p.id, label: p.name }))}
                />
              </FormField>
              <FormField label="Response" required error={fuV.show('response')}>
                <select value={fuForm.response} onChange={(e) => setFuField('response', e.target.value)}>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                </select>
              </FormField>
              <FormField label="Description" style={{ gridColumn: '1 / -1' }}>
                <input value={fuForm.description} onChange={(e) => setFuField('description', e.target.value)} placeholder="e.g. Customer requested a site visit." />
              </FormField>
              <FormField label="Next Follow-up Date" error={fuV.show('nextFollowUpAt')}>
                <input type="datetime-local" value={fuForm.nextFollowUpAt} onChange={(e) => setFuField('nextFollowUpAt', e.target.value)} onBlur={() => fuV.touch('nextFollowUpAt')} />
              </FormField>
              <FormField style={{ justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input type="checkbox" checked={fuForm.reminderEnabled} onChange={(e) => setFuField('reminderEnabled', e.target.checked)} />
                  Set reminder for next follow-up
                </label>
              </FormField>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" disabled={savingFu}>{savingFu ? 'Saving...' : 'Save / Confirm'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="settings-tabs">
        {TABS.map((t) => (
          <div key={t.key} className={activeTab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Lead Information</div>
          <div className="form-grid">
            <div className="form-field"><label>Project</label><input value={lead.project?.name || '—'} disabled /></div>
            <div className="form-field"><label>Agent</label><input value={lead.agent?.name || 'Unassigned'} disabled /></div>
            <div className="form-field"><label>Source</label><input value={lead.source} disabled /></div>
            <div className="form-field"><label>Created By</label><input value={`${lead.creator?.name || '—'} (${lead.createdByRole})`} disabled /></div>
            <div className="form-field"><label>Priority</label><div style={{ marginTop: 6 }}><Badge status={lead.priority} /></div></div>
            <div className="form-field"><label>Next Follow-up</label><input value={lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleString() : 'Not set'} disabled /></div>
          </div>

          {lead.interestedIn?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <label className="cell-sub" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Interested In</label>
              <div className="chip-row">
                {lead.interestedIn.map((v) => <span key={v} className="chip active" style={{ cursor: 'default' }}>{v}</span>)}
              </div>
            </div>
          )}

          {lead.preferredLocations?.cities?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <label className="cell-sub" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Preferred Locations — {lead.preferredLocations.state ? `${lead.preferredLocations.state}, ` : ''}{lead.preferredLocations.country}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lead.preferredLocations.cities.map((c) => (
                  <div key={c.city} className="cell-sub">
                    <strong style={{ color: 'var(--text-900)' }}>{c.city}:</strong> {c.addresses?.length ? c.addresses.join(', ') : '—'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isAgent && (
            <p className="cell-sub" style={{ marginTop: 10 }}>Follow-ups are logged by the assigned agent — you can view the full history here but not add or edit entries.</p>
          )}
        </div>
      )}

      {activeTab === 'followups' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Follow-up History<span style={{ display: 'block', fontWeight: 400, fontSize: 12, color: 'var(--text-600)' }}>All logged interactions, newest first</span></div>
          <div className="timeline">
            {timeline.map((f) => (
              <div className="tl-item" key={f.id}>
                <div className="tl-dot" />
                <div className="tl-text row-flex" style={{ gap: 8 }}>
                  {f.activityType}
                  <span className={`badge ${badgeColor(f.stage)}`}>{f.stage}</span>
                  {f.response && <span className={`badge ${badgeColor(f.response)}`}>{f.response}</span>}
                  {f.reminderEnabled && <span className="badge amber">Reminder set</span>}
                </div>
                {f.description && <div className="tl-meta">{f.description}</div>}
                <div className="tl-meta">
                  {f.agent?.name} · {new Date(f.createdAt).toLocaleString()}
                  {f.nextFollowUpAt && <> · Next: {new Date(f.nextFollowUpAt).toLocaleString()}</>}
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <div style={{ color: 'var(--text-600)' }}>
                No follow-ups logged yet.{isAgent && ' Click "+ Add Follow-up" above to log the first one.'}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sitevisits' && (
        <>
          <SiteVisitTracker leadId={id} isAgent={isAgent} />
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Site Visits<span style={{ display: 'block', fontWeight: 400, fontSize: 12, color: 'var(--text-600)' }}>Follow-ups logged with activity type "Site Visit"</span></div>
            <div className="timeline">
              {siteVisits.map((f) => (
                <div className="tl-item" key={f.id}>
                  <div className="tl-dot" />
                  <div className="tl-text">
                    {f.description || 'Site visit'}
                    {f.project?.name && <span className="badge blue" style={{ marginLeft: 8 }}>{f.project.name}</span>}
                  </div>
                  <div className="tl-meta">{f.agent?.name} · {new Date(f.createdAt).toLocaleString()}</div>
                </div>
              ))}
              {siteVisits.length === 0 && <div style={{ color: 'var(--text-600)' }}>No site visits logged yet.</div>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
