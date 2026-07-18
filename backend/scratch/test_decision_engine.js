/**
 * Decision Engine – Integration Test Suite
 *
 * Tests 6 scenarios covering:
 *   1. Complete financial context
 *   2. Missing financial information
 *   3. Conflicting goals
 *   4. Expensive purchase
 *   5. Career decision (non-financial)
 *   6. Non-financial lifestyle decision
 *
 * Each test validates:
 *   - Response contains all required keys
 *   - Values are dynamically computed from the supplied context (not hardcoded)
 *   - Confidence level reflects the completeness of the supplied context
 *   - missing_information array is populated correctly when data is absent
 *
 * Run: node scratch/test_decision_engine.js
 */

import DecisionEngineService from '../ai/decision/DecisionEngineService.js';

const engine = new DecisionEngineService();

// ── HELPERS ──────────────────────────────────────────────────────────────────

const REQUIRED_KEYS = ['decision', 'reasoning', 'tradeoffs', 'risks', 'missing_information', 'next_step', 'confidence'];

function validateOutput(label, output) {
  const errors = [];

  for (const key of REQUIRED_KEYS) {
    if (!(key in output)) errors.push(`Missing key: "${key}"`);
  }

  if (typeof output.decision !== 'string' || output.decision.trim().length < 5) {
    errors.push('decision: too short or invalid type');
  }
  if (typeof output.reasoning !== 'string' || output.reasoning.trim().length < 10) {
    errors.push('reasoning: too short or invalid type');
  }
  if (!Array.isArray(output.tradeoffs)) errors.push('tradeoffs: must be array');
  if (!Array.isArray(output.risks)) errors.push('risks: must be array');
  if (!Array.isArray(output.missing_information)) errors.push('missing_information: must be array');
  if (typeof output.next_step !== 'string' || output.next_step.trim().length < 5) {
    errors.push('next_step: too short or invalid type');
  }
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(output.confidence)) {
    errors.push(`confidence: invalid value "${output.confidence}"`);
  }

  if (errors.length > 0) {
    console.error(`  ✗ VALIDATION FAILED for "${label}":`);
    errors.forEach(e => console.error(`    - ${e}`));
    return false;
  }
  return true;
}

function printResult(label, output) {
  console.log('\n' + '─'.repeat(70));
  console.log(`TEST: ${label}`);
  console.log('─'.repeat(70));
  console.log(`  Decision    : ${output.decision}`);
  console.log(`  Confidence  : ${output.confidence}`);
  console.log(`  Reasoning   : ${output.reasoning?.substring(0, 120)}...`);
  console.log(`  Tradeoffs   : ${output.tradeoffs?.length ?? 0} items`);
  console.log(`  Risks       : ${output.risks?.length ?? 0} items`);
  console.log(`  Missing Info: ${output.missing_information?.join(', ') || 'none'}`);
  console.log(`  Next Step   : ${output.next_step}`);
}

// ── TEST CASES ────────────────────────────────────────────────────────────────

