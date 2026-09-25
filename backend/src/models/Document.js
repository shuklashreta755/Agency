const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Generic, polymorphic file attachment. `documentableType` + `documentableId`
// let ANY entity — Project today, Lead/Unit/Client/etc. later — have files
// attached to it through this one table and one API, instead of a bespoke
// table per entity (contrast with the older, link-only LeadDocument model).
// `documentableType` is a short lowercase noun, e.g. 'project'.
//
// To attach this system to a new entity: add a lookup for it to
// OWNERSHIP_CHECKS in controllers/documentsController.js and two nested
// routes (GET/POST .../:id/documents) that reuse listForType/uploadForType —
// no new model, table, or delete route needed.
const Document = sequelize.define('Document', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  documentableType: { type: DataTypes.STRING, allowNull: false, field: 'documentable_type' },
  documentableId: { type: DataTypes.UUID, allowNull: false, field: 'documentable_id' },
  name: { type: DataTypes.STRING, allowNull: false }, // original filename shown to the user
  fileName: { type: DataTypes.STRING, allowNull: false, field: 'file_name' }, // name on disk (unique, generated)
  url: { type: DataTypes.STRING, allowNull: false }, // public path, e.g. /uploads/documents/xxx.pdf
  mimeType: { type: DataTypes.STRING, field: 'mime_type' },
  size: { type: DataTypes.INTEGER }, // bytes
  uploadedBy: { type: DataTypes.UUID, allowNull: false, field: 'uploaded_by' },
}, {
  tableName: 'documents',
  indexes: [
    { fields: ['documentable_type', 'documentable_id'] },
  ],
});

module.exports = Document;
