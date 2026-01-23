import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { documentStorageService } from '@/lib/services/document-storage.service';

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

    // Fallback to DocuSign URI
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
