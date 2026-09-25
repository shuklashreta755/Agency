// Keep in sync with backend/src/constants/leadEnums.js

export const LEAD_STAGES = [
  'New', 'Contacted', 'Follow-up', 'Interested', 'Site Visit Scheduled', 'Site Visit Done',
  'Negotiation', 'Proposal Sent', 'Booking Done', 'Converted', 'Lost', 'Not Interested',
  'No Response', 'Closed',
];

export const ACTIVITY_TYPES = [
  'Call', 'WhatsApp', 'SMS', 'Email', 'Site Visit', 'Meeting', 'Note', 'Follow-up Call',
  'Video Call', 'Property Shared', 'Brochure Shared', 'Price Discussion',
  'Document Collection', 'Reminder', 'Other',
];

export const FOLLOWUP_BUCKETS = [
  { value: '', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
];

// Lead Approval Workflow — status of a lead an agent submitted for broker review.
export const LEAD_APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'];

// Add Lead form — "Interested In" popular options. The field also allows adding
// any custom interest not listed here (stored alongside these as plain strings).
export const INTEREST_OPTIONS = [
  { value: 'Residential Land', description: 'Plots for residential purposes (e.g., housing, villas)', icon: '🏡' },
  { value: 'Commercial Land', description: 'Land for offices, shops, malls, etc.', icon: '🏬' },
  { value: 'Farm Land', description: 'Agricultural or farming land', icon: '🌾' },
  { value: 'Industrial Land', description: 'Land for factories, warehouses, industries', icon: '🏭' },
  { value: 'Mixed Use Land', description: 'Land for both residential and commercial use', icon: '🏙️' },
  { value: 'Plot for Investment', description: 'Land bought for future returns', icon: '📈' },
];

// Site Visit Tracker — must exactly mirror backend/src/constants/leadEnums.js
export const SITE_VISIT_STEPS = [
  'Site Visit Scheduled', 'Journey Started', 'Customer Picked Up',
  'Site Visit Started', 'Site Visit Completed', 'Photo Uploaded',
  'Visit Feedback Added', 'Next Follow-up',
];

// Steps that don't require GPS to confirm — mirrors
// backend/src/constants/leadEnums.js SITE_VISIT_LOCATION_OPTIONAL_STEPS.
export const SITE_VISIT_LOCATION_OPTIONAL_STEPS = ['Visit Feedback Added', 'Next Follow-up'];
