import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { docusignService } from '@/lib/services/docusign.service';

/**
 * GET /api/docusign/templates
 * Fetch available DocuSign templates
 * 
 * Used by commercial users to select which template to use when creating contracts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch templates from DocuSign
    const templates = await docusignService.listTemplates();

    return NextResponse.json({
      templates,
      total: templates.length,
    });

  } catch (error) {
    console.error('[API_DOCUSIGN_TEMPLATES] Error fetching templates:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch DocuSign templates',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
