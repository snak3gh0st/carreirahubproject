# DocuSign Sequential Signers Design

## Goal

Adjust the Hub DocuSign envelope payload so every contract created by the Hub uses this signer order:

1. Thais (`people@carreirausa.com`)
2. Witness 1 / Nadya (`people@carreirausa.com`)
3. Witness 2 / Diego Milan (`juridico@carreirausa.com`)
4. Client (dynamic signer from Hub)

The same email must be allowed in multiple steps when the signer names differ.

## Current Finding

- The active templates expose only one template signer role (`Client` or `signer`).
- Direct DocuSign API tests confirmed that the envelope can still be created with four sequential signers via `inlineTemplates.recipients.signers`.
- The recent Hub-generated envelopes are only including the client in practice, so the Hub payload must be corrected.

## Design

- Introduce a single helper in `lib/services/docusign.service.ts` that builds the signer sequence for template-based envelopes.
- The helper will:
  - place internal signers first and client last
  - keep the client text tabs attached only to the client signer
  - support duplicated email addresses with different signer names
  - default internal signer identities to:
    - Thais / `people@carreirausa.com`
    - Nadya / `people@carreirausa.com`
    - Diego Milan / `juridico@carreirausa.com`
- Apply the helper in both template-based creation paths:
  - `createEnvelopeFromTemplate`
  - `createEnvelopeFromSelectedTemplate`
- Trim template IDs loaded from env before using them.

## Test Plan

- Add a unit test for the signer builder that verifies:
  - routing order is `1, 2, 3, 4`
  - Thais and Nadya share the same email
  - client signer is last
  - client signer carries text tabs
  - internal signers do not carry client text tabs
