const { Op } = require('sequelize');
const { Booking, BookingInstallment, Project, Unit, User, Lead, PaymentPlan, PaymentPlanInstallment, AgentProject } = require('../models');
const { logActivity } = require('../utils/activityLogger');
const { agentHasProjectAccess } = require('../utils/agentProjectAccess');
const { notifyAgent } = require('../utils/notify');

const bookingInclude = [
  { model: Project, as: 'project', attributes: ['id', 'name', 'city'] },
  { model: Unit, as: 'unit', attributes: ['id', 'unitNo', 'unitType', 'totalPrice'] },
  { model: User, as: 'agent', attributes: ['id', 'name', 'phone'] },
  { model: User, as: 'creator', attributes: ['id', 'name', 'role'] },
  { model: Lead, as: 'lead', attributes: ['id', 'customerName', 'phone'] },
  { model: PaymentPlan, as: 'paymentPlanRef', attributes: ['id', 'name'] },
];

const detailInclude = [
  ...bookingInclude,
  { model: BookingInstallment, as: 'installments', separate: true, order: [['cycleNumber', 'ASC'], ['sequenceNumber', 'ASC']] },
];

// Generates a human-friendly display code like "BK-2026-001" — sequential
// within this broker's tenant for the current year. No DB uniqueness
// constraint is relied on (see Booking.bookingCode) — a rare race is purely
// cosmetic, never a correctness issue.
async function nextBookingCode(brokerId) {
  const year = new Date().getFullYear();
  const count = await Booking.count({
    where: { brokerId, createdAt: { [Op.gte]: new Date(`${year}-01-01`), [Op.lt]: new Date(`${year + 1}-01-01`) } },
  });
  return `BK-${year}-${String(count + 1).padStart(3, '0')}`;
}

// The single source of truth for "what basis do payment calculations use for
// this booking" — always Selling Price, falling back to Unit Price (`amount`)
// only for the handful of bookings created before Selling Price existed and
// therefore have no value stored for it. Every installment/payment figure
// (generateBookingInstallments below, and the Total/Paid/Pending/Progress KPIs
// on BookingDetail.jsx) is computed from this, never from `amount` directly.
function sellingPriceOf(booking) {
  return booking.sellingPrice != null ? Number(booking.sellingPrice) : Number(booking.amount);
}

// Generates the booking's own sequential installment schedule from its Payment
// Plan — amounts are ALWAYS derived from the booking's Selling Price (see
// sellingPriceOf above) × each plan row's percentage; never hardcoded. Falls back
// to a single 100% "Full Payment" row when no plan was chosen, same convention
// as unitController.generateInstallments. The 1st installment always starts
// 'Pending' (payable) immediately, no broker action needed.
//
// For every later installment: it inherits the plan template row's own
// activation state (see PaymentPlanInstallment.status / activatedDate, set by
// paymentPlanController.activateInstallment) — if the broker already activated
// that milestone for this plan, this new booking starts with it 'Pending' too,
// using that same date, instead of starting 'Locked' and needing a redundant
// booking-specific activation. This works even the very first time a booking is
// made on a plan the broker had already activated milestones for with zero
// bookings on it yet. Anything the plan hasn't activated yet still starts
// 'Locked', same as before.
//
// Always generated for the plan's CURRENT cycle (PaymentPlan.currentCycle) —
// see paymentPlanController.startNextCycle for how/when that advances.
async function generateBookingInstallments(booking) {
  let rows = null;
  let cycleNumber = 1;
  if (booking.paymentPlanId) {
    const plan = await PaymentPlan.findByPk(booking.paymentPlanId, {
      include: [{ model: PaymentPlanInstallment, as: 'installments', separate: true, order: [['sequenceNumber', 'ASC']] }],
    });
    if (plan) cycleNumber = plan.currentCycle;
    if (plan && plan.installments.length) {
      rows = plan.installments.map((r) => ({
        name: r.name, milestone: r.milestone, percentage: Number(r.percentage),
        activated: r.status === 'Activated', activatedDate: r.activatedDate,
      }));
    }
  }
  if (!rows) rows = [{ name: 'Full Payment', milestone: 'On Booking', percentage: 100, activated: false, activatedDate: null }];

  const start = new Date(booking.bookingDate);
  await BookingInstallment.bulkCreate(rows.map((r, i) => {
    const sequenceNumber = i + 1;
    const computedDueDate = new Date(start);
    computedDueDate.setDate(computedDueDate.getDate() + i * 30);

    const status = sequenceNumber === 1 || r.activated ? 'Pending' : 'Locked';
    const dueDate = r.activated ? r.activatedDate : computedDueDate.toISOString().slice(0, 10);

    return {
      bookingId: booking.id,
      cycleNumber,
      sequenceNumber,
      name: r.name,
      milestone: r.milestone,
      percentage: r.percentage,
      amount: Number(((sellingPriceOf(booking) * r.percentage) / 100).toFixed(2)),
      dueDate,
      status,
    };
  }));
}

