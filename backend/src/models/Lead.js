const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { LEAD_STAGES } = require('../constants/leadEnums');

const Lead = sequelize.define('Lead', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  projectId: { type: DataTypes.UUID, allowNull: true, field: 'project_id' },
  agentId: { type: DataTypes.UUID, allowNull: true, field: 'agent_id' },
  // Who actually created the record and in what capacity — this is what governs
  // whether an agent is allowed to edit/delete the lead later (self-created only).
  createdBy: { type: DataTypes.UUID, allowNull: false, field: 'created_by' },
  createdByRole: { type: DataTypes.ENUM('broker', 'agent'), allowNull: false, field: 'created_by_role' },
  customerName: { type: DataTypes.STRING, allowNull: false, field: 'customer_name' },
  phone: { type: DataTypes.STRING, allowNull: false },
  // Optional second contact number — also checked during the agent duplicate-lead
  // scan (a submitted phone/alternatePhone matching either field on an existing
  // lead counts as a duplicate).
  alternatePhone: { type: DataTypes.STRING, allowNull: true, field: 'alternate_phone' },
  email: { type: DataTypes.STRING },
  source: { type: DataTypes.ENUM('Website', 'Referral', 'Walk-in', 'Social Media', 'Reference', 'Import', 'Other'), defaultValue: 'Website' },
  stage: { type: DataTypes.ENUM(...LEAD_STAGES), defaultValue: 'New' },
  priority: { type: DataTypes.ENUM('Low', 'Medium', 'High'), defaultValue: 'Medium' },
  nextFollowUp: { type: DataTypes.DATE, field: 'next_follow_up' },
  lastContactedAt: { type: DataTypes.DATE, field: 'last_contacted_at' },
  notes: { type: DataTypes.TEXT },
  // Add Lead form — "Interested In": a free-form multi-select of land/property
  // types the customer is interested in (predefined options + any custom ones
  // the broker/agent adds). Stored as a plain array of strings, e.g.
  // ["Residential Land", "Farm Land"].
  interestedIn: { type: DataTypes.JSON, defaultValue: [], field: 'interested_in' },
  // Add Lead form — "Preferred Locations": Country -> State -> multiple Cities,
  // with one or more free-text addresses/areas per city. Shape:
  // { country: 'India', state: 'Maharashtra',
  //   cities: [{ city: 'Pune', addresses: ['Baner', 'Wakad'] }, ...] }
  preferredLocations: { type: DataTypes.JSON, defaultValue: null, field: 'preferred_locations' },
  // Lead Approval Workflow — every lead an AGENT submits starts life as 'Pending'
  // and is invisible on the main Leads / My Leads tables until the broker approves
  // it. Broker-created (and imported) leads are stamped 'Approved' immediately, so
  // their behavior is completely unchanged from before this feature existed.
  approvalStatus: { type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'), defaultValue: 'Approved', field: 'approval_status' },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: 'rejection_reason' },
  reviewedBy: { type: DataTypes.UUID, allowNull: true, field: 'reviewed_by' },
  reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
}, {
  tableName: 'leads',
});

const LeadStatusHistory = sequelize.define('LeadStatusHistory', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  leadId: { type: DataTypes.UUID, allowNull: false, field: 'lead_id' },
  changedBy: { type: DataTypes.UUID, allowNull: false, field: 'changed_by' },
  fromStage: { type: DataTypes.STRING, field: 'from_stage' },
  toStage: { type: DataTypes.STRING, field: 'to_stage' },
}, {
  tableName: 'lead_status_history',
});

module.exports = { Lead, LeadStatusHistory };
