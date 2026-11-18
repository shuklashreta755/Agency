const { Op } = require('sequelize');
const { PaymentPlan, PaymentPlanInstallment, Project, Unit, Booking, BookingInstallment, User } = require('../models');
const { logActivity } = require('../utils/activityLogger');
const { validatePlanPayload } = require('../utils/paymentPlanValidation');
const { notifyAgent } = require('../utils/notify');
const { advanceError } = require('../utils/installmentMoney');

const planInclude = [
  { model: PaymentPlanInstallment, as: 'installments', separate: true, order: [['sequenceNumber', 'ASC']] },
];

async function getAccessibleProject(req, projectId) {
  return Project.findOne({ where: { id: projectId, brokerId: req.brokerId } });
}

// GET /api/projects/:id/payment-plans  (Broker only)
// Powers the Add Unit form's Payment Plan picker AND the Project Details ->
// Payment Plans tab — only THIS project's plans, loaded fresh every time.
// Each plan is enriched with its live cycle-completion status: `cycleCompleted`
// is true once every booking that's actually PART OF the plan's CURRENT cycle
// (i.e. has installment rows with cycleNumber = PaymentPlan.currentCycle) has
// fully paid all of them. Bookings from a previous, already-finished cycle are
// deliberately excluded from this check — see startNextCycle below, they never
// get rows on a new cycle, so they'd otherwise wrongly block it forever. A plan
// with no bookings in its current cycle yet is never "completed" — there's
// nothing to have finished.
async function list(req, res) {
  const project = await getAccessibleProject(req, req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const plans = await PaymentPlan.findAll({
    where: { projectId: project.id },
    order: [['createdAt', 'ASC']],
  });

  // Load installment rows ourselves and attach them by paymentPlanId.
  // Eager-loading every plan's installments in one include was handing Plan 2
  // Plan 1's rows (and the other way around) on the Add Unit preview.
  const installmentRows = plans.length
    ? await PaymentPlanInstallment.findAll({
      where: { paymentPlanId: { [Op.in]: plans.map((p) => p.id) } },
      order: [['sequenceNumber', 'ASC']],
    })
    : [];
  const installmentsByPlan = new Map();
  for (const row of installmentRows) {
    const key = String(row.paymentPlanId);
    if (!installmentsByPlan.has(key)) installmentsByPlan.set(key, []);
    installmentsByPlan.get(key).push(row.toJSON());
  }

  const data = await Promise.all(plans.map(async (plan) => {
    const bookings = await Booking.findAll({
      where: { paymentPlanId: plan.id },
      include: [{ model: BookingInstallment, as: 'installments', where: { cycleNumber: plan.currentCycle }, required: false }],
    });
    const cycleBookings = bookings.filter((b) => b.installments.length > 0); // only bookings actually on the CURRENT cycle
    const cycleCompleted = cycleBookings.length > 0 && cycleBookings.every((b) => b.installments.every((i) => i.status === 'Paid'));
    return {
      ...plan.toJSON(),
      installments: installmentsByPlan.get(String(plan.id)) || [],
      cycleBookingsCount: cycleBookings.length,
      cycleCompleted,
    };
  }));

  res.json({ data });
}

// POST /api/projects/:id/payment-plans  (Broker only)
async function create(req, res) {
  const project = await getAccessibleProject(req, req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const error = validatePlanPayload(req.body);
  if (error) return res.status(400).json({ message: error });

  const plan = await PaymentPlan.create({ projectId: project.id, brokerId: req.brokerId, name: req.body.name.trim() });
  await PaymentPlanInstallment.bulkCreate(req.body.installments.map((row, i) => ({
    paymentPlanId: plan.id,
    sequenceNumber: i + 1,
    name: row.name.trim(),
    milestone: row.milestone.trim(),
    percentage: Number(row.percentage),
  })));

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Created payment plan "${plan.name}" (${req.body.installments.length} installments) for project "${project.name}"`,
    relatedType: 'Project', relatedId: project.id,
  });

  const full = await PaymentPlan.findByPk(plan.id, { include: planInclude });
  res.status(201).json({ data: full });
}

// PUT /api/payment-plans/:id  (Broker only)
// Replaces the plan's name + installment rows. Any unit already using this plan
// has its installment schedule regenerated to match, so nothing goes stale.
async function update(req, res) {
  const plan = await PaymentPlan.findOne({
    where: { id: req.params.id },
    include: [{ model: Project, as: 'project', where: { brokerId: req.brokerId } }],
  });
  if (!plan) return res.status(404).json({ message: 'Payment plan not found.' });

  const error = validatePlanPayload(req.body);
  if (error) return res.status(400).json({ message: error });

  // A smaller first installment must still be able to absorb each unit's advance.
  const newFirstPct = Number(req.body.installments[0].percentage);
  const unitsOnPlan = await Unit.findAll({ where: { paymentPlanId: plan.id } });
  for (const unit of unitsOnPlan) {
    const advErr = advanceError(unit.totalPrice, newFirstPct, unit.advanceAmount);
    if (advErr) return res.status(400).json({ message: `Unit "${unit.unitNo}": ${advErr}` });
  }

  await plan.update({ name: req.body.name.trim() });
  await PaymentPlanInstallment.destroy({ where: { paymentPlanId: plan.id } });
  await PaymentPlanInstallment.bulkCreate(req.body.installments.map((row, i) => ({
    paymentPlanId: plan.id,
    sequenceNumber: i + 1,
    name: row.name.trim(),
    milestone: row.milestone.trim(),
    percentage: Number(row.percentage),
  })));

  // Keep every unit already on this plan in sync with the edited schedule.
  const { generateInstallments } = require('./unitController');
  const units = await Unit.findAll({ where: { paymentPlanId: plan.id } });
  for (const unit of units) await generateInstallments(unit);

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Updated payment plan "${plan.name}"`, relatedType: 'Project', relatedId: plan.projectId,
  });

  const full = await PaymentPlan.findByPk(plan.id, { include: planInclude });
  res.json({ data: full });
}

