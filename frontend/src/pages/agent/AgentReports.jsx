import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import KpiCard from '../../components/KpiCard';
import { Icons } from '../../components/icons';
import { fetchOverview, fetchLeadsByStage } from '../../store/reportsSlice';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function AgentReports() {
  const dispatch = useDispatch();
  const { overview, leadsByStage } = useSelector((s) => s.reports);

  useEffect(() => {
    dispatch(fetchOverview());
    dispatch(fetchLeadsByStage());
  }, [dispatch]);

  const stageChart = {
    labels: leadsByStage.map((r) => r.stage),
    datasets: [{ data: leadsByStage.map((r) => Number(r.count)), backgroundColor: ['#7c5cf0', '#3f7dff', '#e8a13b', '#f0b93a', '#1fb579', '#e5484d', '#f472b6', '#38bdf8', '#a3e635', '#fb923c', '#22d3ee', '#f87171', '#c084fc', '#4ade80'] }],
  };

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="My Leads" value={overview.totalLeads ?? '—'} icon={Icons.myleads} color="#2f6fed" bg="var(--blue-100)" />
        <KpiCard label="Closed" value={overview.closedLeads ?? '—'} icon={Icons.reports} color="#1fb579" bg="var(--green-bg)" />
        <KpiCard label="Conversion Rate" value={`${overview.conversionRate ?? 0}%`} icon={Icons.properties} color="#7c5cf0" bg="var(--purple-bg)" />
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">My Leads by Stage<span>Your current pipeline breakdown</span></div></div>
        <Doughnut data={stageChart} options={{ cutout: '68%', plugins: { legend: { position: 'bottom' } } }} />
      </div>
    </>
  );
}
