// Validates a single { name, installments: [{ name, milestone, percentage }] }
// payload. Returns an error string, or null if valid. The broker enters custom
// percentages — this only enforces that each plan's rows add up to exactly 100%.
function validatePlanPayload(body) {
  const { name, installments } = body || {};
  if (!name || !name.trim()) return 'Plan name is required.';
  if (!Array.isArray(installments) || installments.length === 0) return 'At least one installment row is required.';
  for (const row of installments) {
    if (!row.name || !row.name.trim()) return 'Every installment needs a name.';
    if (!row.milestone || !row.milestone.trim()) return 'Every installment needs a milestone / due condition.';
    if (row.percentage === undefined || row.percentage === null || row.percentage === '' || Number.isNaN(Number(row.percentage))) {
      return 'Every installment needs a percentage.';
    }
    if (Number(row.percentage) <= 0) return 'Percentages must be greater than 0.';
  }
  const total = installments.reduce((sum, row) => sum + Number(row.percentage), 0);
  // Allow a tiny floating-point tolerance (e.g. 33.33 x 3 = 99.99).
  if (Math.abs(total - 100) > 0.05) return `Installment percentages must total 100% (currently ${total.toFixed(2)}%).`;
  return null;
}

module.exports = { validatePlanPayload };
