import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Badge from '../components/Badge';
import SearchableSelect from '../components/SearchableSelect';
import { agentsResource } from '../store/resources';
import api from '../api/axios';

const emptyForm = { projectId: '', unitId: '', agentId: '', leadType: 'Client', leadId: '', bookingDate: '', paymentPlanId: '', sellingPrice: '' };

// Broker: full Booking List + Add Booking (with an explicit Agent field).
// Agent: same, minus the Agent field — the logged-in agent is auto-assigned, and
// they can only book within a project they can actually work with: one formally
// assigned to them OR one they already have a lead in (enforced server-side too,
// via GET /bookings/projects — see bookingController.bookableProjects). Project
// → Unit → Payment Plan and Lead Type → Lead/Client are all dynamically loaded
// and reset/reloaded whenever their parent selection changes — nothing here is
// ever hardcoded.
export default function BookingsView({ isAgent }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items: agents } = useSelector((s) => s.agents);

  const [projects, setProjects] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [units, setUnits] = useState([]);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [leadOptions, setLeadOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // Broker Panel only — "Broker Bookings" (created by the broker) vs
  // "Agent's Bookings" (created by any agent). Agent Panel has no tabs; it
  // always sees just its own bookings, unaffected by this.
  const [bookingsTab, setBookingsTab] = useState('broker');

  const loadBookings = async () => {
    setLoading(true);
    try {
      const params = !isAgent ? { createdByRole: bookingsTab } : {};
      const { data } = await api.get('/bookings', { params });
      setBookings(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/bookings/projects').then(({ data }) => setProjects(data.data)).catch(() => {});
    if (!isAgent) dispatch(agentsResource.fetchAll());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingsTab]);

  // Project changed -> reset Unit + Payment Plan and reload both, scoped to the
  // newly-selected project only.
  useEffect(() => {
    setForm((f) => ({ ...f, unitId: '', paymentPlanId: '', sellingPrice: '' }));
    setUnits([]);
    setPaymentPlans([]);
    if (!form.projectId) return;
    api.get(`/projects/${form.projectId}/units`, { params: { status: 'Available' } }).then(({ data }) => setUnits(data.data)).catch(() => {});
    api.get(`/projects/${form.projectId}/payment-plans`).then(({ data }) => setPaymentPlans(data.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.projectId]);

  // Lead Type changed -> reset the Lead/Client field and reload its options for
  // the newly-selected bucket (Client / Lead), scoped correctly for the role.
  useEffect(() => {
    setForm((f) => ({ ...f, leadId: '' }));
    setLeadOptions([]);
    api.get(`/bookings/leads?leadType=${form.leadType}`).then(({ data }) => setLeadOptions(data.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.leadType]);

  // Unit changed -> Unit Price auto-updates from that unit's total price
  // (read-only, never a separately editable field). Selling Price defaults to
  // the same figure but the agent/broker can then override it — e.g. a
  // negotiated discount or premium versus the listed unit price.
  useEffect(() => {
    if (!form.unitId) return;
    const u = units.find((x) => x.id === form.unitId);
    if (u) setForm((f) => ({ ...f, sellingPrice: u.totalPrice }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.unitId]);

  const selectedUnit = units.find((u) => u.id === form.unitId);

  const resetForm = () => {
    setForm(emptyForm);
    setUnits([]);
    setPaymentPlans([]);
    setLeadOptions([]);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.projectId || !form.unitId || !form.leadId || !form.bookingDate) {
      setFormError('Please fill in all required fields.');
      return;
    }
    if (form.sellingPrice === '' || Number(form.sellingPrice) <= 0) {
      setFormError('Selling Price must be a positive number.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (isAgent) delete payload.agentId; // agent is auto-assigned server-side
      else if (!payload.agentId) delete payload.agentId; // optional for broker — leave unassigned
      if (!payload.paymentPlanId) delete payload.paymentPlanId;
      await api.post('/bookings', payload);
      resetForm();
      setShowForm(false);
      await loadBookings();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save booking.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete this booking for "${b.lead?.customerName || 'this lead'}"?`)) return;
    await api.delete(`/bookings/${b.id}`);
    await loadBookings();
  };

  const fmt = (v) => (v || v === 0 ? `₹${Number(v).toLocaleString('en-IN')}` : '—');
  const colSpan = isAgent ? 7 : 9;

  return (
    <>
      {!isAgent && (
        <div className="settings-tabs">
          <div className={bookingsTab === 'broker' ? 'active' : ''} onClick={() => { setBookingsTab('broker'); setShowForm(false); }}>Broker Bookings</div>
          <div className={bookingsTab === 'agent' ? 'active' : ''} onClick={() => { setBookingsTab('agent'); setShowForm(false); }}>Agent's Bookings</div>
        </div>
      )}

      <div className="toolbar">
        <div className="filters" />
        {!(!isAgent && bookingsTab === 'agent') && (
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}>+ Add Booking</button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>New Booking</div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field"><label>Project</label>
                <SearchableSelect
                  variant="form" placeholder="Select project" value={form.projectId}
                  onChange={(val) => setForm({ ...form, projectId: val })}
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
              <div className="form-field"><label>Unit</label>
                <SearchableSelect
                  variant="form" placeholder={form.projectId ? 'Select unit' : 'Select a project first'} value={form.unitId}
                  onChange={(val) => setForm({ ...form, unitId: val })}
                  options={units.map((u) => ({ value: u.id, label: `${u.unitNo} — ${u.unitType}` }))}
                />
              </div>

              {!isAgent && (
                <div className="form-field"><label>Agent (optional)</label>
                  <SearchableSelect
                    variant="form" placeholder="Unassigned" value={form.agentId}
                    onChange={(val) => setForm({ ...form, agentId: val })}
                    options={agents.map((a) => ({ value: a.id, label: a.name }))}
                  />
                </div>
              )}

              <div className="form-field"><label>Booking Date</label>
                <input required type="date" value={form.bookingDate} onChange={(e) => setForm({ ...form, bookingDate: e.target.value })} />
              </div>

              <div className="form-field"><label>Lead Type</label>
                <div className="chip-row" style={{ marginTop: 2 }}>
                  <span className={`chip${form.leadType === 'Client' ? ' active' : ''}`} onClick={() => setForm({ ...form, leadType: 'Client' })}>
                    Client (Purchased)
                  </span>
                  <span className={`chip${form.leadType === 'Lead' ? ' active' : ''}`} onClick={() => setForm({ ...form, leadType: 'Lead' })}>
                    {isAgent ? 'Lead (Assigned to Me)' : 'Lead (Unassigned)'}
                  </span>
                </div>
              </div>
              <div className="form-field"><label>{form.leadType === 'Client' ? 'Client' : 'Lead'}</label>
                <SearchableSelect
                  variant="form" placeholder={form.leadType === 'Client' ? 'Select client' : 'Select lead'} value={form.leadId}
                  onChange={(val) => setForm({ ...form, leadId: val })}
                  options={leadOptions.map((l) => ({ value: l.id, label: `${l.customerName} — ${l.phone}` }))}
                />
              </div>

              <div className="form-field"><label>Unit Price (₹)</label>
                <input disabled placeholder="Select a unit" value={selectedUnit ? `₹${Number(selectedUnit.totalPrice).toLocaleString('en-IN')}` : ''} />
              </div>
              <div className="form-field"><label>Selling Price (₹)</label>
                <input
                  required type="number" min="1" step="0.01"
                  disabled={!selectedUnit}
                  placeholder={selectedUnit ? 'Enter selling price' : 'Select a unit first'}
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                />
                <span className="cell-sub">Defaults to the unit price — override for a negotiated price. Every payment/installment is calculated from this.</span>
              </div>
              <div className="form-field"><label>Payment Plan</label>
                <SearchableSelect
                  variant="form" placeholder="Full Payment (no installments)" value={form.paymentPlanId}
                  onChange={(val) => setForm({ ...form, paymentPlanId: val })}
                  options={paymentPlans.map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
            </div>

            {formError && <div className="cell-sub" style={{ color: 'var(--red)', marginTop: 12 }}>{formError}</div>}

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Booking'}</button>{' '}
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th><th>Unit</th><th>Lead / Client</th><th>Type</th>
                {!isAgent && <th>Agent</th>}
                <th>Booking Date</th><th>Selling Price</th><th>Payment Plan</th>
                {!isAgent && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} onClick={() => navigate(`${isAgent ? '/agent' : '/broker'}/bookings/${b.id}`)} style={{ cursor: 'pointer' }}>
                  <td>{b.project?.name}</td>
                  <td className="cell-main">{b.unit?.unitNo}</td>
                  <td>
                    <div className="cell-main">{b.lead?.customerName}</div>
                    <div className="cell-sub">{b.lead?.phone}</div>
                  </td>
                  <td><Badge status={b.leadType} /></td>
                  {!isAgent && <td>{b.agent?.name || 'Unassigned'}</td>}
                  <td className="cell-sub">{b.bookingDate}</td>
                  <td>{fmt(b.sellingPrice ?? b.amount)}</td>
                  <td>{b.paymentPlanRef?.name || 'Full Payment'}</td>
                  {!isAgent && (
                    <td><span className="link-btn" style={{ color: 'var(--red)' }} onClick={(e) => { e.stopPropagation(); handleDelete(b); }}>Delete</span></td>
                  )}
                </tr>
              ))}
              {!loading && bookings.length === 0 && (
                <tr><td colSpan={colSpan} style={{ textAlign: 'center', color: 'var(--text-600)' }}>
                  {!isAgent && bookingsTab === 'agent' ? 'No bookings created by agents yet.' : 'No bookings yet.'}
                </td></tr>
              )}
              {loading && <tr><td colSpan={colSpan} style={{ textAlign: 'center', color: 'var(--text-600)' }}>Loading...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
