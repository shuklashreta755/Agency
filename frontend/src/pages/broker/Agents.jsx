
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { initials } from '../../components/icons';
import { agentsResource, projectsResource, leadsResource } from '../../store/resources';
import ImageUploadField from '../../components/ImageUploadField';
import api, { SERVER_ORIGIN } from '../../api/axios';

const empty = { name: '', phone: '', email: '', address: '', joiningDate: '' };

export default function Agents() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items: agents } = useSelector((s) => s.agents);
  const { items: projects } = useSelector((s) => s.projects);
  const { items: leads } = useSelector((s) => s.leads);

  const [showForm, setShowForm] = useState(false);
  // Set while editing an existing agent (holds their id); null while adding
  // a brand-new one. The same form panel below is reused for both — see
  // openAdd / openEdit / handleSubmit.
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(empty);
  // Profile Image picked before the agent account exists yet — uploaded
  // right after creation, same staged-file pattern as the Project cover
  // image (see ImageUploadField / Projects.jsx handleSubmit). When editing,
  // this stays null unless the broker picks a new image to replace theirs.
  const [imageFile, setImageFile] = useState(null);
  const [err, setErr] = useState('');
  const [manageAgentId, setManageAgentId] = useState(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Active / Inactive tabs (see backend controllers/agentController.list —
  // ?status=inactive returns soft-deleted agents). The Active tab keeps
  // using the existing agentsResource redux flow untouched — other pages
  // (Dashboard, Reports, lead/booking assignment, etc.) read that same
  // `state.agents` slice expecting active agents, so it must always hold the
  // active list. Inactive agents are fetched separately into local state so
  // switching tabs here never disturbs what those other pages see.
  const [tab, setTab] = useState('active');
  const [inactiveAgents, setInactiveAgents] = useState([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);

  useEffect(() => {
    dispatch(agentsResource.fetchAll());
    dispatch(projectsResource.fetchAll());
    dispatch(leadsResource.fetchAll());
  }, [dispatch]);

  // Loads the soft-deleted agents for the "Inactive Agents" tab. Kept as a
  // plain, reusable function (not a redux thunk) since this list is only
  // ever needed here — refetched every time the tab is opened so it's always
  // current after a delete elsewhere on this page.
  const loadInactiveAgents = async () => {
    setInactiveLoading(true);
    try {
      const { data } = await api.get('/agents', { params: { status: 'inactive' } });
      setInactiveAgents(data.data || []);
    } catch {
      setInactiveAgents([]);
    } finally {
      setInactiveLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'inactive') loadInactiveAgents();
  }, [tab]);

  const displayedAgents = tab === 'active' ? agents : inactiveAgents;

  // Opens the form panel blank, ready to create a brand-new agent.
  const openAdd = () => {
    setEditingId(null);
    setForm(empty);
    setImageFile(null);
    setErr('');
    setShowForm(true);
  };

  // Opens the same form panel pre-filled with an existing agent's data, so
  // the broker can update their details. Uses the same PUT /agents/:id
  // endpoint the "isActive" toggle already relies on (see
  // backend/controllers/agentController.update) — nothing new on the API side.
  const openEdit = (agent) => {
    setEditingId(agent.id);
    setForm({
      name: agent.name || '',
      phone: agent.phone || '',
      email: agent.email || '',
      address: agent.address || '',
      joiningDate: agent.joiningDate ? agent.joiningDate.slice(0, 10) : '',
    });
    setImageFile(null);
    setErr('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(empty); setImageFile(null); setErr(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      let agentId = editingId;
      if (editingId) {
        await api.put(`/agents/${editingId}`, form);
      } else {
        const { data } = await api.post('/auth/agents', form);
        agentId = data.user.id;
      }
      // Profile Image staged in this form — upload/replace it now that we
      // have a real agent id. Non-blocking: the create/update above is still
      // considered successful even if the image upload itself fails.
      if (imageFile) {
        try {
          const fd = new FormData();
          fd.append('image', imageFile);
          await api.post(`/agents/${agentId}/image`, fd);
        } catch (imgErr) {
          window.alert(imgErr.response?.data?.message || `Agent was ${editingId ? 'updated' : 'created'}, but the profile image could not be uploaded.`);
        }
      }
      closeForm();
      dispatch(agentsResource.fetchAll());
    } catch (ex) {
      setErr(ex.response?.data?.message || `Failed to ${editingId ? 'update' : 'add'} agent.`);
    }
  };

  // Soft delete only (see backend controllers/agentController.remove) — the
  // agent row, and everything tied to it (leads, bookings, history), stays
  // in the database. It just stops showing up here.
  const handleDelete = async (agent) => {
    if (!window.confirm(`Remove agent "${agent.name}"? They will no longer appear in this list or be able to log in, but their records are kept.`)) return;
    try {
      await dispatch(agentsResource.removeOne(agent.id)).unwrap();
    } catch (ex) {
      window.alert(typeof ex === 'string' ? ex : 'Failed to remove agent.');
    }
  };

  const openManage = (agent) => {
    setManageAgentId(manageAgentId === agent.id ? null : agent.id);
    setSelectedProjectIds((agent.assignedProjects || []).map((p) => p.id));
    setSelectedLeadIds([]);
    setProjectSearch('');
    setLeadSearch('');
  };

  const toggleProject = (id) => {
    setSelectedProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleLead = (id) => {
    setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const saveAssignments = async (agentId) => {
    setSavingAssignments(true);
    try {
      await api.put(`/agents/${agentId}/projects`, { projectIds: selectedProjectIds });
      await Promise.all(selectedLeadIds.map((leadId) => api.post(`/leads/${leadId}/assign`, { agentId })));
      setSelectedLeadIds([]);
      dispatch(agentsResource.fetchAll());
      dispatch(leadsResource.fetchAll());
      setManageAgentId(null);
    } finally {
      setSavingAssignments(false);
    }
  };

  const statusColor = { online: 'green', idle: 'amber', offline: 'red' };
  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()));
  const filteredLeads = leads.filter((l) => l.customerName.toLowerCase().includes(leadSearch.toLowerCase()) || l.phone.includes(leadSearch));

  return (
    <>
      <div className="settings-tabs">
        <div className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Active Agents</div>
        <div className={tab === 'inactive' ? 'active' : ''} onClick={() => setTab('inactive')}>Inactive Agents</div>
      </div>

      <div className="toolbar">
        <div className="filters"><div className="filter-input"><input placeholder="Search agents..." /></div></div>
        <button className="btn btn-primary" onClick={showForm ? closeForm : openAdd}>{showForm ? 'Cancel' : '+ Add Agent'}</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 6 }}>{editingId ? 'Edit Agent' : 'New Agent'}</div>
          {!editingId && <p className="cell-sub" style={{ marginBottom: 14 }}>The agent will sign in using their phone number — no password needed.</p>}
          {err && <div className="auth-error">{err}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field"><label>Full Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-field"><label>Phone Number</label><input required type="tel" placeholder="+91 98200 12345" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="form-field"><label>Email (optional)</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="form-field"><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="form-field"><label>Joining Date</label><input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></div>
            </div>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <ImageUploadField
                label="Profile Image"
                shape="circle"
                file={imageFile}
                onFileChange={setImageFile}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary">{editingId ? 'Save Changes' : 'Create Agent'}</button>{' '}
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="agent-grid">
        {tab === 'inactive' && inactiveLoading && (
          <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-600)' }}>Loading inactive agents...</div>
        )}
        {!(tab === 'inactive' && inactiveLoading) && displayedAgents.map((a) => (
          <div className="agent-card" key={a.id} style={{ textAlign: 'left' }}>
            <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate(`/broker/agents/${a.id}`)}>
              <div
                className="agent-avatar"
                style={a.avatarUrl
                  ? { backgroundImage: `url(${SERVER_ORIGIN}${a.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: 'var(--blue-600)' }}
              >
                {!a.avatarUrl && initials(a.name)}
              </div>
              <div className="cell-main">{a.name}</div>
              <div className="cell-sub">{a.phone}</div>
              {a.joiningDate && <div className="cell-sub">Joined {new Date(a.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
              <div style={{ marginTop: 10 }}><span className={`badge ${statusColor[a.status] || 'blue'}`}>{a.status}</span></div>
            </div>

            {/* <div className="agent-stats">
              <div className="agent-stat"><b>{a.stats?.closedLeads ?? 0}</b><span>Closed</span></div>
            </div> */}

            {a.assignedProjects?.length > 0 && (
              <div className="chip-row" style={{ marginTop: 10, justifyContent: 'center' }}>
                {a.assignedProjects.map((p) => <span key={p.id} className="chip">{p.name}</span>)}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openManage(a)}>
                {manageAgentId === a.id ? 'Close' : 'Manage Projects & Leads'}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span className="link-btn" onClick={() => openEdit(a)}>Edit</span>
              {' · '}
              <span className="link-btn" style={{ color: 'var(--red)' }} onClick={() => handleDelete(a)}>Delete</span>
            </div>

            {manageAgentId === a.id && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-600)' }}>Searchable Project Assignment</label>
                <input className="filter-input" style={{ width: '100%', marginTop: 6, marginBottom: 8 }}
                  placeholder="Search projects..." value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} />
                <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 9, padding: 8 }}>
                  {filteredProjects.map((p) => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 2px' }}>
                      <input type="checkbox" checked={selectedProjectIds.includes(p.id)} onChange={() => toggleProject(p.id)} />
                      {p.name} <span className="cell-sub">({p.city})</span>
                    </label>
                  ))}
                  {filteredProjects.length === 0 && <div className="cell-sub">No matching projects.</div>}
                </div>

                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-600)', marginTop: 14, display: 'block' }}>Searchable Lead Assignment (optional)</label>
                <input className="filter-input" style={{ width: '100%', marginTop: 6, marginBottom: 8 }}
                  placeholder="Search leads by name or phone..." value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} />
                <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 9, padding: 8 }}>
                  {filteredLeads.map((l) => (
                    <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 2px' }}>
                      <input type="checkbox" checked={selectedLeadIds.includes(l.id)} onChange={() => toggleLead(l.id)} />
                      {l.customerName} <span className="cell-sub">({l.phone}) — currently {l.agent?.name || 'Unassigned'}</span>
                    </label>
                  ))}
                  {filteredLeads.length === 0 && <div className="cell-sub">No matching leads.</div>}
                </div>

                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={savingAssignments} onClick={() => saveAssignments(a.id)}>
                    {savingAssignments ? 'Saving...' : 'Save Assignments'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!(tab === 'inactive' && inactiveLoading) && displayedAgents.length === 0 && (
          <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-600)' }}>
            {tab === 'active' ? 'No agents yet — add your first one.' : 'No inactive agents.'}
          </div>
        )}
      </div>
    </>
  );
}