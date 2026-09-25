const path = require("path");
const fs = require("fs");
const { Op, fn, col } = require("sequelize");
const {
  User,
  Lead,
  AgentLocation,
  Project,
  AgentProject,
  Booking,
  Unit,
} = require("../models");
const { logActivity } = require("../utils/activityLogger");
const { normalizePhone } = require("../utils/phone");
const { notifyAgent } = require("../utils/notify");

// Shared attribute list for returning an agent to the broker panel — keep
// list/getOne in sync so the Agents grid and any future detail view see the
// same shape.
const AGENT_ATTRIBUTES = [
  "id",
  "name",
  "email",
  "phone",
  "status",
  "avatarUrl",
  "address",
  "joiningDate",
  "isActive",
  "createdAt",
];

// GET /api/agents  (Broker only)
// Only ever returns active agents by default — a soft-deleted agent
// (isActive: false, see `remove` below) is excluded so it drops out of the
// Agents grid without its row (or history/bookings/leads that reference it)
// ever being removed. Pass ?status=inactive to fetch the soft-deleted agents
// instead (used by the "Inactive Agents" tab on the Agents page) — every
// other existing caller of this endpoint doesn't send that param, so their
// behavior is unchanged.
async function list(req, res) {
  const isActiveFilter = req.query.status !== "inactive";
  const agents = await User.findAll({
    where: { brokerId: req.brokerId, role: "agent", isActive: isActiveFilter },
    attributes: AGENT_ATTRIBUTES,
    include: [
      { model: AgentLocation, as: "location" },
      {
        model: Project,
        as: "assignedProjects",
        attributes: ["id", "name", "city"],
        through: { attributes: [] },
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  // attach quick lead performance counts
  const withStats = await Promise.all(
    agents.map(async (agent) => {
      const totalLeads = await Lead.count({ where: { agentId: agent.id } });
      const closedLeads = await Lead.count({
        where: { agentId: agent.id, stage: "Closed" },
      });
      return { ...agent.toJSON(), stats: { totalLeads, closedLeads } };
    }),
  );

  res.json({ data: withStats });
}

// GET /api/agents/:id
async function getOne(req, res) {
  const agent = await User.findOne({
    where: { id: req.params.id, brokerId: req.brokerId, role: "agent" },
    attributes: AGENT_ATTRIBUTES,
    include: [
      { model: AgentLocation, as: "location" },
      {
        model: Project,
        as: "assignedProjects",
        attributes: ["id", "name", "city"],
        through: { attributes: [] },
      },
    ],
  });
  if (!agent) return res.status(404).json({ message: "Agent not found." });
  res.json({ data: agent });
}

// PUT /api/agents/:id  (Broker only — activate/deactivate, edit details)
async function update(req, res) {
  const agent = await User.findOne({
    where: { id: req.params.id, brokerId: req.brokerId, role: "agent" },
  });
  if (!agent) return res.status(404).json({ message: "Agent not found." });

  const {
    name,
    phone: rawPhone,
    email,
    address,
    joiningDate,
    isActive,
  } = req.body;
  const patch = { name, isActive };

  if (rawPhone) {
    const phone = normalizePhone(rawPhone);
    if (!phone)
      return res
        .status(400)
        .json({ message: "Please enter a valid phone number." });
    if (phone !== agent.phone) {
      const clash = await User.findOne({
        where: { phone, id: { [Op.ne]: agent.id } },
      });
      if (clash)
        return res
          .status(409)
          .json({ message: "Another account already uses this phone number." });
    }
    patch.phone = phone;
  }
  if (email !== undefined) patch.email = email || null;
  if (address !== undefined) patch.address = address || null;
  if (joiningDate !== undefined) patch.joiningDate = joiningDate || null;

  await agent.update(patch);
  await logActivity({
    brokerId: req.brokerId,
    userId: req.user.id,
    action: `Updated agent profile for ${agent.name}`,
    relatedType: "User",
    relatedId: agent.id,
  });

  res.json({ data: agent });
}

// DELETE /api/agents/:id  (Broker only)
// Soft delete only — the agent row (and everything that references it: leads,
// bookings, history, project assignments) is kept intact. We just flip the
// same `isActive` flag that authController/middleware already use to gate
// login (see authController.login, middleware/auth.js), which:
//   - hides the agent from `list` above (so they disappear from the Agents grid)
//   - stops them from being able to log in from that point on
// No row is ever permanently removed from the database.
async function remove(req, res) {
  const agent = await User.findOne({
    where: { id: req.params.id, brokerId: req.brokerId, role: "agent" },
  });
  if (!agent) return res.status(404).json({ message: "Agent not found." });

  await agent.update({ isActive: false });
  await logActivity({
    brokerId: req.brokerId,
    userId: req.user.id,
    action: `Removed agent ${agent.name}`,
    relatedType: "User",
    relatedId: agent.id,
  });

  res.json({ message: "Agent removed." });
}

// PUT /api/agents/:id/projects  (Broker only)
// Replaces the agent's full set of assigned projects with the given list —
// this is what powers the "searchable project assignment" control on the Agents page.
async function assignProjects(req, res) {
  const agent = await User.findOne({
    where: { id: req.params.id, brokerId: req.brokerId, role: "agent" },
  });
  if (!agent) return res.status(404).json({ message: "Agent not found." });

  const { projectIds = [] } = req.body;
  const validProjects = await Project.findAll({
    where: { id: projectIds, brokerId: req.brokerId },
  });
  const validIds = validProjects.map((p) => p.id);

  await AgentProject.destroy({ where: { agentId: agent.id } });
  if (validIds.length) {
    await AgentProject.bulkCreate(
      validIds.map((projectId) => ({ agentId: agent.id, projectId })),
    );
  }

  await logActivity({
    brokerId: req.brokerId,
    userId: req.user.id,
    action: `Updated project assignments for ${agent.name} (${validIds.length} project${validIds.length === 1 ? "" : "s"})`,
    relatedType: "User",
    relatedId: agent.id,
  });
  if (validIds.length) {
    await notifyAgent(req, agent.id, {
      title: "Projects Updated",
      message: `Your project assignments were updated — you now have ${validIds.length} project${validIds.length === 1 ? "" : "s"} assigned.`,
      link: "/agent/properties",
    });
  }

  const projects = await Project.findAll({
    include: [
      {
        model: User,
        as: "assignedAgents",
        where: { id: agent.id },
        attributes: [],
        through: { attributes: [] },
      },
    ],
  });
  res.json({ data: projects });
}

// GET /api/agents/:id/performance
async function performance(req, res) {
  const agent = await User.findOne({
    where: { id: req.params.id, brokerId: req.brokerId, role: "agent" },
  });
  if (!agent) return res.status(404).json({ message: "Agent not found." });

  const totalLeads = await Lead.count({ where: { agentId: agent.id } });
  const closedLeads = await Lead.count({
    where: { agentId: agent.id, stage: "Closed" },
  });
  const byStage = await Lead.findAll({
    where: { agentId: agent.id },
    attributes: ["stage", [fn("COUNT", col("id")), "count"]],
    group: ["stage"],
    raw: true,
  });

  res.json({
    data: {
      agent: { id: agent.id, name: agent.name },
      totalLeads,
      closedLeads,
      conversionRate: totalLeads
        ? Number(((closedLeads / totalLeads) * 100).toFixed(1))
        : 0,
      byStage,
    },
  });
}

// POST /api/agents/:id/image  (Broker only, multipart/form-data, field "image")
// Sets/replaces this agent's single profile image (one agent → one image).
// Same nested-upload pattern as a Project's cover image
// (controllers/projectController.js uploadImage): a brand-new agent doesn't
// have an id yet to attach a file to, so the Add Agent form stages the
// picked file and calls this right after the agent account is created (see
// frontend Agents.jsx handleSubmit). Re-uploading replaces the old file; the
// previous one is removed from disk best-effort.
async function uploadImage(req, res) {
  const agent = await User.findOne({
    where: { id: req.params.id, brokerId: req.brokerId, role: "agent" },
  });
  if (!agent) return res.status(404).json({ message: "Agent not found." });
  if (!req.file)
    return res.status(400).json({ message: "Select an image to upload." });

  const previousUrl = agent.avatarUrl;
  const newUrl = `/uploads/agents/${req.file.filename}`;
  await agent.update({ avatarUrl: newUrl });

  if (previousUrl && previousUrl !== newUrl) {
    const previousPath = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      "agents",
      path.basename(previousUrl),
    );
    fs.unlink(previousPath, () => {});
  }

  res.json({ data: { avatarUrl: newUrl } });
}

// GET /api/agents/:id/dashboard  (Broker only)
// Powers the Agent Details page (frontend pages/broker/AgentDetail.jsx) with
// one combined call: the agent's own profile fields, headline KPIs, a lead
// status breakdown, a day-by-day performance trend for the last 30 days, and
// their most recent bookings — everything scoped to this one agent only.
// Kept entirely separate from the existing `performance` endpoint above (not
// used anywhere yet) so nothing that already depends on it changes.
const DASHBOARD_TREND_DAYS = 30;

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

// Builds an ordered list of YYYY-MM-DD strings for the trailing N days
// (including today) and a lookup from that string to a 0-initialized bucket,
// so every series lines up on the same X-axis even for days with no activity.
function buildDayBuckets(days) {
  const labels = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    labels.push(toDateStr(d));
  }
  const zeroed = () => Object.fromEntries(labels.map((l) => [l, 0]));
  return { labels, zeroed };
}

async function dashboard(req, res) {
  const agent = await User.findOne({
    where: { id: req.params.id, brokerId: req.brokerId, role: "agent" },
    attributes: AGENT_ATTRIBUTES,
    include: [
      {
        model: Project,
        as: "assignedProjects",
        attributes: ["id", "name", "city"],
        through: { attributes: [] },
      },
    ],
  });
  if (!agent) return res.status(404).json({ message: "Agent not found." });

  const leadWhere = { agentId: agent.id };
  const bookingWhere = { agentId: agent.id };
  const { labels, zeroed } = buildDayBuckets(DASHBOARD_TREND_DAYS);
  const rangeStart = labels[0];

  const [
    totalLeads,
    totalBookings,
    soldBookings,
    byStage,
    leadsByDay,
    bookingsByDay,
    soldUnitsByDay,
    recentBookings,
  ] = await Promise.all([
    Lead.count({ where: leadWhere }),
    Booking.count({ where: bookingWhere }),
    // "Sold Units" — units this agent booked that have since been fully paid
    // off (see models/Unit.js status / bookingController.payInstallment,
    // which is the only place a Unit's status is promoted to 'Sold').
    // Fetched (not .count()) to sidestep Sequelize's COUNT+JOIN ambiguity
    // edge cases — the array length is the count.
    Booking.findAll({
      where: bookingWhere,
      attributes: ["id"],
      include: [
        {
          model: Unit,
          as: "unit",
          attributes: [],
          where: { status: "Sold" },
          required: true,
        },
      ],
    }),
    Lead.findAll({
      where: leadWhere,
      attributes: ["stage", [fn("COUNT", col("id")), "count"]],
      group: ["stage"],
      raw: true,
    }),
    Lead.findAll({
      where: { ...leadWhere, createdAt: { [Op.gte]: rangeStart } },
      attributes: [
        [fn("to_char", col("created_at"), "YYYY-MM-DD"), "day"],
        [fn("COUNT", col("id")), "count"],
      ],
      group: ["day"],
      raw: true,
    }),
    Booking.findAll({
      where: { ...bookingWhere, bookingDate: { [Op.gte]: rangeStart } },
      attributes: ["bookingDate", [fn("COUNT", col("Booking.id")), "count"]],
      group: ["bookingDate"],
      raw: true,
    }),
    Booking.findAll({
      where: { ...bookingWhere, bookingDate: { [Op.gte]: rangeStart } },
      include: [
        {
          model: Unit,
          as: "unit",
          attributes: [],
          where: { status: "Sold" },
          required: true,
        },
      ],
      attributes: ["bookingDate", [fn("COUNT", col("Booking.id")), "count"]],
      group: ["bookingDate"],
      raw: true,
    }),
    Booking.findAll({
      where: bookingWhere,
      include: [
        { model: Project, as: "project", attributes: ["id", "name"] },
        { model: Unit, as: "unit", attributes: ["id", "unitNo", "unitType"] },
        { model: Lead, as: "lead", attributes: ["id", "customerName"] },
      ],
      order: [
        ["bookingDate", "DESC"],
        ["createdAt", "DESC"],
      ],
      limit: 5,
    }),
  ]);

  const leadsBucket = zeroed();
  leadsByDay.forEach((r) => {
    leadsBucket[r.day] = Number(r.count);
  });
  const bookingsBucket = zeroed();
  bookingsByDay.forEach((r) => {
    bookingsBucket[r.bookingDate] = Number(r.count);
  });
  const soldUnitsBucket = zeroed();
  soldUnitsByDay.forEach((r) => {
    soldUnitsBucket[r.bookingDate] = Number(r.count);
  });

  res.json({
    data: {
      agent,
      kpis: {
        totalBookings,
        totalProjects: agent.assignedProjects?.length ?? 0,
        soldUnits: soldBookings.length,
        totalLeads,
      },
      leadStatusDistribution: byStage.map((r) => ({
        stage: r.stage,
        count: Number(r.count),
      })),
      performanceOverview: {
        labels,
        bookings: labels.map((l) => bookingsBucket[l]),
        soldUnits: labels.map((l) => soldUnitsBucket[l]),
        leads: labels.map((l) => leadsBucket[l]),
      },
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        bookingDate: b.bookingDate,
        clientName: b.lead?.customerName || "—",
        projectName: b.project?.name || "—",
        unitNo: b.unit?.unitNo || "—",
        unitType: b.unit?.unitType || "",
        status: b.status,
      })),
    },
  });
}

module.exports = {
  list,
  getOne,
  update,
  remove,
  assignProjects,
  performance,
  uploadImage,
  dashboard,
};