// Broker: can add a payment only for a booking THEY personally created.
// Agent: can add a payment only for a booking assigned to them.
function canManagePayments(req, booking) {
  if (req.user.role === 'agent') return booking.agentId === req.user.id;
  return booking.createdBy === req.user.id;
}

// GET /api/bookings/projects
// Powers the Add Booking form's Project field. Broker: every project in the
// tenant. Agent: the union of projects formally assigned to them (AgentProject)
// AND projects they already have leads in (assigned to them or created by
// them) — so a project they're clearly working (visible on their own Leads
// page) always shows up here too, matching what they actually see elsewhere.
async function bookableProjects(req, res) {
  if (req.user.role === 'broker') {
    const projects = await Project.findAll({ where: { brokerId: req.brokerId }, order: [['name', 'ASC']] });
    return res.json({ data: projects });
  }

  const [links, leadRows] = await Promise.all([
    AgentProject.findAll({ where: { agentId: req.user.id }, attributes: ['projectId'] }),
    Lead.findAll({
      where: { brokerId: req.brokerId, projectId: { [Op.ne]: null }, [Op.or]: [{ agentId: req.user.id }, { createdBy: req.user.id }] },
      attributes: ['projectId'],
    }),
  ]);
  const idSet = new Set([...links.map((l) => l.projectId), ...leadRows.map((l) => l.projectId)]);
  const projects = idSet.size
    ? await Project.findAll({ where: { id: { [Op.in]: [...idSet] }, brokerId: req.brokerId }, order: [['name', 'ASC']] })
    : [];
  res.json({ data: projects });
}

