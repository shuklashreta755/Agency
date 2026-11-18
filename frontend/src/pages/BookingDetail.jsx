import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Badge from '../components/Badge';
import KpiCard from '../components/KpiCard';
import SearchableSelect from '../components/SearchableSelect';
import { Icons } from '../components/icons';
import api from '../api/axios';
import FormField from '../components/FormField';
import useFormValidation from '../hooks/useFormValidation';
import { required, exactAmount, positiveNumber } from '../utils/validation';

const emptyPaymentForm = { paymentDate: '', paymentMethod: '', amount: '', transactionRef: '', remarks: '' };
const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

// Broker: can view ANY booking in the tenant, but the "Enter Payment Details"
// form only appears if `canManagePayments` (from the API) is true — i.e. this
// broker personally created this booking. Agent: can only reach this page for
// a booking assigned to them, and can always manage payments on it.
// All of this is re-enforced server-side too (see bookingController.js) — the
// frontend hiding the form is a UX convenience, not the actual security boundary.
export default function BookingDetail({ isAgent }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [payForm, setPayForm] = useState(emptyPaymentForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const allInstForVal = booking?.installments || [];
  const latestCycleForVal = allInstForVal.length ? Math.max(...allInstForVal.map((i) => i.cycleNumber || 1)) : 1;
  const pendingInstallment = allInstForVal
    .filter((i) => (i.cycleNumber || 1) === latestCycleForVal)
    .find((i) => i.status === 'Pending');
  const v = useFormValidation(payForm, {
    paymentDate: required('Payment date'),
    paymentMethod: required('Payment method'),
    amount: pendingInstallment ? exactAmount(pendingInstallment.amount) : positiveNumber('Amount'),
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/bookings/${id}`);
      setBooking(data.data);
      setCanManage(data.canManagePayments);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/bookings/enums').then(({ data }) => setPaymentMethods(data.paymentMethods)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="cell-sub">Loading...</div>;
  if (!booking) return <div className="cell-sub">Booking not found.</div>;

  const allInstallments = booking.installments || [];
  // A booking can hold more than one payment cycle's worth of rows once its
  // plan has been through "Activate Next Installment" (Payment Plan Cycle
  // Reset) — always show only the CURRENT (latest) cycle here. For the vast
  // majority of bookings there's only ever been cycle 1, so this is a no-op.
  const latestCycle = allInstallments.length ? Math.max(...allInstallments.map((i) => i.cycleNumber || 1)) : 1;
  const installments = allInstallments.filter((i) => (i.cycleNumber || 1) === latestCycle);
  // Every payment/installment figure is based on Selling Price (the
  // actual/current market price this unit was booked for), never Unit Price
  // — falls back to `amount` only for bookings made before Selling Price
  // existed and therefore have no value stored for it (same fallback the
  // backend uses when generating the installment schedule itself).
  const totalAmount = booking.sellingPrice != null ? Number(booking.sellingPrice) : Number(booking.amount);
  const firstInstallment = installments.find((i) => Number(i.sequenceNumber) === 1);
  const firstGross = firstInstallment
    ? Number(((totalAmount * Number(firstInstallment.percentage)) / 100).toFixed(2))
    : 0;
  // Difference between the plan's first installment and the stored amount is the advance already taken off.
  const advanceApplied = firstInstallment ? Math.max(0, Number((firstGross - Number(firstInstallment.amount)).toFixed(2))) : 0;
  const paidInstallments = installments.filter((i) => i.status === 'Paid').reduce((sum, i) => sum + Number(i.amount), 0);
  const paidAmount = paidInstallments + advanceApplied;
  const pendingAmount = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));
  const progress = totalAmount ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
  const currentPayable = installments.find((i) => i.status === 'Pending');

  const setPayField = (key, val) => {
    setPayForm((f) => ({ ...f, [key]: val }));
    v.touch(key);
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!v.validate()) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/bookings/${id}/installments/${currentPayable.id}/pay`, payForm);
      setBooking(data.data);
      setPayForm(emptyPaymentForm);
      v.reset();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="link-btn" style={{ marginBottom: 14 }} onClick={() => navigate(`${isAgent ? '/agent' : '/broker'}/bookings`)}>← Back to Bookings</button>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Booking Information</div>
        <div className="form-grid">
          <div className="form-field"><label>Project</label><div className="cell-main">{booking.project?.name}</div></div>
          <div className="form-field"><label>Unit</label><div className="cell-main">{booking.unit?.unitNo} <span className="cell-sub">({booking.unit?.unitType})</span></div></div>
          <div className="form-field"><label>Lead / Client</label>
            <div className="cell-main">{booking.lead?.customerName}</div>
            <div className="row-flex" style={{ gap: 8, marginTop: 2 }}>
              <span className="cell-sub">{booking.lead?.phone}</span>
              <Badge status={booking.leadType} />
            </div>
          </div>
          <div className="form-field"><label>Agent</label><div className="cell-main">{booking.agent?.name || 'Unassigned'}</div></div>
          <div className="form-field"><label>Booking Date</label><div className="cell-main">{booking.bookingDate}</div></div>
          <div className="form-field"><label>Payment Plan</label><div className="cell-main">{booking.paymentPlanRef?.name || 'Full Payment'}</div></div>
          <div className="form-field"><label>Unit Price</label><div className="cell-main">{fmt(booking.amount)}</div></div>
          <div className="form-field"><label>Selling Price</label><div className="cell-main">{fmt(totalAmount)}</div></div>
          <div className="form-field"><label>Booking Status</label><Badge status={booking.status} /></div>
        </div>
      </div>

      <div className="card-title" style={{ marginBottom: 14 }}>
        Payment Plan Details {latestCycle > 1 && <span className="badge blue" style={{ marginLeft: 8 }}>Cycle {latestCycle}</span>}
        {advanceApplied > 0 && <span>Advance of {fmt(advanceApplied)} is deducted from the first installment.</span>}
      </div>
      <div className="kpi-row">
        <KpiCard label="Total Amount" value={fmt(totalAmount)} icon={Icons.bookings} color="var(--blue-600)" bg="var(--blue-100)" />
        <KpiCard label="Paid Amount" value={fmt(paidAmount)} icon={Icons.reports} color="var(--green)" bg="var(--green-bg)" />
        <KpiCard label="Pending Amount" value={fmt(pendingAmount)} icon={Icons.followups} color="var(--amber)" bg="var(--amber-bg)" />
        <KpiCard label="Payment Progress" value={`${progress}%`} icon={Icons.pendingLeads} color="var(--blue-600)" bg="var(--blue-100)" />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Installment</th><th>Milestone / Trigger</th><th>Amount</th><th>Status</th><th>Paid On</th></tr>
            </thead>
            <tbody>
              {installments.map((inst) => (
                <React.Fragment key={inst.id}>
                  <tr>
                    <td className="cell-main">{inst.sequenceNumber}. {inst.name} <span className="cell-sub">({inst.percentage}%)</span></td>
                    <td className="cell-sub">{inst.milestone}</td>
                    <td className="cell-main">{fmt(inst.amount)}</td>
                    <td>
                      {inst.status === 'Locked'
                        ? <span className="cell-sub">🔒 Locked</span>
                        : <Badge status={inst.status} />}
                    </td>
                    <td className="cell-sub">
                      {inst.status === 'Paid' ? inst.paymentDate : (inst.status === 'Locked' ? 'Pay previous installment first' : '—')}
                    </td>
                  </tr>

                  {inst.status === 'Pending' && inst.id === currentPayable?.id && (
                    <tr>
                      <td colSpan={5}>
                        {canManage ? (
                          <div className="card" style={{ margin: '4px 0 10px', boxShadow: 'none', background: 'var(--bg)' }}>
                            <div className="card-title" style={{ marginBottom: 12, fontSize: 13.5 }}>Enter Payment Details</div>
                            <form onSubmit={handlePay} noValidate>
                              <div className="form-grid">
                                <FormField label="Payment Date" required error={v.show('paymentDate')}>
                                  <input type="date" value={payForm.paymentDate} onChange={(e) => setPayField('paymentDate', e.target.value)} onBlur={() => v.touch('paymentDate')} />
                                </FormField>
                                <FormField label="Payment Method" required error={v.show('paymentMethod')}>
                                  <SearchableSelect
                                    variant="form" placeholder="Select payment method" value={payForm.paymentMethod}
                                    invalid={!!v.show('paymentMethod')}
                                    onBlur={() => v.touch('paymentMethod')}
                                    onChange={(val) => setPayField('paymentMethod', val)}
                                    options={paymentMethods.map((m) => ({ value: m, label: m }))}
                                  />
                                </FormField>
                                <FormField
                                  label="Amount (₹)"
                                  required
                                  error={v.show('amount')}
                                  hint={!v.show('amount') ? `This installment requires exactly ${fmt(currentPayable.amount)}.` : undefined}
                                >
                                  <input
                                    type="number" step="0.01"
                                    value={payForm.amount}
                                    onChange={(e) => setPayField('amount', e.target.value)}
                                    onBlur={() => v.touch('amount')}
                                    placeholder={`Must be exactly ${fmt(currentPayable.amount)}`}
                                  />
                                </FormField>
                                <FormField label="Transaction / Reference No. (optional)">
                                  <input value={payForm.transactionRef} onChange={(e) => setPayField('transactionRef', e.target.value)} placeholder="Enter transaction no." />
                                </FormField>
                                <FormField label="Remarks (optional)">
                                  <input value={payForm.remarks} onChange={(e) => setPayField('remarks', e.target.value)} placeholder="Enter remarks" />
                                </FormField>
                              </div>
                              {formError && <div className="cell-sub" style={{ color: 'var(--red)', marginTop: 10 }}>{formError}</div>}
                              <div style={{ marginTop: 14 }}>
                                <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Payment'}</button>
                              </div>
                            </form>
                          </div>
                        ) : (
                          <div className="cell-sub" style={{ padding: '10px 0' }}>Only the agent or broker who created this booking can record its payments.</div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, background: 'var(--blue-100)', boxShadow: 'none' }}>
        <span className="cell-sub">ℹ️ You can proceed to the next installment only after completing the current installment.</span>
      </div>
    </>
  );
}
