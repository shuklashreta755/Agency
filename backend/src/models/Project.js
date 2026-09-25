const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Project = sequelize.define('Project', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brokerId: { type: DataTypes.UUID, allowNull: false, field: 'broker_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  builderName: { type: DataTypes.STRING, field: 'builder_name' },
  projectType: { type: DataTypes.STRING, field: 'project_type' },
  reraNumber: { type: DataTypes.STRING, field: 'rera_number' },
  launchDate: { type: DataTypes.DATEONLY, field: 'launch_date' },
  possessionDate: { type: DataTypes.DATEONLY, field: 'possession_date' },
  description: { type: DataTypes.TEXT },
  // Country / State / City — from the Project form's searchable Country -> State
  // -> City selector (see frontend components/LocationSelect.jsx). `city` is the
  // one used everywhere else in the app (search, cards, unit/booking listings)
  // and stays required exactly as before; country/state are optional extra
  // context captured alongside it.
  country: { type: DataTypes.STRING, allowNull: true },
  state: { type: DataTypes.STRING, allowNull: true },
  city: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING },
  // Local Addresses (Multiple) — every area/locality the broker added on the
  // form, e.g. ["Vijay Nagar", "Bicholi Mardana"]. `address` (above) is kept in
  // sync with these (joined) purely so every existing place that already
  // displays project.address — cards, detail page — keeps working unchanged;
  // this array is the actual source of truth going forward.
  localAddresses: { type: DataTypes.JSON, defaultValue: [], field: 'local_addresses' },
  minPrice: { type: DataTypes.DECIMAL(14, 2), field: 'min_price' },
  maxPrice: { type: DataTypes.DECIMAL(14, 2), field: 'max_price' },
  // Optional — if set, powers GPS-proximity validation in the Site Visit Tracker
  // (the "Site Visit Started" step must be near this point).
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  status: { type: DataTypes.ENUM('Active', 'Upcoming', 'Sold Out', 'Inactive'), defaultValue: 'Active' },
  // Cover image for this project — shown on the project card and detail page.
  // Uploaded separately via POST /:id/image (see routes/projects.js /
  // controllers/projectController.uploadImage) since the project needs to
  // exist first; the Add/Edit Project form stages the file and uploads it
  // right after create, exactly like the Add Documents field.
  imageUrl: { type: DataTypes.STRING, allowNull: true, field: 'image_url' },
}, {
  tableName: 'projects',
});

module.exports = Project;
