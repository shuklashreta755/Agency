const jwt = require('jsonwebtoken');
const { User, AgentLocation } = require('../models');

function initSockets(io) {
  // Authenticate every socket connection using the same JWT as the REST API
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (!user) return next(new Error('Invalid session'));
      socket.user = user;
      socket.brokerId = user.role === 'broker' ? user.id : user.brokerId;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    // Each broker + their agents share one "room" so location updates
    // and notifications only reach the right tenant.
    const room = `broker:${socket.brokerId}`;
    socket.join(room);
    // Per-user room — lets controllers push a notification (e.g. lead approved/
    // rejected/pending) straight to one person instead of the whole tenant.
    socket.join(`user:${socket.user.id}`);

    if (socket.user.role === 'agent') {
      User.update({ status: 'online' }, { where: { id: socket.user.id } });
      io.to(room).emit('agent:status', { agentId: socket.user.id, status: 'online' });
    }

    // Agent app periodically emits its GPS position
    socket.on('location:update', async ({ lat, lng, areaLabel }) => {
      if (socket.user.role !== 'agent') return;
      await AgentLocation.upsert({ agentId: socket.user.id, lat, lng, areaLabel });
      io.to(room).emit('location:updated', {
        agentId: socket.user.id,
        lat,
        lng,
        areaLabel,
        updatedAt: new Date(),
      });
    });

    // Generic notification push, used by controllers via io.to(room).emit(...)
    socket.on('disconnect', async () => {
      if (socket.user.role === 'agent') {
        await User.update({ status: 'offline' }, { where: { id: socket.user.id } });
        io.to(room).emit('agent:status', { agentId: socket.user.id, status: 'offline' });
      }
    });
  });
}

module.exports = initSockets;
