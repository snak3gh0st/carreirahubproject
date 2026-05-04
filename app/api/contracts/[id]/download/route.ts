import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { documentStorageService } from '@/lib/services/document-storage.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts/[id]/download
 * Get download URL for signed contract
 *
 * Returns presigned S3 URL if available, or DocuSign URI as fallback.
 * Regenerates presigned URL if expired.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        signedS3Key: true,
        signedS3Url: true,
        signedS3UrlExpiresAt: true,
        signedUrl: true, // DocuSign URI fallback
        docusign_env_id: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    if (contract.status !== 'SIGNED') {
      return NextResponse.json(
        { error: 'Contract is not signed yet' },
        { status: 400 }
      );
    }

    // If we have S3 key, use S3 presigned URL
    if (contract.signedS3Key && documentStorageService.isConfigured()) {
      // Check if URL is expired or missing
      const now = new Date();
      const isExpired = !contract.signedS3Url ||
        !contract.signedS3UrlExpiresAt ||
        contract.signedS3UrlExpiresAt < now;

      if (isExpired) {
        // Regenerate presigned URL
        const newUrl = await documentStorageService.getPresignedUrl(contract.signedS3Key);
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            signedS3Url: newUrl,
            signedS3UrlExpiresAt: newExpiresAt,
          },
        });

        return NextResponse.json({
          downloadUrl: newUrl,
          expiresAt: newExpiresAt,
          source: 's3',
        });
      }

      return NextResponse.json({
        downloadUrl: contract.signedS3Url,
        expiresAt: contract.signedS3UrlExpiresAt,
        source: 's3',
      });
    }

    // Fallback: download directly from DocuSign API
    if (contract.docusign_env_id) {
      try {
        const { docusignService } = await import('@/lib/services/docusign.service');
        const pdfBuffer = await docusignService.downloadDocument(contract.docusign_env_id, 'combined');

        // If S3 is configured, store for future requests
        if (documentStorageService.isConfigured()) {
          const s3Key = await documentStorageService.uploadSignedContract(
            contract.docusign_env_id,
            pdfBuffer,
            { contractId: contract.id }
          );
          const presignedUrl = await documentStorageService.getPresignedUrl(s3Key);
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          await prisma.contract.update({
            where: { id: contract.id },
            data: { signedS3Key: s3Key, signedS3Url: presignedUrl, signedS3UrlExpiresAt: expiresAt },
          });

          return NextResponse.json({ downloadUrl: presignedUrl, expiresAt, source: 's3' });
        }

        // No S3 — return PDF directly
        return new NextResponse(new Uint8Array(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="contract-${contract.id.slice(0, 8)}.pdf"`,
          },
        });
      } catch (dsError) {
        console.error('[API_CONTRACT_DOWNLOAD] DocuSign download failed:', dsError);
      }
    }

    if (contract.signedUrl) {
      return NextResponse.json({
        downloadUrl: contract.signedUrl,
        source: 'docusign',
        note: 'Direct DocuSign link - may require authentication',
      });
    }

    return NextResponse.json(
      { error: 'No signed document available' },
      { status: 404 }
    );

  } catch (error) {
    console.error('[API_CONTRACT_DOWNLOAD] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get download URL' },
      { status: 500 }
    );
  }
}
