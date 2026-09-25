const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A Booking's own installment schedule, generated at booking creation time from
// the Booking's Payment Plan (see bookingController.generateBookingInstallments)
// — amount = booking.amount (the unit's locked-in price) × the plan row's
// percentage, never hardcoded or re-derived from the live unit price later.
//
// Installments must be paid IN ORDER: only the earliest non-Paid installment is
// ever 'Pending' (payable); every later one starts 'Locked' and only flips to
// 'Pending' once the one before it is fully paid — enforced here in the model's
// intent and in bookingController.payInstallment server-side.
const BookingInstallment = sequelize.define('BookingInstallment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  bookingId: { type: DataTypes.UUID, allowNull: false, field: 'booking_id' },
  // Which payment cycle this row belongs to (see PaymentPlan.currentCycle /
  // paymentPlanController.startNextCycle). Almost every booking only ever has
  // cycle 1. sequenceNumber restarts at 1 for every new cycle, so a row is only
  // uniquely identified by (bookingId, cycleNumber, sequenceNumber) — always
  // sort/query by cycleNumber first, then sequenceNumber.
  cycleNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'cycle_number' },
  sequenceNumber: { type: DataTypes.INTEGER, allowNull: false, field: 'sequence_number' },
  name: { type: DataTypes.STRING, allowNull: false },
  milestone: { type: DataTypes.STRING, allowNull: false },
  percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  dueDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'due_date' },
  status: { type: DataTypes.ENUM('Locked', 'Pending', 'Paid'), allowNull: false, defaultValue: 'Locked' },
  // Populated only once this installment is paid.
  paymentDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'payment_date' },
  paymentMethod: { type: DataTypes.ENUM('Bank Transfer', 'UPI', 'Cheque', 'Card', 'Cash'), allowNull: true, field: 'payment_method' },
  transactionRef: { type: DataTypes.STRING, allowNull: true, field: 'transaction_ref' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  paidBy: { type: DataTypes.UUID, allowNull: true, field: 'paid_by' },
}, {
  tableName: 'booking_installments',
});

module.exports = BookingInstallment;