// DELETE /api/payment-plans/:id  (Broker only)
// Blocked if any unit currently uses this plan — the broker must reassign
// those units' payment plan first.
async function remove(req, res) {
  const plan = await PaymentPlan.findOne({
    where: { id: req.params.id },
    include: [{ model: Project, as: 'project', where: { brokerId: req.brokerId } }],
  });
  if (!plan) return res.status(404).json({ message: 'Payment plan not found.' });

  const inUseCount = await Unit.count({ where: { paymentPlanId: plan.id } });
  if (inUseCount > 0) {
    return res.status(409).json({ message: `This plan is used by ${inUseCount} unit${inUseCount === 1 ? '' : 's'}. Reassign those units' payment plan before deleting it.` });
  }

  const name = plan.name;
  const projectId = plan.projectId;
  await plan.destroy();

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Deleted payment plan "${name}"`, relatedType: 'Project', relatedId: projectId,
  });

  res.json({ message: 'Payment plan deleted.' });
}

// POST /api/payment-plans/:id/installments/:sequenceNumber/activate  (Broker only)
// The broker picks ONE installment row from this specific Payment Plan (never
// the 1st — that's always auto-active from booking creation) and a "last date"
// for it. This activates (Locked -> Pending) that exact installment ONLY for
// bookings that use THIS specific paymentPlanId — never every booking in the
// project, since different units/bookings can be on entirely different plans.
//
// NOT gated on every booking being ready: a booking whose previous installment
// isn't Paid yet is simply skipped for now (never blocks the broker from
// activating for everyone else who IS ready). That lagging booking isn't stuck
// forever either — see payInstallment below, which auto-promotes a booking's
// next installment the moment its previous one gets paid, IF that next
// installment's template row is already 'Activated'. So activating here is a
// one-time, plan-wide decision; every booking benefits from it as soon as it's
// eligible, whether that's right now or later.
//
// The activation itself is a ONE-TIME, persistent event on the plan template
// row (PaymentPlanInstallment.status/activatedDate) — calling this again for
// an installment that's already 'Activated' is refused (409) rather than
// silently re-running (which used to report a confusing "0 bookings" every
// time on a plan with nothing left, or none at all, to activate). It doesn't
// need to be re-run for laggards to catch up — see payInstallment.
//
// Only the assigned agents of the bookings actually activated right now are
// notified here — a laggard's agent is notified later, at the moment their
// booking auto-catches-up (see payInstallment). Because everything here is
// scoped to `plan.currentCycle` (see currentCycleRows below), a booking that
// already finished a previous cycle has no rows on this cycle at all — it's
// structurally excluded, every time.
async function activateInstallment(req, res) {
  const sequenceNumber = Number(req.params.sequenceNumber);
  const { date } = req.body;
  if (!date) return res.status(400).json({ message: 'A date is required to activate this installment.' });
  if (!sequenceNumber || sequenceNumber < 2) {
    return res.status(400).json({ message: 'Only the 2nd installment onward can be manually activated — the 1st is always active from booking.' });
  }

  const plan = await PaymentPlan.findOne({
    where: { id: req.params.id },
    include: [{ model: Project, as: 'project', where: { brokerId: req.brokerId } }, { model: PaymentPlanInstallment, as: 'installments' }],
  });
  if (!plan) return res.status(404).json({ message: 'Payment plan not found.' });

  const templateRow = plan.installments.find((r) => r.sequenceNumber === sequenceNumber);
  if (!templateRow) return res.status(404).json({ message: `This plan has no installment #${sequenceNumber}.` });
  if (templateRow.status === 'Activated') {
    return res.status(409).json({ message: `"${templateRow.name}" was already activated on ${templateRow.activatedDate}.` });
  }

  // Scoped to exactly this plan's bookings — the core fix: never project-wide.
  const bookings = await Booking.findAll({
    where: { paymentPlanId: plan.id },
    include: [{ model: BookingInstallment, as: 'installments' }],
  });

  // A booking can hold rows from more than one payment cycle (see
  // PaymentPlan.currentCycle / startNextCycle below) — always scope to the
  // plan's CURRENT cycle so we never confuse a past cycle's row with this
  // one's, since sequenceNumber restarts at 1 every cycle.
  const currentCycleRows = (installments) => installments.filter((i) => i.cycleNumber === plan.currentCycle).sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  let activatedCount = 0;
  for (const booking of bookings) {
    const installments = currentCycleRows(booking.installments);
    const target = installments.find((i) => i.sequenceNumber === sequenceNumber);
    if (!target || target.status !== 'Locked') continue; // already activated (or Paid) — nothing to do

    const prev = installments.find((i) => i.sequenceNumber === sequenceNumber - 1);
    const prevPaid = !prev || prev.status === 'Paid';
    if (!prevPaid) continue; // not ready yet — skip it, don't block everyone else; it'll auto-catch-up later (see payInstallment)

    await target.update({ status: 'Pending', dueDate: date });
    activatedCount += 1;

    if (booking.agentId) {
      await notifyAgent(req, booking.agentId, {
        title: 'Payment Action Required',
        message: `${target.name} (₹${Number(target.amount).toLocaleString('en-IN')}) is now due for booking ${booking.bookingCode || booking.id.slice(0, 8)} — last date ${date}.`,
        link: `/agent/bookings/${booking.id}`,
      });
    }
  }

  // Persist the activation on the plan template itself — this is what makes
  // "Activated on <date>" durable and correct even for a plan with zero
  // bookings right now, and what every future booking on this plan will
  // inherit from (see bookingController.generateBookingInstallments).
  await templateRow.update({ status: 'Activated', activatedDate: date });

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Activated "${templateRow.name}" (installment #${sequenceNumber}) on plan "${plan.name}" — ${activatedCount} booking${activatedCount === 1 ? '' : 's'} affected`,
    relatedType: 'Project', relatedId: plan.projectId,
  });

  res.json({ activatedCount, activatedDate: date, message: `Activated for ${activatedCount} booking${activatedCount === 1 ? '' : 's'} on this plan.` });
}

