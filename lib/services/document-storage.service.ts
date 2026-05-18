import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type StorageDriver = 'none' | 's3' | 'local';

interface UploadObjectOptions {
  contentType: string;
  metadata?: Record<string, string>;
}

/**
 * Document Storage Service
 *
 * Handles secure storage of signed contracts and other documents.
 * Supports AWS S3 and a zero-cost local filesystem driver for self-hosted
 * deployments.
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
  private bucketName = '';
  private localRoot = '';
  private driver: StorageDriver = 'none';

  constructor() {
    const requestedDriver = process.env.STORAGE_DRIVER?.toLowerCase();

    if (requestedDriver === 'local') {
      this.driver = 'local';
      this.localRoot = process.env.LOCAL_STORAGE_ROOT || '/app/storage';
      return;
    }

    // Only initialize S3 client if credentials are configured
    this.bucketName = process.env.S3_BUCKET_NAME || '';
    if (
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      this.bucketName
    ) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      this.driver = 's3';
    }
  }

  /**
   * Check if document storage is configured
   */
  isConfigured(): boolean {
    if (this.driver === 'local') {
      return !!this.localRoot;
    }
    return this.driver === 's3' && this.s3Client !== null && !!this.bucketName;
  }

  /**
   * Check if local filesystem storage is active.
   */
  isLocal(): boolean {
    return this.driver === 'local';
  }

  /**
   * Upload a signed contract PDF to document storage
   *
   * @param envelopeId DocuSign envelope ID (used as filename)
   * @param pdfBuffer The PDF file content as Buffer
   * @param metadata Additional metadata to store with the file
   * @returns storage key where the file was stored
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
    const year = new Date().getFullYear();
    const key = `contracts/${year}/${envelopeId}.pdf`;

    await this.uploadObject(key, pdfBuffer, {
      contentType: 'application/pdf',
      metadata: {
        envelopeId: envelopeId,
        uploadedAt: new Date().toISOString(),
        ...(metadata?.contractId && { contractId: metadata.contractId }),
        ...(metadata?.customerId && { customerId: metadata.customerId }),
        ...(metadata?.invoiceId && { invoiceId: metadata.invoiceId }),
      },
    });

    return key;
  }

  /**
   * Upload any document to the configured storage driver.
   */
  async uploadObject(
    key: string,
    body: Buffer,
    options: UploadObjectOptions
  ): Promise<string> {
    if (this.driver === 'local') {
      const filePath = this.resolveLocalPath(key);

      console.log(`[DOCUMENT_STORAGE] Writing document to local storage: ${key}`);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, body);
      console.log(`[DOCUMENT_STORAGE] Document written successfully: ${key}`);

      return key;
    }

    if (!this.s3Client) {
      throw new Error('S3 storage not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and S3_BUCKET_NAME.');
    }

    console.log(`[DOCUMENT_STORAGE] Uploading document to S3: ${key}`);

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: options.contentType,
      ServerSideEncryption: 'AES256',
      Metadata: options.metadata,
    }));

    console.log(`[DOCUMENT_STORAGE] Document uploaded successfully: ${key}`);
    return key;
  }

  /**
   * Generate a presigned URL for downloading a document
   *
   * @param s3Key The storage key of the document
   * @param expiresInSeconds How long the URL should be valid (default: 7 days)
   * @returns Presigned URL for downloading the document
   */
  async getPresignedUrl(
    s3Key: string,
    expiresInSeconds: number = 604800 // 7 days
  ): Promise<string> {
    if (this.driver === 'local') {
      this.validateStorageKey(s3Key);

      const localUrl = `/api/storage/local?key=${encodeURIComponent(s3Key)}`;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

      if (!appUrl) {
        return localUrl;
      }

      return new URL(localUrl, appUrl).toString();
    }

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
   * Check if a document exists in storage
   *
   * @param s3Key The storage key to check
   * @returns true if document exists, false otherwise
   */
  async documentExists(s3Key: string): Promise<boolean> {
    if (this.driver === 'local') {
      try {
        await access(this.resolveLocalPath(s3Key));
        return true;
      } catch (error: any) {
        if (error?.code === 'ENOENT') {
          return false;
        }
        throw error;
      }
    }

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
   * Download a document from storage
   *
   * @param s3Key The storage key of the document
   * @returns Document content as Buffer
   */
  async downloadDocument(s3Key: string): Promise<Buffer> {
    if (this.driver === 'local') {
      try {
        return await readFile(this.resolveLocalPath(s3Key));
      } catch (error: any) {
        if (error?.code === 'ENOENT') {
          throw new Error(`Document not found: ${s3Key}`);
        }
        throw error;
      }
    }

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

  private resolveLocalPath(storageKey: string): string {
    this.validateStorageKey(storageKey);

    const root = path.resolve(this.localRoot);
    const filePath = path.resolve(root, storageKey);

    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Invalid storage key: ${storageKey}`);
    }

    return filePath;
  }

  private validateStorageKey(storageKey: string): void {
    if (!storageKey || storageKey.trim() !== storageKey) {
      throw new Error(`Invalid storage key: ${storageKey}`);
    }

    const normalized = path.posix.normalize(storageKey);
    const segments = storageKey.split('/');
    if (
      path.isAbsolute(storageKey) ||
      normalized === '.' ||
      normalized === '..' ||
      normalized.startsWith('../') ||
      segments.includes('..') ||
      segments.includes('') ||
      storageKey.includes('\\')
    ) {
      throw new Error(`Invalid storage key: ${storageKey}`);
    }
  }
}

export const documentStorageService = new DocumentStorageService();