// GET /api/bookings/:id
// Broker: any booking in the tenant. Agent: only their own (agentId = self).
async function getOne(req, res) {
  const where = { id: req.params.id, brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const booking = await Booking.findOne({ where, include: detailInclude });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  res.json({ data: booking, canManagePayments: canManagePayments(req, booking) });
}

// GET /api/bookings/enums — the valid Payment Method values, read live from the
// BookingInstallment model's ENUM definition, never a hardcoded frontend array.
async function enums(req, res) {
  res.json({ paymentMethods: BookingInstallment.rawAttributes.paymentMethod.values });
}

// GET /api/bookings
// Broker sees every booking in the tenant, optionally filtered by
// ?createdByRole=broker|agent for the "Broker Bookings" / "Agent's Bookings"
// tabs — matched against the actual role of the user referenced by createdBy
// (a live join, not a stored snapshot column), so it works correctly for every
// booking ever created, including ones from before this feature existed. Agent
// sees only bookings assigned to them regardless of who created it.
async function list(req, res) {
  const { createdByRole } = req.query;
  const where = { brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const include = bookingInclude.map((inc) => (
    inc.as === 'creator' && req.user.role === 'broker' && ['broker', 'agent'].includes(createdByRole)
      ? { ...inc, where: { role: createdByRole }, required: true }
      : inc
  ));

  const bookings = await Booking.findAll({ where, include, order: [['bookingDate', 'DESC'], ['createdAt', 'DESC']] });
  res.json({ data: bookings });
}

// GET /api/bookings/leads?leadType=Client|Lead
// Powers the Add Booking form's "Lead / Client" field. Never hardcoded — always
// a live query:
//   Client  -> every converted/purchased lead in the tenant (stage = 'Closed'),
//              same for both roles — not restricted to "my own" clients.
//   Lead    -> Broker: leads not assigned to any agent (the open pool)
//              Agent:  leads assigned to them OR created by them (their own book)
async function leadOptions(req, res) {
  const { leadType } = req.query;
  if (!['Client', 'Lead'].includes(leadType)) return res.status(400).json({ message: 'leadType must be "Client" or "Lead".' });

  const where = { brokerId: req.brokerId, approvalStatus: 'Approved' };

  if (leadType === 'Client') {
    // Every converted/purchased client in the tenant — same set as the Broker
    // Panel's own Clients page, regardless of which agent (if any) handled the
    // sale. Not scoped to the current agent: an agent booking a new unit for an
    // existing client isn't limited to only the clients they personally closed.
    where.stage = 'Closed';
  } else {
    where.stage = { [Op.ne]: 'Closed' };
    if (req.user.role === 'agent') {
      where[Op.or] = [{ agentId: req.user.id }, { createdBy: req.user.id }];
    } else {
      where.agentId = null; // Broker: the unassigned pool
    }
  }

  const leads = await Lead.findAll({ where, attributes: ['id', 'customerName', 'phone', 'agentId'], order: [['customerName', 'ASC']] });
  res.json({ data: leads });
}

// POST /api/bookings
// Broker: must specify agentId explicitly. Agent: agentId is always themself —
// the Agent Panel form has no Agent field at all, so any agentId in the body is
// ignored for that role.
async function create(req, res) {
  const { projectId, unitId, leadId, leadType, bookingDate, paymentPlanId, sellingPrice } = req.body;
  // Agent role: always themself. Broker role: the Agent field is optional — a
  // booking can be created without assigning any agent to it.
  const agentId = req.user.role === 'agent' ? req.user.id : (req.body.agentId || null);

  if (!projectId || !unitId || !leadId || !leadType || !bookingDate) {
    return res.status(400).json({ message: 'Project, Unit, Lead/Client, Booking Date and Lead Type are all required.' });
  }
  if (!['Client', 'Lead'].includes(leadType)) return res.status(400).json({ message: 'leadType must be "Client" or "Lead".' });

  const project = await Project.findOne({ where: { id: projectId, brokerId: req.brokerId } });
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  // Agents may only book within a project they can actually work with —
  // formally assigned OR one they already have a lead in (same rule as the
  // Project field itself and Units access).
  if (req.user.role === 'agent') {
    const ok = await agentHasProjectAccess(req.user.id, projectId);
    if (!ok) return res.status(403).json({ message: 'You can only book units in projects assigned to you.' });
  }

  const unit = await Unit.findOne({ where: { id: unitId, projectId } });
  if (!unit) return res.status(400).json({ message: 'That unit does not belong to the selected project.' });
  if (unit.status !== 'Available') {
    return res.status(409).json({ message: `Unit "${unit.unitNo}" is already ${unit.status.toLowerCase()} and can't be booked again.` });
  }

  if (agentId) {
    const agent = await User.findOne({ where: { id: agentId, brokerId: req.brokerId, role: 'agent' } });
    if (!agent) return res.status(400).json({ message: 'Invalid agent.' });
  }

  const lead = await Lead.findOne({ where: { id: leadId, brokerId: req.brokerId } });
  if (!lead) return res.status(400).json({ message: 'Invalid lead/client.' });

  let validatedPlanId = null;
  if (paymentPlanId) {
    const plan = await PaymentPlan.findOne({ where: { id: paymentPlanId, projectId } });
    if (!plan) return res.status(400).json({ message: 'That payment plan does not belong to this project.' });
    validatedPlanId = plan.id;
  }

  // Selling Price is the actual/current market price this unit is being
  // booked for — defaults to the Unit Price (unit.totalPrice) when left
  // blank, but the broker/agent can override it (e.g. a negotiated discount
  // or premium). Every installment/payment figure is calculated from this,
  // not from Unit Price (see sellingPriceOf / generateBookingInstallments).
  let resolvedSellingPrice = unit.totalPrice;
  if (sellingPrice !== undefined && sellingPrice !== null && sellingPrice !== '') {
    const parsed = Number(sellingPrice);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ message: 'Selling Price must be a positive number.' });
    }
    resolvedSellingPrice = parsed;
  }

  // Amount (Unit Price) is ALWAYS the unit's current total price, taken
  // server-side — never trusted from the client, so it can't be tampered
  // with or drift from reality.
  const booking = await Booking.create({
    brokerId: req.brokerId, projectId, unitId, agentId, leadId, leadType, bookingDate,
    amount: unit.totalPrice, sellingPrice: resolvedSellingPrice, paymentPlanId: validatedPlanId, createdBy: req.user.id,
    bookingCode: await nextBookingCode(req.brokerId),
  });

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Booked unit "${unit.unitNo}" (${project.name}) for ${lead.customerName}`,
    relatedType: 'Project', relatedId: project.id,
  });

  await generateBookingInstallments(booking);

  // A unit with an active booking is no longer just "Available" — mark it
  // Booked immediately (payment progress later promotes it to Sold once every
  // installment is paid; see payInstallment). Never downgrade a unit that's
  // already fully Sold.
  if (unit.status !== 'Sold') await unit.update({ status: 'Booked' });

  const full = await Booking.findByPk(booking.id, { include: bookingInclude });
  res.status(201).json({ data: full });
}

// POST /api/bookings/:id/installments/:instId/pay
// Records a full payment against the CURRENT payable installment only — the
// earliest one that isn't already Paid must be Pending (unlocked); anything
// else (Locked, already Paid, or out of sequence) is rejected. On success, the
// next installment (if any) flips from Locked to Pending.
async function payInstallment(req, res) {
  const { paymentDate, paymentMethod, transactionRef, remarks, amount } = req.body;
  if (!paymentDate || !paymentMethod) {
    return res.status(400).json({ message: 'Payment Date and Payment Method are required.' });
  }
  if (amount === undefined || amount === null || amount === '' || Number.isNaN(Number(amount))) {
    return res.status(400).json({ message: 'Amount is required.' });
  }
  const validMethods = BookingInstallment.rawAttributes.paymentMethod.values;
  if (!validMethods.includes(paymentMethod)) {
    return res.status(400).json({ message: `Payment Method must be one of: ${validMethods.join(', ')}.` });
  }

  const booking = await Booking.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (!canManagePayments(req, booking)) {
    return res.status(403).json({ message: 'You can only record payments for your own bookings.' });
  }

  const installments = await BookingInstallment.findAll({ where: { bookingId: booking.id }, order: [['cycleNumber', 'ASC'], ['sequenceNumber', 'ASC']] });
  const target = installments.find((i) => i.id === req.params.instId);
  if (!target) return res.status(404).json({ message: 'Installment not found.' });

  // Must be exactly the earliest non-Paid installment — the same rule that
  // determines what's 'Pending' vs 'Locked' in the first place, re-checked here
  // server-side so this can never be bypassed by an out-of-date frontend state.
  const currentPayable = installments.find((i) => i.status !== 'Paid');
  if (!currentPayable || currentPayable.id !== target.id) {
    return res.status(409).json({ message: 'Installments must be paid in sequence — pay the earlier pending installment first.' });
  }
  if (target.status !== 'Pending') {
    return res.status(409).json({ message: 'This installment is not currently payable.' });
  }

  // The entered amount must exactly match this installment's own amount — never
  // less (partial payment) or more (overpayment isn't recorded against the next
  // installment automatically), so the schedule always stays exact and auditable.
  const expected = Number(target.amount);
  const entered = Number(amount);
  if (Math.abs(entered - expected) > 0.01) {
    return res.status(400).json({ message: `Amount must be exactly ₹${expected.toLocaleString('en-IN')} for this installment.` });
  }

  await target.update({
    status: 'Paid', paymentDate, paymentMethod,
    transactionRef: transactionRef || null, remarks: remarks || null, paidBy: req.user.id,
  });

  // Catch up a booking that was lagging behind when the broker last activated
  // this plan's next installment (see paymentPlanController.activateInstallment
  // — activating never blocks on a not-yet-ready booking, it just skips it for
  // now). Now that THIS installment is paid, check whether the very next one
  // is still sitting 'Locked' on this booking even though the plan's template
  // already has it 'Activated' for everyone else — if so, unlock it right now,
  // using the same date the broker originally set, instead of leaving this
  // booking stuck until the broker manually re-activates (which they can't:
  // an already-'Activated' row can't be re-activated).
  const next = installments.find((i) => i.cycleNumber === target.cycleNumber && i.sequenceNumber === target.sequenceNumber + 1);
  if (next && next.status === 'Locked') {
    const plan = booking.paymentPlanId ? await PaymentPlan.findByPk(booking.paymentPlanId) : null;
    if (plan && plan.currentCycle === target.cycleNumber) {
      const templateRow = await PaymentPlanInstallment.findOne({ where: { paymentPlanId: plan.id, sequenceNumber: next.sequenceNumber } });
      if (templateRow && templateRow.status === 'Activated') {
        await next.update({ status: 'Pending', dueDate: templateRow.activatedDate });
        if (booking.agentId) {
          await notifyAgent(req, booking.agentId, {
            title: 'Payment Action Required',
            message: `${next.name} (₹${Number(next.amount).toLocaleString('en-IN')}) is now due for booking ${booking.bookingCode || booking.id.slice(0, 8)} — last date ${templateRow.activatedDate}.`,
            link: `/agent/bookings/${booking.id}`,
          });
        }
      }
    }
  }

  // Every installment of THIS installment's own cycle fully paid -> the unit is
  // Sold, and the Lead this booking is for becomes a Client (stage 'Closed') —
  // this is what makes them show up on the Clients page, and flips this
  // booking's Type badge from Lead to Client. Only applies (a) the first time
  // this ever happens for the booking (cycle 1) — a later payment cycle
  // (see PaymentPlan.currentCycle / paymentPlanController.startNextCycle)
  // completing again doesn't re-fire this, the unit/lead are already
  // Sold/Client — and (b) only when it was booked against a Lead in the first
  // place; a booking already made against a Client has nothing to convert.
  const cycleInstallments = installments.filter((i) => i.cycleNumber === target.cycleNumber);
  const allPaidInCycle = cycleInstallments.every((i) => i.id === target.id || i.status === 'Paid');
  if (allPaidInCycle && target.cycleNumber === 1) {
    const unit = await Unit.findByPk(booking.unitId);
    if (unit && unit.status !== 'Sold') await unit.update({ status: 'Sold' });

    if (booking.leadType === 'Lead') {
      const lead = await Lead.findByPk(booking.leadId);
      if (lead && lead.stage !== 'Closed') {
        await lead.update({ stage: 'Closed' });
        await booking.update({ leadType: 'Client' });
        await logActivity({
          brokerId: req.brokerId, userId: req.user.id,
          action: `${lead.customerName} became a client — all installments paid on booking`,
          relatedType: 'Lead', relatedId: lead.id,
        });
      }
    }
  }

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Recorded payment of ${target.amount} for installment #${target.sequenceNumber} on booking`,
    relatedType: 'Project', relatedId: booking.projectId,
  });

  const full = await Booking.findByPk(booking.id, { include: detailInclude });
  res.json({ data: full });
}