// POST /api/payment-plans/:id/next-cycle  (Broker only)
// Payment Plan Cycle Reset — only callable once every booking that's actually
// part of the CURRENT cycle has fully paid every installment of it (mirrors
// the `cycleCompleted` flag from list() above; re-checked here server-side).
// Bumps PaymentPlan.currentCycle and resets every PaymentPlanInstallment
// template row back to 'Locked' (a fresh 1st -> Nth activation sequence,
// exactly like the plan's very first cycle) so the broker activates them
// again one at a time.
//
// Deliberately does NOT touch any existing booking — a booking that already
// completed a cycle stays exactly as it is (fully paid, done); it never gets
// installment rows on the new cycle, is never notified about it, and is
// excluded from every future activation/completion check for this plan (see
// list() and bookingController.payInstallment/activateInstallment, which all
// scope strictly by cycleNumber). ONLY a booking created FROM THIS POINT ON
// gets the new cycle — automatically, the normal way, via
// generateBookingInstallments reading PaymentPlan.currentCycle live at
// booking time.
async function startNextCycle(req, res) {
  const plan = await PaymentPlan.findOne({
    where: { id: req.params.id },
    include: [{ model: Project, as: 'project', where: { brokerId: req.brokerId } }, { model: PaymentPlanInstallment, as: 'installments' }],
  });
  if (!plan) return res.status(404).json({ message: 'Payment plan not found.' });
  if (!plan.installments.length) return res.status(400).json({ message: 'This plan has no installments to start a new cycle for.' });

  const bookings = await Booking.findAll({
    where: { paymentPlanId: plan.id },
    include: [{ model: BookingInstallment, as: 'installments', where: { cycleNumber: plan.currentCycle }, required: false }],
  });
  const cycleBookings = bookings.filter((b) => b.installments.length > 0); // only bookings actually on the CURRENT cycle
  if (cycleBookings.length === 0) {
    return res.status(409).json({ message: "No bookings are using this plan's current cycle yet — nothing to complete." });
  }
  const allComplete = cycleBookings.every((b) => b.installments.every((i) => i.status === 'Paid'));
  if (!allComplete) {
    return res.status(409).json({ message: "The current cycle isn't finished yet — every booking on it must fully pay all installments first." });
  }

  const newCycle = plan.currentCycle + 1;
  await plan.update({ currentCycle: newCycle });

  // Reset the template's activation state so the new cycle activates the same
  // way the first one did — the 1st is never persisted here, it's implicit.
  const templateRows = plan.installments.slice().sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  for (const row of templateRows) {
    if (row.sequenceNumber === 1) continue;
    await row.update({ status: 'Locked', activatedDate: null });
  }

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Started payment cycle #${newCycle} on plan "${plan.name}" — applies to new bookings on this plan only`,
    relatedType: 'Project', relatedId: plan.projectId,
  });

  const full = await PaymentPlan.findByPk(plan.id, { include: planInclude });
  res.json({ data: full, message: `Cycle ${newCycle} started. It won't change any existing booking — only new bookings made on this plan from now on will follow it.` });
}

module.exports = { list, create, update, remove, activateInstallment, startNextCycle };
