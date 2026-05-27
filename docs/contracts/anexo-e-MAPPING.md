# Anexo E — Field Mapping

Arquivo: `anexo-e-refactored.docx` (mesmo diretório).

Cada placeholder no documento Word usa anchor strings no formato `\nome\` (em cinza-claro pequeno, ~7pt). No DocuSign template editor você configura cada campo com **Data Label** igual ao nome do anchor.

## Convenção

Todos os anchors do Anexo E começam com `e_` para não colidir com outros annexes futuros (`a_*`, `b_*`, etc.).

## Tabela de campos

| Anchor | Tipo DocuSign | Onde aparece | Origem do dado (no envio) |
|---|---|---|---|
| `e_compass` | Checkbox | 1.1 Sessão Bússola | `selectedItems.includes('compass')` |
| `e_material` | Checkbox | 1.2 Construção de Material | `selectedItems.includes('material')` |
| `e_mat_with_compass` | Checkbox | sub-opção Com Bússola | quando `material` E `withCompass` |
| `e_mat_without_compass` | Checkbox | sub-opção Sem Bússola | quando `material` E `!withCompass` |
| `e_mat_full` | Checkbox | tipo Completo | `materialType === 'FULL'` |
| `e_mat_resume` | Checkbox | tipo Currículo | `materialType === 'RESUME'` |
| `e_mat_cover` | Checkbox | tipo Cover Letter | `materialType === 'COVER_LETTER'` |
| `e_mat_linkedin` | Checkbox | tipo LinkedIn | `materialType === 'LINKEDIN'` |
| `e_training` | Checkbox | 1.3 Treinamento | `selectedItems.includes('training')` |
| `e_mock` | Checkbox | 1.4 Mock Interview | `selectedItems.includes('mock')` |
| `e_mock_qty_1` | Checkbox | qtd 1 sessão | `mockQty === 1` |
| `e_mock_qty_2` | Checkbox | qtd 2 sessões | `mockQty === 2` |
| `e_mock_qty_3` | Checkbox | qtd 3 sessões | `mockQty === 3` |
| `e_mock_qty_other` | Checkbox | qtd customizada | `mockQty > 3` |
| `e_mock_qty_custom` | Texto | número da qtd custom | `String(mockQty)` quando >3 |
| `e_salary` | Checkbox | 1.5 Negociação | `selectedItems.includes('salary')` |
| `e_value_usd` | Texto | 2.1 valor numérico | `deal.value` (ex: `2,500.00`) |
| `e_value_words` | Texto | 2.1 valor por extenso | gerar a partir do valor |
| `e_pay_lump` | Checkbox | 2.2 à vista | `payment === 'LUMP_SUM'` |
| `e_pay_installment` | Checkbox | 2.2 parcelado | `payment === 'INSTALLMENT'` |
| `e_installments` | Texto | número de parcelas | `installmentCount` |
| `e_pay_qb` | Checkbox | 2.3 QuickBooks | `method === 'QB'` |
| `e_pay_zelle` | Checkbox | 2.3 Zelle | `method === 'ZELLE'` |
| `e_pay_wire` | Checkbox | 2.3 Wire | `method === 'WIRE'` |
| `e_pay_other` | Checkbox | 2.3 Outro | `method === 'OTHER'` |
| `e_pay_other_value` | Texto | nome do outro método | `otherMethodName` |
| `sig_client` | SignHere | linha de assinatura | DocuSign default (recipient role) |

## Como subir no DocuSign

1. **Templates** → **Novo Template** → upload `anexo-e-refactored.docx`
2. Adicionar recipient com role `CLIENTE` (mesmo nome usado nos outros templates)
3. Para CADA linha da tabela acima:
   - Arrastar o tipo de campo correto (Checkbox / Texto / SignHere)
   - No painel direito: **Anchor String** = nome da coluna 1 (ex: `e_compass`)
   - **Data Label** = mesmo valor
   - **Atribuído a**: role CLIENTE
   - Para checkboxes: deixar "Valor inicial" desmarcado
4. Salvar template e copiar o **Template ID**

## Regras por Deal Type (sugestão inicial)

Quando enviar um envelope que inclua este Anexo E, o código deve setar os checkboxes baseado no `Deal.programType`. Sugestão de mapeamento (validar com o Paulo):

| Deal type | Checkboxes ligados |
|---|---|
| `AVULSO_COMPASS` | `e_compass` |
| `AVULSO_MATERIAL_FULL_WITH_COMPASS` | `e_material` + `e_mat_with_compass` + `e_mat_full` + `e_compass` |
| `AVULSO_MATERIAL_FULL_NO_COMPASS` | `e_material` + `e_mat_without_compass` + `e_mat_full` |
| `AVULSO_RESUME` | `e_material` + `e_mat_without_compass` + `e_mat_resume` |
| `AVULSO_COVER` | `e_material` + `e_mat_without_compass` + `e_mat_cover` |
| `AVULSO_LINKEDIN` | `e_material` + `e_mat_without_compass` + `e_mat_linkedin` |
| `AVULSO_INTERVIEW_TRAINING` | `e_training` |
| `AVULSO_MOCK` | `e_mock` + (qtd) |
| `AVULSO_SALARY` | `e_salary` |

Pagamento (`e_pay_*`) e valor (`e_value_*`) vêm do `Invoice`/`Deal` atual.

## Próximo passo (código)

Depois que o template estiver no DocuSign com o **Template ID** copiado:

1. Adicionar env var `DOCUSIGN_TEMPLATE_AVULSO_V2=<id>` (ou substituir o atual)
2. Atualizar `lib/services/docusign.service.ts` no método de envio do template para incluir `checkboxTabs` no payload:

```ts
tabs: {
  textTabs: [...existing, { tabLabel: 'e_value_usd', value: '2,500.00' }, ...],
  checkboxTabs: [
    { tabLabel: 'e_compass', selected: 'true' },
    { tabLabel: 'e_mat_full', selected: 'true' },
    // ...
  ],
}
```

3. Criar helper `buildAnexoETabs(deal, invoice)` que retorna `{ textTabs, checkboxTabs }` baseado no Deal type.

## Sobre os anchors visíveis

No arquivo gerado os anchors estão em **cinza-claro 7pt** — você consegue ver para configurar no editor. Depois que tudo estiver setado e os campos estiverem posicionados pelos anchors, você pode:

1. Abrir o Word original
2. Selecionar todos os anchors `\e_*\` (use Localizar com `\*\\`)
3. Mudar para **branco**, fonte 1pt
4. Re-upload no DocuSign (mesmo template, mas atualizar o documento)

Agora os anchors ficam invisíveis no PDF final que o cliente vê. (Opcional — só faça isso quando tudo já estiver funcionando.)
