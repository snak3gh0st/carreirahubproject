# Anexo E — DocuSign Template Setup

## Estrutura real descoberta (todos os 9 templates v9)

Cada template = `Contrato de Prestação de Serviços` (doc 1) + `Anexo_X.pdf` (doc 2).  
Roles fixas em todos: `CarreiraUSA`, `Client`, `Testemunha 1`, `Testemunha 2` (todos `order=1`).  
Convenção de Data Label: **snake_case simples**, sem prefixo.

| Template | env | docs | textTabs no Client |
|---|---|---|---|
| PASS_ADVANCED | `DOCUSIGN_TEMPLATE_PASS_ADVANCED` | Contrato + Anexo A | 67 |
| PASS | `DOCUSIGN_TEMPLATE_PASS` | Contrato + Anexo B | 67 |
| COMBO | `DOCUSIGN_TEMPLATE_COMBO` | Contrato + Anexo C | (varia) |
| START | `DOCUSIGN_TEMPLATE_START` | Contrato + Anexo D | (varia) |
| **AVULSO** | **`DOCUSIGN_TEMPLATE_AVULSO`** | **Contrato + Anexo E - Avulsos** | **28** |
| UPGRADE | `DOCUSIGN_TEMPLATE_UPGRADE` | Contrato + Anexo F | (varia) |
| NEW_PASS | `DOCUSIGN_TEMPLATE_NEW_PASS` | Contrato + Anexo G | (varia) |
| TREINAMENTO | `DOCUSIGN_TEMPLATE_TREINAMENTO` | Contrato + Anexo H | (varia) |
| EARLY_CAREER | `DOCUSIGN_TEMPLATE_EARLY_CAREER` | Contrato + Anexo I | (varia) |

## O que existe HOJE no template AVULSO (Anexo E v9)

**Template ID:** `f2240a46-524d-41d1-8173-fd117b4be80f`

**Role `Client`** já tem **28 textTabs** que vêm do contrato principal (doc 1) — todos preenchidos pelo código atual:

```
payment_plan, contract_date_day, contract_date_month, contract_date_year,
client_name (x2), client_cpf, client_passport, client_email (x2),
client_address (x2), client_ssn_last4 (x2),
installment_count, service_description, total_amount,
invoice_number_2 ... invoice_number_12
```

**Zero checkboxTabs** no template atual. É isso que precisamos adicionar.

## O que você precisa fazer no DocuSign

1. Abrir o template `Carreira USA – Avulsos (Anexo E) v9` no editor
2. **Doc 1 (Contrato)** — não mexer; os 28 textTabs já estão lá
3. **Doc 2 (Anexo E - Avulsos)** — substituir o PDF se for usar a versão nova do Anexo E
4. Adicionar **Checkboxes** sobre cada `( )` da Anexo E nova com os Data Labels da tabela abaixo
5. Salvar como **v10** (ou nova versão) para preservar o v9

## Checkboxes a adicionar (Data Labels)

Seguindo a convenção snake_case do template existente, sem prefixo `e_`:

| Onde no Anexo E | Tipo | Data Label |
|---|---|---|
| 1.1 `( )` Sessão Bússola | Checkbox | `compass_session` |
| 1.2 `( )` Construção de Material | Checkbox | `material_construction` |
| sub `( )` Com Sessão Bússola | Checkbox | `material_with_compass` |
| sub `( )` Sem Sessão Bússola | Checkbox | `material_without_compass` |
| tipo `( )` Completo | Checkbox | `material_full` |
| tipo `( )` Currículo | Checkbox | `material_resume` |
| tipo `( )` Carta de Apresentação | Checkbox | `material_cover_letter` |
| tipo `( )` Otimização de LinkedIn | Checkbox | `material_linkedin` |
| 1.3 `( )` Treinamento de Entrevista | Checkbox | `interview_training` |
| 1.4 `( )` Mock Interview | Checkbox | `mock_interview` |
| qtd `( ) 1 sessão` | Checkbox | `mock_qty_1` |
| qtd `( ) 2 sessões` | Checkbox | `mock_qty_2` |
| qtd `( ) 3 sessões` | Checkbox | `mock_qty_3` |
| qtd `( ) ___ sessões` | Checkbox | `mock_qty_other` |
| underline `___` (qtd custom) | Texto | `mock_qty_custom` |
| 1.5 `( )` Negociação de Salário | Checkbox | `salary_negotiation` |

