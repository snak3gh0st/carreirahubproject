# DocuSign Template Label Matrix

Updated: 2026-04-01

Status: validated against live DocuSign templates using draft envelopes with populated tabs and cleanup after validation.

## Summary

| Env Var | Template | Role | Unique Labels |
| --- | --- | --- | ---: |
| `DOCUSIGN_TEMPLATE_PASS_ADVANCED` | Carreira USA – Pass Advanced (Anexo A) v9 | `Client` | 48 |
| `DOCUSIGN_TEMPLATE_PASS` | Carreira USA – Pass (Anexo B) v9 | `Client` | 45 |
| `DOCUSIGN_TEMPLATE_COMBO` | Carreira USA – Combo Pass (Anexo C) v9 | `Client` | 28 |
| `DOCUSIGN_TEMPLATE_START` | Carreira USA – Start (Anexo D) v9 | `Client` | 19 |
| `DOCUSIGN_TEMPLATE_AVULSO` | Carreira USA – Avulsos (Anexo E) v9 | `Client` | 11 |
| `DOCUSIGN_TEMPLATE_UPGRADE` | Carreira USA – Upgrade (Anexo F) v9 | `Client` | 13 |
| `DOCUSIGN_TEMPLATE_NEW_PASS` | Carreira USA – New Pass (Anexo G) v9 | `Client` | 15 |
| `DOCUSIGN_TEMPLATE_TREINAMENTO` | Carreira USA – Treinamento (Anexo H) v9 | `Client` | 10 |

## Shared Base Labels

These labels appear across the current contract templates:

- `client_name`
- `client_email`
- `client_address`
- `client_ssn_last4`
- `contract_date_day`
- `contract_date_month`
- `contract_date_year`
- `invoice_numbers`
- `payment_plan`
- `total_amount`

## Template Matrix

### `DOCUSIGN_TEMPLATE_PASS_ADVANCED`

Template ID: `d7b4844c-d047-40d1-a7b5-2816b0faad00`

Labels:
`client_address`, `client_email`, `client_name`, `client_ssn_last4`, `contract_date_day`, `contract_date_month`, `contract_date_year`, `due_date`, `due_date_1`, `due_date_2`, `due_date_3`, `due_date_4`, `due_date_5`, `due_date_6`, `due_date_7`, `due_date_8`, `due_date_9`, `due_date_10`, `due_date_11`, `due_date_12`, `entry_amount`, `installment_amount_1`, `installment_amount_2`, `installment_amount_3`, `installment_amount_4`, `installment_amount_5`, `installment_amount_6`, `installment_amount_7`, `installment_amount_8`, `installment_amount_9`, `installment_amount_10`, `installment_amount_11`, `installment_amount_12`, `installment_desc_1`, `installment_desc_2`, `installment_desc_3`, `installment_desc_4`, `installment_desc_5`, `installment_desc_6`, `installment_desc_7`, `installment_desc_8`, `installment_desc_9`, `installment_desc_10`, `installment_desc_11`, `installment_desc_12`, `invoice_numbers`, `payment_plan`, `total_amount`

### `DOCUSIGN_TEMPLATE_PASS`

Template ID: `189a5097-ae86-4f65-b0ac-b7bea1b150bf`

Labels:
`client_address`, `client_email`, `client_name`, `client_ssn_last4`, `contract_date_day`, `contract_date_month`, `contract_date_year`, `due_date`, `due_date_1`, `due_date_2`, `due_date_3`, `due_date_4`, `due_date_5`, `due_date_6`, `due_date_7`, `due_date_8`, `due_date_9`, `due_date_10`, `due_date_11`, `entry_amount`, `installment_amount_1`, `installment_amount_2`, `installment_amount_3`, `installment_amount_4`, `installment_amount_5`, `installment_amount_6`, `installment_amount_7`, `installment_amount_8`, `installment_amount_9`, `installment_amount_10`, `installment_amount_11`, `installment_desc_1`, `installment_desc_2`, `installment_desc_3`, `installment_desc_4`, `installment_desc_5`, `installment_desc_6`, `installment_desc_7`, `installment_desc_8`, `installment_desc_9`, `installment_desc_10`, `installment_desc_11`, `invoice_numbers`, `payment_plan`, `total_amount`

### `DOCUSIGN_TEMPLATE_COMBO`

Template ID: `5ac12740-350a-438f-9839-a9e986283e73`

Labels:
`client_address`, `client_email`, `client_name`, `client_ssn_last4`, `contract_date_day`, `contract_date_month`, `contract_date_year`, `due_date`, `due_date_1`, `due_date_2`, `due_date_3`, `due_date_4`, `due_date_5`, `entry_amount`, `installment_amount_1`, `installment_amount_2`, `installment_amount_3`, `installment_amount_4`, `installment_amount_5`, `installment_count`, `installment_desc_1`, `installment_desc_2`, `installment_desc_3`, `installment_desc_4`, `installment_desc_5`, `invoice_numbers`, `payment_plan`, `total_amount`

### `DOCUSIGN_TEMPLATE_START`

Template ID: `b4daba8e-f35b-4054-ae44-2f37ca7225ff`

Labels:
`client_address`, `client_email`, `client_name`, `client_ssn_last4`, `contract_date_day`, `contract_date_month`, `contract_date_year`, `due_date`, `due_date_1`, `due_date_2`, `entry_amount`, `installment_amount_1`, `installment_amount_2`, `installment_count`, `installment_desc_1`, `installment_desc_2`, `invoice_numbers`, `payment_plan`, `total_amount`

### `DOCUSIGN_TEMPLATE_AVULSO`

Template ID: `f2240a46-524d-41d1-8173-fd117b4be80f`

Labels:
`client_address`, `client_email`, `client_name`, `client_ssn_last4`, `contract_date_day`, `contract_date_month`, `contract_date_year`, `invoice_numbers`, `payment_plan`, `service_description`, `total_amount`

### `DOCUSIGN_TEMPLATE_UPGRADE`

Template ID: `7da4ad42-c88e-4063-9dd6-50c4371ed298`

Labels:
`client_address`, `client_email`, `client_name`, `client_ssn_last4`, `contract_date_day`, `contract_date_month`, `contract_date_year`, `entry_amount`, `installment_amount_1`, `invoice_numbers`, `payment_plan`, `service_description`, `total_amount`

### `DOCUSIGN_TEMPLATE_NEW_PASS`

Template ID: `273f2fe9-39fa-4a06-b9b6-cc988f54f2b2`

Labels:
`client_address`, `client_email`, `client_name`, `client_ssn_last4`, `contract_date_day`, `contract_date_month`, `contract_date_year`, `due_date`, `due_date_1`, `entry_amount`, `installment_amount_1`, `installment_desc_1`, `invoice_numbers`, `payment_plan`, `total_amount`

### `DOCUSIGN_TEMPLATE_TREINAMENTO`

Template ID: `657faea8-0425-42d2-9785-876b1e3a85a8`

Labels:
`client_address`, `client_email`, `client_name`, `client_ssn_last4`, `contract_date_day`, `contract_date_month`, `contract_date_year`, `invoice_numbers`, `payment_plan`, `total_amount`
