import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import KpiCard from '../../components/KpiCard';
import { Icons, initials } from '../../components/icons';
import api, { SERVER_ORIGIN } from '../../api/axios';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

// Same agent-status color mapping used on the Agents grid (pages/broker/Agents.jsx)
// — kept local rather than added to the shared badgeColor() map so that
// function's existing behavior elsewhere is untouched.
const STATUS_COLOR = { online: 'green', idle: 'amber', offline: 'red' };

// Same palette used for the Doughnut chart on the Agent's own "My Leads by
// Stage" report (pages/agent/AgentReports.jsx) — reused here for consistency.
const STAGE_COLORS = ['#7c5cf0', '#3f7dff', '#e8a13b', '#f0b93a', '#1fb579', '#e5484d', '#f472b6', '#38bdf8', '#a3e635', '#fb923c', '#22d3ee', '#f87171', '#c084fc', '#4ade80'];

const fmtDate = (d, opts) => (d ? new Date(d).toLocaleDateString('en-IN', opts) : '—');

/**
 * Agent Details / Dashboard page (Broker panel) — everything shown here is
 * scoped to the single agent identified by the :id route param, backed by
 * the one combined GET /api/agents/:id/dashboard call (see
 * backend/src/controllers/agentController.js `dashboard`).
 */
export default function AgentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(`/agents/${id}/dashboard`)
      .then((res) => { if (active) setData(res.data.data); })
      .catch((ex) => { if (active) setError(ex.response?.data?.message || 'Could not load this agent.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="card">Loading agent...</div>;
  if (error) return <div className="card">{error}</div>;
  if (!data) return null;

  const { agent, kpis, leadStatusDistribution, performanceOverview, recentBookings } = data;

  const trendData = {
    labels: performanceOverview.labels.map((d) => fmtDate(d, { day: 'numeric', month: 'short' })),
    datasets: [
      { label: 'Bookings', data: performanceOverview.bookings, borderColor: '#3f7dff', backgroundColor: 'rgba(63,125,255,0.12)', fill: true, tension: 0.4 },
      { label: 'Sold Units', data: performanceOverview.soldUnits, borderColor: '#1fb579', backgroundColor: 'rgba(31,181,121,0.12)', fill: true, tension: 0.4 },
      { label: 'Leads', data: performanceOverview.leads, borderColor: '#e8a13b', backgroundColor: 'rgba(232,161,59,0.12)', fill: true, tension: 0.4 },
    ],
  };

  const stageData = {
    labels: leadStatusDistribution.map((r) => r.stage),
    datasets: [{ data: leadStatusDistribution.map((r) => r.count), backgroundColor: STAGE_COLORS }],
  };

  return (
    <>
      <button className="link-btn" style={{ marginBottom: 14 }} onClick={() => navigate(-1)}>← Back to Agents</button>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row-flex" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="row-flex" style={{ gap: 16 }}>
            <div
              className="agent-avatar"
              style={{
                width: 64, height: 64, fontSize: 22, margin: 0, flexShrink: 0,
                ...(agent.avatarUrl
                  ? { backgroundImage: `url(${SERVER_ORIGIN}${agent.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: 'var(--blue-600)' }),
              }}
            >
              {!agent.avatarUrl && initials(agent.name)}
            </div>
            <div>
              <div className="card-title" style={{ marginBottom: 6 }}>{agent.name}</div>
              <span className={`badge ${STATUS_COLOR[agent.status] || 'blue'}`}>{agent.status}</span>
              <div className="cell-sub" style={{ marginTop: 8 }}>{agent.phone}</div>
              {agent.email && <div className="cell-sub">{agent.email}</div>}
              {agent.address && <div className="cell-sub">{agent.address}</div>}
            </div>
          </div>
          <div className="row-flex" style={{ gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div className="cell-sub">Assigned Projects</div>
              <div className="cell-main">{kpis.totalProjects}</div>
            </div>
            <div>
              <div className="cell-sub">Total Leads</div>
              <div className="cell-main">{kpis.totalLeads}</div>
            </div>
            <div>
              <div className="cell-sub">Join Date</div>
              <div className="cell-main">{fmtDate(agent.joiningDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <KpiCard label="Total Bookings" value={kpis.totalBookings} icon={Icons.bookings} color="#2f6fed" bg="var(--blue-100)" />
        <KpiCard label="Total Projects" value={kpis.totalProjects} icon={Icons.properties} color="#1fb579" bg="var(--green-bg)" />
        <KpiCard label="Sold Units" value={kpis.soldUnits} icon={Icons.soldUnits} color="#c026d3" bg="#fbe7fb" />
        <KpiCard label="Total Leads" value={kpis.totalLeads} icon={Icons.leads} color="#e8a13b" bg="var(--amber-bg)" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Performance Overview<span>Bookings, sold units and leads — last 30 days</span></div>
          </div>
          <Line
            data={trendData}
            options={{
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { autoSkip: true, maxTicksLimit: 10 } } },
            }}
          />
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Lead Status Distribution<span>{kpis.totalLeads} total leads</span></div></div>
          {leadStatusDistribution.length
            ? <Doughnut data={stageData} options={{ cutout: '68%', plugins: { legend: { position: 'bottom' } } }} />
            : <div className="cell-sub">No leads assigned yet.</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Recent Bookings<span>Latest bookings by this agent</span></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Client Name</th><th>Project</th><th>Unit</th><th>Status</th></tr></thead>
            <tbody>
              {recentBookings.map((b) => (
                <tr key={b.id}>
                  <td>{fmtDate(b.bookingDate, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="cell-main">{b.clientName}</td>
                  <td>{b.projectName}</td>
                  <td>{b.unitNo}{b.unitType ? ` (${b.unitType})` : ''}</td>
                  <td><span className={`badge ${b.status === 'Confirmed' ? 'green' : 'red'}`}>{b.status}</span></td>
                </tr>
              ))}
              {recentBookings.length === 0 && (
                <tr><td colSpan={5} className="cell-sub" style={{ textAlign: 'center' }}>No bookings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
