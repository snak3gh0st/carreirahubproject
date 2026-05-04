import { ContractStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { docusignService } from "@/lib/services/docusign.service";
import { documentStorageService } from "@/lib/services/document-storage.service";
import { notificationService } from "@/lib/services/notification.service";
import { clintEventProcessor } from "@/lib/services/clint-event-processor.service";
import { identityMapper } from "@/lib/services/identity-mapper";

type SyncableDocuSignStatus = "sent" | "delivered" | "completed" | "declined" | "voided";
type EmailReconcileAction =
  | "already_linked"
  | "sync_existing_contract"
  | "link_existing_contract"
  | "create_backfill_contract"
  | "skip_no_deal";

const DOCUSIGN_TO_HUB_STATUS: Record<SyncableDocuSignStatus, ContractStatus> = {
  sent: ContractStatus.SENT_FOR_SIGNATURE,
  delivered: ContractStatus.VIEWED,
  completed: ContractStatus.SIGNED,
  declined: ContractStatus.DECLINED,
  voided: ContractStatus.VOIDED,
};

const INTERNAL_DOCUSIGN_EMAIL_DOMAINS = ["@carreirausa.com", "@sigmaintel.io"];

type SyncContractRecord = Awaited<ReturnType<typeof loadContract>>;

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

function isInternalDocuSignEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  return INTERNAL_DOCUSIGN_EMAIL_DOMAINS.some((domain) =>
    normalized.endsWith(domain)
  );
}

async function loadContract(contractId: string) {
  return prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      customer: true,
      invoices: {
        include: {
          customer: true,
        },
      },
    },
  });
}

function normalizeProviderStatus(status: string): SyncableDocuSignStatus | null {
  switch (status) {
    case "sent":
    case "delivered":
    case "completed":
    case "declined":
    case "voided":
      return status;
    default:
      return null;
  }
}

async function ensureSignedDocumentArtifacts(contract: NonNullable<SyncContractRecord>) {
  if (!contract.docusign_env_id) {
    return {
      signedUrl: contract.signedUrl,
      signedS3Key: contract.signedS3Key,
      signedS3Url: contract.signedS3Url,
      signedS3UrlExpiresAt: contract.signedS3UrlExpiresAt,
    };
  }

  let signedUrl = contract.signedUrl;
  let signedS3Key = contract.signedS3Key;
  let signedS3Url = contract.signedS3Url;
  let signedS3UrlExpiresAt = contract.signedS3UrlExpiresAt;

  if (!signedUrl) {
    try {
      const documents = await docusignService.getEnvelopeDocuments(contract.docusign_env_id);
      if (documents.length > 0) {
        signedUrl = documents[0].uri;
      }
    } catch (error) {
      console.error("[DOCUSIGN_SYNC] Failed to load envelope documents:", error);
    }
  }

  const s3UrlMissingOrExpired =
    !signedS3Url ||
    !signedS3UrlExpiresAt ||
    new Date(signedS3UrlExpiresAt) <= new Date();

  if (documentStorageService.isConfigured() && s3UrlMissingOrExpired) {
    try {
      const pdfBuffer = await docusignService.downloadDocument(contract.docusign_env_id, "combined");
      signedS3Key = await documentStorageService.uploadSignedContract(
        contract.docusign_env_id,
        pdfBuffer,
        {
          contractId: contract.id,
          customerId: contract.customerId,
          invoiceId: contract.invoices[0]?.id,
        }
      );
      signedS3Url = await documentStorageService.getPresignedUrl(signedS3Key);
      signedS3UrlExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } catch (error) {
      console.error("[DOCUSIGN_SYNC] Failed to persist signed contract PDF:", error);
    }
  }

  return {
    signedUrl,
    signedS3Key,
    signedS3Url,
    signedS3UrlExpiresAt,
  };
}

async function reconcileCustomerIdentity(contract: NonNullable<SyncContractRecord>) {
  if (!contract.customer || !contract.docusign_env_id) {
    return;
  }

  await identityMapper.reconcileCustomer({
    email: contract.customer.email,
    name: contract.customer.name,
    phone: contract.customer.phone || undefined,
    externalIds: {
      docusign_id: contract.docusign_env_id,
    },
  });
}

