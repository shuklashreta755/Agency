const sequelize = require('../config/db');
const User = require('./User');
const Project = require('./Project');
const LocalAddress = require('./LocalAddress');
const Builder = require('./Builder');
const Document = require('./Document');
const AgentProject = require('./AgentProject');
const { Lead, LeadStatusHistory } = require('./Lead');
const FollowUp = require('./FollowUp');
const LeadDocument = require('./LeadDocument');
const SiteVisitTracker = require('./SiteVisitTracker');
const SiteVisitStep = require('./SiteVisitStep');
const Unit = require('./Unit');
const CustomUnitFeature = require('./CustomUnitFeature');
const UnitImage = require('./UnitImage');
const Installment = require('./Installment');
const PaymentPlan = require('./PaymentPlan');
const PaymentPlanInstallment = require('./PaymentPlanInstallment');
const Meeting = require('./Meeting');
const Booking = require('./Booking');
const BookingInstallment = require('./BookingInstallment');
const { Notification, AgentLocation, ActivityHistory } = require('./Misc');

// ---- Associations ----

// Broker <-> Agents (self-referencing User)
User.hasMany(User, { as: 'agents', foreignKey: 'brokerId' });
User.belongsTo(User, { as: 'broker', foreignKey: 'brokerId' });

// Broker <-> Projects
User.hasMany(Project, { foreignKey: 'brokerId', as: 'projects' });
Project.belongsTo(User, { foreignKey: 'brokerId', as: 'broker' });

// Agent <-> Project (N:M via agent_projects)
User.belongsToMany(Project, { through: AgentProject, foreignKey: 'agentId', otherKey: 'projectId', as: 'assignedProjects' });
Project.belongsToMany(User, { through: AgentProject, foreignKey: 'projectId', otherKey: 'agentId', as: 'assignedAgents' });
User.hasMany(AgentProject, { foreignKey: 'agentId', as: 'agentProjectLinks' });
Project.hasMany(AgentProject, { foreignKey: 'projectId', as: 'projectAgentLinks' });
AgentProject.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
AgentProject.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Leads
User.hasMany(Lead, { foreignKey: 'brokerId', as: 'brokerLeads' });
User.hasMany(Lead, { foreignKey: 'agentId', as: 'assignedLeads' });
Lead.belongsTo(User, { foreignKey: 'brokerId', as: 'broker' });
Lead.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
Lead.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Lead.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Project.hasMany(Lead, { foreignKey: 'projectId', as: 'leads' });

Lead.hasMany(LeadStatusHistory, { foreignKey: 'leadId', as: 'statusHistory', onDelete: 'CASCADE' });
LeadStatusHistory.belongsTo(Lead, { foreignKey: 'leadId' });

// Follow-ups — the lead activity/interaction timeline
Lead.hasMany(FollowUp, { foreignKey: 'leadId', as: 'followUps', onDelete: 'CASCADE' });
FollowUp.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
FollowUp.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
User.hasMany(FollowUp, { foreignKey: 'agentId', as: 'followUps' });
// The project a follow-up/site-visit is for — see FollowUp.projectId.
FollowUp.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
// Inverse side — a Project has many follow-ups logged against it (across all
// leads); powers project-wise response tracking on the Lead detail popup
// (see followUpController.projectResponses).
Project.hasMany(FollowUp, { foreignKey: 'projectId', as: 'followUps' });

// Documents
Lead.hasMany(LeadDocument, { foreignKey: 'leadId', as: 'documents', onDelete: 'CASCADE' });
LeadDocument.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
LeadDocument.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });

// Site Visit Tracker
Lead.hasMany(SiteVisitTracker, { foreignKey: 'leadId', as: 'siteVisitTrackers', onDelete: 'CASCADE' });
SiteVisitTracker.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
SiteVisitTracker.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
SiteVisitTracker.belongsTo(FollowUp, { foreignKey: 'followUpId', as: 'followUp' });
// The project this specific site visit is for — see SiteVisitTracker.projectId.
SiteVisitTracker.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
SiteVisitTracker.hasMany(SiteVisitStep, { foreignKey: 'trackerId', as: 'steps', onDelete: 'CASCADE' });
SiteVisitStep.belongsTo(SiteVisitTracker, { foreignKey: 'trackerId', as: 'tracker' });

// Units — belong to a Project; each Unit has images and an installment schedule.
Project.hasMany(Unit, { foreignKey: 'projectId', as: 'units', onDelete: 'CASCADE' });
Unit.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Unit.belongsTo(User, { foreignKey: 'brokerId', as: 'broker' });

