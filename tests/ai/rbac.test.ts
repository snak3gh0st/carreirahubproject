import { describe, it } from 'node:test';
import assert from 'node:assert';
import { allowedToolsForRole, toolRegistry } from '@/lib/ai/tools';

describe('allowedToolsForRole', () => {
  it('returns an array (empty until Plan 02 registers tools)', () => {
    assert.ok(Array.isArray(toolRegistry));
    assert.ok(Array.isArray(allowedToolsForRole('ADMIN' as any)));
  });

  it('returns empty for unknown role', () => {
    assert.deepStrictEqual(allowedToolsForRole('UNKNOWN_ROLE' as any), []);
  });

  it('filters by allowedRoles when registry has tools', () => {
    // After Plan 02 populates registry, ADMIN should see >= SDR count
    const admin = allowedToolsForRole('ADMIN' as any);
    const sdr = allowedToolsForRole('SDR' as any);
    assert.ok(admin.length >= sdr.length, 'ADMIN must see at least as many tools as SDR');
  });
});
