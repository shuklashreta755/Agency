const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { LEAD_STAGES, ACTIVITY_TYPES } = require('../constants/leadEnums');

// Each row is one logged interaction against a Lead. Submitting one also updates
// the parent Lead's `stage` (if changed) and `nextFollowUp`/`lastContactedAt` —
// see followUpController.create(). Kept intentionally simple/flat (no required
// foreign-key-heavy fields beyond leadId/agentId) so it can never block a Lead
// from being created or saved independently.
const FollowUp = sequelize.define('FollowUp', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  leadId: { type: DataTypes.UUID, allowNull: false, field: 'lead_id' },
  agentId: { type: DataTypes.UUID, allowNull: false, field: 'agent_id' },
  // The lead's stage AS OF this follow-up — a snapshot for history, and also
  // applied to the parent Lead's current `stage` when saved.
  stage: { type: DataTypes.ENUM(...LEAD_STAGES), allowNull: false, defaultValue: 'New' },
  activityType: { type: DataTypes.ENUM(...ACTIVITY_TYPES), allowNull: false, field: 'activity_type' },
  // Which project this follow-up/site-visit concerns. Optional — most other
  // activity types don't need it, and even for a Site Visit the agent may
  // simply not have picked one; falls back to the lead's own project
  // wherever a project is needed for display or validation.
  projectId: { type: DataTypes.UUID, allowNull: true, field: 'project_id' },
  // Agent's read on how the interaction went — drives the status indicator (✓/●/✕)
  // on the Leads page's "Last 5 Responses" column. Optional; null shows as neutral.
  response: { type: DataTypes.ENUM('positive', 'neutral', 'negative'), allowNull: true },
  description: { type: DataTypes.TEXT },
  nextFollowUpAt: { type: DataTypes.DATE, field: 'next_follow_up_at' },
  reminderEnabled: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'reminder_enabled' },
}, {
  tableName: 'follow_ups',
});

module.exports = FollowUp;
