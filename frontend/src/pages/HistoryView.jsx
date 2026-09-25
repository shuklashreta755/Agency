import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { initials } from '../components/icons';
import { historyResource } from '../store/resources';

export default function HistoryView() {
  const dispatch = useDispatch();
  const { items } = useSelector((s) => s.history);

  useEffect(() => { dispatch(historyResource.fetchAll({ limit: 30 })); }, [dispatch]);

  return (
    <div className="card">
      <div className="card-head"><div className="card-title">Activity History<span>Full audit trail of important actions</span></div></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Action</th><th>Time</th></tr></thead>
          <tbody>
            {items.map((h) => (
              <tr key={h.id}>
                <td className="row-flex"><div className="avatar-sm" style={{ background: 'var(--blue-600)' }}>{initials(h.user?.name || '')}</div><span className="cell-main">{h.user?.name}</span></td>
                <td>{h.action}</td>
                <td className="cell-sub">{new Date(h.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-600)' }}>No activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
