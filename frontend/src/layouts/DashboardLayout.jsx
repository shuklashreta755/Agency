import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import { Icons, initials } from '../components/icons';
import NotificationBell from '../components/NotificationBell';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';
import { applyLocationUpdate, applyStatusUpdate } from '../store/trackingSlice';
import { useAgentLocationBroadcast } from '../hooks/useAgentLocationBroadcast';

const brokerNav = [
  { to: '/broker/dashboard', label: 'Dashboard', icon: Icons.dashboard },
  { to: '/broker/projects', label: 'Projects', icon: Icons.properties },
  { to: '/broker/leads', label: 'Leads', icon: Icons.leads },
  { to: '/broker/builders', label: 'Builders', icon: Icons.builders },
  { to: '/broker/clients', label: 'Clients', icon: Icons.clients },
  { to: '/broker/bookings', label: 'Bookings', icon: Icons.bookings },
  { to: '/broker/agents', label: 'Agents', icon: Icons.agents },
  { to: '/broker/tracking', label: 'Agent Tracking', icon: Icons.tracking },
  { to: '/broker/meetings', label: 'Meetings', icon: Icons.meetings },
  { to: '/broker/calendar', label: 'Calendar', icon: Icons.calendar },
  { to: '/broker/reports', label: 'Reports', icon: Icons.reports },
  { to: '/broker/history', label: 'History', icon: Icons.history },
  { to: '/broker/settings', label: 'Settings', icon: Icons.settings },
];

// Agents don't get a Meetings tab — scheduling and meeting management is broker-only.
const agentNav = [
  { to: '/agent/dashboard', label: 'Dashboard', icon: Icons.dashboard },
  { to: '/agent/projects', label: 'My Projects', icon: Icons.properties },
  { to: '/agent/leads', label: 'My Leads', icon: Icons.myleads },
  { to: '/agent/followups', label: 'Follow-ups', icon: Icons.followups },
  { to: '/agent/bookings', label: 'Bookings', icon: Icons.bookings },
  { to: '/agent/calendar', label: 'Calendar', icon: Icons.calendar },
  { to: '/agent/reports', label: 'Reports', icon: Icons.reports },
  { to: '/agent/settings', label: 'Settings', icon: Icons.settings },
];

const titleMap = {
  dashboard: ['Dashboard', "Welcome back, here's what's happening today."],
  projects: ['Projects', 'Manage your real-estate project listings.'],
  leads: ['Leads', 'Track, assign and manage every lead in one place.'],
  'pending-leads': ['Pending Leads', 'Review leads submitted for approval — approve to move them into Active Leads, or reject with a reason.'],
  builders: ['Builders', 'Manage the builders your projects are linked to.'],
  clients: ['Clients', "Leads that have closed — they've bought a project from us."],
  bookings: ['Bookings', 'Units booked for a lead or client, with agent, payment plan and amount.'],
  agents: ['Agents', 'Manage your agent team, project assignments and monitor performance.'],
  tracking: ['Agent Tracking', 'View live location of your active agents.'],
  meetings: ['Meetings', 'Upcoming site visits, calls and meetings.'],
  calendar: ['Calendar', 'Your scheduled events at a glance.'],
  reports: ['Reports', 'Lead conversion, project and agent performance.'],
  history: ['History', 'Full audit trail of important actions.'],
  settings: ['Settings', 'Manage your profile, security and preferences.'],
  leadDetail: ['Lead Details', 'Follow-up timeline and interaction history.'],
  projectDetail: ['Project Details', 'Basic information, pricing and units.'],
  unitDetail: ['Unit Details', 'Pricing and installment schedule.'],
  bookingDetail: ['Booking Details – Payment', 'Payment schedule, progress and installment history.'],
  builderDetail: ['Builder Details', 'Total, active and completed projects for this builder.'],
  followups: ['Follow-ups', 'Leads with follow-up activity, sorted by most recent.'],
  sitevisits: ['Site Visits', 'Leads with a logged site visit.'],
};

export default function DashboardLayout({ role }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const nav = role === 'broker' ? brokerNav : agentNav;
  const segments = location.pathname.split('/').filter(Boolean);
  const isLeadDetail = segments[1] === 'leads' && segments.length > 2;
  const isProjectDetail = segments[1] === 'projects' && segments.length > 2;
  const isUnitDetail = segments[1] === 'units' && segments.length > 2;
  const isBookingDetail = segments[1] === 'bookings' && segments.length > 2;
  const isBuilderDetail = segments[1] === 'builders' && segments.length > 2;
  const segment = isLeadDetail ? 'leadDetail' : isProjectDetail ? 'projectDetail' : isUnitDetail ? 'unitDetail' : isBookingDetail ? 'bookingDetail' : isBuilderDetail ? 'builderDetail' : segments[segments.length - 1];
  // "My Projects" (agent) shares the /projects path segment with the broker's
  // "Projects" page but needs its own heading — everything else in titleMap
  // stays exactly as it was for the broker.
  const [title, sub] = (role === 'agent' && segment === 'projects')
    ? ['My Projects', 'View all projects assigned to you.']
    : (titleMap[segment] || titleMap.dashboard);

  // Close the off-canvas sidebar automatically whenever the route changes (mobile/tablet)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Establish a live socket connection for real-time agent tracking + notifications
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return undefined;

    socket.on('location:updated', (payload) => dispatch(applyLocationUpdate(payload)));
    socket.on('agent:status', (payload) => dispatch(applyStatusUpdate(payload)));

    return () => {
      socket.off('location:updated');
      socket.off('agent:status');
    };
  }, [dispatch]);

  // Agents (not brokers) periodically report their GPS position while this
  // layout is mounted, so their entry on the broker's Agent Tracking map
  // actually has somewhere to point to.
  useAgentLocationBroadcast(role === 'agent');

  const handleLogout = () => {
    disconnectSocket();
    dispatch(logout());
  };

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">PC</div>
          <div>
            <div className="brand-text">PropelCRM</div>
            <div className="brand-sub">{role === 'broker' ? 'Broker Panel' : 'Agent Panel'}</div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            {Icons.close}
          </button>
        </div>
        <div className="nav-group-label">Menu</div>
        <ul className="nav">
          {nav.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.icon}<span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <div className="avatar">{initials(user?.name || '')}</div>
          <div>
            <div className="sf-name">{user?.name}</div>
            <div className="sf-role" style={{ cursor: 'pointer' }} onClick={handleLogout}>Log out</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="row-flex" style={{ gap: 10, minWidth: 0 }}>
            <button
              type="button"
              className="sidebar-toggle-btn"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              {Icons.menu}
            </button>
            <div style={{ minWidth: 0 }}>
              <div className="page-title">{title}</div>
              <div className="page-sub">{sub}</div>
            </div>
          </div>
          <div className="topbar-right">
            <div className="search-box">
              {Icons.search}
              <input placeholder="Search leads, projects, agents..." />
            </div>
            <NotificationBell />
            <div className="avatar" style={{ width: 36, height: 36 }}>{initials(user?.name || '')}</div>
          </div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
