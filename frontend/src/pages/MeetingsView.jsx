import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { meetingsResource } from '../store/resources';
import { agentsResource } from '../store/resources';
import FormField from '../components/FormField';
import useFormValidation from '../hooks/useFormValidation';
import { textName, required } from '../utils/validation';

const empty = { title: '', type: 'Meeting', scheduledAt: '', notes: '' };

export default function MeetingsView({ isAgent }) {
  const dispatch = useDispatch();
  const { items } = useSelector((s) => s.meetings);
  const { items: agents } = useSelector((s) => s.agents);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const v = useFormValidation(form, {
    title: textName('Title'),
    scheduledAt: required('Date & time'),
  });

  useEffect(() => {
    dispatch(meetingsResource.fetchAll());
    if (!isAgent) dispatch(agentsResource.fetchAll());
  }, [dispatch, isAgent]);

  const setField = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    v.touch(key);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(empty);
    v.reset();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;
    await dispatch(meetingsResource.createOne({ ...form, agentId: form.agentId || undefined }));
    closeForm();
  };

  return (
    <>
      <div className="toolbar">
        <div className="filters"><span className="cell-sub">{items.length} scheduled</span></div>
        <button className="btn btn-primary" onClick={() => (showForm ? closeForm() : setShowForm(true))}>+ Schedule Meeting</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>New Meeting</div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <FormField label="Title" required error={v.show('title')}>
                <input value={form.title} onChange={(e) => setField('title', e.target.value)} onBlur={() => v.touch('title')} />
              </FormField>
              <FormField label="Type">
                <select value={form.type} onChange={(e) => setField('type', e.target.value)}>
                  <option>Meeting</option><option>Call</option><option>Site Visit</option><option>Follow Up</option>
                </select>
              </FormField>
              <FormField label="Date & Time" required error={v.show('scheduledAt')}>
                <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setField('scheduledAt', e.target.value)} onBlur={() => v.touch('scheduledAt')} />
              </FormField>
              {!isAgent && (
                <FormField label="Assign Agent">
                  <select value={form.agentId || ''} onChange={(e) => setField('agentId', e.target.value)}>
                    <option value="">Select agent</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </FormField>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary">Save Meeting</button>{' '}
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancel</button>
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
