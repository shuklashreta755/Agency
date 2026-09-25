require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const { sequelize } = require('./models');
const initSockets = require('./sockets');
const { backfillFullyPaidLeadConversions } = require('./controllers/bookingController');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const leadRoutes = require('./routes/leads');
const agentRoutes = require('./routes/agents');
const meetingRoutes = require('./routes/meetings');
const trackingRoutes = require('./routes/tracking');
const reportRoutes = require('./routes/reports');
const historyRoutes = require('./routes/history');
const settingsRoutes = require('./routes/settings');
const followUpRoutes = require('./routes/followUps');
const documentRoutes = require('./routes/documents');
const notificationRoutes = require('./routes/notifications');
const unitRoutes = require('./routes/units');
const installmentRoutes = require('./routes/installments');
const paymentPlanRoutes = require('./routes/paymentPlans');
const bookingRoutes = require('./routes/bookings');
const localAddressRoutes = require('./routes/localAddresses');
const builderRoutes = require('./routes/builders');
const attachmentRoutes = require('./routes/attachments');
const clientRoutes = require('./routes/clients');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', credentials: true },
});
app.set('io', io);
initSockets(io);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Uploaded site visit photos — served with an explicit cross-origin-friendly header
// since the frontend (Vite dev server) runs on a different port than this API.
app.use('/uploads', express.static(require('path').join(__dirname, '..', 'uploads'), {
  setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
}));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/follow-ups', followUpRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/installments', installmentRoutes);
app.use('/api/payment-plans', paymentPlanRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/local-addresses', localAddressRoutes);
app.use('/api/builders', builderRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/clients', clientRoutes);

// 404
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✓ PostgreSQL connected.');
    // Catches any lead whose booking was already fully paid before the
    // auto-conversion-to-Client logic existed (see bookingController.payInstallment).
    await backfillFullyPaidLeadConversions().catch((err) => console.error('Backfill (lead->client) failed:', err.message));
    server.listen(PORT, () => console.log(`✓ Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('✗ Unable to start server:', err.message);
    process.exit(1);
  }
}

start();
