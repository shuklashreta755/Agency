// Single source of truth for the Lead pipeline stages and FollowUp activity types.
// Keep the frontend copies (frontend/src/constants/leadEnums.js) in sync with these.

const LEAD_STAGES = [
  'New', 'Contacted', 'Follow-up', 'Interested', 'Site Visit Scheduled', 'Site Visit Done',
  'Negotiation', 'Proposal Sent', 'Booking Done', 'Converted', 'Lost', 'Not Interested',
  'No Response', 'Closed',
];

const ACTIVITY_TYPES = [
  'Call', 'WhatsApp', 'SMS', 'Email', 'Site Visit', 'Meeting', 'Note', 'Follow-up Call',
  'Video Call', 'Property Shared', 'Brochure Shared', 'Price Discussion',
  'Document Collection', 'Reminder', 'Other',
];

// Site Visit Tracker — a fixed 8-step sequence, index 0 is auto-completed the moment
// a "Site Visit" follow-up is logged; the rest are confirmed one at a time by the agent.
// Location is required for every step except the last two (Visit Feedback Added and
// Next Follow-up, both optional) — see siteVisitController.js advanceStep for the
// exact per-step rules.
const SITE_VISIT_STEPS = [
  'Site Visit Scheduled', 'Journey Started', 'Customer Picked Up',
  'Site Visit Started', 'Site Visit Completed', 'Photo Uploaded',
  'Visit Feedback Added', 'Next Follow-up',
];

// Steps that don't require GPS to confirm — kept as a named list (instead of scattered
// string checks) so the frontend can mirror the exact same rule for its own UI hints.
const SITE_VISIT_LOCATION_OPTIONAL_STEPS = ['Visit Feedback Added', 'Next Follow-up'];

// Lead Approval Workflow — status of a lead an agent submitted for broker review.
const LEAD_APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'];

module.exports = { LEAD_STAGES, ACTIVITY_TYPES, SITE_VISIT_STEPS, SITE_VISIT_LOCATION_OPTIONAL_STEPS, LEAD_APPROVAL_STATUSES };
