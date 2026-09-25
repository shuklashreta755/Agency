const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Meeting = sequelize.define('Meeting', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  agentId: { type: DataTypes.UUID, allowNull: false, field: 'agent_id' },
  leadId: { type: DataTypes.UUID, allowNull: true, field: 'lead_id' },
  title: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('Meeting', 'Call', 'Site Visit', 'Follow Up'), defaultValue: 'Meeting' },
  scheduledAt: { type: DataTypes.DATE, allowNull: false, field: 'scheduled_at' },
  durationMinutes: { type: DataTypes.INTEGER, defaultValue: 30, field: 'duration_minutes' },
  status: { type: DataTypes.ENUM('Scheduled', 'Completed', 'Cancelled'), defaultValue: 'Scheduled' },
  reminderSent: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'reminder_sent' },
  notes: { type: DataTypes.TEXT },
}, {
  tableName: 'meetings',
});

module.exports = Meeting;
