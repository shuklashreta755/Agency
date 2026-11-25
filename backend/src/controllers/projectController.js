const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Project, AgentProject, User, Unit, PaymentPlan, PaymentPlanInstallment, Booking, BookingInstallment, Lead, LocalAddress, Builder } = require('../models');
const { logActivity } = require('../utils/activityLogger');
const { validatePlanPayload } = require('../utils/paymentPlanValidation');

// Keeps the broker's Local Address "memory" (see models/LocalAddress.js) in
// sync with whatever addresses a project was just saved with, so they show up
// as autocomplete suggestions for this city on every future project — even if
// they came from the Local Addresses field's plain Enter/Add flow rather than
// its own save-to-DB call, and even for projects created before this table
// existed. Best-effort: never blocks or fails the project save.
async function rememberLocalAddresses(brokerId, city, addresses) {
  if (!city || !addresses.length) return;
  try {
    for (const address of addresses) {
      const existing = await LocalAddress.findOne({ where: { brokerId, city, address: { [Op.iLike]: address } } });
      if (!existing) await LocalAddress.create({ brokerId, city, address });
    }
  } catch (err) {
    console.error('Could not save local address suggestions:', err.message);
  }
}

// Same idea as rememberLocalAddresses, but for the Builder Name field (see
// models/Builder.js) — keeps the broker's Builder Name autocomplete list in
// sync with whatever builder a project was just saved with. Best-effort:
// never blocks or fails the project save.
async function rememberBuilder(brokerId, builderName) {
  const name = (builderName || '').trim();
  if (!name) return;
  try {
    const existing = await Builder.findOne({ where: { brokerId, name: { [Op.iLike]: name } } });
    if (!existing) await Builder.create({ brokerId, name });
  } catch (err) {
    console.error('Could not save builder suggestion:', err.message);
  }
}

// HTML number/date inputs submit an empty optional field as ''. PostgreSQL
// rejects that for DECIMAL/DATE columns, so persist a real NULL instead.
const optionalValue = (value) => (
  value === undefined || value === null || value === '' ? null : value
);

// GET /api/projects
// Broker: every project in the tenant. Agent: only projects they've been assigned to.
async function list(req, res) {
  const { status, search, page = 1, limit = 20 } = req.query;
  const where = { brokerId: req.brokerId };
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { city: { [Op.iLike]: `%${search}%` } },
      { builderName: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (Number(page) - 1) * Number(limit);

  if (req.user.role === 'agent') {
    const links = await AgentProject.findAll({ where: { agentId: req.user.id }, attributes: ['projectId'] });
    const projectIds = links.map((l) => l.projectId);
    where.id = { [Op.in]: projectIds.length ? projectIds : ['00000000-0000-0000-0000-000000000000'] };
  }

  const { rows, count } = await Project.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Number(limit),
    offset,
  });

  res.json({ data: rows, total: count, page: Number(page), limit: Number(limit) });
}

// GET /api/projects/:id
async function getOne(req, res) {
  const project = await Project.findOne({
    where: { id: req.params.id, brokerId: req.brokerId },
    include: [{ model: User, as: 'assignedAgents', attributes: ['id', 'name', 'phone'], through: { attributes: [] } }],
  });
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  if (req.user.role === 'agent') {
    const isAssigned = await AgentProject.findOne({ where: { agentId: req.user.id, projectId: project.id } });
    if (!isAssigned) return res.status(403).json({ message: 'You are not assigned to this project.' });
  }

  const [total, available, sold, booked] = await Promise.all([
    Unit.count({ where: { projectId: project.id } }),
    Unit.count({ where: { projectId: project.id, status: 'Available' } }),
    Unit.count({ where: { projectId: project.id, status: 'Sold' } }),
    Unit.count({ where: { projectId: project.id, status: 'Booked' } }),
  ]);

  res.json({
    data: project,
    unitSummary: {
      totalUnits: total, availableUnits: available, soldUnits: sold,
      bookedOrOnHoldUnits: booked, bookedUnits: booked,
    },
  });
}

