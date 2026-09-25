const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UnitImage = sequelize.define('UnitImage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  unitId: { type: DataTypes.UUID, allowNull: false, field: 'unit_id' },
  url: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'unit_images',
});

module.exports = UnitImage;
