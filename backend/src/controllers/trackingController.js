const { User, AgentLocation } = require('../models');

// GET /api/tracking  (Broker only — snapshot of all agents' last known location)
async function list(req, res) {
  const agents = await User.findAll({
    where: { brokerId: req.brokerId, role: 'agent' },
    attributes: ['id', 'name', 'status'],
    include: [{ model: AgentLocation, as: 'location' }],
  });
  res.json({ data: agents });
}

// POST /api/tracking  (Agent posts location — REST fallback if socket is unavailable)
async function update(req, res) {
  const { lat, lng, areaLabel } = req.body;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ message: 'lat and lng are required.' });
  }
  const [location] = await AgentLocation.upsert(
    { agentId: req.user.id, lat, lng, areaLabel },
    { returning: true }
  );

  const io = req.app.get('io');
  if (io) io.to(`broker:${req.brokerId}`).emit('location:updated', {
    agentId: req.user.id, lat, lng, areaLabel, updatedAt: new Date(),
  });

  res.json({ data: location });
}

module.exports = { list, update };