// Every project needs a payment plan to actually generate booking installment
// schedules against — if the broker doesn't add a custom one on the Add
// Project form, this exact plan is created for them instead, through the
// SAME code path below (PaymentPlan.create + PaymentPlanInstallment.bulkCreate),
// so it is a completely ordinary payment plan afterward: editable, activatable
// per-row, usable on units/bookings — indistinguishable from one the broker
// typed in by hand.
const DEFAULT_PAYMENT_PLAN = {
  name: '5 Installment',
  installments: [
    { name: '1st Installment', milestone: 'On Booking', percentage: 20 },
    { name: '2nd Installment', milestone: 'Starting of Development', percentage: 10 },
    { name: '3rd Installment', milestone: 'Foundation Completed', percentage: 30 },
    { name: '4th Installment', milestone: 'Structure Completed', percentage: 20 },
    { name: '5th Installment', milestone: 'Completion of Development', percentage: 20 },
  ],
};

// POST /api/projects  (Broker only)
// Payment Installment Plans are entered directly on this same "Add Project"
// form (not a separate step) — `paymentPlans` is an optional array of
// { name, installments: [{ name, milestone, percentage }] }. Every plan is
// validated (percentages must total 100%) BEFORE the project is created, so a
// bad plan never leaves a project half-saved. If the broker leaves this empty,
// DEFAULT_PAYMENT_PLAN above is used instead (see plansPayload).
async function create(req, res) {
  const { name, builderName, projectType, reraNumber, launchDate, possessionDate, description, country, state, city, address, localAddresses, minPrice, maxPrice, status, latitude, longitude, paymentPlans } = req.body;
  if (!name || !city) return res.status(400).json({ message: 'Name and city are required.' });

  const plansPayload = Array.isArray(paymentPlans) && paymentPlans.length ? paymentPlans : [DEFAULT_PAYMENT_PLAN];
  for (const plan of plansPayload) {
    const error = validatePlanPayload(plan);
    if (error) return res.status(400).json({ message: `Payment plan "${plan.name || 'Untitled'}": ${error}` });
  }

  const localAddressList = Array.isArray(localAddresses) ? localAddresses.filter((a) => a && a.trim()) : [];

  const project = await Project.create({
    brokerId: req.brokerId, name, builderName, projectType, reraNumber,
    launchDate: optionalValue(launchDate), possessionDate: optionalValue(possessionDate),
    description, country, state, city, address: address || localAddressList.join(', ') || null,
    localAddresses: localAddressList,
    minPrice: optionalValue(minPrice), maxPrice: optionalValue(maxPrice), status,
    latitude: optionalValue(latitude), longitude: optionalValue(longitude),
  });

  await rememberLocalAddresses(req.brokerId, city, localAddressList);
  await rememberBuilder(req.brokerId, builderName);

  for (const plan of plansPayload) {
    const created = await PaymentPlan.create({ projectId: project.id, brokerId: req.brokerId, name: plan.name.trim() });
    await PaymentPlanInstallment.bulkCreate(plan.installments.map((row, i) => ({
      paymentPlanId: created.id,
      sequenceNumber: i + 1,
      name: row.name.trim(),
      milestone: row.milestone.trim(),
      percentage: Number(row.percentage),
    })));
  }

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Added new project "${name}"${plansPayload.length ? ` with ${plansPayload.length} payment plan${plansPayload.length === 1 ? '' : 's'}` : ''}`,
    relatedType: 'Project', relatedId: project.id,
  });

  const full = await Project.findByPk(project.id, {
    include: [{ model: PaymentPlan, as: 'paymentPlans', include: [{ model: PaymentPlanInstallment, as: 'installments' }] }],
  });
  res.status(201).json({ data: full });
}

// PUT /api/projects/:id  (Broker only)
// Edits the project's own fields (name, builder, location, price range, dates,
// description, status). Payment Plans are a separate concern managed on their
// own tab/endpoints (see paymentPlanController) — never touched here.
async function update(req, res) {
  const project = await Project.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const { name, builderName, projectType, reraNumber, launchDate, possessionDate, description, country, state, city, address, localAddresses, minPrice, maxPrice, status, latitude, longitude } = req.body;
  if (!name || !city) return res.status(400).json({ message: 'Name and city are required.' });

  const localAddressList = Array.isArray(localAddresses) ? localAddresses.filter((a) => a && a.trim()) : [];

  await project.update({
    name, builderName, projectType, reraNumber,
    launchDate: optionalValue(launchDate), possessionDate: optionalValue(possessionDate),
    description, country, state, city, address: address || localAddressList.join(', ') || null,
    localAddresses: localAddressList,
    minPrice: optionalValue(minPrice), maxPrice: optionalValue(maxPrice), status,
    latitude: optionalValue(latitude), longitude: optionalValue(longitude),
  });

  await rememberLocalAddresses(req.brokerId, city, localAddressList);
  await rememberBuilder(req.brokerId, builderName);

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Updated project "${project.name}"`, relatedType: 'Project', relatedId: project.id,
  });

  res.json({ data: project });
}

