import React from 'react';
import { badgeColor } from './icons';

export default function Badge({ status }) {
  return (
    <span className={`badge ${badgeColor(status)}`}>
      <span className="badge-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {status}
    </span>
  );
}
