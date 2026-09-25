const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A Booking ties one Unit to one Lead/Client with an assigned Agent.
// `amount` (labelled "Unit Price" on the form) is always the Unit's
// totalPrice AT THE TIME OF BOOKING — the backend derives and locks this
// server-side (see bookingController.create); it is never taken from client
// input, so a unit's list price changing later never silently rewrites
// history. `sellingPrice` (labelled "Selling Price" on the form) is the
// actual/current market/negotiated price this unit is being booked for —
// editable, defaults to the unit's price if left blank — and is what every
// installment/payment calculation and the Total/Paid/Pending/Progress
// figures on the Booking Detail page are based on (see
// bookingController.generateBookingInstallments and BookingDetail.jsx),
// NOT `amount`.
const Booking = sequelize.define('Booking', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
  unitId: { type: DataTypes.UUID, allowNull: false, field: 'unit_id' },
  agentId: { type: DataTypes.UUID, allowNull: true, field: 'agent_id' },
  leadId: { type: DataTypes.UUID, allowNull: false, field: 'lead_id' },
  // Which bucket the Lead/Client was picked from at booking time — 'Client' means
  // an already-converted (stage='Closed') lead; 'Lead' means a previously
  // unassigned/pooled lead. Updated to 'Client' automatically once every
  // installment on this booking is paid (see bookingController.payInstallment),
  // since that's also when the underlying Lead itself converts to a Client.
  leadType: { type: DataTypes.ENUM('Client', 'Lead'), allowNull: false, field: 'lead_type' },
  bookingDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'booking_date' },
  amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  // Nullable so this column can never fail against an existing database with
  // existing booking rows — bookingController falls back to `amount` for any
  // row where it's null (see bookingController.sellingPriceOf).
  sellingPrice: { type: DataTypes.DECIMAL(14, 2), allowNull: true, field: 'selling_price' },
  paymentPlanId: { type: DataTypes.UUID, allowNull: true, field: 'payment_plan_id' },
  status: { type: DataTypes.ENUM('Confirmed', 'Cancelled'), defaultValue: 'Confirmed' },
  // Human-friendly display code (e.g. "BK-2026-001"), generated at creation
  // time — see bookingController.nextBookingCode. Nullable/unenforced at the DB
  // level on purpose, so adding this column can never fail against an existing
  // database with existing rows.
  bookingCode: { type: DataTypes.STRING, allowNull: true, field: 'booking_code' },
  createdBy: { type: DataTypes.UUID, allowNull: false, field: 'created_by' },
}, {
  tableName: 'bookings',
});

module.exports = Booking;
