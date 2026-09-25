const { ActivityHistory, User } = require('../models');

// GET /api/history
async function list(req, res) {
  const { page = 1, limit = 20 } = req.query;
  const where = { brokerId: req.brokerId };
  // Agents only see their own activity; brokers see everything for their tenant.
  if (req.user.role === 'agent') where.userId = req.user.id;

  const offset = (Number(page) - 1) * Number(limit);
  const { rows, count } = await ActivityHistory.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'role'] }],
    order: [['createdAt', 'DESC']],
    limit: Number(limit),
    offset,
  });

  res.json({ data: rows, total: count, page: Number(page), limit: Number(limit) });
}

module.exports = { list };
