const { Booking, Lead, Project, Unit, User } = require('../models');

// GET /api/clients  (Broker only)
// A "Client" here is exactly one successful purchase — a Booking whose
// leadType has flipped from 'Lead' to 'Client'. That flip happens in
// bookingController.payInstallment (and the one-off backfill next to it) the
// moment that booking's first payment cycle is fully paid — see the comment
// there. Reading directly off Booking (rather than off Lead.stage === 'Closed')
// is what gives us the actual purchased Project + Unit for each purchase,
// and is also multi-purchase-safe: a lead who has bought more than one unit
// shows up once per unit actually purchased, not just once.
async function list(req, res) {
  const bookings = await Booking.findAll({
    where: { brokerId: req.brokerId, leadType: 'Client' },
    include: [
      { model: Lead, as: 'lead', attributes: ['id', 'customerName', 'phone'] },
      { model: Project, as: 'project', attributes: ['id', 'name'] },
      { model: Unit, as: 'unit', attributes: ['id', 'unitNo'] },
      // Handled By: the assigned Agent if there is one; otherwise whoever
      // (always a broker in that case — see bookingController.create) created
      // the booking directly.
      { model: User, as: 'agent', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['id', 'name', 'role'] },
    ],
    order: [['updatedAt', 'DESC']],
  });

  const data = bookings.map((b) => ({
    id: b.id,
    customerName: b.lead?.customerName || '—',
    phone: b.lead?.phone || '—',
    projectName: b.project?.name || '—',
    unitNo: b.unit?.unitNo || '—',
    handledBy: b.agent?.name || b.creator?.name || '—',
    handledByRole: b.agent ? 'agent' : (b.creator?.role || null),
    purchaseDate: b.updatedAt,
  }));

  res.json({ data });
}

module.exports = { list };