// GET /api/bookings/payment-actions
// Powers the "Payment Action Required" dashboard widget. Shows two kinds of
// rows for every booking:
//  - Every 'Pending' (activated, unpaid, currently payable) installment.
//  - Every 'Locked' installment whose plan-wide template row the broker has
//    ALREADY activated (PaymentPlanInstallment.status === 'Activated') — this
//    booking just hasn't caught up to it yet because an earlier installment of
//    its own isn't paid. It doesn't matter that this booking is still behind;
//    once the broker has activated it for the plan, it belongs on this list
//    too. It'll flip to 'Pending' automatically the moment this booking
//    catches up (see payInstallment's auto-catch-up), but there's no reason to
//    hide it from view until then.
// A genuinely not-yet-activated 'Locked' installment (the broker hasn't
// touched it at all) is still never shown or notified — only ones the broker
// has actually turned on. A booking can have more than one row here at once.
// Broker: tenant-wide. Agent: only their own.
async function paymentActions(req, res) {
  const where = { brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const bookings = await Booking.findAll({
    where,
    include: [
      { model: Project, as: 'project', attributes: ['id', 'name'] },
      { model: Lead, as: 'lead', attributes: ['id', 'customerName', 'phone'] },
      { model: BookingInstallment, as: 'installments', where: { status: { [Op.in]: ['Pending', 'Locked'] } }, required: true, separate: true, order: [['sequenceNumber', 'ASC']] },
    ],
  });

  // Batch-load every relevant plan's template activation state once, keyed by
  // `${paymentPlanId}:${sequenceNumber}`, instead of a query per installment.
  const planIds = [...new Set(bookings.map((b) => b.paymentPlanId).filter(Boolean))];
  const templateRows = planIds.length ? await PaymentPlanInstallment.findAll({ where: { paymentPlanId: { [Op.in]: planIds } } }) : [];
  const activatedKeys = new Set(templateRows.filter((r) => r.status === 'Activated').map((r) => `${r.paymentPlanId}:${r.sequenceNumber}`));

  const rows = bookings.flatMap((b) => b.installments
    .filter((inst) => inst.status === 'Pending' || activatedKeys.has(`${b.paymentPlanId}:${inst.sequenceNumber}`))
    .map((inst) => ({
      bookingId: b.id,
      installmentId: inst.id,
      bookingCode: b.bookingCode || b.id.slice(0, 8).toUpperCase(),
      customerName: b.lead?.customerName,
      customerPhone: b.lead?.phone,
      projectName: b.project?.name,
      milestone: inst.milestone,
      installmentName: inst.name,
      installmentNumber: inst.sequenceNumber,
      amount: inst.amount,
      status: inst.status,
      // The 1st installment is Pending immediately from booking (no broker
      // activation involved, so no meaningful "last date" yet). Every later
      // installment's date is exactly what the broker set when activating it.
      lastDate: inst.sequenceNumber > 1 ? inst.dueDate : null,
    })));

  res.json({ data: rows, count: rows.length });
}

// DELETE /api/bookings/:id  (Broker only)
async function remove(req, res) {
  const booking = await Booking.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  await booking.destroy();
  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: 'Deleted a booking', relatedType: 'Project', relatedId: booking.projectId,
  });

  res.json({ message: 'Booking deleted.' });
}

