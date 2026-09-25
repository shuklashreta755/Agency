const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// One row per COMPLETED step of a SiteVisitTracker — GPS, address, and timestamp are
// captured automatically at the moment the step is saved; photoUrl only applies to
// the "Photo Uploaded" step, and feedback only applies to "Visit Feedback Added".
const SiteVisitStep = sequelize.define('SiteVisitStep', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  trackerId: { type: DataTypes.UUID, allowNull: false, field: 'tracker_id' },
  stepIndex: { type: DataTypes.INTEGER, allowNull: false, field: 'step_index' },
  stepName: { type: DataTypes.STRING, allowNull: false, field: 'step_name' },
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  address: { type: DataTypes.STRING, allowNull: true },
  photoUrl: { type: DataTypes.STRING, allowNull: true, field: 'photo_url' },
  feedback: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'site_visit_steps',
});

module.exports = SiteVisitStep;
