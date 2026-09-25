require('dotenv').config();
const { sequelize, User, Project, AgentProject, Lead, Meeting, FollowUp, LeadDocument, Notification, Unit, PaymentPlan, PaymentPlanInstallment } = require('../models');
const { generateInstallments } = require('../controllers/unitController');

(async () => {
  try {
    await sequelize.sync({ alter: true });

    const [broker] = await User.findOrCreate({
      where: { phone: '+919820012345' },
      defaults: { name: 'Rahul Mehta', email: 'broker@propelcrm.com', role: 'broker' },
    });

    const [agent1] = await User.findOrCreate({
      where: { phone: '+919823011234' },
      defaults: { name: 'Vikram Rao', email: 'vikram.rao@propelcrm.com', role: 'agent', brokerId: broker.id },
    });
    const [agent2] = await User.findOrCreate({
      where: { phone: '+919987622110' },
      defaults: { name: 'Sneha Iyer', email: 'sneha.iyer@propelcrm.com', role: 'agent', brokerId: broker.id },
    });

    const project1 = await Project.create({
      brokerId: broker.id, name: 'Sunrise Residency', builderName: 'Lodha Group',
      description: '2 & 3 BHK premium apartments with clubhouse and pool.',
      city: 'Indore', address: 'Vijay Nagar, Indore', minPrice: 6500000, maxPrice: 9800000, status: 'Active',
      latitude: 22.7532, longitude: 75.8937, // Vijay Nagar, Indore — used by the Site Visit Tracker's proximity check
    });
    const project2 = await Project.create({
      brokerId: broker.id, name: 'Emerald Heights', builderName: 'Godrej Properties',
      description: 'Luxury villas in a gated community.',
      city: 'Pune', address: 'Bavdhan, Pune', minPrice: 12000000, maxPrice: 18000000, status: 'Active',
    });

    // Assign agents to projects (N:M)
    await AgentProject.findOrCreate({ where: { agentId: agent1.id, projectId: project1.id } });
    await AgentProject.findOrCreate({ where: { agentId: agent2.id, projectId: project2.id } });
    await AgentProject.findOrCreate({ where: { agentId: agent2.id, projectId: project1.id } });

    // Payment Plans — project-owned, broker-configurable installment templates.
    // Demo data only (not hardcoded anywhere in the app itself); the broker can
    // add/edit/delete these freely from Project > Payment Plans.
    const [plan4x] = await PaymentPlan.findOrCreate({
      where: { projectId: project1.id, name: '4 Installment Plan' },
      defaults: { brokerId: broker.id },
    });
    if (!(await PaymentPlanInstallment.count({ where: { paymentPlanId: plan4x.id } }))) {
      await PaymentPlanInstallment.bulkCreate([
        { paymentPlanId: plan4x.id, sequenceNumber: 1, name: 'Booking Amount', milestone: 'On Booking', percentage: 20 },
        { paymentPlanId: plan4x.id, sequenceNumber: 2, name: 'Foundation', milestone: 'On Foundation Completion', percentage: 30 },
        { paymentPlanId: plan4x.id, sequenceNumber: 3, name: 'Slab Completion', milestone: 'On Slab Completion', percentage: 30 },
        { paymentPlanId: plan4x.id, sequenceNumber: 4, name: 'Possession', milestone: 'On Possession', percentage: 20 },
      ]);
    }
    const [planConstruction] = await PaymentPlan.findOrCreate({
      where: { projectId: project1.id, name: 'Construction Linked Plan' },
      defaults: { brokerId: broker.id },
    });
    if (!(await PaymentPlanInstallment.count({ where: { paymentPlanId: planConstruction.id } }))) {
      await PaymentPlanInstallment.bulkCreate([
        { paymentPlanId: planConstruction.id, sequenceNumber: 1, name: 'Booking Amount', milestone: 'On Booking', percentage: 10 },
        { paymentPlanId: planConstruction.id, sequenceNumber: 2, name: 'Plinth', milestone: 'On Plinth Completion', percentage: 15 },
        { paymentPlanId: planConstruction.id, sequenceNumber: 3, name: 'Slab', milestone: 'On Slab Completion', percentage: 25 },
        { paymentPlanId: planConstruction.id, sequenceNumber: 4, name: 'Brickwork', milestone: 'On Brickwork Completion', percentage: 20 },
        { paymentPlanId: planConstruction.id, sequenceNumber: 5, name: 'Finishing', milestone: 'On Finishing', percentage: 20 },
        { paymentPlanId: planConstruction.id, sequenceNumber: 6, name: 'Possession', milestone: 'On Possession', percentage: 10 },
      ]);
    }

    const unit1 = await Unit.create({
      projectId: project1.id, brokerId: broker.id, unitNo: 'A-101', unitType: '2 BHK',
      features: ['Corner Unit', 'Garden Facing'], sizeSqft: 1050, basicPrice: 6800000, totalPrice: 7200000,
      advanceAmount: 500000, paymentPlanId: plan4x.id, status: 'Available',
    });
    await generateInstallments(unit1);
    const unit2 = await Unit.create({
      projectId: project1.id, brokerId: broker.id, unitNo: 'A-102', unitType: '3 BHK',
      features: ['Pool Facing', 'Near Clubhouse'], sizeSqft: 1450, basicPrice: 9200000, totalPrice: 9800000,
      advanceAmount: 800000, paymentPlanId: null, status: 'Booked', // Full Payment fallback
    });
    await generateInstallments(unit2);

    const lead1 = await Lead.create({
      brokerId: broker.id, projectId: project1.id, agentId: agent1.id,
      createdBy: broker.id, createdByRole: 'broker',
      customerName: 'Ankita Sharma', phone: '+919000000001', source: 'Website',
      stage: 'Site Visit Scheduled', priority: 'High',
      nextFollowUp: new Date(Date.now() + 24 * 3600 * 1000),
    });
    const lead2 = await Lead.create({
      brokerId: broker.id, projectId: project2.id, agentId: agent2.id,
      createdBy: agent2.id, createdByRole: 'agent',
      customerName: 'Rohit Malhotra', phone: '+919000000002', source: 'Referral',
      stage: 'Closed', priority: 'Medium',
    });
    // A third lead with NO follow-ups yet — should stay hidden from the Follow-ups sidebar.
    await Lead.create({
      brokerId: broker.id, projectId: project1.id, agentId: agent1.id,
      createdBy: broker.id, createdByRole: 'broker',
      customerName: 'Priya Nair', phone: '+919000000003', source: 'Walk-in',
      stage: 'New', priority: 'Medium',
    });

    await FollowUp.create({
      leadId: lead1.id, agentId: agent1.id, stage: 'Interested', activityType: 'Call',
      description: 'Discussed floor plans, very interested. Scheduled a site visit.',
      nextFollowUpAt: new Date(Date.now() + 24 * 3600 * 1000), reminderEnabled: true,
    });
    await FollowUp.create({
      leadId: lead1.id, agentId: agent1.id, stage: 'Site Visit Scheduled', activityType: 'Site Visit',
      description: 'Site visit confirmed for tomorrow at 11am.',
      nextFollowUpAt: new Date(Date.now() + 24 * 3600 * 1000), reminderEnabled: true,
    });
    await FollowUp.create({
      leadId: lead2.id, agentId: agent2.id, stage: 'Closed', activityType: 'Site Visit',
      description: 'Site visit completed, customer confirmed booking.',
    });

    await LeadDocument.create({
      leadId: lead1.id, uploadedBy: agent1.id, name: 'Sunrise Residency Brochure', url: 'https://example.com/brochure.pdf',
    });

    await Meeting.create({
      brokerId: broker.id, agentId: agent1.id, leadId: lead1.id, title: 'Site Visit — Ankita Sharma',
      type: 'Site Visit', scheduledAt: new Date(Date.now() + 24 * 3600 * 1000),
    });

    await Notification.create({
      userId: agent1.id, title: 'New lead assigned', message: 'Ankita Sharma has been assigned to you.',
      link: `/agent/leads/${lead1.id}`,
    });

    console.log('✓ Seed data created.');
    console.log('  Broker login phone: +919820012345');
    console.log('  Agent login phone:  +919823011234 (Vikram Rao)');
    console.log('  Login sends a real OTP via Firebase Phone Auth — see README for setup.');
    process.exit(0);
  } catch (err) {
    console.error('✗ Seed failed:', err);
    process.exit(1);
  }
})();
