import { addMonths } from '@/lib/utils/date';

const tests = [
  { base: '2024-01-31', months: 1, expected: '2024-02-29' }, // Leap year
  { base: '2023-01-31', months: 1, expected: '2023-02-28' }, // Non-leap
  { base: '2024-01-31', months: 2, expected: '2024-03-31' }, // Back to 31
  { base: '2024-01-31', months: 3, expected: '2024-04-30' }, // April has 30
  { base: '2024-01-30', months: 1, expected: '2024-02-29' }, // Leap year clamp
  { base: '2024-01-15', months: 1, expected: '2024-02-15' }, // Mid-month (no overflow)
  { base: '2024-05-31', months: 1, expected: '2024-06-30' }, // May → June
];

console.log('Testing installment date calculations...\n');
let passed = 0;
let failed = 0;

tests.forEach(({ base, months, expected }) => {
  const baseDate = new Date(base);
  const result = addMonths(baseDate, months);
  const resultStr = result.toISOString().split('T')[0];
  const match = resultStr === expected;
  
  if (match) {
    passed++;
    console.log(`✓ ${base} + ${months} month(s) = ${resultStr}`);
  } else {
    failed++;
    console.log(`✗ ${base} + ${months} month(s) = ${resultStr} (expected ${expected})`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
