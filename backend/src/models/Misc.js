const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.STRING },
  // Frontend path to navigate to on click (e.g. "/agent/leads/:id?tab=followups").
  // Only ever set on notifications sent TO an agent — broker notifications are
  // informational only and must never carry a link (see notificationController).
  link: { type: DataTypes.STRING, allowNull: true },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' },
}, {
  tableName: 'notifications',
});

const AgentLocation = sequelize.define('AgentLocation', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  agentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'agent_id' },
  lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  areaLabel: { type: DataTypes.STRING, field: 'area_label' },
}, {
  tableName: 'agent_locations',
});

const ActivityHistory = sequelize.define('ActivityHistory', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  action: { type: DataTypes.STRING, allowNull: false },
  relatedType: { type: DataTypes.STRING, field: 'related_type' },
  relatedId: { type: DataTypes.UUID, field: 'related_id' },
}, {
  tableName: 'activity_history',
});

module.exports = { Notification, AgentLocation, ActivityHistory };