// Custom unit-feature names this broker added (see models/CustomUnitFeature.js).
User.hasMany(CustomUnitFeature, { foreignKey: 'brokerId', as: 'customUnitFeatures' });
CustomUnitFeature.belongsTo(User, { foreignKey: 'brokerId', as: 'broker' });

Unit.hasMany(UnitImage, { foreignKey: 'unitId', as: 'images', onDelete: 'CASCADE' });
UnitImage.belongsTo(Unit, { foreignKey: 'unitId' });

Unit.hasMany(Installment, { foreignKey: 'unitId', as: 'installments', onDelete: 'CASCADE' });
Installment.belongsTo(Unit, { foreignKey: 'unitId', as: 'unit' });

// Project Payment Plans — a project can define multiple installment plan
// templates; each plan has its own ordered set of installment rows (Name,
// Milestone/Due Condition, Percentage). Units reference one of their parent
// project's plans (see Unit.paymentPlanId) instead of any hardcoded plan list.
Project.hasMany(PaymentPlan, { foreignKey: 'projectId', as: 'paymentPlans', onDelete: 'CASCADE' });
PaymentPlan.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
PaymentPlan.belongsTo(User, { foreignKey: 'brokerId', as: 'broker' });

PaymentPlan.hasMany(PaymentPlanInstallment, { foreignKey: 'paymentPlanId', as: 'installments', onDelete: 'CASCADE' });
PaymentPlanInstallment.belongsTo(PaymentPlan, { foreignKey: 'paymentPlanId', as: 'plan' });

Unit.belongsTo(PaymentPlan, { foreignKey: 'paymentPlanId', as: 'paymentPlanRef' });
PaymentPlan.hasMany(Unit, { foreignKey: 'paymentPlanId', as: 'units' });

// Bookings — ties one Unit to one Lead/Client with an assigned Agent.
Project.hasMany(Booking, { foreignKey: 'projectId', as: 'bookings' });
Booking.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Unit.hasMany(Booking, { foreignKey: 'unitId', as: 'bookings' });
Booking.belongsTo(Unit, { foreignKey: 'unitId', as: 'unit' });
Booking.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
Booking.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Booking.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Lead.hasMany(Booking, { foreignKey: 'leadId', as: 'bookings' });
Booking.belongsTo(PaymentPlan, { foreignKey: 'paymentPlanId', as: 'paymentPlanRef' });

Booking.hasMany(BookingInstallment, { foreignKey: 'bookingId', as: 'installments', onDelete: 'CASCADE' });
BookingInstallment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });
BookingInstallment.belongsTo(User, { foreignKey: 'paidBy', as: 'paidByUser' });

// Meetings (broker-managed scheduling — separate from the lead follow-up timeline)
Lead.hasMany(Meeting, { foreignKey: 'leadId', as: 'meetings' });
Meeting.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Meeting.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
Meeting.belongsTo(User, { foreignKey: 'brokerId', as: 'broker' });

// Saved Local Addresses — broker-scoped autocomplete memory keyed by city
// (see models/LocalAddress.js).
User.hasMany(LocalAddress, { foreignKey: 'brokerId', as: 'localAddresses' });
LocalAddress.belongsTo(User, { foreignKey: 'brokerId', as: 'broker' });

// Saved Builders — broker-scoped autocomplete memory for the Project form's
// Builder Name field (see models/Builder.js).
User.hasMany(Builder, { foreignKey: 'brokerId', as: 'builders' });
Builder.belongsTo(User, { foreignKey: 'brokerId', as: 'broker' });

// Generic polymorphic file attachments (see models/Document.js). No
// belongsTo(Project)/belongsTo(Lead) etc. on purpose — documentableType +
// documentableId are resolved manually in controllers/documentsController.js
// so the same table/model serves every entity that adopts it.
User.hasMany(Document, { foreignKey: 'uploadedBy', as: 'uploadedDocuments' });
Document.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });

// Notifications / Locations / History
User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(AgentLocation, { foreignKey: 'agentId', as: 'location' });
AgentLocation.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });

User.hasMany(ActivityHistory, { foreignKey: 'userId' });
ActivityHistory.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  User,
  Project,
  LocalAddress,
  Builder,
  Document,
  AgentProject,
  Lead,
  LeadStatusHistory,
  FollowUp,
  LeadDocument,
  SiteVisitTracker,
  SiteVisitStep,
  Unit,
  CustomUnitFeature,
  UnitImage,
  Installment,
  PaymentPlan,
  PaymentPlanInstallment,
  Booking,
  BookingInstallment,
  Meeting,
  Notification,
  AgentLocation,
  ActivityHistory,
};
