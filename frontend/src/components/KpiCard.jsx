import React from 'react';

export default function KpiCard({ label, value, trend, up, icon, color, bg }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <div className="kpi-icon" style={{ background: bg, color }}>{icon}</div>
        {trend && <div className={`kpi-trend ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {trend}</div>}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
