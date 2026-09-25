const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A named, reusable installment plan template that belongs to a Project (e.g.
// "2 Installment Plan", "Construction Linked Plan"). A project can have many
// plans; each plan's rows live in PaymentPlanInstallment. Units then reference
// one of these by paymentPlanId when created — see Unit.js / unitController.js.
const PaymentPlan = sequelize.define('PaymentPlan', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  // Which payment cycle this plan is currently on. Starts at 1. When every
  // booking on this plan has fully paid every installment of the current
  // cycle, the broker can start a new one (paymentPlanController.startNextCycle)
  // — this bumps the number, resets every PaymentPlanInstallment row's
  // activation state back to Locked, and gives every booking currently on this
  // plan a fresh 1st -> Nth installment schedule for the new cycle.
  currentCycle: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'current_cycle' },
}, {
  tableName: 'payment_plans',
});

module.exports = PaymentPlan;
