const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Lightweight document reference (name + URL) attached to a lead — e.g. a link to
// a brochure, ID proof, or agreement stored elsewhere (Drive, S3, etc.). This is
// intentionally not a file-upload system; if real file storage is added later
// (see README "Extending" section), `url` just becomes the uploaded file's URL.
const LeadDocument = sequelize.define('LeadDocument', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  leadId: { type: DataTypes.UUID, allowNull: false, field: 'lead_id' },
  uploadedBy: { type: DataTypes.UUID, allowNull: false, field: 'uploaded_by' },
  name: { type: DataTypes.STRING, allowNull: false },
  url: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'lead_documents',
});

module.exports = LeadDocument;
