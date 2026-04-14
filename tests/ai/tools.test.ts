// Note: run with POSTGRES_PRISMA_URL set to a dummy value to avoid PrismaClient constructor error.
// Tests do not make real DB calls — tools are inspected structurally only.
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';
import { defineAiTool, requireRole } from '@/lib/ai/tools/_base';
import { toolRegistry } from '@/lib/ai/tools';

describe('defineAiTool', () => {
  it('returns the input definition unchanged', () => {
    const def = defineAiTool({
      name: 'testTool',
      description: 'test',
      allowedRoles: ['ADMIN'] as any,
      inputSchema: z.object({ x: z.number() }),
      handler: async ({ x }) => ({ doubled: x * 2 }),
    });
    assert.strictEqual(def.name, 'testTool');
    assert.deepStrictEqual(def.allowedRoles, ['ADMIN']);
  });
});

describe('requireRole', () => {
  it('throws when role not in allowed list', () => {
    assert.throws(() => requireRole('SDR' as any, ['ADMIN', 'FINANCE'] as any), /Acesso negado/);
  });
  it('does not throw when role is allowed', () => {
    assert.doesNotThrow(() => requireRole('ADMIN' as any, ['ADMIN', 'FINANCE'] as any));
  });
});

describe('toolRegistry — Plan 02 population', () => {
  const ALL_TOOL_NAMES = [
    'getInvoices',
    'getOverdueInvoices',
    'getPaymentsTimeline',
    'getQuickBooksReport',
    'getStudentsByPhase',
    'getStudentProfile',
    'getStudentSessions',
    'getStudentNextActions',
    'getLeadsByStatus',
    'getLeadQualification',
    'getLeadsBySource',
    'getContracts',
    'getDocumentStatus',
    'getDailyActionView',
    'getCoordinatorOverview',
    'listCapabilities',
    'explainDataModel',
    'getCurrentDate',
    'searchCustomers',
    'searchStudents',
  ];

  it('has exactly 20 tools registered', () => {
    assert.strictEqual(toolRegistry.length, 20, `Expected 20 tools, got ${toolRegistry.length}`);
  });

  for (const name of ALL_TOOL_NAMES) {
    it(`tool "${name}" is registered`, () => {
      const found = toolRegistry.find(t => t.name === name);
      assert.ok(found, `Tool "${name}" not found in registry`);
    });
  }

  it('each tool has required fields (name, description, allowedRoles, inputSchema, handler)', () => {
    for (const tool of toolRegistry) {
      assert.ok(typeof tool.name === 'string' && tool.name.length > 0, `${tool.name}: missing name`);
      assert.ok(typeof tool.description === 'string' && tool.description.length > 0, `${tool.name}: missing description`);
      assert.ok(Array.isArray(tool.allowedRoles) && tool.allowedRoles.length > 0, `${tool.name}: missing allowedRoles`);
      assert.ok(tool.inputSchema, `${tool.name}: missing inputSchema`);
      assert.ok(typeof tool.handler === 'function', `${tool.name}: missing handler`);
    }
  });

  it('finance tools accessible to ADMIN and FINANCE only (not SDR)', () => {
    const financeTools = ['getInvoices', 'getOverdueInvoices', 'getPaymentsTimeline', 'getQuickBooksReport'];
    for (const name of financeTools) {
      const tool = toolRegistry.find(t => t.name === name)!;
      assert.ok(tool.allowedRoles.includes('ADMIN' as any), `${name}: ADMIN should be allowed`);
      assert.ok(tool.allowedRoles.includes('FINANCE' as any), `${name}: FINANCE should be allowed`);
      assert.ok(!tool.allowedRoles.includes('SDR' as any), `${name}: SDR should NOT be allowed`);
    }
  });

  it('leads tools accessible to ADMIN, SALES, SDR', () => {
    const leadsTools = ['getLeadsByStatus', 'getLeadQualification', 'getLeadsBySource'];
    for (const name of leadsTools) {
      const tool = toolRegistry.find(t => t.name === name)!;
      assert.ok(tool.allowedRoles.includes('ADMIN' as any), `${name}: ADMIN should be allowed`);
      assert.ok(tool.allowedRoles.includes('SALES' as any), `${name}: SALES should be allowed`);
      assert.ok(tool.allowedRoles.includes('SDR' as any), `${name}: SDR should be allowed`);
    }
  });

  it('meta tools accessible to all roles', () => {
    const metaTools = ['listCapabilities', 'explainDataModel', 'getCurrentDate'];
    const allRoles = ['ADMIN', 'SALES', 'SDR', 'FINANCE', 'SUPPORT', 'OPERATIONAL', 'COMMERCIAL'];
    for (const name of metaTools) {
      const tool = toolRegistry.find(t => t.name === name)!;
      for (const role of allRoles) {
        assert.ok(tool.allowedRoles.includes(role as any), `${name}: ${role} should be allowed`);
      }
    }
  });
});
