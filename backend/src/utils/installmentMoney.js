function money(n) {
  return Number((Number(n) || 0).toFixed(2));
}

// Plan percentage of the price, before any advance is taken off.
function grossInstallment(basePrice, percentage) {
  return money((Number(basePrice) * Number(percentage)) / 100);
}

// First installment is reduced by the advance already collected.
// Later installments stay a straight percentage of the price.
function installmentAmount(basePrice, percentage, isFirst, advance) {
  const gross = grossInstallment(basePrice, percentage);
  if (!isFirst) return gross;
  return money(Math.max(0, gross - money(advance)));
}

// null when the advance fits inside the first installment.
function advanceError(basePrice, firstPercentage, advance) {
  if (advance === undefined || advance === null || advance === '') return null;
  const adv = Number(advance);
  if (Number.isNaN(adv) || adv < 0) return 'Advance amount cannot be negative.';
  const gross = grossInstallment(basePrice, firstPercentage);
  if (money(adv) > gross) {
    return `Advance amount (₹${money(adv).toLocaleString('en-IN')}) cannot be more than the first installment (₹${gross.toLocaleString('en-IN')}).`;
  }
  return null;
}

// First row of a payment plan, or 100 when the unit/booking uses Full Payment.
async function firstPlanPercentage(paymentPlanId) {
  if (!paymentPlanId) return 100;
  const { PaymentPlan, PaymentPlanInstallment } = require('../models');
  const plan = await PaymentPlan.findByPk(paymentPlanId, {
    include: [{ model: PaymentPlanInstallment, as: 'installments', separate: true, order: [['sequenceNumber', 'ASC']] }],
  });
  if (!plan || !plan.installments.length) return 100;
  return Number(plan.installments[0].percentage);
}

module.exports = { money, grossInstallment, installmentAmount, advanceError, firstPlanPercentage };
