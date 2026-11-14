// Runs the phase 1 test set (lib/aiEvalCases.js) through the phone's parser
// (lib/quickParse.js), against both category sets. No app, no network:
//
//   node scripts/quick-parse-check.mjs
//
// For each case it reports what the parser did:
//   local ✓   answered on the phone, and every scored field is right
//   local ✗   answered on the phone, but wrong (the parser must never do this)
//   → model   not sure, so the line would go to the model (ticket 02)
//   null ✓    correctly refused a line that can't be read
//
// Exits with code 1 if any answer is wrong, or if the phone answers fewer
// than half the cases on the starting set.

import { quickParse } from '../lib/quickParse.js';
import { EVAL_ACCOUNTS, EVAL_CASES, EVAL_TODAY } from '../lib/aiEvalCases.js';
import { categoriesFor, readable, scoreCase } from '../lib/aiEvalScore.js';

function run(setName) {
  const categories = categoriesFor(setName);
  const rows = [];
  let local = 0;
  let wrong = 0;
  let refused = 0;
  let toModel = 0;

  for (const testCase of EVAL_CASES) {
    const got = readable(
      quickParse(testCase.text, { categories, accounts: EVAL_ACCOUNTS, today: EVAL_TODAY }),
      categories
    );
    let outcome;
    let detail = '';
    if (!got && !testCase.expected) {
      outcome = 'null ✓';
      refused++;
    } else if (!got) {
      outcome = '→ model';
      toModel++;
    } else {
      const { problems } = scoreCase(testCase, got, setName);
      if (problems.length) {
        outcome = 'local ✗';
        detail = problems.join('; ');
        wrong++;
      } else {
        outcome = 'local ✓';
        local++;
        if (got.note) detail = `note "${got.note}"`;
      }
    }
    const expectedLocal = setName === 'start' && testCase.expected && testCase.local !== !!got ? ' (expected ' + (testCase.local ? 'local' : 'model') + ')' : '';
    rows.push(`${String(testCase.id).padStart(2)}  ${outcome.padEnd(8)}  ${testCase.text.padEnd(28)} ${detail}${expectedLocal}`);
  }

  console.log(`\n== ${setName} category set`);
  console.log(rows.join('\n'));
  console.log(
    `\n${setName}: ${local} answered on the phone, ${toModel} to the model, ${refused} refused correctly, ${wrong} wrong (of ${EVAL_CASES.length})`
  );
  return { local, wrong };
}

const start = run('start');
const current = run('current');

const failures = [];
if (start.wrong || current.wrong) failures.push(`${start.wrong + current.wrong} wrong answer(s) on the phone`);
if (start.local < EVAL_CASES.length / 2) failures.push(`only ${start.local} of ${EVAL_CASES.length} answered on the phone (need at least half)`);

if (failures.length) {
  console.log(`\nFAIL: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('\nPASS: no wrong answers, and the phone answers at least half on the starting set');
