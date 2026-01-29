---
type: quick
number: "025"
description: Add contract generator page for commercial with DocuSign template selection
autonomous: true
---

# Quick Task 025: Add Contract Generator Page for Commercial with DocuSign Template Selection

## Objective

Add DocuSign template selection to the contract creation page so commercial users can choose which template to use when generating contracts, instead of using a hardcoded default template.

## Tasks

### Task 1: Add DocuSign template listing method
- Add `listTemplates()` method to DocuSign service
- Returns available templates from DocuSign account
- Includes template ID, name, description, created/modified dates

### Task 2: Create API endpoint for templates
- Create `/api/docusign/templates` endpoint
- Returns list of available templates for authenticated users
- Used by frontend to populate template dropdown

### Task 3: Add template selection to contract creation
- Add `createEnvelopeFromSelectedTemplate()` method to DocuSign service
- Uses Composite Templates pattern with selected template ID
- Populates custom fields (customer name, email, invoice data if linked)

### Task 4: Update contract creation page
- Add template dropdown selector (required field)
- Show template name and description when selected
- Update form submission to include templateId
- Disable submit button until template is selected

### Task 5: Update contracts API
- Accept `templateId` parameter in POST /api/contracts
- Use selected template when creating envelope
- Fallback to legacy behavior if no template provided

## Success Criteria
- [ ] Commercial users can see available DocuSign templates
- [ ] Template selection is required to create a contract
- [ ] Selected template is used when creating DocuSign envelope
- [ ] Customer data is populated into template fields
