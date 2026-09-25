import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import KpiCard from '../../components/KpiCard';
import Badge from '../../components/Badge';
import PaymentActionRequired from '../../components/PaymentActionRequired';
import { Icons, initials } from '../../components/icons';
import { fetchOverview } from '../../store/reportsSlice';
import { leadsResource } from '../../store/resources';

export default function AgentDashboard() {
  const dispatch = useDispatch();
  const { overview } = useSelector((s) => s.reports);
  const { items: leads } = useSelector((s) => s.leads);
  const [paymentActionCount, setPaymentActionCount] = useState(0);

  useEffect(() => {
    dispatch(fetchOverview());
    dispatch(leadsResource.fetchAll({ limit: 50 }));
  }, [dispatch]);

  const dueToday = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return leads.filter((l) => l.nextFollowUp && new Date(l.nextFollowUp) >= start && new Date(l.nextFollowUp) <= end);
  }, [leads]);

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="My Leads" value={overview.totalLeads ?? '—'} trend="3 new" up icon={Icons.myleads} color="#2f6fed" bg="var(--blue-100)" />
        <KpiCard label="Due Today" value={dueToday.length} icon={Icons.tracking} color="#7c5cf0" bg="var(--purple-bg)" />
        <KpiCard label="Payment Action Required" value={paymentActionCount} icon={Icons.bookings} color="#e2643a" bg="#fdecea" />
        <KpiCard label="Closed" value={overview.closedLeads ?? '—'} trend="1 this wk" up icon={Icons.reports} color="#1fb579" bg="var(--green-bg)" />
        <KpiCard label="Conversion Rate" value={`${overview.conversionRate ?? 0}%`} icon={Icons.meetings} color="#e8a13b" bg="var(--amber-bg)" />
      </div>

      <PaymentActionRequired basePath="/agent" onCount={setPaymentActionCount} />

      <div className="grid-2">
        <div className="card min-w0">
          <div className="card-head"><div className="card-title">My Leads<span>Assigned to you and your own references</span></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lead</th><th>Project</th><th>Stage</th><th>Priority</th></tr></thead>
              <tbody>
                {leads.slice(0, 5).map((l) => (
                  <tr key={l.id}>
                    <td className="row-flex"><div className="avatar-sm" style={{ background: 'var(--blue-600)' }}>{initials(l.customerName)}</div><span className="cell-main">{l.customerName}</span></td>
                    <td>{l.project?.name || '—'}</td>
                    <td>{l.stage}</td>
                    <td><Badge status={l.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card min-w0">
          <div className="card-head"><div className="card-title">Due Today<span>Leads with a follow-up date of today</span></div></div>
          <div className="timeline">
            {dueToday.slice(0, 6).map((l) => (
              <div className="tl-item" key={l.id}>
                <div className="tl-dot" />
                <div className="tl-text" style={{ overflowWrap: 'break-word' }}>{l.customerName}{l.project?.name ? ` — ${l.project.name}` : ''}</div>
                <div className="tl-meta">{new Date(l.nextFollowUp).toLocaleString()}</div>
              </div>
            ))}
            {dueToday.length === 0 && <div style={{ color: 'var(--text-600)' }}>Nothing due today.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
