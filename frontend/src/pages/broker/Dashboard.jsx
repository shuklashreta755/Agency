import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import KpiCard from '../../components/KpiCard';
import Badge from '../../components/Badge';
import PaymentActionRequired from '../../components/PaymentActionRequired';
import { Icons, initials } from '../../components/icons';
import { fetchOverview, fetchMonthlyTrend } from '../../store/reportsSlice';
import { historyResource, leadsResource } from '../../store/resources';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export default function BrokerDashboard() {
  const dispatch = useDispatch();
  const { overview, monthlyTrend } = useSelector((s) => s.reports);
  const { items: history } = useSelector((s) => s.history);
  const { items: leads } = useSelector((s) => s.leads);
  const [paymentActionCount, setPaymentActionCount] = useState(0);

  useEffect(() => {
    dispatch(fetchOverview());
    dispatch(fetchMonthlyTrend());
    dispatch(historyResource.fetchAll({ limit: 5 }));
    dispatch(leadsResource.fetchAll({ limit: 5 }));
  }, [dispatch]);

  const chartData = {
    labels: monthlyTrend.map((m) => m.month),
    datasets: [
      { label: 'New Leads', data: monthlyTrend.map((m) => Number(m.newLeads)), borderColor: '#3f7dff', backgroundColor: 'rgba(63,125,255,0.12)', fill: true, tension: 0.4 },
      { label: 'Closed', data: monthlyTrend.map((m) => Number(m.closed)), borderColor: '#1fb579', backgroundColor: 'rgba(31,181,121,0.12)', fill: true, tension: 0.4 },
    ],
  };

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Leads" value={overview.totalLeads ?? '—'} trend="12.4%" up icon={Icons.leads} color="#2f6fed" bg="var(--blue-100)" />
        <KpiCard label="Active Projects" value={overview.totalProjects ?? '—'} trend="4.1%" up icon={Icons.properties} color="#7c5cf0" bg="var(--purple-bg)" />
        <KpiCard label="Payment Action Required" value={paymentActionCount} icon={Icons.bookings} color="#e2643a" bg="#fdecea" />
        <KpiCard label="Conversion Rate" value={`${overview.conversionRate ?? 0}%`} trend="2.3%" icon={Icons.reports} color="#1fb579" bg="var(--green-bg)" />
        <KpiCard label="Active Agents" value={overview.activeAgents ?? '—'} trend="1 new" up icon={Icons.agents} color="#e8a13b" bg="var(--amber-bg)" />
      </div>

      <PaymentActionRequired basePath="/broker" onCount={setPaymentActionCount} />

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Lead Conversion Trend<span>Monthly leads vs closed deals</span></div>
          </div>
          <Line data={chartData} options={{ plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }} />
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Recent Activity<span>Latest actions across your team</span></div></div>
          <div className="timeline">
            {history.map((h) => (
              <div className="tl-item" key={h.id}>
                <div className="tl-dot" />
                <div className="tl-text">{h.action}</div>
                <div className="tl-meta">{h.user?.name} · {new Date(h.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Recent Leads<span>Latest leads added across all agents</span></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Lead</th><th>Project</th><th>Agent</th><th>Stage</th><th>Priority</th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="row-flex"><div className="avatar-sm" style={{ background: 'var(--blue-600)' }}>{initials(l.customerName)}</div><span className="cell-main">{l.customerName}</span></td>
                  <td>{l.project?.name || '—'}</td>
                  <td>{l.agent?.name || '—'}</td>
                  <td>{l.stage}</td>
                  <td><Badge status={l.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
