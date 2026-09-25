import React from 'react';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 };

export const Icons = {
  menu: <svg viewBox="0 0 24 24" {...stroke}><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  close: <svg viewBox="0 0 24 24" {...stroke}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  dashboard: <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>,
  properties: <svg viewBox="0 0 24 24" {...stroke}><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>,
  leads: <svg viewBox="0 0 24 24" {...stroke}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  agents: <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>,
  tracking: <svg viewBox="0 0 24 24" {...stroke}><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  meetings: <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 15l2 2 4-4"/></svg>,
  calendar: <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  reports: <svg viewBox="0 0 24 24" {...stroke}><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>,
  history: <svg viewBox="0 0 24 24" {...stroke}><path d="M3 12a9 9 0 109-9 9 9 0 00-9 9z"/><path d="M12 7v5l3 3"/><path d="M3 3v6h6"/></svg>,
  settings: <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9c.4.5.9.9 1.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>,
  myleads: <svg viewBox="0 0 24 24" {...stroke}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  clients: <svg viewBox="0 0 24 24" {...stroke}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M8.5 11l2 2 4-4"/></svg>,
  builders: <svg viewBox="0 0 24 24" {...stroke}><path d="M6 21V9l6-4 6 4v12"/><path d="M9 21v-5h6v5"/><path d="M9 9h.01M9 13h.01M15 9h.01M15 13h.01"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="#93a0b4" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  bell: <svg viewBox="0 0 24 24" {...stroke}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>,
  upload: <svg viewBox="0 0 24 24" {...stroke}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>,
  followups: <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  siteVisit: <svg viewBox="0 0 24 24" {...stroke}><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z"/><path d="M9.5 10l1.5 1.5L15 8"/></svg>,
  documents: <svg viewBox="0 0 24 24" {...stroke}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6M9 9h1"/></svg>,
  pendingLeads: <svg viewBox="0 0 24 24" {...stroke}><path d="M4 4h11l5 5v11a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M15 4v5h5"/><circle cx="9" cy="15" r="4"/><path d="M9 13.2V15l1.2 1"/></svg>,
  bookings: <svg viewBox="0 0 24 24" {...stroke}><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l7-4 7 4z"/><path d="M9 8h6M9 12h4"/></svg>,
  soldUnits: <svg viewBox="0 0 24 24" {...stroke}><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 14.5l1.8 1.8L15 12.5"/></svg>,
  actCall: <svg viewBox="0 0 24 24" {...stroke}><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L7.9 9.9a16 16 0 006 6l1.4-1.4a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.8 2z"/></svg>,
  actWhatsapp: <svg viewBox="0 0 24 24" {...stroke}><path d="M20.5 11.9a8.5 8.5 0 01-12.3 7.6L4 20l.6-4.1a8.5 8.5 0 1115.9-4z"/><path d="M8.5 9.5c0 3.5 2.5 6 6 6"/></svg>,
  actSms: <svg viewBox="0 0 24 24" {...stroke}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M7 9h10M7 13h6"/></svg>,
  actEmail: <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>,
  actMeeting: <svg viewBox="0 0 24 24" {...stroke}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="8" r="2.5"/><path d="M15.5 14.2c2.6.5 4.5 2.8 4.5 5.8"/></svg>,
  actSiteVisit: <svg viewBox="0 0 24 24" {...stroke}><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  actGeneric: <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>,
};

// Maps a FollowUp activityType to a topbar-style icon for the "Last 5 Responses" column.
export const ACTIVITY_ICON_MAP = {
  Call: 'actCall', 'Follow-up Call': 'actCall', Reminder: 'actCall',
  WhatsApp: 'actWhatsapp',
  SMS: 'actSms',
  Email: 'actEmail',
  Meeting: 'actMeeting', 'Video Call': 'actMeeting',
  'Site Visit': 'actSiteVisit',
};
export const activityIcon = (type) => Icons[ACTIVITY_ICON_MAP[type] || 'actGeneric'];

export const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const badgeColor = (s) => ({
  // Lead priority
  High: 'red', Medium: 'amber', Low: 'blue',
  // Lead stage (full pipeline)
  New: 'purple', Contacted: 'blue', 'Follow-up': 'amber', Interested: 'blue',
  'Site Visit Scheduled': 'amber', 'Site Visit Done': 'amber', Negotiation: 'amber',
  'Proposal Sent': 'blue', 'Booking Done': 'green', Converted: 'green', Closed: 'green',
  Lost: 'red', 'Not Interested': 'red', 'No Response': 'red',
  // Project status
  Active: 'green', Upcoming: 'blue', 'Sold Out': 'red', Inactive: 'purple',
  // Unit status
  Available: 'green', Booked: 'blue', Sold: 'purple', 'On Hold': 'red',
  // Installment status
  Paid: 'green', Overdue: 'red', Locked: 'purple',
  // Follow-up response sentiment (backend uses lowercase)
  positive: 'green', neutral: 'blue', negative: 'red',
  Positive: 'green', Neutral: 'blue', Negative: 'red',
  // Lead approval workflow status
  Pending: 'amber', Approved: 'green', Rejected: 'red',
  // Lead "used in a booking" status (Leads table Status column)
  'Not Booked': 'amber',
  // Booking lead type
  Client: 'green', Lead: 'blue',
  // Booking status / installment status
  Confirmed: 'green', Cancelled: 'red', Completed: 'green',
}[s] || 'blue');