// One-time startup backfill (see server.js) — covers bookings that reached
// "every installment Paid" before the auto-conversion in payInstallment above
// existed, or any that slipped through some other path. Finds every booking
// still labelled leadType='Lead' whose installments are all Paid, and converts
// the Lead to a Client (stage 'Closed') + flips the booking's own Type badge,
// exactly like a fresh final payment would.
async function backfillFullyPaidLeadConversions() {
  const bookings = await Booking.findAll({
    where: { leadType: 'Lead' },
    include: [{ model: BookingInstallment, as: 'installments', separate: true }],
  });

  let converted = 0;
  for (const booking of bookings) {
    const cycle1 = booking.installments.filter((i) => i.cycleNumber === 1);
    if (!cycle1.length) continue;
    const allPaid = cycle1.every((i) => i.status === 'Paid');
    if (!allPaid) continue;

    const lead = await Lead.findByPk(booking.leadId);
    if (!lead || lead.stage === 'Closed') continue;

    await lead.update({ stage: 'Closed' });
    await booking.update({ leadType: 'Client' });
    converted += 1;
  }
  if (converted) console.log(`✓ Backfilled ${converted} lead(s) to Client status (fully paid bookings).`);
}

module.exports = { list, getOne, leadOptions, bookableProjects, enums, create, payInstallment, paymentActions, remove, backfillFullyPaidLeadConversions };