// DELETE /api/projects/:id  (Broker only)
// Full cascade — deleting a project removes every piece of data that only
// makes sense in the context of THIS project:
//  - Bookings for this project, and their installment schedules. Handled
//    explicitly here first: Booking references both a Unit and this Project
//    directly, and nothing cascades that automatically, so this must happen
//    BEFORE the project (and its units) can be safely removed.
//  - Agent <-> Project assignments (agent_projects), same reason.
//  - Units, and their own images/installments — already onDelete: CASCADE
//    from Project (see models/index.js), fires automatically below.
//  - Payment Plans, and their installment template rows — same, already
//    onDelete: CASCADE from Project.
// Leads are customer records independent of any one project — they're kept,
// just unlinked (projectId set to null) rather than deleted.
async function remove(req, res) {
  const project = await Project.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!project) return res.status(404).json({ message: 'Project not found.' });

  const name = project.name;

  const bookingIds = (await Booking.findAll({ where: { projectId: project.id }, attributes: ['id'] })).map((b) => b.id);
  if (bookingIds.length) {
    await BookingInstallment.destroy({ where: { bookingId: bookingIds } });
    await Booking.destroy({ where: { id: bookingIds } });
  }
  await AgentProject.destroy({ where: { projectId: project.id } });
  await Lead.update({ projectId: null }, { where: { projectId: project.id } });

  await project.destroy(); // cascades to Units (+images/installments) and Payment Plans (+installment rows)

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Deleted project "${name}"${bookingIds.length ? ` — ${bookingIds.length} booking${bookingIds.length === 1 ? '' : 's'} removed with it` : ''}`,
    relatedType: 'Project', relatedId: project.id,
  });

  res.json({ message: 'Project deleted.' });
}

// POST /api/projects/:id/image  (Broker only, multipart/form-data, field "image")
// Sets/replaces this project's single cover image. Uploaded as its own nested
// request — same reason as Documents (routes/projects.js): a brand-new
// project doesn't have an id yet to attach a file to, so the Add/Edit Project
// form stages the picked file and calls this right after the project itself
// is created (see frontend Projects.jsx handleSubmit). Re-uploading replaces
// the old file; the previous one is removed from disk best-effort.
async function uploadImage(req, res) {
  const project = await Project.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  if (!req.file) return res.status(400).json({ message: 'Select an image to upload.' });

  const previousUrl = project.imageUrl;
  const newUrl = `/uploads/projects/${req.file.filename}`;
  await project.update({ imageUrl: newUrl });

  if (previousUrl && previousUrl !== newUrl) {
    const previousPath = path.join(__dirname, '..', '..', 'uploads', 'projects', path.basename(previousUrl));
    fs.unlink(previousPath, () => {});
  }

  res.json({ data: { imageUrl: newUrl } });
}

module.exports = { list, getOne, create, update, remove, uploadImage };
