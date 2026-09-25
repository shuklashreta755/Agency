import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import KpiCard from '../../components/KpiCard';
import { Icons, initials } from '../../components/icons';
import { fetchOverview, fetchLeadsByStage, fetchLeadsByPriority, fetchAgentPerformance } from '../../store/reportsSlice';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function Reports() {
  const dispatch = useDispatch();
  const { overview, leadsByStage, leadsByPriority, agentPerformance } = useSelector((s) => s.reports);

  useEffect(() => {
    dispatch(fetchOverview());
    dispatch(fetchLeadsByStage());
    dispatch(fetchLeadsByPriority());
    dispatch(fetchAgentPerformance());
  }, [dispatch]);

  const stageChart = {
    labels: leadsByStage.map((r) => r.stage),
    datasets: [{ data: leadsByStage.map((r) => Number(r.count)), backgroundColor: ['#7c5cf0', '#3f7dff', '#e8a13b', '#f0b93a', '#1fb579', '#e5484d', '#f472b6', '#38bdf8', '#a3e635', '#fb923c', '#22d3ee', '#f87171', '#c084fc', '#4ade80'] }],
  };
  const priorityChart = {
    labels: leadsByPriority.map((r) => r.priority),
    datasets: [{ data: leadsByPriority.map((r) => Number(r.count)), backgroundColor: ['#e5484d', '#e8a13b', '#3f7dff'] }],
  };

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Leads" value={overview.totalLeads ?? '—'} trend="9.4%" up icon={Icons.leads} color="#2f6fed" bg="var(--blue-100)" />
        <KpiCard label="Closed Leads" value={overview.closedLeads ?? '—'} trend="3.1%" up icon={Icons.reports} color="#1fb579" bg="var(--green-bg)" />
        <KpiCard label="Conversion Rate" value={`${overview.conversionRate ?? 0}%`} trend="steady" icon={Icons.properties} color="#7c5cf0" bg="var(--purple-bg)" />
        <KpiCard label="Active Agents" value={overview.activeAgents ?? '—'} icon={Icons.agents} color="#e8a13b" bg="var(--amber-bg)" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Leads by Stage<span>Current distribution across your pipeline</span></div></div>
          <Bar data={stageChart} options={{ plugins: { legend: { display: false } } }} />
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Leads by Priority<span>How urgent your open leads are</span></div></div>
          <Doughnut data={priorityChart} options={{ cutout: '68%', plugins: { legend: { position: 'bottom' } } }} />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Agent Performance<span>Leads handled vs deals closed</span></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Agent</th><th>Leads Assigned</th><th>Closed</th><th>Conversion</th></tr></thead>
            <tbody>
              {agentPerformance.map((a) => (
                <tr key={a.agentId}>
                  <td className="row-flex"><div className="avatar-sm" style={{ background: 'var(--blue-600)' }}>{initials(a.name)}</div><span className="cell-main">{a.name}</span></td>
                  <td>{a.totalLeads}</td>
                  <td>{a.closedLeads}</td>
                  <td><span className="progress-bar"><span className="progress-fill" style={{ width: `${a.conversionRate}%` }} /></span>{a.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
