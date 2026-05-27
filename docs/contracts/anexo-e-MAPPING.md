# Anexo E — Field Mapping (DocuSign Template Setup)

**Documento de referência:** o `.docx` original que o Paulo já tem (`2026 02 25 Carreira USA - Modelo_Contrato Prestacao de Servicos-4.docx`). **Não altere o layout do contrato** — esta integração funciona posicionando campos DocuSign por cima do documento sem mexer no texto.

## Como posicionar os campos no DocuSign template

1. Upload do `.docx` original no DocuSign como Template
2. Adicione um recipient com role `CLIENTE` (mesmo nome usado nos outros templates atuais)
3. Para cada linha da tabela abaixo:
   - Vá até a localização indicada no documento (Anexo E, item correspondente)
   - Arraste o **tipo de campo** indicado para cima do `( )` ou do espaço em branco/underline
   - No painel direito do editor configure:
     - **Atribuído a**: `CLIENTE`
     - **Rótulo de dados (Data Label)**: copie exatamente o valor da coluna **Data Label**
     - **Valor inicial**: deixe em branco (o código vai setar)
     - **Somente leitura**: desmarcado por enquanto (você pode marcar depois quando estabilizar)
4. Salvar template, copiar o **Template ID** e me passar — vou ligar no código

## Tabela de campos — Anexo E

| Onde no documento | Tipo de campo | Data Label | Fonte do dado (no envio) |
|---|---|---|---|
| **1.1 `( )` Sessão Bússola** | Checkbox | `e_compass` | quando o serviço avulso for Sessão Bússola |
| **1.2 `( )` Construção de Material** | Checkbox | `e_material` | quando incluir construção de material |
| sub `( )` Com Sessão Bússola | Checkbox | `e_mat_with_compass` | material + opção Com Bússola |
| sub `( )` Sem Sessão Bússola | Checkbox | `e_mat_without_compass` | material + opção Sem Bússola |
| tipo `( )` Completo | Checkbox | `e_mat_full` | tipo Completo |
| tipo `( )` Currículo | Checkbox | `e_mat_resume` | tipo Resume |
| tipo `( )` Carta de Apresentação | Checkbox | `e_mat_cover` | tipo Cover Letter |
| tipo `( )` Otimização de LinkedIn | Checkbox | `e_mat_linkedin` | tipo LinkedIn |
| **1.3 `( )` Treinamento de Entrevista** | Checkbox | `e_training` | quando incluir Interview Training |
| **1.4 `( )` Mock Interview** | Checkbox | `e_mock` | quando incluir Mock Interview |
| qtd `( ) 1 sessão` | Checkbox | `e_mock_qty_1` | quando `mockQty === 1` |
| qtd `( ) 2 sessões` | Checkbox | `e_mock_qty_2` | quando `mockQty === 2` |
| qtd `( ) 3 sessões` | Checkbox | `e_mock_qty_3` | quando `mockQty === 3` |
| qtd `( ) ___ sessões` | Checkbox | `e_mock_qty_other` | quando `mockQty > 3` |
| qtd underline `___` | Texto | `e_mock_qty_custom` | número quando > 3 |
| **1.5 `( )` Negociação de Salário** | Checkbox | `e_salary` | quando incluir Salary Negotiation |
| **2.1 `US$ _______`** (numérico) | Texto | `e_value_usd` | `deal.value` (ex: `2,500.00`) |
| **2.1 `(_______ dólares ...)`** (extenso) | Texto | `e_value_words` | gerar a partir do valor |
| **2.2 `( )` À vista** | Checkbox | `e_pay_lump` | `payment === 'LUMP_SUM'` |
| **2.2 `( )` Parcelado em [ ]x** | Checkbox | `e_pay_installment` | `payment === 'INSTALLMENT'` |
| qtd parcelas `[ ]` | Texto | `e_installments` | número de parcelas |
| **2.3 `( )` QuickBooks** | Checkbox | `e_pay_qb` | método QB |
| **2.3 `( )` Zelle** | Checkbox | `e_pay_zelle` | método Zelle |
| **2.3 `( )` Wire Transfer** | Checkbox | `e_pay_wire` | método Wire |
| **2.3 `( )` Outro/Other** | Checkbox | `e_pay_other` | método Outro |
| linha do Outro `___________` | Texto | `e_pay_other_value` | nome do método quando Outro |
| **Linha de assinatura final** (do Cliente) | Sign Here | `sig_client` | DocuSign default |
| **Data** ao lado da assinatura | Date Signed | `date_signed` | DocuSign default |

> **Observação sobre o item 1.4 (Mock Interview):** o documento original tem um `(x)` pré-marcado, que faz sentido como exemplo no Word. Quando você configurar o template no DocuSign, posicione um Checkbox normal (não marcado por padrão) e deixe o código decidir.

## Mapeamento sugerido: Deal type → checkboxes

Quando o ops criar um envelope com este Anexo E, o código define os checkboxes pelo `Deal.programType` ou um campo equivalente. Sugestão inicial (vamos validar com você):

| Programa / Serviço avulso | Checkboxes a marcar |
|---|---|
| Compass Session sozinho | `e_compass` |
| Material Completo (com Bússola) | `e_material` + `e_mat_with_compass` + `e_mat_full` + `e_compass` |
| Material Completo (sem Bússola) | `e_material` + `e_mat_without_compass` + `e_mat_full` |
| Só Currículo | `e_material` + `e_mat_without_compass` + `e_mat_resume` |
| Só Cover Letter | `e_material` + `e_mat_without_compass` + `e_mat_cover` |
| Só LinkedIn | `e_material` + `e_mat_without_compass` + `e_mat_linkedin` |
| Interview Training | `e_training` |
| Mock Interview (N sessões) | `e_mock` + `e_mock_qty_N` (e `e_mock_qty_custom` se N>3) |
| Salary Negotiation | `e_salary` |

Pagamento (`e_pay_*`, `e_installments`) e valor (`e_value_*`) vêm do `Invoice`/`Deal` no momento do envio.

## Próximos passos no código (próxima sessão)

Quando você tiver o **Template ID** copiado do DocuSign:

1. Adicionar env var (`DOCUSIGN_TEMPLATE_AVULSO_V2`) com o novo Template ID
2. Criar helper `buildAnexoETabs(deal, invoice)` em `lib/services/docusign.service.ts`:
   ```ts
   tabs: {
     textTabs: [
       { tabLabel: 'e_value_usd', value: formatUsd(deal.value) },
       { tabLabel: 'e_value_words', value: numberToWords(deal.value) },
       // ...
     ],
     checkboxTabs: [
       { tabLabel: 'e_compass', selected: 'true' },
       { tabLabel: 'e_mat_full', selected: 'true' },
       // ...
     ],
   }
   ```
3. Wire no `createEnvelopeFromTemplate` quando o template do envelope for o de Avulsos
