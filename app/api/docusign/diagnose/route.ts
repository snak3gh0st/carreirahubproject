import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { docusignService } from '@/lib/services/docusign.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/docusign/diagnose?templateId=<id>
 *
 * Inspects a DocuSign template's recipients and their configured tabs.
 * Use this to verify whether the template has text tab fields defined
 * and whether their labels match what the system sends at envelope creation.
 *
 * Expected tab labels for client data:
 *   client_name, client_email, client_address, client_ssn_last4,
 *   client_cpf, client_passport, contract_date_day, contract_date_month,
 *   contract_date_year, invoice_number, invoice_amount, total_amount,
 *   payment_plan, installment_count, service_description
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templateId = request.nextUrl.searchParams.get('templateId');
    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId query param is required' },
        { status: 400 }
      );
    }

    const token = await (docusignService as any).getAccessToken();
    const baseUrl = (docusignService as any).baseUrl;
    const accountId = (docusignService as any).accountId;

    // Fetch template recipients + tabs
    const recipientsUrl = `${baseUrl}/restapi/v2.1/accounts/${accountId}/templates/${templateId}/recipients?include_tabs=true`;
    const recipientsRes = await fetch(recipientsUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!recipientsRes.ok) {
      const err = await recipientsRes.text();
      return NextResponse.json(
        { error: 'DocuSign API error', details: err },
        { status: recipientsRes.status }
      );
    }

    const recipientsData = await recipientsRes.json();

    // Extract tab labels per signer
    const signers = (recipientsData.signers || []).map((signer: any) => {
      const tabs = signer.tabs || {};
      const tabSummary: Record<string, string[]> = {};
      for (const [tabType, tabList] of Object.entries(tabs)) {
        if (Array.isArray(tabList)) {
          tabSummary[tabType] = tabList.map((t: any) => t.tabLabel || t.name || '(no label)');
        }
      }
      return {
        recipientId: signer.recipientId,
        roleName: signer.roleName,
        name: signer.name,
        email: signer.email,
        routingOrder: signer.routingOrder,
        tabLabels: tabSummary,
        hasTextTabs: Array.isArray(tabs.textTabs) && tabs.textTabs.length > 0,
        textTabCount: Array.isArray(tabs.textTabs) ? tabs.textTabs.length : 0,
      };
    });

    // Expected labels for client data
    const expectedClientLabels = [
      'client_name', 'client_email', 'client_address', 'client_ssn_last4',
      'client_cpf', 'client_passport', 'contract_date_day', 'contract_date_month',
      'contract_date_year', 'invoice_number', 'invoice_amount', 'total_amount',
      'payment_plan', 'installment_count', 'service_description',
    ];

    const allTextTabLabels = signers.flatMap((s: any) => s.tabLabels?.textTabs || []);
    const missingExpected = expectedClientLabels.filter(
      (label) => !allTextTabLabels.includes(label)
    );

    return NextResponse.json({
      templateId,
      signers,
      diagnosis: {
        totalSigners: signers.length,
        signersWithTextTabs: signers.filter((s: any) => s.hasTextTabs).length,
        allTextTabLabels,
        expectedClientLabels,
        missingExpected,
        verdict:
          allTextTabLabels.length === 0
            ? 'PROBLEM: Template has NO text tabs defined. Upload the template to DocuSign and add text tab fields at each blank line, naming them with the labels above.'
            : missingExpected.length > 0
            ? `PARTIAL: Template has ${allTextTabLabels.length} text tabs but is missing: ${missingExpected.join(', ')}`
            : 'OK: All expected tab labels are present in the template.',
      },
    });
  } catch (error) {
    console.error('[API_DOCUSIGN_DIAGNOSE]', error);
    return NextResponse.json(
      { error: 'Diagnosis failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
