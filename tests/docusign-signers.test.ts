import { describe, it } from 'node:test';
import assert from 'node:assert';

import { buildTemplateEnvelopeSigners } from '@/lib/services/docusign.service';

describe('DocuSign template signer sequence', () => {
  it('builds internal signers first and client last, preserving duplicate emails', () => {
    const signers = buildTemplateEnvelopeSigners({
      clientEmail: 'client@example.com',
      clientName: 'Client Example',
      clientRoleName: 'Client',
      clientTextTabs: [{ tabLabel: 'client_name', value: 'Client Example', locked: 'true' }],
    });

    assert.equal(signers.length, 4);

    assert.deepEqual(
      signers.map((signer) => ({
        name: signer.name,
        email: signer.email,
        routingOrder: signer.routingOrder,
      })),
      [
        { name: 'Thais', email: 'people@carreirausa.com', routingOrder: '1' },
        { name: 'Nadya', email: 'people@carreirausa.com', routingOrder: '2' },
        { name: 'Diego Milan', email: 'juridico@carreirausa.com', routingOrder: '3' },
        { name: 'Client Example', email: 'client@example.com', routingOrder: '4' },
      ]
    );

    assert.equal(signers[0].roleName, 'CarreiraUSA');
    assert.equal(signers[1].roleName, 'Testemunha 1');
    assert.equal(signers[2].roleName, 'Testemunha 2');
    assert.equal(signers[3].roleName, 'Client');

    assert.ok(!('tabs' in signers[0]));
    assert.ok(!('tabs' in signers[1]));
    assert.ok(!('tabs' in signers[2]));
    assert.deepEqual(signers[3].tabs, {
      textTabs: [{ tabLabel: 'client_name', value: 'Client Example', locked: 'true' }],
    });
  });
});