async function markDealWonAndNotify(contract: NonNullable<SyncContractRecord>, previousStatus: ContractStatus) {
  if (!contract.dealId || !contract.customer) {
    return;
  }

  const deal = await prisma.deal.findUnique({
    where: { id: contract.dealId },
    include: {
      customer: true,
    },
  });

  if (!deal || !deal.customer) {
    return;
  }

  if (deal.status !== "WON") {
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        status: "WON",
        lastClintSyncAt: new Date(),
      },
    });
  }

  if (previousStatus !== ContractStatus.SIGNED) {
    await notificationService.notifyCommercialUser(
      {
        id: deal.id,
        title: deal.title,
        ownerId: deal.ownerId,
        customer: {
          name: deal.customer.name,
          email: deal.customer.email,
        },
      },
      {
        id: contract.id,
        status: ContractStatus.SIGNED,
      }
    );
  }
}

async function triggerOnboardingIfEligible(contract: NonNullable<SyncContractRecord>) {
  if (!contract.dealId || !contract.customer) {
    return;
  }

  const linkedInvoice = await prisma.invoice.findFirst({
    where: {
      dealId: contract.dealId,
      status: "PAID",
    },
  });

  if (!linkedInvoice) {
    return;
  }

  await clintEventProcessor.triggerOnboarding(contract.dealId, contract.customer);
}

async function applySignedContractSync(
  contract: NonNullable<SyncContractRecord>,
  provider: { statusDateTime: string; signedDateTime?: string }
) {
  const previousStatus = contract.status;
  const signedArtifacts = await ensureSignedDocumentArtifacts(contract);
  const signedAt =
    provider.signedDateTime ||
    provider.statusDateTime ||
    contract.signedAt?.toISOString() ||
    new Date().toISOString();

  const updatedContract = await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: ContractStatus.SIGNED,
      signedAt: new Date(signedAt),
      signedUrl: signedArtifacts.signedUrl,
      signedS3Key: signedArtifacts.signedS3Key,
      signedS3Url: signedArtifacts.signedS3Url,
      signedS3UrlExpiresAt: signedArtifacts.signedS3UrlExpiresAt,
    },
  });

  await reconcileCustomerIdentity(contract);

  if (previousStatus !== ContractStatus.SIGNED) {
    await notificationService.sendContractSigned(
      {
        id: updatedContract.id,
        docusign_env_id: updatedContract.docusign_env_id,
        status: ContractStatus.SIGNED,
        signedUrl: updatedContract.signedS3Url || updatedContract.signedUrl,
        sentAt: updatedContract.sentAt,
        expiresAt: updatedContract.expiresAt,
        reminderCount: updatedContract.reminderCount,
        signerEmail: updatedContract.signerEmail,
        signerName: updatedContract.signerName,
      },
      contract.customer
    );
  }

  await markDealWonAndNotify(contract, previousStatus);
  await triggerOnboardingIfEligible(contract);

  return updatedContract;
}

async function applyNonSignedStatus(
  contract: NonNullable<SyncContractRecord>,
  targetStatus: ContractStatus,
  provider: { statusDateTime: string }
) {
  const updateData: Record<string, unknown> = {
    status: targetStatus,
  };

  if (targetStatus === ContractStatus.DECLINED && !contract.declinedAt) {
    updateData.declinedAt = new Date(provider.statusDateTime);
  }

  if (targetStatus === ContractStatus.VOIDED && !contract.voidedAt) {
    updateData.voidedAt = new Date(provider.statusDateTime);
  }

  return prisma.contract.update({
    where: { id: contract.id },
    data: updateData,
  });
}

