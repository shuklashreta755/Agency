const { Notification } = require('../models');

// GET /api/notifications
async function list(req, res) {
  const notifications = await Notification.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  res.json({ data: notifications, unreadCount: notifications.filter((n) => !n.isRead).length });
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
  const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!notification) return res.status(404).json({ message: 'Notification not found.' });
  await notification.update({ isRead: true });
  res.json({ data: notification });
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res) {
  await Notification.update({ isRead: true }, { where: { userId: req.user.id, isRead: false } });
  res.json({ message: 'All notifications marked as read.' });
}

module.exports = { list, markRead, markAllRead };
