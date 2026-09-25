import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Icons } from './icons';
import api from '../api/axios';
import { getSocket } from '../api/socket';

const POLL_INTERVAL_MS = 30000;

export default function NotificationBell() {
  const { user } = useSelector((s) => s.auth);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const containerRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get('/notifications');
      setItems(data.data);
      setUnreadCount(data.unreadCount);
    } catch {
      // stay silent — the bell just won't update this cycle
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Real-time push (Lead Approval Workflow and others) — refresh immediately when
  // a notification is created for this user. The interval above is still the
  // fallback if the socket connection isn't available.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const handler = () => load();
    socket.on('notification:new', handler);
    return () => socket.off('notification:new', handler);
  }, []);

  // Close the dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  // Agent notifications: clicking navigates to the linked page (and marks read).
  // Broker notifications: informational only — clicking ONLY marks read / expands
  // the message. Never navigates, regardless of whether a link happens to be set.
  const handleClick = (n) => {
    if (!n.isRead) markRead(n.id);
    if (user?.role === 'agent' && n.link) {
      setOpen(false);
      navigate(n.link);
    } else {
      setExpandedId((cur) => (cur === n.id ? null : n.id));
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className="icon-btn" onClick={() => setOpen((o) => !o)}>
        {Icons.bell}
        {unreadCount > 0 && <div className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</div>}
      </div>

      {open && (
        <div className="notif-dropdown-wrap" onClick={() => setOpen(false)}>
          <div className="notif-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="row-flex" style={{ justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <span className="cell-main">Notifications</span>
            {unreadCount > 0 && <span className="link-btn" onClick={markAllRead}>Mark all read</span>}
          </div>

          {items.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-600)', fontSize: 13 }}>No notifications yet.</div>
          )}

          {items.map((n) => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                background: n.isRead ? 'transparent' : 'var(--blue-100)',
              }}
            >
              <div className="row-flex" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span className="cell-main" style={{ fontSize: 13 }}>{n.title}</span>
                {!n.isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue-600)', flexShrink: 0, marginTop: 4 }} />}
              </div>
              <div className="cell-sub" style={{
                marginTop: 3,
                ...(expandedId !== n.id && user?.role === 'broker' ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}),
              }}>
                {n.message}
              </div>
              <div className="cell-sub" style={{ marginTop: 4, fontSize: 11 }}>{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
