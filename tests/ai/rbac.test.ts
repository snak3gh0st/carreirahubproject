// Note: run with POSTGRES_PRISMA_URL set to a dummy value to avoid PrismaClient constructor error.
// Tests do not make real DB calls — tools are inspected structurally only.
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { allowedToolsForRole, toolRegistry } from '@/lib/ai/tools';

describe('allowedToolsForRole', () => {
  it('returns an array', () => {
    assert.ok(Array.isArray(toolRegistry));
    assert.ok(Array.isArray(allowedToolsForRole('ADMIN' as any)));
  });

  it('returns empty for unknown role', () => {
    assert.deepStrictEqual(allowedToolsForRole('UNKNOWN_ROLE' as any), []);
  });

  it('ADMIN sees all 20 tools', () => {
    const admin = allowedToolsForRole('ADMIN' as any);
    assert.strictEqual(admin.length, 20, `ADMIN should see 20 tools, got ${admin.length}`);
  });

  it('FINANCE sees exactly 10 tools', () => {
    const finance = allowedToolsForRole('FINANCE' as any);
    const expected = [
      'getInvoices', 'getOverdueInvoices', 'getPaymentsTimeline', 'getQuickBooksReport',
      'getContracts', 'getDocumentStatus',
      'searchCustomers',
      'listCapabilities', 'explainDataModel', 'getCurrentDate',
    ];
    assert.strictEqual(finance.length, expected.length, `FINANCE should see ${expected.length} tools, got ${finance.length}: ${finance.map(t => t.name).join(', ')}`);
    for (const name of expected) {
      assert.ok(finance.find(t => t.name === name), `FINANCE should see tool "${name}"`);
    }
  });

  it('SDR sees exactly 6 tools (3 leads + 3 meta)', () => {
    const sdr = allowedToolsForRole('SDR' as any);
    const expected = [
      'getLeadsByStatus', 'getLeadQualification', 'getLeadsBySource',
      'listCapabilities', 'explainDataModel', 'getCurrentDate',
    ];
    assert.strictEqual(sdr.length, expected.length, `SDR should see ${expected.length} tools, got ${sdr.length}: ${sdr.map(t => t.name).join(', ')}`);
    for (const name of expected) {
      assert.ok(sdr.find(t => t.name === name), `SDR should see tool "${name}"`);
    }
  });

  it('SUPPORT sees exactly 9 tools (4 students + 1 ops + 1 utility + 3 meta)', () => {
    const support = allowedToolsForRole('SUPPORT' as any);
    const expected = [
      'getStudentsByPhase', 'getStudentProfile', 'getStudentSessions', 'getStudentNextActions',
      'getDailyActionView',
      'searchStudents',
      'listCapabilities', 'explainDataModel', 'getCurrentDate',
    ];
    assert.strictEqual(support.length, expected.length, `SUPPORT should see ${expected.length} tools, got ${support.length}: ${support.map(t => t.name).join(', ')}`);
    for (const name of expected) {
      assert.ok(support.find(t => t.name === name), `SUPPORT should see tool "${name}"`);
    }
  });

  it('SALES sees exactly 7 tools (3 leads + 3 meta + 1 utility)', () => {
    const sales = allowedToolsForRole('SALES' as any);
    const expected = [
      'getLeadsByStatus', 'getLeadQualification', 'getLeadsBySource',
      'listCapabilities', 'explainDataModel', 'getCurrentDate',
      'searchCustomers',
    ];
    assert.strictEqual(sales.length, expected.length, `SALES should see ${expected.length} tools, got ${sales.length}: ${sales.map(t => t.name).join(', ')}`);
    for (const name of expected) {
      assert.ok(sales.find(t => t.name === name), `SALES should see tool "${name}"`);
    }
  });

  it('ADMIN must see at least as many tools as SDR', () => {
    const admin = allowedToolsForRole('ADMIN' as any);
    const sdr = allowedToolsForRole('SDR' as any);
    assert.ok(admin.length >= sdr.length, 'ADMIN must see at least as many tools as SDR');
  });
});
