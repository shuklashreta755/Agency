const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Join table for the Agent N:M Project relationship — which agents are allowed
// to work (view + create leads) on which projects.
const AgentProject = sequelize.define('AgentProject', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  agentId: { type: DataTypes.UUID, allowNull: false, field: 'agent_id' },
  projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
}, {
  tableName: 'agent_projects',
  indexes: [{ unique: true, fields: ['agent_id', 'project_id'] }],
});

module.exports = AgentProject;
