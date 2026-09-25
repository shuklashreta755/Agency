import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from './Badge';
import api from '../api/axios';

// "Payment Action Required" — every installment the broker has activated for a
// booking that isn't paid yet: 'Pending' ones (currently payable right now)
// plus any later 'Locked' one whose milestone is already activated plan-wide
// but this booking hasn't caught up to yet (an earlier installment of its own
// is still unpaid) — shown so nothing activated is out of sight, even if this
// particular booking isn't ready to pay it yet. Broker sees the whole tenant;
// Agent sees only their own — both via the same endpoint, which already scopes
// correctly server-side based on the logged-in role.
export default function PaymentActionRequired({ basePath, onCount }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/bookings/payment-actions')
      .then(({ data }) => { setRows(data.data); if (onCount) onCount(data.count); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="card-title">Payment Action Required<span>Bookings with an active installment pending payment.</span></div>
        <Link className="btn btn-ghost" to={`${basePath}/bookings`}>View All Bookings →</Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Booking ID</th><th>Customer</th><th>Project</th><th>Current Milestone</th><th>Installment</th><th>Amount</th><th>Last Date</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.installmentId || `${r.bookingId}-${r.installmentNumber}`}>
                <td className="cell-main">{r.bookingCode}</td>
                <td>
                  <div className="cell-main">{r.customerName}</div>
                  <div className="cell-sub">{r.customerPhone}</div>
                </td>
                <td>{r.projectName}</td>
                <td className="cell-sub">{r.milestone}</td>
                <td>{r.installmentName}</td>
                <td className="cell-main">{fmt(r.amount)}</td>
                <td className="cell-sub">{r.lastDate || '—'}</td>
                <td><Badge status={r.status} /></td>
                <td><Link className="link-btn" to={`${basePath}/bookings/${r.bookingId}`}>View</Link></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No payment actions required right now.</td></tr>
            )}
            {loading && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-600)' }}>Loading...</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