### Sobre o item 2 (Preço/Pagamento) do Anexo E

O Anexo E novo tem sua própria seção 2 (Valor Total, Condição, Método). Antes de adicionar tabs novos, **valide se os 28 textTabs existentes (`total_amount`, `payment_plan`, `installment_count`) cobrem ou se precisa adicionar específicos**:

- Se a seção 2 do novo Anexo E for IDÊNTICA à do contrato principal → o `total_amount` etc. já preenchem
- Se for INDEPENDENTE (avulsos têm valor próprio) → adicionar tabs separados:

| Onde | Tipo | Data Label |
|---|---|---|
| 2.1 `US$ _____` (numérico) | Texto | `e_value_usd` |
| 2.1 `(_____ dólares ...)` (extenso) | Texto | `e_value_words` |
| 2.2 `( )` À vista | Checkbox | `e_pay_lump` |
| 2.2 `( )` Parcelado em [ ]x | Checkbox | `e_pay_installment` |
| 2.2 `[ ]` qtd parcelas | Texto | `e_installments` |
| 2.3 `( )` QuickBooks | Checkbox | `e_pay_qb` |
| 2.3 `( )` Zelle | Checkbox | `e_pay_zelle` |
| 2.3 `( )` Wire Transfer | Checkbox | `e_pay_wire` |
| 2.3 `( )` Outro | Checkbox | `e_pay_other` |
| 2.3 `___` (nome do Outro) | Texto | `e_pay_other_value` |

> Uso do prefixo `e_` aqui é proposital: para NÃO colidir com os labels do contrato principal que reutilizam o mesmo nome semântico (ex: `total_amount` do main = total do programa principal, `e_value_usd` = valor do Anexo E avulso).

## Mapeamento sugerido: serviço avulso → checkboxes

Quando enviar um envelope AVULSO, o código define os checkboxes pelo serviço selecionado:

| Serviço | Checkboxes a marcar |
|---|---|
| Compass Session sozinho | `compass_session` |
| Material Completo (com Bússola) | `material_construction` + `material_with_compass` + `material_full` + `compass_session` |
| Material Completo (sem Bússola) | `material_construction` + `material_without_compass` + `material_full` |
| Só Currículo | `material_construction` + `material_without_compass` + `material_resume` |
| Só Cover Letter | `material_construction` + `material_without_compass` + `material_cover_letter` |
| Só LinkedIn | `material_construction` + `material_without_compass` + `material_linkedin` |
| Interview Training | `interview_training` |
| Mock Interview (N sessões) | `mock_interview` + `mock_qty_N` (e `mock_qty_custom` se N>3) |
| Salary Negotiation | `salary_negotiation` |

## Próximos passos no código

Depois que os checkboxes estiverem no template (você confirma com `npx tsx --env-file=.env.local scripts/inspect-docusign-template.ts --only=AVULSO --detail` — deve listar `checkboxTabs` no role Client):

1. Adicionar tipo de serviço avulso ao Deal/Invoice (campo novo, ex: `avulsoServiceType: enum`)
2. Criar helper `buildAnexoETabs(deal)` em `lib/services/docusign.service.ts`:
   ```ts
   tabs: {
     textTabs: [
       { tabLabel: 'e_value_usd', value: formatUsd(deal.value) },
       { tabLabel: 'e_value_words', value: numberToWords(deal.value) },
     ],
     checkboxTabs: [
       { tabLabel: 'compass_session', selected: 'true' },
       { tabLabel: 'material_full', selected: 'true' },
     ],
   }
   ```
3. Chamar no `createEnvelopeFromTemplate` quando o template for AVULSO