async function resolveFallbackDealId(customerId: string): Promise<string | null> {
  const deal = await prisma.deal.findFirst({
    where: { customerId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  if (deal) {
    return deal.id;
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      customerId,
      dealId: { not: null },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: { dealId: true },
  });

  return invoice?.dealId || null;
}

async function linkUnassignedDealInvoices(
  contractId: string,
  dealId: string,
  customerId: string
) {
  await prisma.invoice.updateMany({
    where: {
      dealId,
      customerId,
      contractId: null,
    },
    data: { contractId },
  });
}

export type DocusignContractSyncResult = {
  contractId: string;
  envelopeId: string | null;
  localStatus: ContractStatus;
  providerStatus: string | null;
  targetStatus: ContractStatus | null;
  changed: boolean;
  hydratedSignedDocument: boolean;
  error?: string;
};

export type DocusignEmailReconciliationResult = {
  envelopeId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  contractId: string | null;
  action: EmailReconcileAction;
  changed: boolean;
  error?: string;
};

export type DocusignEmailReconciliationSummary = {
  scannedEnvelopes: number;
  matchedCustomers: number;
  alreadyLinked: number;
  syncedExisting: number;
  linkedExisting: number;
  createdBackfill: number;
  skippedNoDeal: number;
  errors: number;
  results: DocusignEmailReconciliationResult[];
};

type CompletedEnvelope = {
  envelopeId: string;
  emailSubject: string;
  status: string;
  recipientsUri: string;
  createdDateTime?: string;
  sentDateTime?: string;
  deliveredDateTime?: string;
  completedDateTime?: string;
};

export class DocusignContractSyncService {
  private needsSignedArtifacts(contract: NonNullable<SyncContractRecord>) {
    return (
      !contract.signedAt ||
      !contract.signedS3Url ||
      !contract.signedS3UrlExpiresAt ||
      new Date(contract.signedS3UrlExpiresAt) <= new Date()
    );
  }

  private async applyCompletedEnvelopeToContract(
    contractId: string,
    envelope: CompletedEnvelope
  ) {
    const contract = await loadContract(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    const previousStatus = contract.status;
    const hadSignedArtifacts = !this.needsSignedArtifacts(contract);
    const signedAt =
      envelope.completedDateTime ||
      envelope.deliveredDateTime ||
      envelope.sentDateTime ||
      envelope.createdDateTime ||
      new Date().toISOString();

    await applySignedContractSync(contract, {
      statusDateTime: signedAt,
      signedDateTime: signedAt,
    });

    return {
      previousStatus,
      changed:
        previousStatus !== ContractStatus.SIGNED || !hadSignedArtifacts,
    };
  }

  private async resolveExistingContractForEnvelope(
    customerId: string,
    customerEmail: string,
    envelopeId: string
  ) {
    const exact = await prisma.contract.findFirst({
      where: { docusign_env_id: envelopeId },
      select: { id: true, status: true },
    });

    if (exact) {
      return { contractId: exact.id, action: exact.status === ContractStatus.SIGNED ? "already_linked" : "sync_existing_contract" as EmailReconcileAction };
    }

    const pendingLocal = await prisma.contract.findFirst({
      where: {
        customerId,
        docusign_env_id: null,
        status: {
          in: [
            ContractStatus.DRAFT,
            ContractStatus.SENT_FOR_SIGNATURE,
            ContractStatus.VIEWED,
            ContractStatus.DECLINED,
            ContractStatus.VOIDED,
            ContractStatus.EXPIRED,
          ],
        },
        signerEmail: {
          equals: customerEmail,
          mode: "insensitive",
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    if (pendingLocal) {
      return {
        contractId: pendingLocal.id,
        action: "link_existing_contract" as EmailReconcileAction,
      };
    }

    return null;
  }

  private async backfillContractForEnvelope(params: {
    customerId: string;
    customerName: string;
    customerEmail: string;
    envelope: CompletedEnvelope;
    signerName: string;
  }) {
    const dealId = await resolveFallbackDealId(params.customerId);
    if (!dealId) {
      return null;
    }

    const sentAtIso =
      params.envelope.sentDateTime ||
      params.envelope.createdDateTime ||
      params.envelope.completedDateTime ||
      new Date().toISOString();

    const created = await prisma.contract.create({
      data: {
        docusign_env_id: params.envelope.envelopeId,
        status: ContractStatus.DRAFT,
        signerEmail: params.customerEmail,
        signerName: params.signerName || params.customerName,
        customerId: params.customerId,
        dealId,
        sentAt: new Date(sentAtIso),
      },
      select: { id: true },
    });

    await linkUnassignedDealInvoices(created.id, dealId, params.customerId);
    return created.id;
  }

  async inspectContract(contractId: string): Promise<DocusignContractSyncResult> {
    const contract = await loadContract(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }
    if (!contract.docusign_env_id) {
      return {
        contractId: contract.id,
        envelopeId: null,
        localStatus: contract.status,
        providerStatus: null,
        targetStatus: null,
        changed: false,
        hydratedSignedDocument: false,
      };
    }

    const provider = await docusignService.getEnvelopeStatus(contract.docusign_env_id);
    const normalized = normalizeProviderStatus(provider.status);
    return {
      contractId: contract.id,
      envelopeId: contract.docusign_env_id,
      localStatus: contract.status,
      providerStatus: provider.status,
      targetStatus: normalized ? DOCUSIGN_TO_HUB_STATUS[normalized] : null,
      changed: normalized ? DOCUSIGN_TO_HUB_STATUS[normalized] !== contract.status : false,
      hydratedSignedDocument: false,
    };
  }

  async syncContract(contractId: string): Promise<DocusignContractSyncResult> {
    const contract = await loadContract(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }
    if (!contract.docusign_env_id) {
      return {
        contractId: contract.id,
        envelopeId: null,
        localStatus: contract.status,
        providerStatus: null,
        targetStatus: null,
        changed: false,
        hydratedSignedDocument: false,
      };
    }

    const provider = await docusignService.getEnvelopeStatus(contract.docusign_env_id);
    const normalized = normalizeProviderStatus(provider.status);
    if (!normalized) {
      return {
        contractId: contract.id,
        envelopeId: contract.docusign_env_id,
        localStatus: contract.status,
        providerStatus: provider.status,
        targetStatus: null,
        changed: false,
        hydratedSignedDocument: false,
        error: `Unsupported DocuSign status: ${provider.status}`,
      };
    }

    const targetStatus = DOCUSIGN_TO_HUB_STATUS[normalized];
    const needsSignedArtifacts =
      targetStatus === ContractStatus.SIGNED &&
      (!contract.signedAt ||
        !contract.signedS3Url ||
        !contract.signedS3UrlExpiresAt ||
        new Date(contract.signedS3UrlExpiresAt) <= new Date());

    if (targetStatus === ContractStatus.SIGNED) {
      await applySignedContractSync(contract, provider);
    } else if (targetStatus !== contract.status) {
      await applyNonSignedStatus(contract, targetStatus, provider);
    }

    await prisma.integrationLog.create({
      data: {
        service: "DOCUSIGN",
        action: "CONTRACT_SYNC",
        status: "SUCCESS",
        payload: {
          contractId: contract.id,
          envelopeId: contract.docusign_env_id,
          oldStatus: contract.status,
          newStatus: targetStatus,
          docusignStatus: provider.status,
        } as any,
      },
    });

    return {
      contractId: contract.id,
      envelopeId: contract.docusign_env_id,
      localStatus: contract.status,
      providerStatus: provider.status,
      targetStatus,
      changed: contract.status !== targetStatus || needsSignedArtifacts,
      hydratedSignedDocument: needsSignedArtifacts,
    };
  }

  async listContractsForSync() {
    const now = new Date();
    return prisma.contract.findMany({
      where: {
        docusign_env_id: { not: null },
        OR: [
          { status: { in: [ContractStatus.DRAFT, ContractStatus.SENT_FOR_SIGNATURE, ContractStatus.VIEWED] } },
          {
            status: ContractStatus.SIGNED,
            OR: [
              { signedAt: null },
              { signedS3Url: null },
              { signedS3UrlExpiresAt: null },
              { signedS3UrlExpiresAt: { lte: now } },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
  }

  async syncOpenContracts(): Promise<{
    total: number;
    synced: number;
    changed: number;
    errors: number;
    results: DocusignContractSyncResult[];
  }> {
    const contracts = await this.listContractsForSync();
    const results: DocusignContractSyncResult[] = [];
    let synced = 0;
    let changed = 0;
    let errors = 0;

    for (const contract of contracts) {
      try {
        const result = await this.syncContract(contract.id);
        results.push(result);
        synced++;
        if (result.changed) {
          changed++;
        }
      } catch (error) {
        errors++;
        results.push({
          contractId: contract.id,
          envelopeId: null,
          localStatus: ContractStatus.DRAFT,
          providerStatus: null,
          targetStatus: null,
          changed: false,
          hydratedSignedDocument: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      total: contracts.length,
      synced,
      changed,
      errors,
      results,
    };
  }

  async reconcileCompletedEnvelopesByEmail(options?: {
    fromDate?: Date;
    maxPages?: number;
    pageSize?: number;
    apply?: boolean;
  }): Promise<DocusignEmailReconciliationSummary> {
    const apply = options?.apply ?? false;
    const fromDate = options?.fromDate ?? new Date("2025-01-01T00:00:00.000Z");
    const maxPages = options?.maxPages ?? 10;
    const pageSize = options?.pageSize ?? 100;

    const customers = await prisma.customer.findMany({
      select: { id: true, name: true, email: true },
    });
    const customersByEmail = new Map(
      customers.map((customer) => [normalizeEmail(customer.email), customer])
    );

    const results: DocusignEmailReconciliationResult[] = [];
    let scannedEnvelopes = 0;
    let matchedCustomers = 0;
    let alreadyLinked = 0;
    let syncedExisting = 0;
    let linkedExisting = 0;
    let createdBackfill = 0;
    let skippedNoDeal = 0;
    let errors = 0;

    let nextUri: string | null = null;
    for (let page = 0; page < maxPages; page++) {
      const batch: Awaited<ReturnType<typeof docusignService.listEnvelopesByStatus>> = page === 0
        ? await docusignService.listEnvelopesByStatus({
            fromDate,
            status: "completed",
            count: pageSize,
          })
        : await docusignService.listEnvelopesByStatus({
            fromDate,
            status: "completed",
            count: pageSize,
            startPosition: Number(
              new URLSearchParams(nextUri?.split("?")[1] || "").get(
                "start_position"
              ) || "0"
            ),
          });

      scannedEnvelopes += batch.envelopes.length;
      nextUri = batch.nextUri;

      for (const envelope of batch.envelopes) {
        const recipients = await docusignService.getEnvelopeRecipients(
          envelope.envelopeId
        );

        const externalSigners = recipients.signers.filter((signer) => {
          const email = normalizeEmail(signer.email);
          return email && !isInternalDocuSignEmail(email);
        });

        for (const signer of externalSigners) {
          const customerEmail = normalizeEmail(signer.email);
          const customer = customersByEmail.get(customerEmail);
          if (!customer) {
            continue;
          }

          matchedCustomers++;

          try {
            const existing = await this.resolveExistingContractForEnvelope(
              customer.id,
              customerEmail,
              envelope.envelopeId
            );

            if (existing?.action === "already_linked") {
              alreadyLinked++;
              results.push({
                envelopeId: envelope.envelopeId,
                customerId: customer.id,
                customerEmail,
                customerName: customer.name,
                contractId: existing.contractId,
                action: "already_linked",
                changed: false,
              });
              continue;
            }

            let contractId = existing?.contractId || null;
            let action: EmailReconcileAction =
              existing?.action || "create_backfill_contract";

            if (!contractId && action === "create_backfill_contract") {
              contractId = await this.backfillContractForEnvelope({
                customerId: customer.id,
                customerName: customer.name,
                customerEmail,
                envelope,
                signerName: signer.name || customer.name,
              });

              if (!contractId) {
                skippedNoDeal++;
                results.push({
                  envelopeId: envelope.envelopeId,
                  customerId: customer.id,
                  customerEmail,
                  customerName: customer.name,
                  contractId: null,
                  action: "skip_no_deal",
                  changed: false,
                });
                continue;
              }
            }

            if (apply) {
              if (action === "link_existing_contract") {
                await prisma.contract.update({
                  where: { id: contractId! },
                  data: {
                    docusign_env_id: envelope.envelopeId,
                    signerEmail: customerEmail,
                    signerName: signer.name || customer.name,
                    sentAt: envelope.sentDateTime
                      ? new Date(envelope.sentDateTime)
                      : undefined,
                  },
                });
              }

              const applied = await this.applyCompletedEnvelopeToContract(
                contractId!,
                envelope
              );

              await prisma.integrationLog.create({
                data: {
                  service: "DOCUSIGN",
                  action: "CONTRACT_EMAIL_RECONCILE",
                  status: "SUCCESS",
                  payload: {
                    envelopeId: envelope.envelopeId,
                    contractId,
                    customerId: customer.id,
                    customerEmail,
                    action,
                    previousStatus: applied.previousStatus,
                    newStatus: ContractStatus.SIGNED,
                  } as any,
                },
              });

              if (action === "sync_existing_contract") {
                syncedExisting++;
              } else if (action === "link_existing_contract") {
                linkedExisting++;
              } else if (action === "create_backfill_contract") {
                createdBackfill++;
              }

              results.push({
                envelopeId: envelope.envelopeId,
                customerId: customer.id,
                customerEmail,
                customerName: customer.name,
                contractId,
                action,
                changed: applied.changed || action !== "sync_existing_contract",
              });
            } else {
              if (action === "sync_existing_contract") {
                syncedExisting++;
              } else if (action === "link_existing_contract") {
                linkedExisting++;
              } else if (action === "create_backfill_contract") {
                createdBackfill++;
              }

              results.push({
                envelopeId: envelope.envelopeId,
                customerId: customer.id,
                customerEmail,
                customerName: customer.name,
                contractId,
                action,
                changed: true,
              });
            }
          } catch (error) {
            errors++;
            results.push({
              envelopeId: envelope.envelopeId,
              customerId: customer.id,
              customerEmail,
              customerName: customer.name,
              contractId: null,
              action: "create_backfill_contract",
              changed: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      if (!nextUri) {
        break;
      }
    }

    return {
      scannedEnvelopes,
      matchedCustomers,
      alreadyLinked,
      syncedExisting,
      linkedExisting,
      createdBackfill,
      skippedNoDeal,
      errors,
      results,
    };
  }

  async syncAllContracts(options?: {
    fromDate?: Date;
    maxPages?: number;
    pageSize?: number;
  }) {
    const openContracts = await this.syncOpenContracts();
    const emailReconciliation = await this.reconcileCompletedEnvelopesByEmail({
      ...options,
      apply: true,
    });

    return {
      openContracts,
      emailReconciliation,
    };
  }
}

export const docusignContractSyncService = new DocusignContractSyncService();
