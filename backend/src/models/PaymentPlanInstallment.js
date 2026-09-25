const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// One row of a PaymentPlan template — e.g. { name: 'Booking Amount',
// milestone: 'On Booking', percentage: 10 }. These are the broker-authored
// blueprint; when a Unit is created against this plan, unitController copies
// each row into a real, dated Installment for that unit (see
// unitController.generateInstallments).
const PaymentPlanInstallment = sequelize.define('PaymentPlanInstallment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  paymentPlanId: { type: DataTypes.UUID, allowNull: false, field: 'payment_plan_id' },
  sequenceNumber: { type: DataTypes.INTEGER, allowNull: false, field: 'sequence_number' },
  name: { type: DataTypes.STRING, allowNull: false },
  milestone: { type: DataTypes.STRING, allowNull: false }, // Due condition, e.g. "On Booking", "On Slab Completion"
  percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  // Plan-wide activation state (see paymentPlanController.activateInstallment) —
  // the 1st installment is always implicitly active from booking and never
  // touches these. From the 2nd onward, the broker "Activate"s a row here ONCE
  // for the whole plan (with a date); every booking on the plan then gets it
  // unlocked, and any NEW booking created afterward inherits it as already
  // active with this same date — even if the plan currently has zero bookings.
  // This is the persistent source of truth the "Activated on <date>" UI reads,
  // independent of how many bookings exist at any given moment.
  status: { type: DataTypes.ENUM('Locked', 'Activated'), defaultValue: 'Locked' },
  activatedDate: { type: DataTypes.DATEONLY, field: 'activated_date' },
}, {
  tableName: 'payment_plan_installments',
});

module.exports = PaymentPlanInstallment;
