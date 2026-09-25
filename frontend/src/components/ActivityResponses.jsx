import React from 'react';
import { activityIcon } from './icons';

const STATUS_SYMBOL = { positive: '✓', negative: '✕', neutral: '' };

function responseClass(response) {
  if (response === 'positive') return 'positive';
  if (response === 'negative') return 'negative';
  return 'neutral'; // covers 'neutral' and null/undefined
}

function fmtDate(d) {
  const dt = new Date(d);
  return { date: dt.toLocaleDateString(), time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
}

export default function ActivityResponses({ followUps }) {
  if (!followUps || followUps.length === 0) {
    return <span className="cell-sub">No Activity</span>;
  }

  return (
    <div className="activity-cell">
      {followUps.slice(0, 5).map((f) => {
        const status = responseClass(f.response);
        const { date, time } = fmtDate(f.createdAt);
        return (
          <div className="activity-icon-wrap" key={f.id}>
            {activityIcon(f.activityType)}
            <span className={`activity-status-dot ${status}`} style={{ color: '#fff' }}>
              {STATUS_SYMBOL[status]}
            </span>
            <div className="activity-tooltip">
              <b>{f.activityType}</b> · {f.response ? f.response[0].toUpperCase() + f.response.slice(1) : 'No response'}<br />
              {f.agent?.name || 'Unknown agent'}<br />
              {date} at {time}
              {f.description && <><br />{f.description}</>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
