import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Badge from '../../components/Badge';
import api, { SERVER_ORIGIN } from '../../api/axios';

export default function UnitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingPricing, setEditingPricing] = useState(false);
  const [pricingForm, setPricingForm] = useState({ basicPrice: '', totalPrice: '', advanceAmount: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/units/${id}`);
      setUnit(data.data);
      setPricingForm({
        basicPrice: data.data.basicPrice, totalPrice: data.data.totalPrice, advanceAmount: data.data.advanceAmount,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const handleSavePricing = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/units/${id}/pricing`, pricingForm);
      setEditingPricing(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const markInstallment = async (installmentId, status) => {
    await api.patch(`/installments/${installmentId}`, { status });
    load();
  };

  const fmt = (v) => (v || v === 0 ? `₹${Number(v).toLocaleString('en-IN')}` : '—');

  if (loading) return <div className="card">Loading unit...</div>;
  if (!unit) return <div className="card">Unit not found.</div>;

  const remainingBalance = Number(unit.totalPrice) - Number(unit.advanceAmount || 0);

  return (
    <>
      <button className="link-btn" style={{ marginBottom: 14 }} onClick={() => navigate(-1)}>← Back to project</button>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="card-title">Unit {unit.unitNo}<span>{unit.unitType} · {unit.project?.name}</span></div>
          <Badge status={unit.status} />
        </div>

        {unit.images?.length > 0 && (
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {unit.images.map((img) => (
              <a key={img.id} href={`${SERVER_ORIGIN}${img.url}`} target="_blank" rel="noreferrer">
                <img src={`${SERVER_ORIGIN}${img.url}`} alt={unit.unitNo} style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 9, border: '1px solid var(--border)' }} />
              </a>
            ))}
          </div>
        )}

        <div className="card-title" style={{ marginBottom: 16 }}>Basic Details</div>
        <div className="form-grid">
          <div className="form-field"><label>Unit Number</label><input value={unit.unitNo} disabled /></div>
          <div className="form-field"><label>Unit Type</label><input value={unit.unitType} disabled /></div>
          <div className="form-field"><label>Size</label><input value={unit.sizeSqft ? `${unit.sizeSqft} sq.ft.` : '—'} disabled /></div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}><label>Unit Features</label><input value={unit.features?.length ? unit.features.join(', ') : '—'} disabled /></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="card-title">Pricing<span>Only pricing fields can be edited here — changing Total Price recalculates the installment schedule automatically.</span></div>
          {!editingPricing && <button className="link-btn" onClick={() => setEditingPricing(true)}>Edit</button>}
        </div>

        {editingPricing ? (
          <form onSubmit={handleSavePricing}>
            <div className="form-grid">
              <div className="form-field"><label>Basic Price (₹)</label><input type="number" value={pricingForm.basicPrice} onChange={(e) => setPricingForm({ ...pricingForm, basicPrice: e.target.value })} /></div>
              <div className="form-field"><label>Total Price (₹)</label><input type="number" value={pricingForm.totalPrice} onChange={(e) => setPricingForm({ ...pricingForm, totalPrice: e.target.value })} /></div>
              <div className="form-field"><label>Advance Paid (₹)</label><input type="number" value={pricingForm.advanceAmount} onChange={(e) => setPricingForm({ ...pricingForm, advanceAmount: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Pricing'}</button>{' '}
              <button type="button" className="btn btn-ghost" onClick={() => setEditingPricing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="form-grid">
            <div className="form-field"><label>Basic Price</label><input value={fmt(unit.basicPrice)} disabled /></div>
            <div className="form-field"><label>Total Price</label><input value={fmt(unit.totalPrice)} disabled /></div>
            <div className="form-field"><label>Advance Paid</label><input value={fmt(unit.advanceAmount)} disabled /></div>
            <div className="form-field"><label>Remaining Balance</label><input value={fmt(remainingBalance)} disabled /></div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Payment Information<span>Plan: {unit.paymentPlanRef?.name || 'Full Payment'}</span></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Installment No.</th><th>Name</th><th>Milestone / Due Condition</th><th>Due Date</th><th>Percentage</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {unit.installments?.map((inst) => (
                <tr key={inst.id}>
                  <td className="cell-main">{inst.installmentNumber}</td>
                  <td className="cell-main">{inst.name || '—'}</td>
                  <td className="cell-sub">{inst.milestone || '—'}</td>
                  <td className="cell-sub">{inst.dueDate}</td>
                  <td>{inst.percentage}%</td>
                  <td>{fmt(inst.amount)}</td>
                  <td>
                    <select className="filter-select" style={{ padding: '5px 8px', fontSize: 12 }} value={inst.status} onChange={(e) => markInstallment(inst.id, e.target.value)}>
                      <option>Pending</option><option>Paid</option><option>Overdue</option>
                    </select>
                  </td>
                </tr>
              ))}
              {(!unit.installments || unit.installments.length === 0) && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No installment schedule available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
