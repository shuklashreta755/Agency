const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Broker-scoped "memory" of every Local Address (area/locality) ever entered
// against a given city on the Project form (see frontend
// components/LocalAddresses.jsx). This is separate from Project.localAddresses
// (which stores the addresses actually attached to one project) — this table
// exists purely so that once an address has been used for a city, it shows up
// as an autocomplete suggestion the next time ANY project is created/edited
// for that same city, instead of the broker having to retype it.
const LocalAddress = sequelize.define('LocalAddress', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  city: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'local_addresses',
  indexes: [
    // One broker can't save the same address twice for the same city (matched
    // case-insensitively in the controller before insert).
    { unique: true, fields: ['broker_id', 'city', 'address'] },
  ],
});

module.exports = LocalAddress;
