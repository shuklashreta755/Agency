const { Op } = require('sequelize');
const { LocalAddress } = require('../models');

// GET /api/local-addresses?city=Indore
// Returns every Local Address previously saved (by anyone on this broker's
// team) for the given city, for use as autocomplete suggestions on the
// Project form's Local Addresses field. Broker-scoped, alphabetical.
async function list(req, res) {
  const { city } = req.query;
  if (!city || !city.trim()) return res.json({ data: [] });

  const rows = await LocalAddress.findAll({
    where: { brokerId: req.brokerId, city: city.trim() },
    order: [['address', 'ASC']],
  });
  res.json({ data: rows.map((r) => r.address) });
}

// POST /api/local-addresses  { city, address }
// Saves a new area/locality against a city so it appears as a suggestion for
// this city on every future project. If the same address (case-insensitive)
// is already saved for this city, the existing one is returned as-is instead
// of creating a duplicate.
async function create(req, res) {
  const city = (req.body.city || '').trim();
  const address = (req.body.address || '').trim();
  if (!city) return res.status(400).json({ message: 'City is required.' });
  if (!address) return res.status(400).json({ message: 'Address is required.' });

  const existing = await LocalAddress.findOne({
    where: { brokerId: req.brokerId, city, address: { [Op.iLike]: address } },
  });
  if (existing) return res.status(200).json({ data: existing.address });

  const created = await LocalAddress.create({ brokerId: req.brokerId, city, address });
  res.status(201).json({ data: created.address });
}

module.exports = { list, create };
