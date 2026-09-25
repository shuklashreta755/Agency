const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// One row per Site Visit follow-up logged — tracks progress through the fixed
// 11-step sequence defined in constants/leadEnums.js (SITE_VISIT_STEPS).
const SiteVisitTracker = sequelize.define('SiteVisitTracker', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  leadId: { type: DataTypes.UUID, allowNull: false, field: 'lead_id' },
  agentId: { type: DataTypes.UUID, allowNull: false, field: 'agent_id' },
  followUpId: { type: DataTypes.UUID, allowNull: true, field: 'follow_up_id' },
  // Denormalized copy of the originating follow-up's projectId (see
  // FollowUp.projectId) — kept directly on the tracker so every screen that
  // shows a Site Visit's project (the tracker itself, and the Previous/All
  // Site Visits list) can display it without an extra join through FollowUp.
  projectId: { type: DataTypes.UUID, allowNull: true, field: 'project_id' },
  // Index into SITE_VISIT_STEPS of the step that is currently ACTIVE (not yet completed).
  currentStepIndex: { type: DataTypes.INTEGER, defaultValue: 0, field: 'current_step_index' },
  status: { type: DataTypes.ENUM('in_progress', 'completed'), defaultValue: 'in_progress' },
}, {
  tableName: 'site_visit_trackers',
});

module.exports = SiteVisitTracker;
