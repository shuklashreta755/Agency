const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  // Phone is the login identity — every user (broker or agent) must have a unique phone number.
  phone: { type: DataTypes.STRING, allowNull: false, unique: true },
  // Email is optional metadata only; not used for authentication.
  email: { type: DataTypes.STRING, allowNull: true, unique: true, validate: { isEmail: true } },
  role: { type: DataTypes.ENUM('broker', 'agent'), allowNull: false, defaultValue: 'agent' },
  // Self-reference: for an agent, brokerId points to the broker who created them
  brokerId: { type: DataTypes.UUID, allowNull: true, field: 'broker_id' },
  status: { type: DataTypes.ENUM('online', 'idle', 'offline'), defaultValue: 'offline' },
  // Single profile/avatar image — one user, one image. Uploaded separately
  // via POST /api/agents/:id/image (see controllers/agentController.js
  // uploadImage), same nested-upload pattern as a Project's cover image.
  avatarUrl: { type: DataTypes.STRING },
  address: { type: DataTypes.STRING, allowNull: true },
  joiningDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'joining_date' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'users',
});

module.exports = User;
