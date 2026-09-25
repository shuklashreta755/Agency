import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Badge from './Badge';
import { initials } from './icons';
import { fetchLeadsWithFollowUps } from '../store/followUpsSlice';
import { ACTIVITY_TYPES, FOLLOWUP_BUCKETS } from '../constants/leadEnums';

/**
 * @param {string} basePath - '/agent' or '/broker' — where "View Lead" navigates to
 * @param {string} [fixedActivityType] - if set (e.g. 'Site Visit'), locks the activity
 *   type filter and hides the dropdown — this is what turns this same list into the
 *   Site Visits page.
 * @param {string} title
 * @param {string} subtitle
 */
export default function FollowUpLeadsList({ basePath, fixedActivityType, title, subtitle }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { leadsList } = useSelector((s) => s.followUps);

  const [search, setSearch] = useState('');
  const [activityType, setActivityType] = useState(fixedActivityType || '');
  const [bucket, setBucket] = useState('');

  const load = () => {
    const params = {};
    if (activityType) params.activityType = activityType;
    if (bucket) params.bucket = bucket;
    if (search) params.search = search;
    dispatch(fetchLeadsWithFollowUps(params));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activityType, bucket]);
  useEffect(() => {
    const t = setTimeout(load, 350); // debounce search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const goToLead = (leadId) => navigate(`${basePath}/leads/${leadId}?tab=followups`);

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <div className="filter-input"><input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {!fixedActivityType && (
            <select className="filter-select" value={activityType} onChange={(e) => setActivityType(e.target.value)}>
              <option value="">All Activity Types</option>
              {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <select className="filter-select" value={bucket} onChange={(e) => setBucket(e.target.value)}>
            {FOLLOWUP_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {title && <div className="card-head"><div className="card-title">{title}{subtitle && <span>{subtitle}</span>}</div></div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lead</th><th>Phone</th><th>Project</th><th>Last Activity</th>
                <th>Last Activity Date</th><th>Next Follow-up</th><th>Priority</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {leadsList.map((l) => (
                <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => goToLead(l.id)}>
                  <td className="row-flex"><div className="avatar-sm" style={{ background: 'var(--blue-600)' }}>{initials(l.customerName)}</div><span className="cell-main">{l.customerName}</span></td>
                  <td className="cell-sub">{l.phone}</td>
                  <td>{l.project?.name || '—'}</td>
                  <td><span className="badge blue">{l.lastActivityType}</span></td>
                  <td className="cell-sub">{l.lastActivityAt ? new Date(l.lastActivityAt).toLocaleString() : '—'}</td>
                  <td className="cell-sub">{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : '—'}</td>
                  <td><Badge status={l.priority} /></td>
                  <td>
                    <span className="link-btn" onClick={(e) => { e.stopPropagation(); goToLead(l.id); }}>View Lead</span>
                  </td>
                </tr>
              ))}
              {leadsList.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-600)' }}>
                  No leads with follow-up activity yet{fixedActivityType ? ` for "${fixedActivityType}"` : ''}.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
