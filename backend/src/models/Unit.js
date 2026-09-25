const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { UNIT_TYPES, UNIT_STATUSES } = require('../constants/unitEnums');

const Unit = sequelize.define('Unit', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  unitNo: { type: DataTypes.STRING, allowNull: false, field: 'unit_no' },
  unitType: { type: DataTypes.ENUM(...UNIT_TYPES), allowNull: false, field: 'unit_type' },
  // Multi-select — stored as a plain string array; validated against UNIT_FEATURES in the controller.
  features: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  sizeSqft: { type: DataTypes.DECIMAL(10, 2), field: 'size_sqft' },
  basicPrice: { type: DataTypes.DECIMAL(14, 2), allowNull: false, field: 'basic_price' },
  totalPrice: { type: DataTypes.DECIMAL(14, 2), allowNull: false, field: 'total_price' },
  advanceAmount: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0, field: 'advance_amount' },
  // References one of the PARENT PROJECT's saved PaymentPlan rows (see
  // PaymentPlan.js) — never a hardcoded plan name. null = the built-in "Full
  // Payment" fallback (one 100% installment), for units with no formal plan.
  paymentPlanId: { type: DataTypes.UUID, allowNull: true, field: 'payment_plan_id' },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM(...UNIT_STATUSES), defaultValue: 'Available' },
}, {
  tableName: 'units',
});

module.exports = Unit;
