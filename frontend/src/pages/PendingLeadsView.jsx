import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Badge from '../components/Badge';
import { initials } from '../components/icons';
import { projectsResource } from '../store/resources';
import { useDispatch } from 'react-redux';
import api from '../api/axios';
import { getSocket } from '../api/socket';

// Broker: "Pending Lead Requests" — view, Approve (assign/change Project +
// auto-assign to the submitting agent) or Reject (reason required).
// Agent: "My Pending Leads" — read-only status of their own submissions.
export default function PendingLeadsView({ isAgent }) {
  const dispatch = useDispatch();
  const { items: projects } = useSelector((s) => s.projects);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Row-level inline action panel — only one open at a time.
  const [actionRow, setActionRow] = useState(null); // { id, type: 'approve' | 'reject' }
  const [approveProjectId, setApproveProjectId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads/pending');
      setLeads(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (!isAgent) dispatch(projectsResource.fetchAll());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time — broker gets pushed a "New Lead Approval Request" the moment an
  // agent submits one; the agent gets pushed "Lead Approved/Rejected". Either way
  // it arrives as a generic `notification:new` socket event — just refresh this
  // list when one comes in. Falls back gracefully to the initial load() above if
  // the socket isn't connected.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const handler = () => load();
    socket.on('notification:new', handler);
    return () => socket.off('notification:new', handler);
  }, []);

  const openApprove = (lead) => {
    setActionRow({ id: lead.id, type: 'approve' });
    setApproveProjectId(lead.projectId || '');
    setRejectReason('');
  };
  const openReject = (lead) => {
    setActionRow({ id: lead.id, type: 'reject' });
    setRejectReason('');
  };
  const closeAction = () => setActionRow(null);

  const confirmApprove = async (lead) => {
    setWorking(true);
    try {
      await api.post(`/leads/${lead.id}/approve`, { projectId: approveProjectId || null });
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setActionRow(null);
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not approve lead.');
    } finally {
      setWorking(false);
    }
  };

  const confirmReject = async (lead) => {
    if (!rejectReason.trim()) return;
    setWorking(true);
    try {
      await api.post(`/leads/${lead.id}/reject`, { reason: rejectReason.trim() });
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setActionRow(null);
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not reject lead.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th><th>Phone</th><th>Alternate Phone</th><th>Project</th>
              {!isAgent && <th>Submitted By</th>}
              <th>Submitted</th><th>Status</th>{!isAgent && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <React.Fragment key={l.id}>
                <tr>
                  <td className="row-flex"><div className="avatar-sm" style={{ background: 'var(--blue-600)' }}>{initials(l.customerName)}</div><span className="cell-main">{l.customerName}</span></td>
                  <td className="cell-sub">{l.phone}</td>
                  <td className="cell-sub">{l.alternatePhone || '—'}</td>
                  <td>{l.project?.name || 'Unassigned'}</td>
                  {!isAgent && <td>{l.creator?.name || '—'}</td>}
                  <td className="cell-sub">{new Date(l.createdAt).toLocaleString()}</td>
                  <td><Badge status={l.approvalStatus} /></td>
                  {!isAgent && (
                    <td>
                      <span className="link-btn" onClick={() => openApprove(l)}>Approve</span>
                      {' · '}
                      <span className="link-btn" style={{ color: 'var(--red)' }} onClick={() => openReject(l)}>Reject</span>
                    </td>
                  )}
                </tr>
                {!isAgent && actionRow?.id === l.id && actionRow.type === 'approve' && (
                  <tr>
                    <td colSpan={7}>
                      <div className="card" style={{ margin: '4px 0', boxShadow: 'none', background: 'var(--blue-100)' }}>
                        <div className="row-flex" style={{ gap: 12, flexWrap: 'wrap' }}>
                          <span className="cell-main">Approve "{l.customerName}"</span>
                          <select className="filter-select" value={approveProjectId} onChange={(e) => setApproveProjectId(e.target.value)}>
                            <option value="">Unassigned</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <span className="cell-sub">Will be assigned to {l.creator?.name || 'the submitting agent'}.</span>
                          <button className="btn btn-primary" disabled={working} onClick={() => confirmApprove(l)}>{working ? 'Approving...' : 'Confirm Approve'}</button>
                          <button className="btn btn-ghost" onClick={closeAction}>Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {!isAgent && actionRow?.id === l.id && actionRow.type === 'reject' && (
                  <tr>
                    <td colSpan={7}>
                      <div className="card" style={{ margin: '4px 0', boxShadow: 'none', background: 'var(--red-bg)' }}>
                        <div className="form-field" style={{ marginBottom: 10 }}>
                          <label>Rejection reason (required)</label>
                          <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Duplicate of an existing customer" autoFocus />
                        </div>
                        <button className="btn btn-primary" disabled={working || !rejectReason.trim()} onClick={() => confirmReject(l)}>{working ? 'Rejecting...' : 'Confirm Reject'}</button>{' '}
                        <button className="btn btn-ghost" onClick={closeAction}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!loading && leads.length === 0 && (
              <tr><td colSpan={isAgent ? 6 : 7} style={{ textAlign: 'center', color: 'var(--text-600)' }}>
                {isAgent ? 'No pending leads. Newly added leads will appear here until the broker reviews them.' : 'No pending lead requests right now.'}
              </td></tr>
            )}
            {loading && <tr><td colSpan={isAgent ? 6 : 7} style={{ textAlign: 'center', color: 'var(--text-600)' }}>Loading...</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
