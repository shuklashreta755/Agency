const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const CustomUnitFeature = sequelize.define('CustomUnitFeature', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  name: { type: DataTypes.STRING(40), allowNull: false },
  // Lowercase copy of `name`, so "Sea Facing" and "sea facing" can't both be saved.
  nameKey: { type: DataTypes.STRING(40), allowNull: false, field: 'name_key' },
}, {
  tableName: 'custom_unit_features',
  indexes: [
    { unique: true, fields: ['broker_id', 'name_key'] },
  ],
});

module.exports = CustomUnitFeature;
