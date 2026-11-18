const { Op } = require('sequelize');
const { Unit, UnitImage, Installment, Project, PaymentPlan, PaymentPlanInstallment } = require('../models');
const { rememberFeatures } = require('./unitFeatureController');
const { logActivity } = require('../utils/activityLogger');
const { installmentAmount, advanceError, firstPlanPercentage } = require('../utils/installmentMoney');

const unitInclude = [
  { model: UnitImage, as: 'images' },
  { model: Installment, as: 'installments', separate: true, order: [['installmentNumber', 'ASC']] },
  { model: PaymentPlan, as: 'paymentPlanRef', attributes: ['id', 'name'] },
];

// Generates the unit's real, dated Installment schedule from its Payment Plan:
// - If the unit references a project Payment Plan, copy each of that plan's
//   rows (Name, Milestone, Percentage) — never hardcoded, always the broker's
//   own saved plan data.
// - Otherwise (no plan selected) fall back to a single 100% "Full Payment"
//   installment, due immediately — the same default this app has always had.
// Due dates are spaced 30 days apart starting today, since a plan's rows only
// define a milestone/condition (e.g. "On Booking"), not a calendar date.
// The first installment's amount is the plan percentage minus this unit's
// advance (see installmentAmount). Later rows are not reduced.
async function generateInstallments(unit) {
  await Installment.destroy({ where: { unitId: unit.id } });

  let rows = null;
  if (unit.paymentPlanId) {
    const plan = await PaymentPlan.findByPk(unit.paymentPlanId, {
      include: [{ model: PaymentPlanInstallment, as: 'installments', separate: true, order: [['sequenceNumber', 'ASC']] }],
    });
    if (plan && plan.installments.length) {
      rows = plan.installments.map((r) => ({ name: r.name, milestone: r.milestone, percentage: Number(r.percentage) }));
    }
  }
  if (!rows) rows = [{ name: 'Full Payment', milestone: 'On Booking', percentage: 100 }];

  const today = new Date();
  await Installment.bulkCreate(rows.map((r, i) => {
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + i * 30);
    return {
      unitId: unit.id,
      installmentNumber: i + 1,
      name: r.name,
      milestone: r.milestone,
      dueDate: dueDate.toISOString().slice(0, 10),
      percentage: r.percentage,
      amount: installmentAmount(unit.totalPrice, r.percentage, i === 0, unit.advanceAmount),
    };
  }));
}

// Recomputes each installment's `amount` from the unit's current totalPrice.
// Percentage and status stay as they are. Installment 1 is still net of advance.
async function recalculateInstallmentAmounts(unit) {
  const installments = await Installment.findAll({ where: { unitId: unit.id } });
  await Promise.all(installments.map((inst) => inst.update({
    amount: installmentAmount(unit.totalPrice, inst.percentage, inst.installmentNumber === 1, unit.advanceAmount),
  })));
}

async function getAccessibleProject(req, projectId) {
  const project = await Project.findOne({ where: { id: projectId, brokerId: req.brokerId } });
  if (!project) return null;
  if (req.user.role === 'agent') {
    const { agentHasProjectAccess } = require('../utils/agentProjectAccess');
    const ok = await agentHasProjectAccess(req.user.id, projectId);
    if (!ok) return null;
  }
  return project;
}

