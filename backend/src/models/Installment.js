const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { INSTALLMENT_STATUSES } = require('../constants/unitEnums');

// Auto-generated from the unit's Payment Plan when the unit is created (see
// unitController.generateInstallments). `percentage` is fixed once created;
// `amount` is recalculated whenever the unit's totalPrice changes.
const Installment = sequelize.define('Installment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  unitId: { type: DataTypes.UUID, allowNull: false, field: 'unit_id' },
  installmentNumber: { type: DataTypes.INTEGER, allowNull: false, field: 'installment_number' },
  // Copied from the PaymentPlan template row this installment was generated
  // from (see unitController.generateInstallments) — kept on the installment
  // itself so it still displays correctly even if the plan is edited/deleted later.
  name: { type: DataTypes.STRING, allowNull: true },
  milestone: { type: DataTypes.STRING, allowNull: true },
  dueDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'due_date' },
  percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  status: { type: DataTypes.ENUM(...INSTALLMENT_STATUSES), defaultValue: 'Pending' },
}, {
  tableName: 'installments',
});

module.exports = Installment;