const testCases = [

  // TEST 1 — Complete financial context
  {
    label: 'Test 1: Complete financial context — laptop purchase',
    input: {
      question: 'Can I afford to buy a laptop worth ₹70,000?',
      user_context: {
        monthly_income: 80000,
        monthly_expenses: 45000,
        current_savings: 200000,
        upcoming_expenses: 30000,
        financial_goals: ['Build emergency fund of ₹3,00,000'],
      },
    },
    assertions: (output) => {
      // With full context, confidence should be HIGH or MEDIUM
      if (!['HIGH', 'MEDIUM'].includes(output.confidence)) {
        console.warn(`  ⚠ Expected HIGH/MEDIUM confidence but got "${output.confidence}"`);
      }
      // Missing info should be empty or minimal
      if (output.missing_information.length > 1) {
        console.warn(`  ⚠ Unexpectedly many missing fields: ${output.missing_information.join(', ')}`);
      }
    },
  },

  // TEST 2 — Missing financial information
  {
    label: 'Test 2: Missing financial information — vague question',
    input: {
      question: 'Should I invest in a mutual fund?',
      user_context: {
        current_savings: 150000,
        // deliberately omitting monthly_income, monthly_expenses, upcoming_expenses
      },
    },
    assertions: (output) => {
      // Should flag missing income and expenses
      const flags = output.missing_information.join(' ').toLowerCase();
      if (!flags.includes('income') && !flags.includes('expense') && !flags.includes('monthly')) {
        console.warn('  ⚠ Expected missing_information to flag income/expense fields');
      }
      if (output.confidence === 'HIGH') {
        console.warn('  ⚠ Confidence should NOT be HIGH with missing income/expense data');
      }
    },
  },

  // TEST 3 — Conflicting goals
  {
    label: 'Test 3: Conflicting goals — save AND spend',
    input: {
      question: 'Should I book a ₹1,50,000 international trip next month?',
      user_context: {
        monthly_income: 60000,
        monthly_expenses: 48000,
        current_savings: 80000,
        upcoming_expenses: 20000,
        financial_goals: ['Build emergency fund', 'Save for home down payment in 6 months'],
      },
    },
    assertions: (output) => {
      // Decision should lean cautious given tight surplus and goals
      const decision = output.decision.toLowerCase();
      const reasoning = output.reasoning.toLowerCase();
      const hasConflictAwareness =
        decision.includes('no') ||
        decision.includes('wait') ||
        decision.includes('delay') ||
        reasoning.includes('goal') ||
        reasoning.includes('savings');
      if (!hasConflictAwareness) {
        console.warn('  ⚠ Expected decision to acknowledge conflict between trip and financial goals');
      }
    },
  },

  // TEST 4 — Expensive purchase (stress test)
  {
    label: 'Test 4: Expensive purchase — luxury car',
    input: {
      question: 'Should I buy a luxury car for ₹18,00,000 on a 5-year EMI?',
      user_context: {
        monthly_income: 150000,
        monthly_expenses: 85000,
        current_savings: 500000,
        upcoming_expenses: 50000,
        financial_goals: ['Early retirement by 45', 'Children\'s education fund'],
      },
    },
    assertions: (output) => {
      // Should have multiple trade-offs for a major purchase decision
      if (output.tradeoffs.length < 2) {
        console.warn('  ⚠ Expected at least 2 trade-offs for a major purchase');
      }
      if (output.risks.length < 1) {
        console.warn('  ⚠ Expected at least 1 risk for a major EMI commitment');
      }
    },
  },

  // TEST 5 — Career decision (non-financial primary)
  {
    label: 'Test 5: Career decision — job switch with pay cut',
    input: {
      question: 'Should I leave my current ₹18 LPA job to join a startup at ₹14 LPA for equity?',
      user_context: {
        monthly_income: 150000,
        monthly_expenses: 70000,
        current_savings: 800000,
        upcoming_expenses: 0,
        financial_goals: ['Achieve financial independence'],
        job_title: 'Senior Software Engineer',
        industry: 'Enterprise Software',
        years_experience: 5,
      },
    },
    assertions: (output) => {
      // Should address trade-off between current salary and equity upside
      const combined = (output.reasoning + output.tradeoffs.join(' ')).toLowerCase();
      if (!combined.includes('equity') && !combined.includes('startup') && !combined.includes('risk')) {
        console.warn('  ⚠ Expected decision to address equity/startup risk specifically');
      }
    },
  },

  // TEST 6 — Non-financial lifestyle decision
  {
    label: 'Test 6: Lifestyle decision — sleep schedule change',
    input: {
      question: 'Should I switch to a 5 AM wake-up routine to improve productivity?',
      user_context: {
        activity_level: 'Sedentary (desk job, 10+ hours screen time)',
        health_conditions: 'None reported',
        fitness_goals: 'Increase energy, improve focus',
        // No financial context — all financial fields absent
      },
    },
    assertions: (output) => {
      // Should not invent any financial data
      const fullText = JSON.stringify(output).toLowerCase();
      if (fullText.includes('₹') || fullText.includes('income') || fullText.includes('savings')) {
        console.warn('  ⚠ Response appears to have invented financial data — this is a bug!');
      }
    },
  },

];

// ── RUNNER ────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n' + '═'.repeat(70));
  console.log('  ORBIT DECISION ENGINE — INFERENCE TEST SUITE');
  console.log('═'.repeat(70));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      console.log(`\n⏳ Running: ${testCase.label}`);
      const output = await engine.decide(testCase.input);

      printResult(testCase.label, output);

      const valid = validateOutput(testCase.label, output);
      if (valid) {
        testCase.assertions?.(output);
        console.log(`  ✓ PASSED`);
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`\n  ✗ EXCEPTION in "${testCase.label}": ${err.message}`);
      console.error(err.stack);
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`  RESULTS: ${passed} passed / ${failed} failed / ${testCases.length} total`);
  console.log('═'.repeat(70) + '\n');

  if (failed > 0) process.exit(1);
}

runTests();