// GET /api/projects/:id/units — broker sees every unit; agent sees only Available ones.
async function list(req, res) {
  const project = await getAccessibleProject(req, req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const where = { projectId: project.id };
  // Agents always only see Available units here (existing behavior). Any
  // caller — broker included — can also explicitly ask for Available-only via
  // ?status=Available, e.g. the Add Booking form's Unit field, which should
  // never offer a unit that's already Booked or Sold.
  if (req.user.role === 'agent' || req.query.status === 'Available') where.status = 'Available';

  const units = await Unit.findAll({
    where,
    include: req.user.role === 'broker' ? unitInclude : [{ model: UnitImage, as: 'images' }],
    order: [['unitNo', 'ASC']],
  });
  res.json({ data: units });
}

// GET /api/units/:id — broker: full detail incl. installments. Agent: only if the
// unit is Available, and installment schedule is withheld (broker-only per spec).
async function getOne(req, res) {
  const unit = await Unit.findOne({
    where: { id: req.params.id, brokerId: req.brokerId },
    include: unitInclude,
  });
  if (!unit) return res.status(404).json({ message: 'Unit not found.' });

  if (req.user.role === 'agent') {
    if (unit.status !== 'Available') return res.status(403).json({ message: 'This unit is not available.' });
    const data = unit.toJSON();
    delete data.installments;
    return res.json({ data });
  }
  res.json({ data: unit });
}

// POST /api/projects/:id/units  (Broker only)
async function create(req, res) {
  const project = await Project.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const { unitNo, unitType, features, sizeSqft, basicPrice, totalPrice, advanceAmount, paymentPlanId, description, status } = req.body;
  if (!unitNo || !unitType || !totalPrice) {
    return res.status(400).json({ message: 'Unit No., Unit Type and Total Price are required.' });
  }

  const remembered = await rememberFeatures(features, req.brokerId);
  if (remembered.error) return res.status(400).json({ message: remembered.error });
  const featureList = remembered.features;

  // A unit's payment plan must belong to its own project — never another
  // project's plan, and never a hardcoded/free-typed value.
  let validatedPlanId = null;
  if (paymentPlanId) {
    const plan = await PaymentPlan.findOne({ where: { id: paymentPlanId, projectId: project.id } });
    if (!plan) return res.status(400).json({ message: 'That payment plan does not belong to this project.' });
    validatedPlanId = plan.id;
  }

  const advance = advanceAmount === undefined || advanceAmount === null || advanceAmount === '' ? 0 : Number(advanceAmount);
  const advErr = advanceError(totalPrice, await firstPlanPercentage(validatedPlanId), advance);
  if (advErr) return res.status(400).json({ message: advErr });

  const unit = await Unit.create({
    projectId: project.id, brokerId: req.brokerId, unitNo, unitType, features: featureList,
    // Basic Price is no longer collected on the Add Unit form — it defaults to
    // Total Price and can be fine-tuned afterward via the unit's Pricing edit or
    // Bulk Price Update, both of which still manage it as a distinct value.
    sizeSqft, basicPrice: basicPrice || totalPrice, totalPrice, advanceAmount: advance,
    paymentPlanId: validatedPlanId, description, status: status || 'Available',
  });

  if (req.files?.length) {
    await UnitImage.bulkCreate(req.files.map((f) => ({ unitId: unit.id, url: `/uploads/units/${f.filename}` })));
  }

  await generateInstallments(unit);

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Added unit "${unitNo}" to project "${project.name}"`, relatedType: 'Project', relatedId: project.id,
  });

  const full = await Unit.findByPk(unit.id, { include: unitInclude });
  res.status(201).json({ data: full });
}

// PUT /api/units/:id  (Broker only) — full edit, excluding pricing fields
// (use PATCH /units/:id/pricing for basicPrice/totalPrice/advanceAmount).
async function update(req, res) {
  const unit = await Unit.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!unit) return res.status(404).json({ message: 'Unit not found.' });

  const { unitNo, unitType, features, sizeSqft, paymentPlanId, description, status } = req.body;
  let featureList;
  if (features !== undefined) {
    const remembered = await rememberFeatures(features, req.brokerId);
    if (remembered.error) return res.status(400).json({ message: remembered.error });
    featureList = remembered.features;
  }

  let validatedPlanId;
  if (paymentPlanId !== undefined) {
    if (!paymentPlanId) {
      validatedPlanId = null; // explicit reset to the "Full Payment" fallback
    } else {
      const plan = await PaymentPlan.findOne({ where: { id: paymentPlanId, projectId: unit.projectId } });
      if (!plan) return res.status(400).json({ message: 'That payment plan does not belong to this project.' });
      validatedPlanId = plan.id;
    }
    const advErr = advanceError(unit.totalPrice, await firstPlanPercentage(validatedPlanId), unit.advanceAmount);
    if (advErr) return res.status(400).json({ message: advErr });
  }

  const prevPlanId = unit.paymentPlanId;
  await unit.update({
    ...(unitNo !== undefined && { unitNo }),
    ...(unitType !== undefined && { unitType }),
    ...(features !== undefined && { features: featureList }),
    ...(sizeSqft !== undefined && { sizeSqft }),
    ...(paymentPlanId !== undefined && { paymentPlanId: validatedPlanId }),
    ...(description !== undefined && { description }),
    ...(status !== undefined && { status }),
  });

  if (req.files?.length) {
    await UnitImage.bulkCreate(req.files.map((f) => ({ unitId: unit.id, url: `/uploads/units/${f.filename}` })));
  }

  // Payment plan changed → the old schedule no longer applies, regenerate it.
  if (paymentPlanId !== undefined && validatedPlanId !== prevPlanId) {
    await generateInstallments(unit);
  }

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Updated unit "${unit.unitNo}"`, relatedType: 'Project', relatedId: unit.projectId,
  });

  const full = await Unit.findByPk(unit.id, { include: unitInclude });
  res.json({ data: full });
}

