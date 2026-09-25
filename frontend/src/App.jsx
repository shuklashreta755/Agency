import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

import Login from './pages/Login';

import BrokerDashboard from './pages/broker/Dashboard';
import Projects from './pages/broker/Projects';
import ProjectDetail from './pages/broker/ProjectDetail';
import UnitDetail from './pages/broker/UnitDetail';
import Leads from './pages/broker/Leads';
import Builders from './pages/broker/Builders';
import BuilderDetail from './pages/broker/BuilderDetail';
import Clients from './pages/broker/Clients';
import BrokerBookings from './pages/broker/Bookings';
import BrokerBookingDetail from './pages/broker/BookingDetail';
import Agents from './pages/broker/Agents';
import AgentDetail from './pages/broker/AgentDetail';
import Tracking from './pages/broker/Tracking';
import BrokerReports from './pages/broker/Reports';

import AgentDashboard from './pages/agent/AgentDashboard';
import MyProjects from './pages/agent/MyProjects';
import MyProjectDetail from './pages/agent/MyProjectDetail';
import MyLeads from './pages/agent/MyLeads';
import AgentBookings from './pages/agent/Bookings';
import AgentBookingDetail from './pages/agent/BookingDetail';
import AgentReports from './pages/agent/AgentReports';
import AgentFollowUps from './pages/agent/AgentFollowUps';
import AgentSiteVisits from './pages/agent/AgentSiteVisits';

import LeadDetail from './pages/LeadDetail';
import MeetingsView from './pages/MeetingsView';
import CalendarView from './pages/CalendarView';
import HistoryView from './pages/HistoryView';
import SettingsView from './pages/SettingsView';

export default function App() {
  const { user, token } = useSelector((s) => s.auth);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Broker panel */}
      <Route path="/broker" element={<ProtectedRoute role="broker"><DashboardLayout role="broker" /></ProtectedRoute>}>
        <Route path="dashboard" element={<BrokerDashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="units/:id" element={<UnitDetail />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail isAgent={false} />} />
        {/* Pending Leads moved into the Leads page as a tab — redirect the old sidebar route for any bookmarks/links. */}
        <Route path="pending-leads" element={<Navigate to="/broker/leads" replace />} />
        <Route path="builders" element={<Builders />} />
        <Route path="builders/:id" element={<BuilderDetail />} />
        <Route path="clients" element={<Clients />} />
        <Route path="bookings" element={<BrokerBookings />} />
        <Route path="bookings/:id" element={<BrokerBookingDetail />} />
        <Route path="agents" element={<Agents />} />
        <Route path="agents/:id" element={<AgentDetail />} />
        <Route path="tracking" element={<Tracking />} />
        <Route path="meetings" element={<MeetingsView isAgent={false} />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="reports" element={<BrokerReports />} />
        <Route path="history" element={<HistoryView />} />
        <Route path="settings" element={<SettingsView />} />
      </Route>

      {/* Agent panel — no Meetings tab; meetings are broker-managed only */}
      <Route path="/agent" element={<ProtectedRoute role="agent"><DashboardLayout role="agent" /></ProtectedRoute>}>
        <Route path="dashboard" element={<AgentDashboard />} />
        <Route path="projects" element={<MyProjects />} />
        <Route path="projects/:id" element={<MyProjectDetail />} />
        <Route path="leads" element={<MyLeads />} />
        <Route path="leads/:id" element={<LeadDetail isAgent={true} />} />
        <Route path="pending-leads" element={<Navigate to="/agent/leads" replace />} />
        <Route path="followups" element={<AgentFollowUps />} />
        <Route path="bookings" element={<AgentBookings />} />
        <Route path="bookings/:id" element={<AgentBookingDetail />} />
        <Route path="sitevisits" element={<AgentSiteVisits />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="reports" element={<AgentReports />} />
        <Route path="settings" element={<SettingsView />} />
      </Route>

      <Route path="/" element={
        token && user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
