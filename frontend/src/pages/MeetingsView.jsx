import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { meetingsResource } from '../store/resources';
import { agentsResource } from '../store/resources';

const empty = { title: '', type: 'Meeting', scheduledAt: '', notes: '' };

export default function MeetingsView({ isAgent }) {
  const dispatch = useDispatch();
  const { items } = useSelector((s) => s.meetings);
  const { items: agents } = useSelector((s) => s.agents);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);

  useEffect(() => {
    dispatch(meetingsResource.fetchAll());
    if (!isAgent) dispatch(agentsResource.fetchAll());
  }, [dispatch, isAgent]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(meetingsResource.createOne({ ...form, agentId: form.agentId || undefined }));
    setForm(empty);
    setShowForm(false);
  };

  return (
    <>
      <div className="toolbar">
        <div className="filters"><span className="cell-sub">{items.length} scheduled</span></div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Schedule Meeting</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>New Meeting</div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field"><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="form-field"><label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>Meeting</option><option>Call</option><option>Site Visit</option><option>Follow Up</option>
                </select>
              </div>
              <div className="form-field"><label>Date &amp; Time</label><input required type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
              {!isAgent && (
                <div className="form-field"><label>Assign Agent</label>
                  <select value={form.agentId || ''} onChange={(e) => setForm({ ...form, agentId: e.target.value })}>
                    <option value="">Select agent</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary">Save Meeting</button>{' '}
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="timeline">
          {items.map((m) => (
            <div className="tl-item" key={m.id}>
              <div className="tl-dot" />
              <div className="tl-text">{m.title}</div>
              <div className="tl-meta">
                {m.lead?.customerName ? `${m.lead.customerName} · ` : ''}{m.agent?.name ? `${m.agent.name} · ` : ''}
                <b>{new Date(m.scheduledAt).toLocaleString()}</b> · <span className="badge blue">{m.type}</span>
              </div>
            </div>
          ))}
          {items.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-600)' }}>No meetings scheduled.</div>}
        </div>
      </div>
    </>
  );
}