// PATCH /api/units/:id/pricing  (Broker only)
// The only endpoint allowed to change basicPrice/totalPrice/advanceAmount — updating
// totalPrice automatically recalculates every installment's amount to match.
async function updatePricing(req, res) {
  const unit = await Unit.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!unit) return res.status(404).json({ message: 'Unit not found.' });

  const { basicPrice, totalPrice, advanceAmount } = req.body;
  const prevTotal = Number(unit.totalPrice);
  const prevAdvance = Number(unit.advanceAmount);
  const nextTotal = totalPrice !== undefined ? Number(totalPrice) : prevTotal;
  const nextAdvance = advanceAmount !== undefined && advanceAmount !== '' ? Number(advanceAmount) : prevAdvance;
  const advErr = advanceError(nextTotal, await firstPlanPercentage(unit.paymentPlanId), nextAdvance);
  if (advErr) return res.status(400).json({ message: advErr });

  await unit.update({
    ...(basicPrice !== undefined && { basicPrice }),
    ...(totalPrice !== undefined && { totalPrice }),
    ...(advanceAmount !== undefined && { advanceAmount: nextAdvance }),
  });

  if (nextTotal !== prevTotal || nextAdvance !== prevAdvance) {
    await recalculateInstallmentAmounts(unit);
  }

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Updated pricing for unit "${unit.unitNo}"`, relatedType: 'Project', relatedId: unit.projectId,
  });

  const full = await Unit.findByPk(unit.id, { include: unitInclude });
  res.json({ data: full });
}

// DELETE /api/units/:id  (Broker only)
async function remove(req, res) {
  const unit = await Unit.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!unit) return res.status(404).json({ message: 'Unit not found.' });

  await unit.destroy();
  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Deleted unit "${unit.unitNo}"`, relatedType: 'Project', relatedId: unit.projectId,
  });
  res.json({ message: 'Unit deleted.' });
}

// POST /api/projects/:id/units/bulk-price-preview  (Broker only) — no DB changes.
async function bulkPricePreview(req, res) {
  const project = await Project.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const { feature, percentage } = req.body;
  if (!feature || percentage === undefined) return res.status(400).json({ message: 'A feature and a percentage are required.' });

  const units = await Unit.findAll({ where: { projectId: project.id, features: { [Op.contains]: [feature] } } });
  const pct = Number(percentage);
  const preview = units.map((u) => ({
    id: u.id, unitNo: u.unitNo,
    currentBasicPrice: Number(u.basicPrice), newBasicPrice: Number((Number(u.basicPrice) * (1 + pct / 100)).toFixed(2)),
    currentTotalPrice: Number(u.totalPrice), newTotalPrice: Number((Number(u.totalPrice) * (1 + pct / 100)).toFixed(2)),
  }));
  res.json({ data: preview, count: preview.length });
}

// POST /api/projects/:id/units/bulk-price-apply  (Broker only)
async function bulkPriceApply(req, res) {
  const project = await Project.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const { feature, percentage } = req.body;
  if (!feature || percentage === undefined) return res.status(400).json({ message: 'A feature and a percentage are required.' });

  const units = await Unit.findAll({
    where: { projectId: project.id, features: { [Op.contains]: [feature] } },
    include: [{ model: Installment, as: 'installments' }],
  });
  const pct = Number(percentage);

  const priced = units.map((unit) => {
    const newTotal = Number((Number(unit.totalPrice) * (1 + pct / 100)).toFixed(2));
    const first = (unit.installments || []).find((inst) => inst.installmentNumber === 1);
    const err = first ? advanceError(newTotal, first.percentage, unit.advanceAmount) : null;
    return { unit, newTotal, err };
  });
  const blocked = priced.find((row) => row.err);
  if (blocked) return res.status(400).json({ message: `Unit "${blocked.unit.unitNo}": ${blocked.err}` });

  for (const { unit, newTotal } of priced) {
    const newBasic = Number((Number(unit.basicPrice) * (1 + pct / 100)).toFixed(2));
    await unit.update({ basicPrice: newBasic, totalPrice: newTotal });
    await recalculateInstallmentAmounts(unit);
  }

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Bulk-updated prices for ${units.length} unit(s) with "${feature}" (${pct > 0 ? '+' : ''}${pct}%)`,
    relatedType: 'Project', relatedId: project.id,
  });

  res.json({ message: `Updated ${units.length} unit(s).`, count: units.length });
}

// PATCH /api/installments/:id  (Broker only) — mark an installment Paid/Pending/Overdue.
async function updateInstallmentStatus(req, res) {
  const installment = await Installment.findOne({
    include: [{ model: Unit, as: 'unit', where: { brokerId: req.brokerId } }],
    where: { id: req.params.id },
  });
  if (!installment) return res.status(404).json({ message: 'Installment not found.' });

  const { status } = req.body;
  await installment.update({ status });
  res.json({ data: installment });
}

module.exports = { list, getOne, create, update, updatePricing, remove, bulkPricePreview, bulkPriceApply, updateInstallmentStatus, generateInstallments };
