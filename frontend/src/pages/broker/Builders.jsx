import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../../components/Badge';
import api from '../../api/axios';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import useFormValidation from '../../hooks/useFormValidation';
import { textName, phone, email } from '../../utils/validation';

const empty = { name: '', phone: '', email: '', description: '', status: 'Active' };

/**
 * Builders — Create/View/Edit/Delete, broker-scoped. Delete is a soft delete
 * (see backend controllers/builderController.remove — the row keeps its data,
 * just gets deletedAt set and disappears from every list). Completely separate
 * from, and doesn't affect, the lightweight Builder Name autocomplete on the
 * Project form (components/BuilderSelect.jsx) — both read/write the same
 * underlying table, but through their own endpoints.
 */
export default function Builders() {
  const [builders, setBuilders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const v = useFormValidation(form, {
    name: textName('Builder name'),
    phone,
    email,
  });

  const load = () => {
    setLoading(true);
    api.get('/builders/full')
      .then(({ data }) => setBuilders(data.data || []))
      .catch(() => setBuilders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(empty);
    setFormError('');
    v.reset();
    setShowForm(true);
  };

  const openEdit = (b) => {
    setEditingId(b.id);
    setForm({ name: b.name, phone: b.phone || '', email: b.email || '', description: b.description || '', status: b.status });
    setFormError('');
    v.reset();
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(empty); setFormError(''); v.reset(); };

  const setField = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    v.touch(key);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!v.validate()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/builders/${editingId}`, form);
      } else {
        await api.post('/builders/full', form);
      }
      closeForm();
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save builder.');
    } finally {
      setSaving(false);
    }
  };

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDelete = (b) => {
    setDeleteError('');
    setPendingDelete(b);
  };

  const runDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/builders/${pendingDelete.id}`);
      setBuilders((prev) => prev.filter((x) => x.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Could not delete builder.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = builders.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.phone || '').includes(search) ||
    (b.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="toolbar">
        <div className="filters"><div className="filter-input"><input placeholder="Search builders..." value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        <button className="btn btn-primary" onClick={showForm ? closeForm : openCreate}>{showForm ? 'Cancel' : '+ Add Builder'}</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>{editingId ? 'Edit Builder' : 'New Builder'}</div>
          {formError && <div className="auth-error">{formError}</div>}
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <FormField label="Builder Name" required error={v.show('name')}>
                <input value={form.name} onChange={(e) => setField('name', e.target.value)} onBlur={() => v.touch('name')} />
              </FormField>
              <FormField label="Phone" error={v.show('phone')}>
                <input type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} onBlur={() => v.touch('phone')} placeholder="+91 98200 12345" />
              </FormField>
              <FormField label="Email" error={v.show('email')}>
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} onBlur={() => v.touch('email')} />
              </FormField>
              <FormField label="Status">
                <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </FormField>
              <FormField label="Description" style={{ gridColumn: 'span 2' }}>
                <input value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Notes about this builder..." />
              </FormField>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Builder')}</button>{' '}
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-head"><div className="card-title">Builders<span>Every builder your projects are linked to.</span></div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Builder Name</th><th>Phone</th><th>Email</th><th>Description</th><th>Projects</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td className="cell-main"><Link to={`/broker/builders/${b.id}`}>{b.name}</Link></td>
                  <td className="cell-sub">{b.phone || '—'}</td>
                  <td className="cell-sub">{b.email || '—'}</td>
                  <td className="cell-sub" style={{ maxWidth: 220, whiteSpace: 'normal' }}>{b.description || '—'}</td>
                  <td>
                    {b.projects?.length ? (
                      <div className="chip-row">
                        {b.projects.map((p) => <span key={p.id} className="chip">{p.name}</span>)}
                      </div>
                    ) : <span className="cell-sub">—</span>}
                  </td>
                  <td><Badge status={b.status} /></td>
                  <td>
                    <span className="link-btn" onClick={() => openEdit(b)}>Edit</span>
                    {' · '}
                    <span className="link-btn" style={{ color: 'var(--red)' }} onClick={() => handleDelete(b)}>Delete</span>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-600)' }}>Loading builders...</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No builders yet — add your first one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete builder"
          message={`Delete builder "${pendingDelete.name}"? It won't show up in this list anymore.`}
          busy={deleting}
          error={deleteError}
          onConfirm={runDelete}
          onCancel={() => { if (!deleting) { setPendingDelete(null); setDeleteError(''); } }}
        />
      )}
    </>
  );
}
