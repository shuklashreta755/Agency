const { CustomUnitFeature } = require('../models');
const { UNIT_FEATURES } = require('../constants/unitEnums');

function cleanFeatureName(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

function validateFeatureName(name) {
  if (!name) return 'Feature name is required.';
  if (name.length < 2) return 'Feature name must be at least 2 characters.';
  if (name.length > 40) return 'Feature name must be 40 characters or less.';
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s&/'.,+-]*$/u.test(name)) {
    return 'Feature name can only use letters, numbers, and simple punctuation.';
  }
  return null;
}
async function resolveFeature(raw, brokerId) {
  const name = cleanFeatureName(raw);
  const invalid = validateFeatureName(name);
  if (invalid) return { error: invalid };

  const preset = UNIT_FEATURES.find((f) => f.toLowerCase() === name.toLowerCase());
  if (preset) return { id: null, name: preset, preset: true };

  const nameKey = name.toLowerCase();
  const existing = await CustomUnitFeature.findOne({ where: { brokerId, nameKey } });
  if (existing) return { id: existing.id, name: existing.name, preset: false };

  try {
    const created = await CustomUnitFeature.create({ brokerId, name, nameKey });
    return { id: created.id, name: created.name, preset: false, created: true };
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    const again = await CustomUnitFeature.findOne({ where: { brokerId, nameKey } });
    if (again) return { id: again.id, name: again.name, preset: false };
    throw err;
  }
}
async function rememberFeatures(rawList, brokerId) {
  const list = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);
  const features = [];
  const seen = new Set();

  for (const raw of list) {
    if (!cleanFeatureName(raw)) continue;
    const resolved = await resolveFeature(raw, brokerId);
    if (resolved.error) return { error: resolved.error };
    const key = resolved.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    features.push(resolved.name);
  }

  return { features };
}

// GET /api/unit-features
async function list(req, res) {
  const rows = await CustomUnitFeature.findAll({
    where: { brokerId: req.brokerId },
    order: [['name', 'ASC']],
  });
  res.json({ data: rows.map((r) => ({ id: r.id, name: r.name })) });
}

// POST /api/unit-features  { name }
async function create(req, res) {
  const resolved = await resolveFeature(req.body.name, req.brokerId);
  if (resolved.error) return res.status(400).json({ message: resolved.error });
  // `id` is null for a built-in feature — the client just selects that chip.
  res.status(resolved.created ? 201 : 200).json({
    data: { id: resolved.id, name: resolved.name, preset: resolved.preset },
  });
}
async function remove(req, res) {
  const row = await CustomUnitFeature.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!row) return res.status(404).json({ message: 'Feature not found.' });
  await row.destroy();
  res.json({ message: 'Feature removed from the list.' });
}

module.exports = { list, create, remove, rememberFeatures };
