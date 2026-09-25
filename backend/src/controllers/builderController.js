const { Op } = require('sequelize');
const { Builder, Project } = require('../models');

// GET /api/builders
// Every builder name this broker's team has ever saved, for the Project
// form's Builder Name autocomplete. Alphabetical, broker-scoped. UNCHANGED —
// still name-only, still returns every non-deleted builder regardless of
// Status, exactly as it did before the full Builders page existed.
async function list(req, res) {
  const rows = await Builder.findAll({
    where: { brokerId: req.brokerId },
    order: [['name', 'ASC']],
  });
  res.json({ data: rows.map((r) => r.name) });
}

// POST /api/builders  { name }
// Saves a new builder so it appears as a suggestion on every future project.
// If the same name (case-insensitive) is already saved, the existing one is
// returned as-is instead of creating a duplicate. UNCHANGED.
async function create(req, res) {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Builder name is required.' });

  const existing = await Builder.findOne({
    where: { brokerId: req.brokerId, name: { [Op.iLike]: name } },
  });
  if (existing) return res.status(200).json({ data: existing.name });

  const created = await Builder.create({ brokerId: req.brokerId, name });
  res.status(201).json({ data: created.name });
}

// Attaches a `projects` list to each builder — every Project this broker has
// whose Builder Name (a plain string on Project, not a foreign key — see
// models/Project.js) matches this builder's name, case-insensitively. One
// query for every builder on the page, not one query per builder. Includes
// each matched project's status + possessionDate so the Builder Detail page
// can derive Total/Active/Completed without a second round trip.
async function withProjects(brokerId, builders) {
  const allProjects = await Project.findAll({
    where: { brokerId },
    attributes: ['id', 'name', 'builderName', 'status', 'possessionDate', 'city'],
  });
  return builders.map((b) => {
    const matched = allProjects.filter((p) => (p.builderName || '').trim().toLowerCase() === b.name.trim().toLowerCase());
    return {
      ...b.toJSON(),
      projects: matched.map((p) => ({ id: p.id, name: p.name, status: p.status, possessionDate: p.possessionDate, city: p.city })),
    };
  });
}

// A project counts as "Completed" once its Possession Date has passed —
// independent of its sales Status (an Active-for-sale project can still be a
// fully-built, handed-over building). Projects with no Possession Date set
// are never counted as completed.
function projectStats(projects) {
  const today = new Date().toISOString().slice(0, 10);
  const total = projects.length;
  const active = projects.filter((p) => p.status === 'Active').length;
  const completed = projects.filter((p) => p.possessionDate && p.possessionDate <= today).length;
  return { total, active, completed };
}

// GET /api/builders/full  (Broker only)
// Every field for every builder — backs the full Builders page (sidebar,
// between Leads and Clients). Soft-deleted builders are excluded automatically
// (paranoid model — see models/Builder.js).
async function listFull(req, res) {
  const rows = await Builder.findAll({
    where: { brokerId: req.brokerId },
    order: [['createdAt', 'DESC']],
  });
  res.json({ data: await withProjects(req.brokerId, rows) });
}

// GET /api/builders/:id  (Broker only) — backs the Builder Detail page:
// full builder info + every linked project + Total/Active/Completed counts.
async function getOne(req, res) {
  const builder = await Builder.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!builder) return res.status(404).json({ message: 'Builder not found.' });
  const [withProjectsData] = await withProjects(req.brokerId, [builder]);
  res.json({ data: { ...withProjectsData, stats: projectStats(withProjectsData.projects) } });
}

// POST /api/builders/full  (Broker only)  { name, phone, email, description, status }
// Full create for the Builders page — distinct from the quick name-only
// create above (POST /api/builders) used by the Project form's Add button,
// so that one keeps behaving exactly as it always has.
async function createFull(req, res) {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Builder name is required.' });

  const existing = await Builder.findOne({ where: { brokerId: req.brokerId, name: { [Op.iLike]: name } } });
  if (existing) return res.status(409).json({ message: 'A builder with this name already exists.' });

  const { phone, email, description, status } = req.body;
  const builder = await Builder.create({
    brokerId: req.brokerId, name,
    phone: phone || null, email: email || null, description: description || null,
    status: status === 'Inactive' ? 'Inactive' : 'Active',
  });
  const [withProjectsData] = await withProjects(req.brokerId, [builder]);
  res.status(201).json({ data: withProjectsData });
}

// PUT /api/builders/:id  (Broker only)
async function update(req, res) {
  const builder = await Builder.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!builder) return res.status(404).json({ message: 'Builder not found.' });

  const { name, phone, email, description, status } = req.body;
  if (name !== undefined) {
    const trimmed = (name || '').trim();
    if (!trimmed) return res.status(400).json({ message: 'Builder name is required.' });
    const existing = await Builder.findOne({
      where: { brokerId: req.brokerId, name: { [Op.iLike]: trimmed }, id: { [Op.ne]: builder.id } },
    });
    if (existing) return res.status(409).json({ message: 'A builder with this name already exists.' });
    builder.name = trimmed;
  }
  if (phone !== undefined) builder.phone = phone || null;
  if (email !== undefined) builder.email = email || null;
  if (description !== undefined) builder.description = description || null;
  if (status !== undefined) builder.status = status === 'Inactive' ? 'Inactive' : 'Active';
  await builder.save();

  const [withProjectsData] = await withProjects(req.brokerId, [builder]);
  res.json({ data: withProjectsData });
}

// DELETE /api/builders/:id  (Broker only) — SOFT delete: `builder.destroy()`
// on a paranoid model just stamps `deletedAt` and keeps the row, so it can
// never show up again in list/listFull/getOne, but nothing is actually
// erased. Projects already saved with this builder's name are untouched —
// Project.builderName is a plain string, not a foreign key to this row.
async function remove(req, res) {
  const builder = await Builder.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!builder) return res.status(404).json({ message: 'Builder not found.' });
  await builder.destroy();
  res.json({ message: 'Builder deleted.' });
}

module.exports = { list, create, listFull, getOne, createFull, update, remove };
