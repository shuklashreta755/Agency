const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Broker-scoped Builder entity. Powers two things:
//  1. The full "Builders" page (sidebar, between Leads and Clients) — plain
//     Create/View/Edit/soft-Delete with Phone/Email/Description/Status
//     (controllers/builderController.js: listFull/createFull/getOne/update/remove).
//  2. The Project form's Builder Name autocomplete (frontend
//     components/BuilderSelect.jsx via list/create below) — completely
//     unchanged: every builder saved here (from either place) is still
//     suggested there by name alone, regardless of Status.
//
// `paranoid: true` gives soft delete for free — a deleted row just gets
// `deletedAt` set instead of being removed, and Sequelize automatically
// excludes it from every ordinary find/findAll (including the pre-existing
// autocomplete queries) without those queries needing to change at all.
const Builder = sequelize.define('Builder', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('Active', 'Inactive'), defaultValue: 'Active' },
}, {
  tableName: 'builders',
  paranoid: true,
  indexes: [
    // One broker can't save the exact same (non-deleted) builder name twice
    // (matched case-insensitively in the controller before insert). Scoped to
    // `deleted_at IS NULL` so a soft-deleted builder's name can be reused.
    { unique: true, fields: ['broker_id', 'name'], where: { deleted_at: null } },
  ],
});

module.exports = Builder;
