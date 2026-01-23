import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Document Storage Service
 *
 * Handles secure storage of signed contracts and other documents in S3.
 * Uses presigned URLs for secure, time-limited access.
 *
 * Storage structure:
 * contracts/
 *   {year}/
 *     {envelopeId}.pdf
 *
 * Example: contracts/2026/abc123-def456.pdf
 */
export class DocumentStorageService {
  private s3Client: S3Client | null = null;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || '';

    // Only initialize S3 client if credentials are configured
    if (
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION
    ) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    }
  }

  /**
   * Check if S3 storage is configured
   */
  isConfigured(): boolean {
    return this.s3Client !== null && !!this.bucketName;
  }

  /**
   * Upload a signed contract PDF to S3
   *
   * @param envelopeId DocuSign envelope ID (used as filename)
   * @param pdfBuffer The PDF file content as Buffer
   * @param metadata Additional metadata to store with the file
   * @returns S3 key where the file was stored
   */
  async uploadSignedContract(
    envelopeId: string,
    pdfBuffer: Buffer,
    metadata?: {
      contractId?: string;
      customerId?: string;
      invoiceId?: string;
    }
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 storage not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and S3_BUCKET_NAME.');
    }

    const year = new Date().getFullYear();
    const key = `contracts/${year}/${envelopeId}.pdf`;

    console.log(`[DOCUMENT_STORAGE] Uploading signed contract to S3: ${key}`);

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256',
      Metadata: {
        envelopeId: envelopeId,
        uploadedAt: new Date().toISOString(),
        ...(metadata?.contractId && { contractId: metadata.contractId }),
        ...(metadata?.customerId && { customerId: metadata.customerId }),
        ...(metadata?.invoiceId && { invoiceId: metadata.invoiceId }),
      },
    }));

    console.log(`[DOCUMENT_STORAGE] Contract uploaded successfully: ${key}`);
    return key;
  }

  /**
   * Generate a presigned URL for downloading a document
   *
   * @param s3Key The S3 key of the document
   * @param expiresInSeconds How long the URL should be valid (default: 7 days)
   * @returns Presigned URL for downloading the document
   */
  async getPresignedUrl(
    s3Key: string,
    expiresInSeconds: number = 604800 // 7 days
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 storage not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    console.log(`[DOCUMENT_STORAGE] Generated presigned URL for ${s3Key} (expires in ${expiresInSeconds}s)`);
    return presignedUrl;
  }

  /**
   * Check if a document exists in S3
   *
   * @param s3Key The S3 key to check
   * @returns true if document exists, false otherwise
   */
  async documentExists(s3Key: string): Promise<boolean> {
    if (!this.s3Client) {
      return false;
    }

    try {
      await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      }));
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Download a document from S3
   *
   * @param s3Key The S3 key of the document
   * @returns Document content as Buffer
   */
  async downloadDocument(s3Key: string): Promise<Buffer> {
    if (!this.s3Client) {
      throw new Error('S3 storage not configured');
    }

    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    }));

    if (!response.Body) {
      throw new Error(`Document not found: ${s3Key}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Generate the S3 key for a contract based on envelope ID
   * Useful for looking up contracts without querying database
   */
  getContractKey(envelopeId: string, year?: number): string {
    const y = year || new Date().getFullYear();
    return `contracts/${y}/${envelopeId}.pdf`;
  }
}

export const documentStorageService = new DocumentStorageService();
