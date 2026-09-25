const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Verifies the JWT and attaches req.user
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
    if (!token) return res.status(401).json({ message: 'Authentication required.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid or expired session.' });

    req.user = user;
    // Every resource is scoped to a broker: for a broker, brokerId is their own id;
    // for an agent, brokerId is the broker who owns them.
    req.brokerId = user.role === 'broker' ? user.id : user.brokerId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// Restricts a route to specific roles, e.g. authorize('broker')
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
