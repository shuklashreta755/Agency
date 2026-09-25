require('dotenv').config();
const { sequelize } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established.');
    await sequelize.sync({ alter: true });
    console.log('✓ All models synced (tables created/updated).');

    // Sequelize's alter:true doesn't reliably relax an existing NOT NULL
    // constraint on Postgres. bookings.agent_id became optional (a broker can
    // leave a booking unassigned) — make sure that actually takes effect even
    // on a database that already had this column as NOT NULL.
    await sequelize.query('ALTER TABLE bookings ALTER COLUMN agent_id DROP NOT NULL;').catch(() => {});

    process.exit(0);
  } catch (err) {
    console.error('✗ Failed to sync database:', err);
    process.exit(1);
  }
})();
