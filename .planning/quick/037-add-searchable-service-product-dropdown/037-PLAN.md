---
type: quick
task_id: 037
title: Add searchable service/product dropdown
status: pending
created: 2026-02-02
estimated_context: 30%
---

# Quick Task 037: Add Searchable Service/Product Dropdown

## Objective

Replace the plain `<select>` dropdown for services/products in the invoice form with a searchable dropdown that matches the customer selection UX pattern. Users should be able to type to filter services by name, see both the service name and price in the dropdown, and have a clear button when selected.

**Why:** Long service lists require excessive scrolling. Searchable dropdown improves data entry speed and reduces user friction, especially with 20+ services in QuickBooks.

**Output:** Invoice form with searchable service dropdown matching the customer selection pattern.

## Context

**Current State:**
- Customer selection uses searchable dropdown (lines 383-462 in InvoiceForm.tsx)
- Service selection uses standard `<select>` dropdown (lines 562-575)
- Service items already loaded from QuickBooks API into `serviceItems` state
- Multiple invoice items can be added (each needs its own searchable dropdown)

**Pattern to Apply:**
- Text input with search icon
- Filtered dropdown showing results
- Display service name and price
- Clear button when service selected
- Outside click detection to close dropdown
- Container class for click-outside detection

**Key State Variables (customer pattern):**
- `customerSearch` - search input value
- `showCustomerDropdown` - dropdown visibility
- `filteredCustomers` - filtered results
- Outside click handler using `.customer-search-container` class

## Tasks

<task type="auto">
  <name>Add searchable service dropdown to invoice form</name>
  <files>app/dashboard/invoices/new/InvoiceForm.tsx</files>
  <action>
**1. Add state management for each invoice item's service search:**
- Add `serviceSearch` and `showServiceDropdown` to `InvoiceItemForm` interface
- Initialize these fields in `addItem()` and when creating initial item
- Create `updateItemSearch()` helper to update search state for specific item

**2. Create filtered service items function:**
- Add `getFilteredServices(searchTerm: string)` that filters `serviceItems` by name (case-insensitive)
- Returns matching services sorted alphabetically

**3. Replace `<select>` dropdown (lines 562-575) with searchable dropdown:**
- Replace with structure matching customer dropdown (lines 383-462)
- Use `service-search-container-{item.id}` as container class (unique per item)
- Input shows search icon (left) and clear button (right, when selected)
- Placeholder: "Buscar serviço por nome..."
- Dropdown items show: service name (bold) + price (gray, smaller text)
- Format price as: `R$ ${svc.unitPrice?.toFixed(2) || "0.00"}`
- On selection: update `serviceItemId`, set input value to service name, close dropdown
- Clear button: clears `serviceItemId`, clears search input, closes dropdown

**4. Add outside click handler:**
- Add useEffect for each item's dropdown (similar to lines 108-121)
- Use dynamic class selector: `.service-search-container-${item.id}`
- Close dropdown when clicking outside the specific item's container

**5. Auto-populate unitPrice when service selected:**
- In selection handler, find selected service in `serviceItems`
- Update `unitPrice` field with service's `unitPrice` value
- Preserves existing auto-population logic

**Important Notes:**
- Each invoice item needs independent search state (multiple dropdowns on page)
- DO NOT break existing functionality: quantity, unitPrice editing, remove button
- Match customer dropdown styling exactly (hover:bg-blue-50, selected bg-blue-100)
- Service type display `(${svc.type})` can be removed to simplify dropdown
- Keep loading state check: show message if `loadingItems` or empty `serviceItems`
  </action>
  <verify>
1. Run `npm run dev` and navigate to /dashboard/invoices/new
2. Test service search: Type "pro" → should filter services containing "pro"
3. Test service selection: Click service → input shows name, unitPrice auto-populated
4. Test clear button: Click X → clears selection and input
5. Test multiple items: Add 2nd item, both search dropdowns work independently
6. Test outside click: Click outside dropdown → closes
7. Test keyboard: Can still tab through form, Enter doesn't submit while dropdown open
8. Visual check: Dropdown matches customer dropdown styling (same borders, hover states, font sizes)
  </verify>
  <done>
✅ Service selection replaced with searchable dropdown
✅ Search filters services by name (case-insensitive)
✅ Dropdown shows service name + formatted price
✅ Clear button removes selection
✅ Outside click closes dropdown
✅ Multiple item dropdowns work independently
✅ UnitPrice auto-populates on selection
✅ Styling matches customer dropdown pattern
  </done>
</task>

## Success Criteria

**Functional:**
- [ ] User can type to search services
- [ ] Dropdown shows filtered results with name and price
- [ ] Selecting service populates serviceItemId and unitPrice
- [ ] Clear button resets selection
- [ ] Outside click closes dropdown
- [ ] Multiple items have independent search dropdowns

**Visual:**
- [ ] Search icon on left of input
- [ ] Clear button (X) on right when selected
- [ ] Dropdown styling matches customer dropdown
- [ ] Service name in bold, price in gray below
- [ ] Hover state on dropdown items

**Code Quality:**
- [ ] State management per invoice item (not global)
- [ ] No regressions in existing form functionality
- [ ] Clean TypeScript with proper types
- [ ] Follows existing code patterns

## Notes

**Why not extract to component:** Customer dropdown is single-use, service dropdown needs multiple instances with independent state. Extracting to shared component would add complexity without clear benefit for this quick task. Can refactor later if pattern repeats elsewhere.

**Price display format:** Use Brazilian currency format `R$` to match invoice display conventions (verified in quick task 036).

**Accessibility consideration:** Current implementation doesn't have keyboard navigation (arrow keys, Enter to select). This matches customer dropdown behavior. Can enhance in future if users request it.
